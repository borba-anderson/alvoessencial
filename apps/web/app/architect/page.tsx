"use client"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { useDashboard, type Campaign, type CampaignStatus } from "@/context/dashboard-context"
import { useRecords } from "@/hooks/use-records"
import { Button } from "@/components/ui/button"
import { PageHeading, EmptyState, Pagination, fieldClass, panelClass } from "@/components/dashboard/clinical-ui"
import { DataState, Field, Message, PatientSelect } from "@/components/dashboard/data-ui"
import { todayISO, currency, type Patient } from "@/lib/domain"
const labels: Record<CampaignStatus, string> = { agendado: "Agendado", aguardando_confirmacao: "Aguardando confirmação", confirmado: "Confirmado", paciente_chegou: "Na recepção", em_atendimento: "Em atendimento", concluido: "Concluído", faltou: "Faltou", cancelado: "Cancelado" }
type Draft = { id?: string; patientId: string; date: string; time: string; professional: string; service: string; duration: number; value: string; note: string }
export default function AgendaPage() {
  const { campaigns, user, can, isLoading, persistenceError, refreshMetrics, addCampaign, updateCampaign } = useDashboard()
  const patients = useRecords<Patient>("patients", can("patients"))
  const [day, setDay] = useState(todayISO)
  const [all, setAll] = useState(false)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const blank = (): Draft => ({ patientId: "", date: day, time: "09:00", professional: user.fullName, service: "", duration: 60, value: "", note: "" })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("paciente"); if (id) setDraft({ patientId: id, date: todayISO(), time: "09:00", professional: user.fullName, service: "", duration: 60, value: "", note: "" }) }, [user.fullName])
  const visible = useMemo(() => campaigns.filter(c => (all || (!!c.startDate && c.startDate.toLocaleDateString("sv-SE") === day)) && (!status || c.status === status) && [c.patient, c.channel, c.service].join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))).sort((a,b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0)), [campaigns, all, day, status, query])
  const act = async (action: () => Promise<void>, success: string) => { setBusy(true); setMessage(""); try { await action(); setMessage(success) } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao salvar.") } finally { setBusy(false) } }
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!draft) return
    const patient = patients.records.find(p => p.id === draft.patientId)
    const startDate = new Date(draft.date + "T" + draft.time)
    const amount = Number(draft.value || 0)
    if (!patient || !Number.isFinite(startDate.getTime()) || !Number.isFinite(amount) || amount < 0) { setMessage("Confira paciente, data e valor."); return }
    const endDate = new Date(startDate.getTime() + draft.duration * 60000)
    if (campaigns.some(c => c.id !== draft.id && !["cancelado", "faltou"].includes(c.status) && c.channel.trim().toLowerCase() === draft.professional.trim().toLowerCase() && c.startDate && c.startDate < endDate && new Date(c.startDate.getTime() + (c.duration || 60) * 60000) > startDate)) { setMessage("O profissional já tem um compromisso neste horário."); return }
    const record: Omit<Campaign, "id"> = { name: patient.name + " · " + draft.service.trim(), patient: patient.name, patientId: patient.id, phone: patient.whatsappId, channel: draft.professional.trim(), service: draft.service.trim(), startDate, endDate, duration: draft.duration, spend: amount, impressions: 0, status: "agendado", note: draft.note.trim(), history: [new Date().toLocaleString("pt-BR") + " · " + (draft.id ? "Reagendado" : "Agendado") + " por " + user.fullName], lastUpdated: new Date().toISOString() }
    await act(async () => { if (draft.id) await updateCampaign(draft.id, record); else await addCampaign(record); setDraft(null) }, "Agendamento salvo.")
  }
  const transition = (c: Campaign, next: CampaignStatus) => act(() => updateCampaign(c.id, { status: next, history: [...(c.history || []), new Date().toLocaleString("pt-BR") + " · " + labels[next] + " por " + user.fullName] }), "Situação atualizada.")
  if (!can("appointments")) return <p className="p-8">Seu perfil não tem acesso à agenda.</p>
  return <div className="p-4 md:p-8"><PageHeading title="Agenda e recepção" description="Agendamentos, confirmação e chegada dos pacientes.">{can("appointments","create") && <Button disabled={isLoading || !!persistenceError} onClick={() => setDraft(blank())}>Novo agendamento</Button>}</PageHeading>
    <Message text={message} />
    {draft && <form className={panelClass + " mb-6 grid gap-4 md:grid-cols-2"} onSubmit={save}>
      <PatientSelect patients={patients.records} value={draft.patientId} onChange={patientId => setDraft({ ...draft, patientId })} />
      <Field label="Profissional responsável"><input required maxLength={150} className={fieldClass} value={draft.professional} onChange={e => setDraft({ ...draft, professional: e.target.value })} /></Field>
      <Field label="Serviço"><input required maxLength={150} className={fieldClass} value={draft.service} onChange={e => setDraft({ ...draft, service: e.target.value })} /></Field>
      <Field label="Data"><input required type="date" className={fieldClass} value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></Field>
      <Field label="Horário"><input required type="time" className={fieldClass} value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></Field>
      <Field label="Duração em minutos"><input required type="number" min={5} max={720} className={fieldClass} value={draft.duration} onChange={e => setDraft({ ...draft, duration: Number(e.target.value) })} /></Field>
      <Field label="Valor previsto (R$)"><input type="number" min={0} step="0.01" className={fieldClass} value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} /></Field>
      <Field label="Observação administrativa"><input maxLength={1000} className={fieldClass} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></Field>
      <div className="flex gap-3"><Button disabled={busy || patients.loading || !!patients.error}>{busy ? "Salvando…" : "Salvar"}</Button><Button variant="outline" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancelar edição</Button></div>
      {patients.error && <Message text={patients.error} />}
    </form>}
    <div className="mb-6 grid items-end gap-4 md:grid-cols-4">
      <Field label="Data"><input className={fieldClass} type="date" value={day} onChange={e => { setDay(e.target.value); setPage(1) }} /></Field>
      <Field label="Busca"><input className={fieldClass} value={query} placeholder="Paciente, profissional ou serviço" onChange={e => { setQuery(e.target.value); setPage(1) }} /></Field>
      <Field label="Situação"><select className={fieldClass} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">Todas</option>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <label className="flex items-center gap-2 py-3 text-sm"><input type="checkbox" checked={all} onChange={e => { setAll(e.target.checked); setPage(1) }} />Todas as datas</label>
    </div>
    <DataState loading={isLoading} error={persistenceError} retry={refreshMetrics}>
      {!visible.length && <EmptyState>Nenhum agendamento encontrado.</EmptyState>}
      <div className="space-y-3">{visible.slice((page-1)*20,page*20).map(c => <article key={c.id} className={panelClass}>
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{c.patient}</h2><p className="mt-1 text-sm">{c.startDate?.toLocaleString("pt-BR") || "Data não informada"} · {c.duration || "—"} min · {c.channel}</p><p className="text-sm text-muted-foreground">{c.service} · {currency(c.spend || 0)}</p></div><span className="text-sm font-medium">{labels[c.status] || c.status}</span></div>
        {c.note && <p className="my-3 text-sm">{c.note}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {can("appointments","update") && !["concluido","cancelado","faltou"].includes(c.status) && <>
            {["agendado","aguardando_confirmacao"].includes(c.status) && <Button variant="outline" disabled={busy} onClick={() => void transition(c,"confirmado")}>Confirmar</Button>}
            {["agendado","confirmado","aguardando_confirmacao"].includes(c.status) && <Button variant="outline" disabled={busy} onClick={() => void transition(c,"paciente_chegou")}>Registrar chegada</Button>}
            <Button variant="outline" disabled={busy} onClick={() => setDraft({ id:c.id,patientId:c.patientId || "",date:c.startDate?.toLocaleDateString("sv-SE") || day,time:c.startDate?.toTimeString().slice(0,5) || "09:00",professional:c.channel,service:c.service || "",duration:c.duration || 60,value:String(c.spend || 0),note:c.note || "" })}>Remarcar</Button>
            <Button variant="outline" disabled={busy} onClick={() => void transition(c,"faltou")}>Marcar falta</Button>
            <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Cancelar este agendamento?")) void transition(c,"cancelado") }}>Cancelar</Button>
          </>}
          {can("records") && <Button asChild variant="outline"><Link href={"/analytics?agendamento=" + encodeURIComponent(c.id)}>Atendimento</Link></Button>}
        </div>
      </article>)}</div>
      <Pagination page={page} total={visible.length} onChange={setPage} />
    </DataState>
  </div>
}
