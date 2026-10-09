"use client"

import { cn } from "@/lib/utils"
import { ExternalLink, MoreHorizontal } from "lucide-react"
import { useDashboard, type Campaign, type CampaignStatus } from "@/context/dashboard-context"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/formatters"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  agendado: {
    label: "Agendado",
    className: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  },
  aguardando_confirmacao: {
    label: "Aguardando confirmação",
    className: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  paciente_chegou: {
    label: "Paciente chegou",
    className: "bg-brand-yellow/20 text-foreground border-brand-yellow/40",
  },
  em_atendimento: {
    label: "Em atendimento",
    className: "bg-lime/15 text-lime border-lime/30",
  },
  concluido: {
    label: "Concluído",
    className: "bg-muted text-muted-foreground border-border",
  },
  faltou: {
    label: "Faltou",
    className: "bg-red-500/15 text-red-500 border-red-500/30",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground border-border",
  },
}

interface CampaignFeedProps {
  campaigns?: Campaign[]
}

export function CampaignFeed({ campaigns: propCampaigns }: CampaignFeedProps) {
  const { campaigns: contextCampaigns } = useDashboard()
  const campaigns = propCampaigns || contextCampaigns
  
  return (
    <div className="bg-card border border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium">Atividade recente</h2>
        <span className="text-xs text-muted-foreground font-mono">
          Supabase ativo
        </span>
      </div>
      
      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
        {campaigns.map((campaign) => (
          <CampaignRow key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const config = statusConfig[campaign.status]
  const { toggleCampaignStatus, deleteCampaign, selectCampaign } = useDashboard()
  
  const canAdvance = ["agendado", "confirmado", "paciente_chegou", "em_atendimento"].includes(campaign.status)
  
  return (
    <div 
      className="p-3 md:p-4 flex items-center gap-4 hover:bg-surface-hover transition-colors group cursor-pointer"
      onClick={() => selectCampaign(campaign.id)}
    >
      {/* Status - Fixed width for alignment */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (canAdvance) toggleCampaignStatus(campaign.id)
        }}
        disabled={!canAdvance}
        className={cn(
          "w-32 text-center px-2 py-1 text-xs border shrink-0 transition-all",
          config.className,
          campaign.status === "em_atendimento" && "status-pulse",
          canAdvance && "hover:scale-105 cursor-pointer"
        )}
      >
        {config.label}
      </button>
      
      {/* Campaign Info - Flex grow */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">{campaign.name}</h3>
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {campaign.channel} · {campaign.lastUpdated}
        </p>
      </div>
      
      {/* Metrics - Fixed width for alignment */}
      <div className="w-24 text-right shrink-0">
        <p className="text-sm font-mono">{formatCurrency(campaign.spend)}</p>
        <p className="text-xs text-muted-foreground">
          {campaign.impressions.toLocaleString("pt-BR")} registro
        </p>
      </div>
      
      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="sm" 
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canAdvance && (
            <DropdownMenuItem onClick={() => toggleCampaignStatus(campaign.id)}>
              Avançar situação
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onClick={() => deleteCampaign(campaign.id)}
            className="text-red-500 focus:text-red-500"
          >
            Remover agenda
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// Recebimentos do dia
interface SpendCounterProps {
  totalSpend: number
  dailyBudget: number
}

export function SpendCounter({ totalSpend, dailyBudget }: SpendCounterProps) {
  const percentage = dailyBudget > 0 ? (totalSpend / dailyBudget) * 100 : 0

  return (
    <div className="bg-card border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Recebimentos do dia</h2>
        <span className="text-xs text-muted-foreground font-mono">
          {percentage.toFixed(0)}% da meta
        </span>
      </div>
      
      <div className="mb-4">
        <span className="text-4xl font-mono font-semibold tracking-tighter">
          {formatCurrency(totalSpend)}
        </span>
        <span className="text-muted-foreground ml-2">
          / {formatCurrency(dailyBudget)}
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Atingimento calculado por recebido / meta.
      </p>
      
      {/* Progress bar */}
      <div className="h-1 bg-muted overflow-hidden">
        <div
          className="h-full bg-lime transition-all duration-1000 ease-out"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}
