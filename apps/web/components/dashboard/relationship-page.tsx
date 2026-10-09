"use client"
import { useState, type FormEvent } from "react"
import { useRecords } from "@/hooks/use-records"
import { useDashboard } from "@/context/dashboard-context"
import { Button } from "@/components/ui/button"
import { PageHeading, EmptyState, Pagination, fieldClass, panelClass } from "./clinical-ui"
import { DataState, Field, Message } from "./data-ui"
import { todayISO, type FollowUp } from "@/lib/domain"
export function RelationshipPage({ leads=false }: {leads?:boolean}) {
  const {can}=useDashboard()
  const module=leads?"patients":"crm"
  const data=useRecords<FollowUp>(leads?"leads":"returns",can(module))
  const [draft,setDraft]=useState<FollowUp|null>(null)
  const [query,setQuery]=useState("")
  const [filter,setFilter]=useState("")
  const [page,setPage]=useState(1)
  const [message,setMessage]=useState("")
  const states=leads?{new:"Novo",contacted:"Em contato",qualified:"Qualificado",closed:"Encerrado"}:{pending:"Pendente",contacted:"Em contato",done:"Concluído"}
  const visible=data.records.filter(r=>(!filter||r.status===filter)&&[r.name,r.phone,r.note].join(" ").toLowerCase().includes(query.toLowerCase()))
  const persist=async(record:FollowUp)=>{setMessage("");try{await data.save(record);setDraft(null);setMessage("Registro salvo.")}catch(e){setMessage((e as Error).message)}}
  const save=(e:FormEvent)=>{e.preventDefault();if(draft)void persist({...draft,name:draft.name.trim(),phone:draft.phone.replace(/\D/g,"")})}
  if(!can(module))return <p className="p-8">Seu perfil não tem acesso a este módulo.</p>
  return <div className="p-4 md:p-8"><PageHeading title={leads?"Leads":"Relacionamento e retornos"} description={leads?"Acompanhe contatos interessados nos serviços da clínica.":"Organize contatos e próximos passos com os pacientes."}>{can(module,"create")&&<Button disabled={data.loading||!!data.error} onClick={()=>setDraft({id:crypto.randomUUID(),name:"",phone:"",note:"",status:leads?"new":"pending",dueDate:todayISO(),createdAt:new Date().toISOString()})}>Novo registro</Button>}</PageHeading><Message text={message}/>
    {draft&&<form className={panelClass+" mb-6 grid gap-4 md:grid-cols-2"} onSubmit={save}>
      <Field label="Nome"><input required maxLength={200} className={fieldClass} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field>
      <Field label="Telefone / WhatsApp"><input className={fieldClass} value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></Field>
      <Field label="Próximo contato"><input type="date" className={fieldClass} value={draft.dueDate||""} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></Field>
      <Field label="Situação"><select className={fieldClass} value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{Object.entries(states).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Observações"><textarea rows={3} maxLength={5000} className={fieldClass} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></Field>
      <div className="flex items-end gap-2"><Button disabled={data.saving}>{data.saving?"Salvando…":"Salvar"}</Button><Button type="button" variant="outline" disabled={data.saving} onClick={()=>setDraft(null)}>Cancelar</Button></div>
    </form>}
    <div className="mb-5 grid gap-4 md:grid-cols-2"><Field label="Busca"><input className={fieldClass} value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></Field><Field label="Situação"><select className={fieldClass} value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}}><option value="">Todas</option>{Object.entries(states).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div>
    <DataState loading={data.loading} error={data.error} retry={data.reload}>{!visible.length?<EmptyState>Nenhum registro encontrado.</EmptyState>:<div className="space-y-3">{visible.slice((page-1)*20,page*20).map(r=><article className={panelClass} key={r.id}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-medium">{r.name}</h2><p className="text-sm text-muted-foreground">{r.phone||"Telefone não informado"} · {states[r.status as keyof typeof states]||r.status} {r.dueDate?"· Contato: "+r.dueDate:""}</p><p className="mt-2 whitespace-pre-wrap text-sm">{r.note}</p></div><div className="flex gap-2">{can(module,"update")&&<Button variant="outline" onClick={()=>setDraft(r)}>Editar</Button>}{r.phone&&<Button variant="outline" asChild><a href={"https://wa.me/"+r.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer">Abrir WhatsApp</a></Button>}</div></div></article>)}</div>}<Pagination page={page} total={visible.length} onChange={setPage}/></DataState>
  </div>
}
