"use client"
import { useState, type FormEvent } from "react"
import { useRecords } from "@/hooks/use-records"
import { useDashboard } from "@/context/dashboard-context"
import { Button } from "@/components/ui/button"
import { PageHeading, EmptyState, Pagination, fieldClass, panelClass, downloadText, csvCell } from "@/components/dashboard/clinical-ui"
import { DataState, Field, Message, PatientSelect } from "@/components/dashboard/data-ui"
import { currency, todayISO, type BillingEntry, type Patient } from "@/lib/domain"
export default function FinancePage() {
  const { can } = useDashboard()
  const data = useRecords<BillingEntry>("billing_entries", can("financial"))
  const patients = useRecords<Patient>("patients", can("patients"))
  const [draft,setDraft]=useState<BillingEntry|null>(null)
  const [query,setQuery]=useState("")
  const [status,setStatus]=useState("")
  const [page,setPage]=useState(1)
  const [message,setMessage]=useState("")
  const visible=data.records.filter(r=>(!status||r.status===status)&&[r.patientName,r.description].join(" ").toLowerCase().includes(query.toLowerCase()))
  const total=(state:string)=>data.records.filter(r=>r.status===state).reduce((sum,r)=>sum+Math.round(r.amount*100),0)/100
  const persist=async(record:BillingEntry)=>{setMessage("");try{await data.save(record);setDraft(null);setMessage("Lançamento salvo no banco.")}catch(e){setMessage((e as Error).message)}}
  const submit=(event:FormEvent)=>{event.preventDefault();if(!draft)return;const patient=patients.records.find(p=>p.id===draft.patientId);if(!patient){setMessage("Selecione um paciente cadastrado.");return}void persist({...draft,patientName:patient.name,amount:Math.round(Number(draft.amount)*100)/100})}
  const exportCSV=()=>downloadText("financeiro.csv","\ufeff"+[["Paciente","Descrição","Valor","Vencimento","Situação","Pagamento"],...visible.map(r=>[r.patientName,r.description,r.amount.toFixed(2),r.dueDate,r.status,r.paidAt||""])].map(row=>row.map(csvCell).join(";")).join("\r\n"),"text/csv;charset=utf-8")
  if(!can("financial"))return <p className="p-8">Seu perfil não tem acesso ao financeiro.</p>
  return <div className="p-4 md:p-8"><PageHeading title="Financeiro" description="Cobranças e recebimentos registrados na clínica."><div className="flex gap-2"><Button variant="outline" onClick={exportCSV} disabled={data.loading||!!data.error||!visible.length}>Exportar CSV</Button>{can("financial","create")&&<Button disabled={data.loading||!!data.error} onClick={()=>setDraft({id:crypto.randomUUID(),patientId:"",patientName:"",description:"",amount:0,dueDate:todayISO(),status:"pending",createdAt:new Date().toISOString()})}>Nova cobrança</Button>}</div></PageHeading>
    <Message text={message}/>
    {draft&&<form onSubmit={submit} className={panelClass+" mb-6 grid gap-4 md:grid-cols-2"}>
      <PatientSelect patients={patients.records} value={draft.patientId} onChange={patientId=>setDraft({...draft,patientId})}/>
      <Field label="Descrição"><input required maxLength={250} className={fieldClass} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></Field>
      <Field label="Valor (R$)"><input required type="number" min="0.01" max="1000000" step="0.01" className={fieldClass} value={draft.amount||""} onChange={e=>setDraft({...draft,amount:Number(e.target.value)})}/></Field>
      <Field label="Vencimento"><input required type="date" className={fieldClass} value={draft.dueDate} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></Field>
      <div className="flex gap-2"><Button disabled={data.saving||patients.loading||!!patients.error}>{data.saving?"Salvando…":"Salvar cobrança"}</Button><Button variant="outline" type="button" disabled={data.saving} onClick={()=>setDraft(null)}>Cancelar</Button></div>
      {patients.error&&<Message text={patients.error}/>}
    </form>}
    <DataState loading={data.loading} error={data.error} retry={data.reload}>
      <div className="mb-6 grid gap-4 md:grid-cols-3">{[["A receber",total("pending")],["Recebido",total("paid")],["Vencido",data.records.filter(r=>r.status==="pending"&&r.dueDate<todayISO()).reduce((sum,r)=>sum+Math.round(r.amount*100),0)/100]].map(([label,value])=><div key={String(label)} className={panelClass}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{currency(Number(value))}</p></div>)}</div>
      <div className="mb-4 grid gap-4 md:grid-cols-2"><Field label="Buscar cobrança"><input className={fieldClass} value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></Field><Field label="Situação"><select className={fieldClass} value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">Todas</option><option value="pending">A receber</option><option value="paid">Pago</option><option value="cancelled">Cancelado</option></select></Field></div>
      {!visible.length?<EmptyState>Nenhuma cobrança registrada neste filtro.</EmptyState>:<div className="space-y-3">{visible.slice((page-1)*20,page*20).map(r=><article key={r.id} className={panelClass}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-medium">{r.patientName} · {r.description}</h2><p className="text-sm text-muted-foreground">Vencimento: {r.dueDate} · {r.status==="pending"?"A receber":r.status==="paid"?"Pago":"Cancelado"}</p></div><strong>{currency(r.amount)}</strong></div><div className="mt-3 flex gap-2">{r.status==="pending"&&can("financial","update")&&<><Button variant="outline" disabled={data.saving} onClick={()=>{if(window.confirm("Confirmar o recebimento desta cobrança?"))void persist({...r,status:"paid",paidAt:new Date().toISOString()})}}>Registrar pagamento</Button><Button variant="outline" disabled={data.saving} onClick={()=>setDraft(r)}>Editar</Button><Button variant="outline" disabled={data.saving} onClick={()=>{if(window.confirm("Cancelar esta cobrança?"))void persist({...r,status:"cancelled"})}}>Cancelar cobrança</Button></>}{r.status==="paid"&&can("financial","refund")&&<Button variant="outline" disabled={data.saving} onClick={()=>{if(window.confirm("Registrar estorno deste pagamento? Esta ação não movimenta uma conta bancária."))void persist({...r,status:"cancelled"})}}>Registrar estorno</Button>}</div></article>)}</div>}
      <Pagination page={page} total={visible.length} onChange={setPage}/>
    </DataState>
  </div>
}
