"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export const fieldClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime"
export const panelClass = "rounded-xl border border-border bg-card p-5"

export function PageHeading({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{children}</div>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p role="status" className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{children}</p>
}

export function Pagination({ page, total, size = 20, onChange }: { page: number; total: number; size?: number; onChange: (page: number) => void }) {
  const count = Math.max(1, Math.ceil(total / size))
  return <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{total} registros · Página {Math.min(page, count)} de {count}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= count} onClick={() => onChange(page + 1)}>Próxima</Button></div></div>
}

export function downloadText(name: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = window.document.createElement("a")
  anchor.href = url
  anchor.download = name.replace(/[\\/:*?"<>|]/g, "-")
  window.document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function csvCell(value: unknown) {
  let text = String(value ?? "")
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function printText(title: string, content: string) {
  const popup = window.open("", "_blank")
  if (!popup) throw new Error("Permita abrir uma janela para imprimir o documento.")
  popup.opener = null
  popup.document.title = title
  const heading = popup.document.createElement("h1")
  heading.textContent = title
  const body = popup.document.createElement("pre")
  body.textContent = content
  body.style.cssText = "white-space:pre-wrap;font:14px/1.6 sans-serif"
  popup.document.body.style.padding = "24px"
  popup.document.body.append(heading, body)
  popup.focus()
  popup.print()
}
