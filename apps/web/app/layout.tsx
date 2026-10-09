import React from "react"
import type { Metadata, Viewport } from 'next'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alvo Essencial | Sistema clínico',
  description: 'Painel clínico para agenda, pacientes, prontuário, financeiro e continuidade de cuidado',
  generator: 'Codex',
  icons: {
    icon: '/alvo-essencial-brand.svg',
    apple: '/alvo-essencial-brand.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#050505',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="light" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  )
}
