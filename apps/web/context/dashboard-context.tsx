"use client"
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react"
import type { AuthenticatedUser, ModuleName, ActionName } from "@/lib/rbac"
import { useRecords } from "@/hooks/use-records"
export type CampaignStatus = "agendado" | "aguardando_confirmacao" | "confirmado" | "paciente_chegou" | "em_atendimento" | "concluido" | "faltou" | "cancelado"
export type AssetType = "image" | "video"
export interface Campaign { id: string; patientId?: string; name: string; patient?: string; phone?: string; service?: string; duration?: number; note?: string; history?: string[]; status: CampaignStatus; spend: number; impressions: number; channel: string; lastUpdated: string; startDate?: Date; endDate?: Date; progress?: number; budget?: number }
export interface Asset { id: string; name: string; type: AssetType; thumbnail: string; impressions: number; engagement: number; ctr: number; campaign: string; size: "small" | "medium" | "large" }
export interface AudienceSegment { id: string; name: string; size: number; growth: number; engagement: number }
export interface BudgetItem { channel: string; allocated: number; spent: number }
export interface Notification { id: string; title: string; message: string; type: "success" | "warning" | "error" | "info"; timestamp: Date }
type StoredCampaign = Omit<Campaign, "startDate" | "endDate"> & { startDate?: string; endDate?: string }
type Budget = { id: string; totalBudget: number; dailyBudget: number; totalSpent: number; channelBudgets: BudgetItem[] }
const serialize = (c: Campaign): StoredCampaign => ({ ...c, startDate: c.startDate?.toISOString(), endDate: c.endDate?.toISOString() })
const revive = (c: StoredCampaign): Campaign => ({ ...c, startDate: c.startDate && Number.isFinite(Date.parse(c.startDate)) ? new Date(c.startDate) : undefined, endDate: c.endDate && Number.isFinite(Date.parse(c.endDate)) ? new Date(c.endDate) : undefined })
function useDashboardValue(user: AuthenticatedUser) {
  const can = useCallback((module: ModuleName, action: ActionName = "read") => user.permissions.some(p => p.module === module && p.action === action), [user])
  const appointments = useRecords<StoredCampaign>("appointments", can("appointments"))
  const budgetData = useRecords<Budget>("billing", can("financial"))
  const campaigns = useMemo(() => appointments.records.map(revive), [appointments.records])
  const budget = budgetData.records.find(row => row.id === "budget")
  const [selectedCampaignId, selectCampaign] = useState<string | null>(null)
  const [selectedAssetId, selectAsset] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const addNotification = useCallback((n: Omit<Notification, "id" | "timestamp">) => setNotifications(current => [{ ...n, id: crypto.randomUUID(), timestamp: new Date() }, ...current].slice(0, 8)), [])
  useEffect(() => {
    const failed = (event: Event) => setPersistenceError((event as CustomEvent).detail.message)
    const saved = () => setPersistenceError(null)
    window.addEventListener("alvo:persistence-error", failed)
    window.addEventListener("alvo:records-saved", saved)
    return () => { window.removeEventListener("alvo:persistence-error", failed); window.removeEventListener("alvo:records-saved", saved) }
  }, [])
  const addCampaign = async (record: Omit<Campaign, "id">) => {
    const campaign = { ...record, id: crypto.randomUUID() }
    await appointments.save(serialize(campaign))
    addNotification({ title: "Agendamento salvo", message: campaign.name, type: "success" })
  }
  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    const current = campaigns.find(item => item.id === id)
    if (!current) throw new Error("Agendamento não encontrado.")
    await appointments.save(serialize({ ...current, ...updates, lastUpdated: new Date().toISOString() }))
  }
  const deleteCampaign = async (id: string) => updateCampaign(id, { status: "cancelado" })
  const toggleCampaignStatus = async (id: string) => {
    const current = campaigns.find(item => item.id === id)
    const stages: CampaignStatus[] = ["agendado", "confirmado", "paciente_chegou", "em_atendimento"]
    if (!current) return
    const index = stages.indexOf(current.status)
    if (index >= 0 && index < stages.length - 1) await updateCampaign(id, { status: stages[index + 1] })
  }
  const updateBudget = async (totalBudget: number, dailyBudget: number) => {
    if (![totalBudget, dailyBudget].every(value => Number.isFinite(value) && value >= 0)) throw new Error("Valores inválidos.")
    await budgetData.save({ id: "budget", totalBudget, dailyBudget, totalSpent: budget?.totalSpent || 0, channelBudgets: budget?.channelBudgets || [] })
  }
  const updateChannelBudget = async (channel: string, allocated: number) => {
    if (!budget || !Number.isFinite(allocated) || allocated < 0) throw new Error("Meta inválida.")
    await budgetData.save({ ...budget, channelBudgets: budget.channelBudgets.map(item => item.channel === channel ? { ...item, allocated } : item) })
  }
  const unavailable = async () => { throw new Error("Use o módulo de documentos ou financeiro para registrar esta operação.") }
  return {
    user, can, campaigns, selectedCampaignId, selectCampaign, selectedAssetId, selectAsset,
    assets: [] as Asset[], audienceSegments: [] as AudienceSegment[],
    totalBudget: budget?.totalBudget || 0, dailyBudget: budget?.dailyBudget || 0, totalSpent: budget?.totalSpent || 0, channelBudgets: budget?.channelBudgets || [],
    metrics: { totalImpressions: 0, activeROAS: 0, conversionRate: 0, totalClicks: 0 },
    isLoading: appointments.loading, persistenceError: persistenceError || appointments.error || budgetData.error,
    notifications, addNotification, dismissNotification: (id: string) => setNotifications(current => current.filter(item => item.id !== id)),
    addCampaign, updateCampaign, deleteCampaign, toggleCampaignStatus, updateBudget, updateChannelBudget,
    addSpend: (_channel: string, _amount: number) => unavailable(), addAsset: (_asset: Omit<Asset, "id">) => unavailable(), deleteAsset: (_id: string) => unavailable(),
    refreshMetrics: () => { void appointments.reload(); void budgetData.reload() },
  }
}
const DashboardContext = createContext<ReturnType<typeof useDashboardValue> | undefined>(undefined)
export function DashboardProvider({ children, user }: { children: React.ReactNode; user: AuthenticatedUser }) {
  const value = useDashboardValue(user)
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
export function useOptionalDashboard() { return useContext(DashboardContext) }
export function useDashboard() {
  const context = useOptionalDashboard()
  if (!context) throw new Error("DashboardProvider obrigatório.")
  return context
}
