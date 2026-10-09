"use client"
import { useEffect, useState, type FormEvent } from "react"
import { useDashboard } from "@/context/dashboard-context"
import { useRecords } from "@/hooks/use-records"
import { Button } from "@/components/ui/button"
import { PageHeading, EmptyState, fieldClass, panelClass, downloadText, printText } from "@/components/dashboard/clinical-ui"
import { DataState, Field, Message, PatientSelect } from "@/components/dashboard/data-ui"
import type { Patient, Prescription } from "@/lib/domain"
import type { AttendanceRecord, ClinicalDocument, ClinicalEncounter } from "@/lib/clinic-data"
type ClinicalFile = { id: string; patientId: string; name: string; size: number; uploadedAt: string }
export default function RecordsPage() {
  const { can, user } = useDashboard()
  const patients = useRecords<Patient>("patients", can("patients"))
  const notes = useRecords<AttendanceRecord>("attendance", can("records"))
  const documents = useRecords<ClinicalDocument>("documents", can("records"))
  const encounters = useRecords<ClinicalEncounter & Partial<AttendanceRecord>>("encounters", can("records"))
  const prescriptions = useRecords<Prescription>("prescriptions", can("records"))
  const files = useRecords<ClinicalFile>("files", can("records"))
  const [selected, setSelected] = useState("")
  const [text, setText] = useState("")
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState("evolution")
  const [parent, setParent] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  useEffect(() => { setSelected(new URLSearchParams(window.location.search).get("paciente") || "") }, [])
  const patient = patients.records.find(p => p.id === selected)
  const fail = (e: unknown) => setMessage(e instanceof Error ? e.message : "Não foi possível concluir a operação.")
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!patient || !text.trim() || busy) return
    setBusy(true); setMessage("")
    try {
      if (kind === "prescription") {
        await prescriptions.save({ id: crypto.randomUUID(), patientId: selected, title: title.trim() || "Prescrição", content: text.trim(), professional: user.fullName, status: "final", createdAt: new Date().toISOString(), signedAt: new Date().toISOString(), ...(parent ? { parentId: parent } : {}) })
      } else {
        await notes.save({ id: crypto.randomUUID(), contactId: selected, type: kind === "addendum" ? "Adendo clínico" : "Evolução clínica", date: new Date().toISOString(), professional: user.fullName, summary: text.trim(), source: "prontuario" })
      }
      setText(""); setTitle(""); setParent(undefined); setMessage("Registro salvo no prontuário.")
    } catch(e) { fail(e) } finally { setBusy(false) }
  }
  const upload = async (file: File | undefined) => {
    if (!file || !patient || busy) return
    setBusy(true); setMessage("")
    try {
      const body = new FormData(); body.set("file",file); body.set("patientId",selected)
      const response = await fetch("/api/files", { method:"POST",body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Falha no envio.")
      await files.reload(); setMessage("Arquivo anexado ao prontuário.")
    } catch(e) { fail(e) } finally { setBusy(false) }
  }
  const downloadFile = async (file: ClinicalFile) => {
    try {
      const response = await fetch("/api/files?id=" + encodeURIComponent(file.id))
      if (!response.ok) throw new Error((await response.json()).error || "Falha no download.")
      const blob = await response.blob(); const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement("a"); anchor.href=url; anchor.download=file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000)
    } catch(e) { fail(e) }
  }
  if (!can("records")) return <p className="p-8">Seu perfil não tem acesso aos prontuários.</p>
  const history = [...notes.records, ...encounters.records.filter(e => typeof e.summary === "string") as AttendanceRecord[]].filter(n => n.contactId === selected)
  const patientDocuments = documents.records.filter(d => d.patientId === selected && typeof d.content === "string")
  const patientPrescriptions = prescriptions.records.filter(d => d.patientId === selected)
  return <div className="p-4 md:p-8"><PageHeading title="Prontuário e documentos" description="Histórico, evoluções, prescrições e arquivos vinculados ao paciente." />
    <PatientSelect patients={patients.records} value={selected} onChange={id => { setSelected(id); setText(""); setParent(undefined) }} />
    <Message text={message} />
    <DataState loading={[patients,notes,documents,encounters,prescriptions,files].some(d=>d.loading)} error={[patients,notes,documents,encounters,prescriptions,files].find(d=>d.error)?.error || null} retry={()=> { void patients.reload(); void notes.reload(); void documents.reload(); void encounters.reload(); void prescriptions.reload(); void files.reload() }}>
      {!patient ? <EmptyState>Selecione um paciente para consultar o prontuário.</EmptyState> : <div className="mt-6 space-y-6">
        <section className={panelClass}><h2 className="mb-4 text-lg font-semibold">{patient.name || patient.whatsappName}</h2>
          {can("records","create") && <form className="grid gap-4" onSubmit={save}>
            <Field label="Tipo de registro"><select className={fieldClass} value={kind} onChange={e=>setKind(e.target.value)}><option value="evolution">Evolução clínica</option>{can("records","addendum") && <option value="addendum">Adendo clínico</option>}{can("records","finalize") && <option value="prescription">Prescrição</option>}</select></Field>
            {kind==="prescription" && <Field label="Título"><input className={fieldClass} value={title} maxLength={200} onChange={e=>setTitle(e.target.value)} placeholder="Prescrição" /></Field>}
            <Field label={kind==="prescription" ? "Medicamentos, posologia e orientações do profissional" : "Registro clínico"}><textarea className={fieldClass} rows={6} required maxLength={30000} value={text} onChange={e=>setText(e.target.value)} /></Field>
            <p className="text-xs text-muted-foreground">Responsável: {user.fullName}. Prescrições finalizadas ficam preservadas; uma correção gera novo registro.</p>
            <div><Button disabled={busy || !text.trim()}>{busy ? "Salvando…" : "Salvar registro"}</Button></div>
          </form>}
        </section>
        <section className={panelClass}><h2 className="mb-4 font-semibold">Histórico e evoluções</h2>
          {!history.length ? <EmptyState>Nenhuma evolução registrada.</EmptyState> : <div className="space-y-4">{history.map(n=><article key={n.id} className="border-b pb-4"><p className="font-medium">{n.type}</p><p className="text-xs text-muted-foreground">{n.date} · {n.professional}</p><p className="mt-2 whitespace-pre-wrap text-sm">{n.summary}</p></article>)}</div>}
        </section>
        <section className={panelClass}><h2 className="mb-4 font-semibold">Documentos de atendimento e prescrições</h2>
          {!patientDocuments.length && !patientPrescriptions.length && <EmptyState>Nenhum documento registrado.</EmptyState>}
          {[...patientDocuments,...patientPrescriptions].map(d=> {
            const isPrescription = "professional" in d
            const content = isPrescription ? ["Paciente: "+patient.name,"Profissional: "+d.professional,"Data: "+new Date(d.createdAt).toLocaleString("pt-BR"),"",d.content,"","Assinatura do profissional: ____________________"].join("\n") : d.content
            return <article key={d.id} className="mb-4 rounded border p-4"><h3 className="font-medium">{d.title}</h3><details className="my-3"><summary className="cursor-pointer text-sm">Visualizar conteúdo</summary><pre className="mt-3 whitespace-pre-wrap text-sm">{content}</pre></details><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>downloadText(d.title+".txt",content)}>Baixar</Button><Button variant="outline" onClick={()=> { try { printText(d.title,content) } catch(e) { fail(e) } }}>Imprimir</Button>{isPrescription && can("records","finalize") && <Button variant="outline" onClick={()=> { setKind("prescription"); setTitle("Correção de "+d.title); setText(d.content); setParent(d.id); window.scrollTo({top:0,behavior:"smooth"}) }}>Registrar correção</Button>}</div></article>
          })}
        </section>
        <section className={panelClass}><h2 className="mb-4 font-semibold">Arquivos anexos</h2>
          {can("records","create") && <Field label="Anexar PDF, imagem, texto ou DOCX (até 10 MB)"><input className={fieldClass} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.docx" disabled={busy} onChange={e=> { void upload(e.target.files?.[0]); e.target.value="" }} /></Field>}
          <div className="mt-4 space-y-2">{files.records.filter(f=>f.patientId===selected).map(f=><div key={f.id} className="flex items-center justify-between gap-3 rounded border p-3"><span className="break-all text-sm">{f.name} · {Math.ceil(f.size/1024)} KB</span><Button variant="outline" onClick={()=>void downloadFile(f)}>Baixar</Button></div>)}</div>
        </section>
      </div>}
    </DataState>
  </div>
}
