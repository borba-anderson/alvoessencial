import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authenticateRequest, getRequestIdentity } from "@/lib/auth"
import { appendAuditEvent } from "@/lib/audit"
import { hasPermission, requirePermission, type ActionName } from "@/lib/rbac"
import { collectionModules, isCollection, stableJSON, type RecordChange, type RecordValue } from "@/lib/collections"
import { getSupabaseConfig, supabaseRest, SupabaseError, type AppRecord } from "@/lib/supabase"

const jsonRecord = z.object({ id: z.string().trim().min(1).max(160) }).passthrough()
const changeSchema = z.object({ collection: z.string().refine(isCollection), id: z.string().min(1).max(160), before: jsonRecord.nullable(), after: jsonRecord.nullable() })
const changesSchema = z.object({ changes: z.array(changeSchema).min(1).max(100) })
const stateKey = () => process.env.SUPABASE_STATE_KEY || "clinic-main"
const filter = (collection: string, id?: string) => "app_records?state_key=eq." + encodeURIComponent(stateKey()) + "&collection=eq." + encodeURIComponent(collection) + (id ? "&record_id=eq." + encodeURIComponent(id) : "")
const rowValue = (row: AppRecord) => ({ ...row.payload, id: row.record_id }) as RecordValue
const responseError = (error: unknown) => {
  if (error instanceof SupabaseError) {
    if (error.code === "23P01") return NextResponse.json({ error: "O profissional já tem um compromisso neste horário." }, { status: 409 })
    if (error.code === "23514" || error.code === "23503") return NextResponse.json({ error: "A operação viola a integridade do prontuário ou referencia um cadastro inexistente." }, { status: 422 })
    if (["23505", "40001", "P0001"].includes(error.code)) return NextResponse.json({ error: "O registro foi alterado por outra sessão. Recarregue antes de salvar." }, { status: 409 })
    if (error.code === "PGRST202") return NextResponse.json({ error: "A migração de transações do banco ainda não foi aplicada. Nenhuma alteração desta operação foi salva." }, { status: 503 })
  }
  console.error("app-records: operação indisponível", error instanceof SupabaseError ? error.code : "INTERNAL")
  return NextResponse.json({ error: "Não foi possível concluir a operação no banco. Tente novamente." }, { status: 503 })
}

export async function GET(request: NextRequest) {
  try {
    const collection = request.nextUrl.searchParams.get("collection") || ""
    if (!isCollection(collection)) return NextResponse.json({ error: "Informe uma coleção válida." }, { status: 400 })
    const permission = await requirePermission(request, collectionModules[collection], "read", authenticateRequest)
    if (permission.response) return permission.response
    if (!getSupabaseConfig().enabled) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 })
    const rows: AppRecord[] = []
    // PostgREST applies a row limit. Explicit pages prevent silent truncation.
    for (let offset = 0; ; offset += 500) {
      const page = await supabaseRest<AppRecord[]>(filter(collection) + "&select=state_key,collection,record_id,payload,updated_at&order=record_id.asc&limit=500&offset=" + offset)
      rows.push(...page)
      if (page.length < 500) break
      if (rows.length >= 10000) return NextResponse.json({ error: "A coleção excede o limite de consulta. Solicite uma exportação administrativa." }, { status: 422 })
    }
    const identity = getRequestIdentity(request)
    appendAuditEvent({ actorUserId: permission.user!.id, actorEmail: permission.user!.email, module: collectionModules[collection], action: "read", entityType: "app_records", entityId: collection, result: "success", ...identity, metadata: { count: rows.length } })
    return NextResponse.json({ enabled: true, collection, records: rows.map(rowValue), updatedAt: rows.map(row => row.updated_at).filter(Boolean).sort().at(-1) || null })
  } catch (error) { return responseError(error) }
}

function validateRecord(change: RecordChange): string | null {
  const { collection, id, before, after } = change
  if ((!before && !after) || (before && before.id !== id) || (after && after.id !== id)) return "Identificadores inconsistentes."
  if (before && ["concluido", "final"].includes(String(before.status)) && ["encounters", "documents", "prescriptions"].includes(collection)) return "Documentos finalizados são imutáveis. Registre um adendo."
  if (collection === "files") return "Use o envio de arquivos para registrar anexos."
  if (!after) return "Use cancelamento ou arquivamento para preservar o histórico."
  const text = (key: string) => typeof after[key] === "string" && String(after[key]).trim().length > 0
  if (collection === "patients" && !text("name") && !text("whatsappName")) return "Informe o nome do paciente."
  if (collection === "appointments") {
    if (!text("patient") || !text("channel") || !text("service") || !text("startDate") || !Number.isFinite(Date.parse(String(after.startDate)))) return "Paciente, profissional, serviço e data válidos são obrigatórios."
    if (typeof after.duration !== "number" || after.duration < 5 || after.duration > 720) return "Duração inválida."
    if (!["agendado", "aguardando_confirmacao", "confirmado", "paciente_chegou", "em_atendimento", "concluido", "faltou", "cancelado"].includes(String(after.status))) return "Situação inválida."
  }
  if (collection === "billing_entries" && (!text("description") || !text("patientId") || !text("dueDate") || !/^\d{4}-\d{2}-\d{2}$/.test(String(after.dueDate)) || typeof after.amount !== "number" || !Number.isFinite(after.amount) || after.amount <= 0 || after.amount > 1000000 || !["pending", "paid", "cancelled"].includes(String(after.status)))) return "Paciente, descrição, vencimento, valor positivo e situação são obrigatórios."
  if (collection === "billing_entries" && before?.status === "cancelled") return "Lançamentos cancelados ficam preservados. Crie um novo lançamento."
  if (collection === "billing_entries" && before?.status === "paid" && (after.status !== "cancelled" || after.amount !== before.amount || after.patientId !== before.patientId)) return "Um recebimento só pode ser estornado, preservando o valor e o paciente."
  if (collection === "clinic_settings" && (!text("name") || !text("timezone"))) return "Informe o nome e fuso da clínica."
  if (["documents", "prescriptions"].includes(collection) && (!text("patientId") || !text("title") || !text("content"))) return "Paciente, título e conteúdo são obrigatórios."
  if (collection === "attendance" && (!text("contactId") || !text("summary") || !text("professional"))) return "Paciente, profissional e registro são obrigatórios."
  if (collection === "encounters" && (!text("patientId") || !text("appointmentId") || !text("professional"))) return "Atendimento sem paciente, agenda ou profissional."
  if (["leads", "returns"].includes(collection) && !text("name")) return "Informe o nome."
  return null
}

