import { remoteInsert, remoteRows } from "@/lib/access-store"
import { newId, sha256 } from "@/lib/security"

export type AuditResult = "success" | "denied" | "failure"
export type AuditEventInput = { actorUserId?: string | null; actorEmail?: string | null; module: string; action: string; entityType: string; entityId?: string | null; result: AuditResult; ipHash?: string | null; userAgentHash?: string | null; metadata?: Record<string, unknown> }

export async function appendAuditEvent(input: AuditEventInput) {
  const previous = await remoteRows<{ event_hash: string }>("alvo_audit_events?select=event_hash&order=occurred_at.desc,id.desc&limit=1")
  const id = newId("aud"), occurredAt = new Date().toISOString(), metadataJson = input.metadata || {}, previousHash = previous[0]?.event_hash || null
  const eventHash = sha256(JSON.stringify({ id, occurredAt, actorUserId: input.actorUserId || null, actorEmail: input.actorEmail || null, module: input.module, action: input.action, entityType: input.entityType, entityId: input.entityId || null, result: input.result, ipHash: input.ipHash || null, userAgentHash: input.userAgentHash || null, metadataJson, previousHash }))
  await remoteInsert("alvo_audit_events", { id, occurred_at: occurredAt, actor_user_id: input.actorUserId || null, actor_email: input.actorEmail || null, module: input.module, action: input.action, entity_type: input.entityType, entity_id: input.entityId || null, result: input.result, ip_hash: input.ipHash || null, user_agent_hash: input.userAgentHash || null, metadata_json: metadataJson, previous_hash: previousHash, event_hash: eventHash })
  return { id, eventHash, previousHash }
}
