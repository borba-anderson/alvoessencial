"use client"
import { useState } from "react"
import Link from "next/link"
import { useDashboard } from "@/context/dashboard-context"
import { useRecords } from "@/hooks/use-records"
import { Button } from "@/components/ui/button"
import { PageHeading, EmptyState, panelClass, fieldClass, downloadText, csvCell } from "./clinical-ui"
import { DataState, Field } from "./data-ui"
import { currency, todayISO, type Patient, type BillingEntry } from "@/lib/domain"
export function OperationsSummary({ report=false }: { report?:boolean }) {
  const {campaigns,can,isLoading,persistenceError,refreshMetrics}=useDashboard()
  const patients=useRecords<Patient>("patients",can("patients"))
  const billing=useRecords<BillingEntry>("billing_entries",can("financial"))
  const [from,setFrom]=useState(()=>todayISO().slice(0,7)+"-01")
  const [to,setTo]=useState(todayISO)
  const appointments=campaigns.filter(c=>c.startDate&&c.startDate.toLocaleDateString("sv-SE")>=from&&c.startDate.toLocaleDateString("sv-SE")<=to)
  const charges=billing.records.filter(b=>b.dueDate>=from&&b.dueDate<=to)
  const paid=billing.records.filter(b=>b.status==="paid"&&b.paidAt&&b.paidAt.slice(0,10)>=from&&b.paidAt.slice(0,10)<=to)
  const sum=(items:BillingEntry[])=>items.reduce((n,r)=>n+Math.round(r.amount*100),0)/100
  const metrics=[...(can("patients")?[["Pacientes cadastrados",String(patients.records.filter(p=>!p.archived).length)]]:[]),...(can("appointments")?[["Agendamentos no período",String(appointments.length)],["Atendimentos concluídos",String(appointments.filter(c=>c.status==="concluido").length)]]:[]),...(can("financial")?[["Recebido no período",currency(sum(paid))],["A receber com vencimento no período",currency(sum(charges.filter(c=>c.status==="pending")))]]:[])]
  const exportReport=()=>downloadText("indicadores.csv","\ufeff"+[["Indicador","Valor"],...metrics,["Início",from],["Fim",to]].map(r=>r.map(csvCell).join(";")).join("\r\n"),"text/csv;charset=utf-8")
  return <div className="p-4 md:p-8"><PageHeading title={report?"Relatórios":"Visão geral"} description="Indicadores calculados a partir dos registros acessíveis ao seu perfil.">{report&&<Button onClick={exportReport} variant="outline" disabled={isLoading||patients.loading||billing.loading||!!persistenceError||!!patients.error||!!billing.error}>Exportar CSV</Button>}</PageHeading>
    <div className="mb-6 grid max-w-lg grid-cols-2 gap-4"><Field label="De"><input type="date" className={fieldClass} value={from} max={to} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Até"><input type="date" className={fieldClass} value={to} min={from} onChange={e=>setTo(e.target.value)}/></Field></div>
    <DataState loading={isLoading||patients.loading||billing.loading} error={persistenceError||patients.error||billing.error} retry={()=>{refreshMetrics();void patients.reload();void billing.reload()}}>
      {!metrics.length?<EmptyState>Seu perfil não possui acesso às fontes destes indicadores.</EmptyState>:<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label,value])=><div key={label} className={panelClass}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></div>)}</div>}
      {can("appointments")&&<section className={panelClass}><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Próximos compromissos</h2><Button asChild variant="outline"><Link href="/architect">Abrir agenda</Link></Button></div>
        {!campaigns.some(c=>c.startDate&&c.startDate>=new Date()&&!["cancelado","concluido","faltou"].includes(c.status))?<EmptyState>Nenhum compromisso futuro registrado.</EmptyState>:<div className="divide-y">{campaigns.filter(c=>c.startDate&&c.startDate>=new Date()&&!["cancelado","concluido","faltou"].includes(c.status)).sort((a,b)=>a.startDate!.getTime()-b.startDate!.getTime()).slice(0,10).map(c=><div key={c.id} className="py-3"><p className="font-medium">{c.patient}</p><p className="text-sm text-muted-foreground">{c.startDate?.toLocaleString("pt-BR")} · {c.service} · {c.channel}</p></div>)}</div>}
      </section>}
    </DataState>
  </div>
}
