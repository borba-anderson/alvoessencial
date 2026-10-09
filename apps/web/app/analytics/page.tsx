"use client"
import { useEffect, useState } from "react"
import { useDashboard } from "@/context/dashboard-context"
import { useRecords } from "@/hooks/use-records"
import { mutateRecords } from "@/lib/persistence"
import type { RecordValue } from "@/lib/collections"
import { buildClinicalDocument, generateEncounterFromAppointment, type ClinicalEncounter, type ClinicalAnamnesis, type ClinicalDocument } from "@/lib/clinic-data"
import { Button } from "@/components/ui/button"
import { PageHeading, EmptyState, fieldClass, panelClass, downloadText, printText } from "@/components/dashboard/clinical-ui"
import { DataState, Field, Message } from "@/components/dashboard/data-ui"
export default function ClinicalPage() {
  const { campaigns, can, user } = useDashboard()
  const encounters = useRecords<ClinicalEncounter>("encounters", can("records"))
  const documents = useRecords<ClinicalDocument>("documents", can("records"))
  const [selected, setSelected] = useState("")
  const [draft, setDraft] = useState<ClinicalAnamnesis | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  useEffect(() => { setSelected(new URLSearchParams(window.location.search).get("agendamento") || "") }, [])
  const appointment = campaigns.find(c => c.id === selected)
  const existing = encounters.records.find(e => e.appointmentId === selected && e.patientId)
  const finalDocument = documents.records.find(d => d.appointmentId === selected && d.status === "final")
  const choose = (id: string) => { setSelected(id); setDraft(null); setMessage("") }
  const startDraft = () => {
    if (!appointment?.patientId) { setMessage("Vincule este agendamento a um paciente em Agenda antes de atender."); return }
    const encounter = existing || generateEncounterFromAppointment(appointment, appointment.patientId)
    setDraft({ ...encounter.anamnese!, professional: user.fullName, startedAt: encounter.startedAt || new Date().toISOString() })
  }
  const save = async (finalize: boolean) => {
    if (!appointment?.patientId || !draft || busy) return
    if (finalize && !draft.chiefComplaint.trim()) { setMessage("Informe a queixa principal antes de finalizar."); return }
    setBusy(true); setMessage("")
    const now = new Date().toISOString()
    const encounter: ClinicalEncounter = { ...(existing || generateEncounterFromAppointment(appointment, appointment.patientId)), patientId: appointment.patientId, professional: user.fullName, startedAt: existing?.startedAt || now, completedAt: finalize ? now : undefined, status: finalize ? "concluido" : "em_atendimento", updatedAt: now, anamnese: { ...draft, updatedAt: now, status: finalize ? "completed" : "in_progress" } }
    try {
      if (finalize) {
        const document = buildClinicalDocument(encounter, appointment.patient || encounter.patientName)
        document.id = crypto.randomUUID()
        document.generatedAt = now
        const beforeAppointment = JSON.parse(JSON.stringify({ ...appointment, startDate: appointment.startDate?.toISOString(), endDate: appointment.endDate?.toISOString() }))
        await mutateRecords([
          { collection: "encounters", id: encounter.id, before: (existing || null) as unknown as RecordValue | null, after: JSON.parse(JSON.stringify(encounter)) },
          { collection: "documents", id: document.id, before: null, after: document as unknown as RecordValue },
          { collection: "appointments", id: appointment.id, before: beforeAppointment, after: { ...beforeAppointment, status: "concluido", lastUpdated: now, history: [...(appointment.history || []), now + " · Finalizado por " + user.fullName] } },
        ])
        setDraft(null); setMessage("Atendimento finalizado. Documento e agenda salvos na mesma transação.")
      } else { await encounters.save(encounter); setDraft(null); setMessage("Rascunho salvo no prontuário.") }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao salvar. O texto foi preservado nesta tela.") }
    finally { setBusy(false) }
  }
  if (!can("records")) return <p className="p-8">Seu perfil não tem acesso aos atendimentos clínicos.</p>
  return <div className="p-4 md:p-8"><PageHeading title="Atendimentos" description="Anamnese, evolução e conclusão do atendimento." />
    <Field label="Agendamento"><select className={fieldClass + " mb-5"} value={selected} disabled={busy} onChange={e => { if (!draft || window.confirm("Trocar de atendimento e descartar o texto não salvo?")) choose(e.target.value) }}><option value="">Selecione um agendamento</option>{campaigns.filter(c => !["cancelado","faltou"].includes(c.status)).map(c => <option key={c.id} value={c.id}>{c.patient} · {c.startDate?.toLocaleString("pt-BR") || "Sem data"}</option>)}</select></Field>
    <Message text={message} />
    <DataState loading={encounters.loading || documents.loading} error={encounters.error || documents.error} retry={() => { void encounters.reload(); void documents.reload() }}>
      {!appointment ? <EmptyState>Selecione um agendamento para iniciar ou continuar o atendimento.</EmptyState> : <section className={panelClass}>
        <h2 className="text-lg font-semibold">{appointment.patient}</h2><p className="mb-4 text-sm text-muted-foreground">{appointment.service} · {existing?.status === "concluido" ? "Concluído" : "Em preparação"}</p>
        {existing?.status === "concluido" ? <>
          <p className="mb-4 text-sm">Registro finalizado em {existing.completedAt ? new Date(existing.completedAt).toLocaleString("pt-BR") : "data não registrada"}. Alterações posteriores devem ser registradas como adendo no prontuário.</p>
          {finalDocument && <><pre className="mb-4 whitespace-pre-wrap rounded bg-muted p-4 text-sm">{finalDocument.content}</pre><div className="flex gap-3"><Button variant="outline" onClick={() => downloadText(finalDocument.title + ".txt", finalDocument.content)}>Baixar documento</Button><Button variant="outline" onClick={() => { try { printText(finalDocument.title, finalDocument.content) } catch (e) { setMessage((e as Error).message) } }}>Imprimir</Button></div></>}
        </> : !draft ? <>{existing?.anamnese && <p className="mb-4 text-sm">Último rascunho: {new Date(existing.updatedAt).toLocaleString("pt-BR")}</p>}{can("records", existing ? "update" : "create") && <Button onClick={startDraft}>{existing ? "Continuar anamnese" : "Iniciar anamnese"}</Button>}</> : <div className="space-y-4">
          {(["chiefComplaint","history","allergies","medications","observations"] as const).map((key,index) => <Field key={key} label={["Queixa principal","Histórico","Alergias","Medicamentos em uso","Observações e conduta"][index]}><textarea className={fieldClass} rows={4} maxLength={20000} value={draft[key]} disabled={busy} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></Field>)}
          <div className="flex flex-wrap gap-3"><Button disabled={busy} variant="outline" onClick={() => void save(false)}>{busy ? "Salvando…" : "Salvar rascunho"}</Button>{can("records","finalize") && <Button disabled={busy} onClick={() => { if (window.confirm("Finalizar o atendimento? O registro final não poderá ser editado.")) void save(true) }}>Finalizar atendimento</Button>}</div>
        </div>}
      </section>}
    </DataState>
  </div>
}
