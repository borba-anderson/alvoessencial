"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  compact?: boolean
  onClick?: () => void
  className?: string
}

export function BrandLogo({ compact = false, onClick, className }: BrandLogoProps) {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <Link href="/" className={cn("flex items-center gap-3", className)} onClick={onClick}>
      {!logoFailed ? (
        <Image
          src="/alvo-essencial-brand.svg"
          alt="Alvo Essencial"
          width={compact ? 180 : 260}
          height={compact ? 50 : 80}
          className={cn("h-auto w-auto object-contain", compact ? "max-w-[140px]" : "max-w-[200px]")}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className={cn("font-semibold tracking-tight text-foreground", compact ? "text-base" : "text-lg")}>
          Alvo Essencial
        </span>
      )}
    </Link>
  )
}
