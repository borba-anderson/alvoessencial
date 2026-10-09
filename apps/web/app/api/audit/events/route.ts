import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth"
import { remoteRows } from "@/lib/access-store"
import { requirePermission } from "@/lib/rbac"
export async function GET(request: NextRequest) {
  const permission = await requirePermission(request, "audit", "read", authenticateRequest)
  if (permission.response) return permission.response
  const limit = Number(request.nextUrl.searchParams.get("limit") || 50)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ error: "Limite inválido" }, { status: 400 })
  const events = await remoteRows(`alvo_audit_events?select=id,occurredAt:occurred_at,actorUserId:actor_user_id,actorEmail:actor_email,module,action,entityType:entity_type,entityId:entity_id,result,metadataJson:metadata_json,previousHash:previous_hash,eventHash:event_hash&order=occurred_at.desc,id.desc&limit=${limit}`)
  return NextResponse.json({ events })
}
