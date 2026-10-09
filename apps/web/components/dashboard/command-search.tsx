"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getContactName } from "@/lib/clinic-data"
import { useRecords } from "@/hooks/use-records"
import { useDashboard } from "@/context/dashboard-context"
import type { Patient } from "@/lib/domain"
import {
  ClipboardList,
  FileBarChart,
  Calendar,
  FileText,
  Users,
  Wallet,
  TrendingUp,
  LayoutDashboard,
  MessageSquare,
  Settings,
  UserPlus,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

const pages = [
  { name: "Visão geral", href: "/", icon: LayoutDashboard },
  { name: "Agenda", href: "/architect", icon: Calendar },
  { name: "Leads", href: "/leads", icon: UserPlus },
  { name: "Pacientes", href: "/audience", icon: Users },
  { name: "Atendimentos", href: "/analytics", icon: ClipboardList },
  { name: "Prontuários", href: "/assets", icon: FileText },
  { name: "Financeiro", href: "/budget", icon: Wallet },
  { name: "CRM", href: "/crm", icon: MessageSquare },
  { name: "Relatórios", href: "/reports", icon: FileBarChart },
  { name: "Configurações", href: "/settings", icon: Settings },
]

const quickActions = [
  { name: "Novo agendamento", action: "new-appointment", icon: FileText },
  { name: "Ver prioridades do dia", action: "today-priorities", icon: TrendingUp },
  { name: "Exportar relatorio", action: "export", icon: FileText },
]

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const router = useRouter()
  const { can } = useDashboard()
  const contacts = useRecords<Patient>("patients", open && can("patients"))

  const handleSelect = useCallback(
    (value: string) => {
      onOpenChange(false)
      if (value.startsWith("/")) {
        router.push(value)
      }
    },
    [router, onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas, pacientes, agenda..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {pages.map((page) => (
            <CommandItem
              key={page.href}
              value={page.name}
              onSelect={() => handleSelect(page.href)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <page.icon className="w-4 h-4 text-muted-foreground" />
              <span>{page.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Clientes">
          {contacts.records.map((contact) => {
            const name = getContactName(contact)
            return (
              <CommandItem
                key={contact.id}
                value={`${name} ${contact.whatsappName} ${contact.whatsappId}`}
                onSelect={() => handleSelect(`/audience?paciente=${contact.id}&busca=${encodeURIComponent(name)}`)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{contact.whatsappId}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações rápidas">
          {quickActions.map((action) => (
            <CommandItem
              key={action.action}
              value={action.name}
              onSelect={() => handleSelect(action.action === "new-appointment" ? "/architect" : action.action === "export" ? "/reports" : "/")}
              className="flex items-center gap-3 cursor-pointer"
            >
              <action.icon className="w-4 h-4 text-muted-foreground" />
              <span>{action.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export function useCommandSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return { open, setOpen }
}
