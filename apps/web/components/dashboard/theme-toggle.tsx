"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Check initial theme from document class or localStorage
    const savedTheme = localStorage.getItem("alvo-os-theme")
    const initialDark = savedTheme === "dark"
    
    setIsDark(initialDark)
    updateTheme(initialDark)
    setMounted(true)
  }, [])

  const updateTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add("dark")
      document.documentElement.classList.remove("light")
    } else {
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
    }
    localStorage.setItem("alvo-os-theme", dark ? "dark" : "light")
  }

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    updateTheme(newIsDark)
  }

  if (!mounted) {
    return (
      <button className="flex items-center justify-center w-8 h-8 bg-surface border border-border">
        <div className="w-4 h-4" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center justify-center w-8 h-8 bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all cursor-pointer"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  )
}
