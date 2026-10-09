"use client"

import React, { useEffect, useState } from "react"

import { Sidebar } from "./sidebar"
import { CommandSearch, useCommandSearch } from "./command-search"
import { NotificationToast } from "./notification-toast"
import { DashboardProvider, useDashboard, useOptionalDashboard } from "@/context/dashboard-context"
import type { AuthenticatedUser } from "@/lib/rbac"
import { clearPersistenceSession } from "@/lib/persistence"
import { AnimatePresence, motion } from "framer-motion"
import { Menu, Search } from "lucide-react"
import { BrandLogo } from "./brand-logo"
import { LoginScreen, type LoginResult } from "./login-screen"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const parent = useOptionalDashboard()
  if (parent) return <>{children}</>
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>
}

function AuthenticatedLayout({ children }: DashboardLayoutProps) {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return
        if (response.status === 401) { setUser(null); return }
        if (!response.ok) throw new Error("Serviço de autenticação indisponível.")
        const data = await response.json()
        if (active) { setUser(data.user); setSessionError(null) }
      })
      .catch(() => {
        if (active) setSessionError("Não foi possível consultar a sessão. Recarregue para tentar novamente.")
      })
      .finally(() => {
        if (active) setIsReady(true)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const expired = (event: Event) => {
      if ((event as CustomEvent).detail?.status === 401) { clearPersistenceSession(); setUser(null) }
    }
    window.addEventListener("alvo:persistence-error", expired)
    return () => window.removeEventListener("alvo:persistence-error", expired)
  }, [])

  const handleLogin = async (email: string, password: string, remember: boolean): Promise<LoginResult> => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, remember }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      return { ok: false, error: data?.error || "Nao foi possivel autenticar." }
    }

    const data = await response.json()
    clearPersistenceSession()
    setUser(data.user)
    return { ok: true }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) throw new Error("Falha ao sair")
      clearPersistenceSession()
      setUser(null)
    } catch { setSessionError("Não foi possível encerrar a sessão. Tente novamente.") }
  }

  if (!isReady) {
    return <div role="status" className="min-h-screen bg-background p-8">Carregando sessão…</div>
  }

  if (sessionError) return <div role="alert" className="p-8"><p>{sessionError}</p><button type="button" className="mt-4 underline" onClick={() => window.location.reload()}>Tentar novamente</button></div>
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <DashboardProvider user={user}>
      <DashboardShell onLogout={handleLogout}>{children}</DashboardShell>
    </DashboardProvider>
  )
}

function DashboardShell({ children, onLogout }: DashboardLayoutProps & { onLogout: () => Promise<void> }) {
  const { persistenceError } = useDashboard()
  const { open, setOpen } = useCommandSearch()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
        <header className="fixed left-0 right-0 top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-xl lg:hidden">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 transition-colors hover:bg-surface-hover"
                aria-label="Abrir navegacao"
              >
                <Menu className="h-5 w-5" />
              </button>
              <BrandLogo compact />
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="p-2 transition-colors hover:bg-surface-hover"
              aria-label="Abrir busca"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </header>

        <Sidebar
          onOpenCommand={() => setOpen(true)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={onLogout}
        />
        <CommandSearch open={open} onOpenChange={setOpen} />

        <main className="pt-14 lg:pl-64 lg:pt-0">
          {persistenceError ? (
            <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:px-8">
              {persistenceError} Nenhuma alteração será considerada persistida até a conexão ser restabelecida.
            </div>
          ) : null}
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <NotificationToast />
    </div>
  )
}
