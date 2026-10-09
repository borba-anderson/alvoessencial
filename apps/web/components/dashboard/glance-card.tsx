"use client"

import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

interface GlanceCardProps {
  title: string
  value: number
  valueLabel?: string
  prefix?: string
  suffix?: string
  change?: number
  sparklineData: number[]
  className?: string
}

function formatNumber(num: number): string {
  return num.toLocaleString("pt-BR")
}

export function GlanceCard({
  title,
  value,
  valueLabel,
  prefix = "",
  suffix = "",
  change,
  sparklineData,
  className,
}: GlanceCardProps) {
  const chartData = sparklineData.map((value, index) => ({ value, index }))
  const isPositive = (change || 0) >= 0
  const displayValue = valueLabel || `${prefix}${formatNumber(value)}${suffix}`

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border bg-card p-4 md:p-6",
        className
      )}
    >
      <div className="relative z-10">
        <p className="mb-2 text-sm text-muted-foreground">{title}</p>

        <div className="mb-3 flex items-baseline gap-1 md:mb-4 md:gap-2">
          <span className="text-lg font-mono font-semibold tracking-tighter sm:text-2xl md:text-4xl">
            {displayValue}
          </span>
          {typeof change === "number" && (
            <div
              className={cn(
                "flex items-center gap-0.5 text-sm font-medium",
                isPositive ? "text-lime" : "text-destructive"
              )}
            >
              {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>

        <div className="-mx-2 mt-2 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--lime)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--card)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--lime)"
                strokeWidth={2}
                fill={`url(#gradient-${title.replace(/\s+/g, "-")})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
