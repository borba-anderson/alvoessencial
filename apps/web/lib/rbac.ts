import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { appendAuditEvent } from "@/lib/audit"
import { isSameOriginMutation } from "@/lib/security"

export type ModuleName = "auth" | "settings" | "patients" | "appointments" | "records" | "financial" | "crm" | "reports" | "lgpd" | "audit"
export type ActionName = "read" | "create" | "update" | "delete" | "finalize" | "addendum" | "refund" | "reconcile" | "export" | "anonymize" | "manage"
export type Permission = { module: ModuleName; action: ActionName }
export type AuthenticatedUser = { id: string; unitId: string; email: string; fullName: string; roles: string[]; permissions: Permission[] }
const roles: Record<string, string[]> = {
  admin: ["auth:manage","settings:read","settings:update","patients:read","patients:create","patients:update","patients:delete","appointments:read","appointments:create","appointments:update","appointments:delete","records:read","records:create","records:update","records:delete","records:finalize","records:addendum","financial:read","financial:create","financial:update","financial:delete","financial:refund","financial:reconcile","crm:read","crm:create","crm:update","crm:delete","reports:read","reports:export","lgpd:read","lgpd:export","lgpd:anonymize","audit:read"],
  recepcao: ["patients:read","patients:create","patients:update","appointments:read","appointments:create","appointments:update","crm:read","crm:create","crm:update"],
  profissional: ["patients:read","appointments:read","records:read","records:create","records:update","records:finalize","records:addendum"],
  financeiro: ["patients:read","financial:read","financial:create","financial:update","financial:refund","financial:reconcile","reports:read","reports:export"],
  auditoria: ["audit:read","reports:read","reports:export","lgpd:read","lgpd:export"],
}
export function permissionsForRole(role: string): Permission[] { return (roles[role] || []).map(value => { const [module, action] = value.split(":"); return { module: module as ModuleName, action: action as ActionName } }) }
export function hasPermission(user: AuthenticatedUser, module: ModuleName, action: ActionName) { return user.permissions.some(p => p.module === module && p.action === action) }
export async function requirePermission(request: NextRequest, module: ModuleName, action: ActionName, authenticate: (request: NextRequest) => Promise<AuthenticatedUser | null>) {
  if (!isSameOriginMutation(request)) return { user: null, response: NextResponse.json({ error: "Origem inválida" }, { status: 403 }) }
  const user = await authenticate(request)
  if (!user) return { user: null, response: NextResponse.json({ error: "Sessão obrigatória" }, { status: 401 }) }
  if (user.unitId !== (process.env.ALVO_UNIT_ID || "unit-main") || !hasPermission(user, module, action)) {
    await appendAuditEvent({ actorUserId: user.id, actorEmail: user.email, module, action, entityType: "permission", entityId: `${module}:${action}`, result: "denied", metadata: { reason: "permission_denied" } })
    return { user, response: NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 }) }
  }
  return { user, response: null }
}
