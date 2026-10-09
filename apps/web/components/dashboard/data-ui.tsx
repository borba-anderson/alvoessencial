"use client"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { fieldClass } from "./clinical-ui"
export function DataState({ loading, error, retry, children }: { loading: boolean; error: string | null; retry: () => void; children: ReactNode }) {
  if (loading) return <p role="status" className="p-6 text-muted-foreground">Carregando dados…</p>
  if (error) return <div role="alert" className="space-y-3 rounded border border-red-200 bg-red-50 p-4 text-red-900"><p>{error}</p><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>
  return <>{children}</>
}
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm"><span className="font-medium">{label}</span>{children}</label> }
export function Message({ text }: { text: string }) { return text ? <p role="status" className="my-3 rounded border bg-muted p-3 text-sm">{text}</p> : null }
export function PatientSelect({ patients, value, onChange, required = true }: { patients: { id: string; name: string; whatsappName?: string }[]; value: string; onChange: (id: string) => void; required?: boolean }) {
  return <Field label="Paciente"><select aria-label="Paciente" className={fieldClass} value={value} onChange={e => onChange(e.target.value)} required={required}><option value="">Selecione o paciente</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name || p.whatsappName || p.id}</option>)}</select></Field>
}
