import type { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { appendAuditEvent } from "@/lib/audit"
import { remoteInsert, remoteRows, remoteUpdate, type RemoteUser } from "@/lib/access-store"
import type { AuthenticatedUser } from "@/lib/rbac"
import { permissionsForRole } from "@/lib/rbac"
import { supabaseAuthSignInWithPassword } from "@/lib/supabase"
import { hashRequestValue, newId, normalizeEmail, randomToken, sha256 } from "@/lib/security"

export const SESSION_COOKIE = "alvo_essencial_session"
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
export type RequestIdentity = { ipHash: string | null; userAgentHash: string | null }
export function getRequestIdentity(request: NextRequest): RequestIdentity { const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"); return { ipHash: hashRequestValue(forwarded), userAgentHash: hashRequestValue(request.headers.get("user-agent")) } }

export async function authenticateRequest(request: NextRequest) { const token = request.cookies.get(SESSION_COOKIE)?.value; return token && token.length <= 256 ? getUserBySessionToken(token) : null }
export async function authenticateCookieStore() { const token = (await cookies()).get(SESSION_COOKIE)?.value; return token ? getUserBySessionToken(token) : null }

export async function loginWithPassword(request: NextRequest, emailInput: string, password: string) {
  const email = normalizeEmail(emailInput), identity = getRequestIdentity(request), now = new Date(), since = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
  const attempts = await remoteRows<{ id: string }>(`alvo_login_attempts?select=id&attempted_at=gt.${encodeURIComponent(since)}&or=(email_hash.eq.${sha256(email)},ip_hash.eq.${identity.ipHash || ""})`)
  if (attempts.length >= 10) throw new Error("Muitas tentativas. Aguarde 15 minutos.")
  await remoteInsert("alvo_login_attempts", { id: newId("attempt"), email_hash: sha256(email), ip_hash: identity.ipHash, attempted_at: now.toISOString() })
  const user = (await remoteRows<RemoteUser>(`alvo_users?select=*&email=eq.${encodeURIComponent(email)}&limit=1`))[0]
  const supabaseUser = await supabaseAuthSignInWithPassword(email, password)
  if (!user || user.status !== "active" || user.unit_id !== (process.env.ALVO_UNIT_ID || "unit-main") || !supabaseUser || normalizeEmail(supabaseUser.email) !== email) {
    if (user) await remoteUpdate(`alvo_users?id=eq.${encodeURIComponent(user.id)}`, { failed_login_attempts: 1, updated_at: now.toISOString() })
    await appendAuditEvent({ actorEmail: email, module: "auth", action: "read", entityType: "session", result: "failure", ipHash: identity.ipHash, userAgentHash: identity.userAgentHash, metadata: { reason: "invalid_credentials", source: "supabase" } })
    return null
  }
  const role = (await remoteRows<{ role: string }>(`alvo_user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`))[0]?.role
  if (!role) return null
  const token = randomToken(), sessionId = newId("ses"), expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
  await remoteInsert("alvo_sessions", { id: sessionId, user_id: user.id, token_hash: sha256(token), ip_hash: identity.ipHash, user_agent_hash: identity.userAgentHash, created_at: now.toISOString(), expires_at: expiresAt.toISOString(), last_seen_at: now.toISOString() })
  await remoteUpdate(`alvo_users?id=eq.${encodeURIComponent(user.id)}`, { failed_login_attempts: 0, last_login_at: now.toISOString(), updated_at: now.toISOString() })
  await appendAuditEvent({ actorUserId: user.id, actorEmail: user.email, module: "auth", action: "read", entityType: "session", entityId: sessionId, result: "success", ipHash: identity.ipHash, userAgentHash: identity.userAgentHash, metadata: { source: "supabase" } })
  return { token, expiresAt, user: toAuthenticatedUser(user, role) }
}
export function applySessionCookie(response: NextResponse, token: string, expiresAt: Date, remember = true) { response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", ...(remember ? { expires: expiresAt } : {}) }) }
export function clearSessionCookie(response: NextResponse) { response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 }) }
export async function revokeSession(request: NextRequest, user: AuthenticatedUser | null) { const token = request.cookies.get(SESSION_COOKIE)?.value; if (!token) return; await remoteUpdate(`alvo_sessions?token_hash=eq.${sha256(token)}&revoked_at=is.null`, { revoked_at: new Date().toISOString() }); if (user) await appendAuditEvent({ actorUserId: user.id, actorEmail: user.email, module: "auth", action: "read", entityType: "session", result: "success", ...getRequestIdentity(request), metadata: { operation: "logout" } }) }
async function getUserBySessionToken(token: string): Promise<AuthenticatedUser | null> {
  const session = (await remoteRows<{ id: string; user_id: string }>(`alvo_sessions?select=id,user_id&token_hash=eq.${sha256(token)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`))[0]
  if (!session) return null
  const user = (await remoteRows<RemoteUser>(`alvo_users?select=*&id=eq.${encodeURIComponent(session.user_id)}&limit=1`))[0]
  const role = user && (await remoteRows<{ role: string }>(`alvo_user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&limit=1`))[0]?.role
  if (!user || !role || user.status !== "active" || user.unit_id !== (process.env.ALVO_UNIT_ID || "unit-main")) return null
  await remoteUpdate(`alvo_sessions?id=eq.${encodeURIComponent(session.id)}`, { last_seen_at: new Date().toISOString() })
  return toAuthenticatedUser(user, role)
}
function toAuthenticatedUser(user: RemoteUser, role: string): AuthenticatedUser { return { id: user.id, unitId: user.unit_id, email: user.email, fullName: user.full_name, roles: [role], permissions: permissionsForRole(role) } }
