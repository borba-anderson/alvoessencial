"use client"
import { useEffect, useState, type FormEvent } from "react"
import { useDashboard } from "@/context/dashboard-context"
import { useRecords } from "@/hooks/use-records"
import { Button } from "@/components/ui/button"
import { PageHeading, fieldClass, panelClass } from "@/components/dashboard/clinical-ui"
import { DataState, Field, Message } from "@/components/dashboard/data-ui"
type Clinic = {id:string;name:string;phone:string;address:string;timezone:string}
type User = {id:string;fullName:string;email:string;status:string;roles:string}
export default function SettingsPage(){
  const {can,user}=useDashboard()
  const settings=useRecords<Clinic>("clinic_settings",can("settings"))
  const [draft,setDraft]=useState<Clinic|null>(null)
  const [message,setMessage]=useState("")
  const [connection,setConnection]=useState("")
  const [checking,setChecking]=useState(false)
  const [users,setUsers]=useState<User[]>([])
  const [usersError,setUsersError]=useState<string|null>(null)
  const [provider,setProvider]=useState("")
  const [busy,setBusy]=useState(false)
  const [newUser,setNewUser]=useState({fullName:"",email:"",role:"recepcao",password:""})
  const [events,setEvents]=useState<{id:string;occurredAt:string;module:string;action:string;result:string;actorEmail:string}[]>([])
  const [auditMessage,setAuditMessage]=useState("")
  const current=draft||settings.records.find(s=>s.id==="clinic")||{id:"clinic",name:"",phone:"",address:"",timezone:"America/Sao_Paulo"}
  const loadUsers=async()=>{try{const response=await fetch("/api/users",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error);setUsers(data.users);setProvider(data.provider);setUsersError(null)}catch(e){setUsersError((e as Error).message)}}
  useEffect(()=>{if(can("auth","manage"))void loadUsers()},[can])
  const save=async(e:FormEvent)=>{e.preventDefault();try{await settings.save(current);setDraft(null);setMessage("Configurações salvas.")}catch(e){setMessage((e as Error).message)}}
  const userRequest=async(method:string,body:unknown)=>{setBusy(true);setMessage("");try{const response=await fetch("/api/users",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error);setMessage("Acesso atualizado.");setNewUser({fullName:"",email:"",role:"recepcao",password:""});await loadUsers()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
  const check=async()=>{setChecking(true);try{const response=await fetch("/api/sync-status",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error);setConnection(data.transactions?"Banco conectado. Transações disponíveis.":"Banco conectado. A migração de transações ainda está pendente.")}catch(e){setConnection((e as Error).message)}finally{setChecking(false)}}
  const audit=async()=>{try{const response=await fetch("/api/audit/events?limit=50",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Falha ao consultar auditoria.");setEvents(data.events);setAuditMessage(data.events.length?"Últimos eventos registrados.":"Nenhum evento registrado.")}catch(e){setAuditMessage((e as Error).message)}}
  if(!can("settings")&&!can("auth","manage")&&!can("audit"))return <p className="p-8">Seu perfil não tem acesso às configurações.</p>
  return <div className="p-4 md:p-8"><PageHeading title="Configurações" description="Unidade, conexão, usuários e auditoria."/><Message text={message}/>
    {can("settings")&&<DataState loading={settings.loading} error={settings.error} retry={settings.reload}><form className={panelClass+" mb-6 grid gap-4 md:grid-cols-2"} onSubmit={save}>
      <Field label="Nome da clínica"><input required maxLength={200} className={fieldClass} value={current.name} onChange={e=>setDraft({...current,name:e.target.value})}/></Field>
      <Field label="Telefone"><input className={fieldClass} value={current.phone} onChange={e=>setDraft({...current,phone:e.target.value})}/></Field>
      <Field label="Endereço"><input className={fieldClass} value={current.address} onChange={e=>setDraft({...current,address:e.target.value})}/></Field>
      <Field label="Fuso horário da unidade"><select className={fieldClass} value={current.timezone} onChange={e=>setDraft({...current,timezone:e.target.value})}><option>America/Sao_Paulo</option><option>America/Manaus</option><option>America/Rio_Branco</option><option>America/Noronha</option></select></Field>
      {can("settings","manage")&&<div><Button disabled={settings.saving}>{settings.saving?"Salvando…":"Salvar configurações"}</Button></div>}
    </form><section className={panelClass+" mb-6"}><h2 className="mb-3 font-semibold">Conexão com o banco</h2><Button variant="outline" disabled={checking} onClick={()=>void check()}>{checking?"Verificando…":"Verificar conexão"}</Button><Message text={connection}/></section></DataState>}
    {can("auth","manage")&&<section className={panelClass+" mb-6"}><h2 className="mb-4 font-semibold">Usuários e permissões</h2>
      <DataState loading={false} error={usersError} retry={loadUsers}>
        <p className="mb-4 text-sm text-muted-foreground">{provider==="supabase"?"Autenticação pelo Supabase. Autorize aqui contas já cadastradas no provedor.":"Autenticação local da clínica."}</p>
        <form className="mb-6 grid gap-4 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void userRequest("POST",{fullName:newUser.fullName,email:newUser.email,role:newUser.role,...(provider==="local"?{password:newUser.password}:{})})}}>
          <Field label="Nome do usuário"><input required className={fieldClass} value={newUser.fullName} onChange={e=>setNewUser({...newUser,fullName:e.target.value})}/></Field>
          <Field label="E-mail do usuário"><input required type="email" className={fieldClass} value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/></Field>
          <Field label="Perfil"><select className={fieldClass} value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}><option value="recepcao">Recepção</option><option value="profissional">Profissional clínico</option><option value="financeiro">Financeiro</option><option value="auditoria">Auditoria</option><option value="admin">Administrador</option></select></Field>
          {provider==="local"&&<Field label="Senha inicial (mínimo 12 caracteres)"><input required type="password" autoComplete="new-password" minLength={12} className={fieldClass} value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/></Field>}
          <div><Button disabled={busy}>Autorizar usuário</Button></div>
        </form>
        <div className="divide-y">{users.map(u=><div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{u.fullName}</p><p className="text-sm text-muted-foreground">{u.email} · {u.roles} · {u.status==="active"?"Ativo":"Inativo"}</p></div>{u.id!==user.id&&<div className="flex flex-wrap gap-2"><label className="text-sm"><span className="sr-only">Perfil de {u.fullName}</span><select className={fieldClass} value={u.roles.split(",")[0]} disabled={busy} onChange={e=>void userRequest("PATCH",{id:u.id,role:e.target.value})}>{["recepcao","profissional","financeiro","auditoria","admin"].map(r=><option key={r}>{r}</option>)}</select></label><Button variant="outline" disabled={busy} onClick={()=>{if(window.confirm("Alterar o acesso deste usuário e encerrar suas sessões?"))void userRequest("PATCH",{id:u.id,status:u.status==="active"?"inactive":"active"})}}>{u.status==="active"?"Desativar":"Ativar"}</Button>{provider==="local"&&<Button variant="outline" disabled={busy} onClick={()=>{const password=window.prompt("Nova senha (mínimo 12 caracteres):");if(password)void userRequest("PATCH",{id:u.id,password})}}>Redefinir senha</Button>}</div>}</div>)}</div>
      </DataState>
    </section>}
    {can("audit")&&<section className={panelClass}><h2 className="mb-3 font-semibold">Auditoria</h2><Button variant="outline" onClick={()=>void audit()}>Consultar últimos eventos</Button><Message text={auditMessage}/><div className="mt-4 divide-y">{events.map(e=><p key={e.id} className="py-2 text-sm">{new Date(e.occurredAt).toLocaleString("pt-BR")} · {e.actorEmail||"Sistema"} · {e.module}/{e.action} · {e.result}</p>)}</div></section>}
  </div>
}