export async function PATCH(request: NextRequest) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 2000000) return NextResponse.json({ error: "Operação muito grande." }, { status: 413 })
    const raw = await request.text()
    if (raw.length > 2000000) return NextResponse.json({ error: "Operação muito grande." }, { status: 413 })
    let body: unknown
    try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }) }
    const parsed = changesSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Alterações inválidas." }, { status: 400 })
    const changes = parsed.data.changes as RecordChange[]
    if (new Set(changes.map(item => item.collection + ":" + item.id)).size !== changes.length) return NextResponse.json({ error: "Registros duplicados na operação." }, { status: 400 })
    let actor: Awaited<ReturnType<typeof authenticateRequest>> = null
    for (const change of changes) {
      const action: ActionName = change.collection === "clinic_settings" ? "manage" : !change.before ? "create" : !change.after ? "delete" : "update"
      const permission = await requirePermission(request, collectionModules[change.collection], action, authenticateRequest)
      if (permission.response) return permission.response
      actor = permission.user
      if (change.collection === "billing_entries" && change.before?.status === "paid" && !hasPermission(actor!, "financial", "refund")) return NextResponse.json({ error: "Permissão de estorno obrigatória." }, { status: 403 })
      if (["encounters", "documents", "prescriptions"].includes(change.collection) && ["final", "concluido"].includes(String(change.after?.status)) && !hasPermission(actor!, "records", "finalize")) return NextResponse.json({ error: "Permissão para finalizar obrigatória." }, { status: 403 })
      const error = validateRecord(change)
      if (error) return NextResponse.json({ error }, { status: 422 })
      const patientId = change.after?.patientId || change.after?.contactId
      if (patientId && change.collection !== "patients") {
        const included = changes.some(c => c.collection === "patients" && c.id === patientId && c.after)
        if (!included) {
          const patients = await supabaseRest<AppRecord[]>(filter("patients", String(patientId)) + "&select=record_id")
          if (!patients.length) return NextResponse.json({ error: "Paciente não encontrado nesta clínica." }, { status: 422 })
        }
      }
    }
    if (!getSupabaseConfig().enabled) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 })
    const identity = getRequestIdentity(request)
    // Audit intent before contacting the remote service: fail closed if audit is unavailable.
    appendAuditEvent({ actorUserId: actor!.id, actorEmail: actor!.email, module: "records", action: "update", entityType: "mutation_request", result: "success", ...identity, metadata: { changes: changes.map(c => ({ collection: c.collection, id: c.id })) } })
    if (changes.length === 1) {
      const change = changes[0]
      const existing = await supabaseRest<AppRecord[]>(filter(change.collection, change.id) + "&select=state_key,collection,record_id,payload,updated_at")
      const row = existing[0]
      if (stableJSON(row ? rowValue(row) : null) !== stableJSON(change.before)) return NextResponse.json({ error: "Este registro mudou. Recarregue os dados antes de salvar." }, { status: 409 })
      if (!row) {
        await supabaseRest("app_records", { method: "POST", body: JSON.stringify({ state_key: stateKey(), collection: change.collection, record_id: change.id, payload: change.after }) })
      } else {
        const changed = await supabaseRest<AppRecord[]>(filter(change.collection, change.id) + "&updated_at=eq." + encodeURIComponent(row.updated_at!), {
          method: change.after ? "PATCH" : "DELETE",
          headers: { Prefer: "return=representation" },
          ...(change.after ? { body: JSON.stringify({ payload: change.after }) } : {}),
        })
        if (changed.length !== 1) return NextResponse.json({ error: "Este registro mudou. Recarregue os dados antes de salvar." }, { status: 409 })
      }
    } else {
      await supabaseRest("rpc/mutate_app_records", { method: "POST", body: JSON.stringify({ p_state_key: stateKey(), p_changes: changes }) })
    }
    appendAuditEvent({ actorUserId: actor!.id, actorEmail: actor!.email, module: "records", action: "update", entityType: "mutation_committed", result: "success", ...identity, metadata: { count: changes.length } })
    return NextResponse.json({ enabled: true, count: changes.length, updatedAt: new Date().toISOString() })
  } catch (error) { return responseError(error) }
}

export async function PUT() {
  return NextResponse.json({ error: "Substituição integral desativada. Atualize a aplicação para salvar registros individualmente." }, { status: 405 })
}
