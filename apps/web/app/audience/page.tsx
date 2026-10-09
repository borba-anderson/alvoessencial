"use client"
import { useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRecords } from "@/hooks/use-records"
import { useDashboard } from "@/context/dashboard-context"
import { Button } from "@/components/ui/button"
import { PageHeading, EmptyState, Pagination, fieldClass, panelClass } from "@/components/dashboard/clinical-ui"
import { DataState, Field, Message } from "@/components/dashboard/data-ui"
import type { Patient } from "@/lib/domain"
import { normalizeText, formatWhatsApp } from "@/lib/clinic-data"
const emptyPatient = (): Patient => ({ id: crypto.randomUUID(), name: "", whatsappName: "", whatsappId: "", email: "", birthDate: "" })
export default function PatientsPage() {
  const { can } = useDashboard()
  const data = useRecords<Patient>("patients", can("patients"))
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<Patient | null>(null)
  const [message, setMessage] = useState("")
  const filtered = useMemo(() => data.records.filter(p => !p.archived && normalizeText([p.name, p.whatsappName, p.whatsappId].join(" ")).includes(normalizeText(query))), [data.records, query])
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    setMessage("")
    try { await data.save({ ...draft, name: draft.name.trim(), whatsappId: draft.whatsappId.replace(/\D/g, "") }); setDraft(null); setMessage("Cadastro salvo no banco.") }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar.") }
  }
  if (!can("patients")) return <p className="p-8">Seu perfil não tem acesso aos pacientes.</p>
  return <div className="p-4 md:p-8">
    <PageHeading title="Pacientes" description="Cadastro e histórico da clínica.">{can("patients", "create") && <Button disabled={data.loading || !!data.error} onClick={() => { setDraft(emptyPatient()); setMessage("") }}>Novo paciente</Button>}</PageHeading>
    <Message text={message} />
    {draft && <form onSubmit={save} className={panelClass + " mb-6 grid gap-4 md:grid-cols-2"}>
      <Field label="Nome completo"><input className={fieldClass} value={draft.name} required maxLength={200} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
      <Field label="WhatsApp com DDD e país"><input className={fieldClass} inputMode="tel" value={draft.whatsappId} maxLength={25} onChange={e => setDraft({ ...draft, whatsappId: e.target.value })} /></Field>
      <Field label="E-mail"><input className={fieldClass} type="email" value={draft.email || ""} onChange={e => setDraft({ ...draft, email: e.target.value })} /></Field>
      <Field label="Data de nascimento"><input className={fieldClass} type="date" value={draft.birthDate || ""} max={new Date().toISOString().slice(0, 10)} onChange={e => setDraft({ ...draft, birthDate: e.target.value })} /></Field>
      <div className="flex gap-3 md:col-span-2"><Button disabled={data.saving}>{data.saving ? "Salvando…" : "Salvar cadastro"}</Button><Button type="button" variant="outline" disabled={data.saving} onClick={() => setDraft(null)}>Cancelar</Button></div>
    </form>}
    <Field label="Buscar paciente"><input className={fieldClass + " mb-4"} value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Nome ou telefone" /></Field>
    <DataState loading={data.loading} error={data.error} retry={data.reload}>
      {!filtered.length ? <EmptyState>Nenhum paciente encontrado.</EmptyState> : <div className="divide-y rounded-xl border">
        {filtered.slice((page - 1) * 20, page * 20).map(patient => <article key={patient.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div><h2 className="font-medium">{patient.name || patient.whatsappName}</h2><p className="text-sm text-muted-foreground">{formatWhatsApp(patient.whatsappId || "")}</p></div>
          <div className="flex flex-wrap gap-2">
            {can("patients", "update") && <Button variant="outline" onClick={() => { setDraft({ ...emptyPatient(), ...patient }); setMessage("") }}>Editar</Button>}
            {can("records") && <Button asChild variant="outline"><Link href={"/assets?paciente=" + encodeURIComponent(patient.id)}>Prontuário</Link></Button>}
            {can("appointments", "create") && <Button asChild variant="outline"><Link href={"/architect?paciente=" + encodeURIComponent(patient.id)}>Agendar</Link></Button>}
            {!!patient.whatsappId && <Button asChild variant="outline"><a href={"https://wa.me/" + patient.whatsappId.replace(/\D/g, "")} target="_blank" rel="noreferrer">WhatsApp</a></Button>}
          </div>
        </article>)}
      </div>}
      <Pagination page={page} total={filtered.length} onChange={setPage} />
    </DataState>
  </div>
}
