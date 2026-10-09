"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import { ArrowRight, Check, ChevronDown, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Moon, Sun } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import styles from "./login-screen.module.css"

export type LoginResult = { ok: true } | { ok: false; error: string }

const copy = {
  "pt-BR": {
    system: "SISTEMA DE GESTÃO CLÍNICA", line1: "Organização", line2: "para um cuidado", purpose: "com propósito.",
    description: "Pacientes, atendimentos, prontuário, financeiro", descriptionEnd: "e muito mais em um único sistema.",
    tagline: "SAÚDE INTEGRAL. RESULTADOS REAIS.", welcome: "Bem-vindo de volta", subtitle: "Acesse sua conta para continuar.",
    email: "E-mail", emailPlaceholder: "seu@email.com", password: "Senha", passwordPlaceholder: "Sua senha", remember: "Manter conectado",
    forgot: "Esqueceu a senha?", enter: "Entrar", loading: "Entrando…", or: "ou", help: "Solicitar ajuda com o acesso",
    footer: "Uso exclusivo para profissionais autorizados.", show: "Mostrar senha", hide: "Ocultar senha", theme: "Alternar tema", language: "Idioma",
    recoveryTitle: "Precisa de ajuda para entrar?", recovery: "Para recuperar sua senha ou solicitar acesso, entre em contato com a administração da sua unidade. Informe o e-mail cadastrado para que a equipe possa ajudar.",
    networkError: "Não foi possível conectar. Verifique sua conexão e tente novamente.", close: "Entendi",
  },
  en: {
    system: "CLINICAL MANAGEMENT SYSTEM", line1: "Organization", line2: "for care", purpose: "with purpose.",
    description: "Patients, appointments, medical records, finances", descriptionEnd: "and much more in a single system.",
    tagline: "INTEGRATED HEALTH. REAL RESULTS.", welcome: "Welcome back", subtitle: "Sign in to your account to continue.",
    email: "Email", emailPlaceholder: "you@email.com", password: "Password", passwordPlaceholder: "Your password", remember: "Keep me signed in",
    forgot: "Forgot password?", enter: "Sign in", loading: "Signing in…", or: "or", help: "Get help signing in",
    footer: "For authorized professionals only.", show: "Show password", hide: "Hide password", theme: "Toggle theme", language: "Language",
    recoveryTitle: "Need help signing in?", recovery: "To recover your password or request access, contact your clinic administrator. Provide your registered email address so the team can help.",
    networkError: "Unable to connect. Check your connection and try again.", close: "Got it",
  },
}

export function LoginScreen({ onLogin }: { onLogin: (email: string, password: string, remember: boolean) => Promise<LoginResult> }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [language, setLanguage] = useState<keyof typeof copy>("pt-BR")
  const [helpOpen, setHelpOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = copy[language]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await onLogin(email.trim(), password, remember)
      if (!result.ok) setError(result.error)
    } catch {
      setError(t.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.screen} data-theme={isDark ? "dark" : "light"} lang={language}>
      <section className={styles.brandPanel} aria-label="Alvo Essencial">
        <Image src="/login-botanical.png" alt="" fill priority sizes="(min-width: 900px) 53vw, 100vw" className={styles.botanical} />
        <div className={styles.brandWash} />
        <div className={styles.topCircle} />
        <div className={styles.bottomCircle} />
        <div className={styles.brandContent}>
          <Image src="/alvo-essencial-brand.svg" alt="Alvo Essencial" width={350} height={116} priority className={styles.logo} />
          <p className={styles.eyebrow}>{t.system}</p>
          <h1>{t.line1}<br />{t.line2}<br /><strong>{t.purpose}</strong></h1>
          <div className={styles.shortRule} />
          <p className={styles.description}>{t.description}<br className={styles.desktopBreak} /> {t.descriptionEnd}</p>
        </div>
        <p className={styles.tagline}>{t.tagline}</p>
      </section>

      <section className={styles.formPanel} aria-labelledby="login-title">
        <div className={styles.toolbar}>
          <button type="button" className={styles.iconButton} onClick={() => setIsDark(!isDark)} aria-label={t.theme} aria-pressed={isDark}>
            {isDark ? <Sun size={22} /> : <Moon size={22} />}
          </button>
          <div className={styles.language}>
            <select aria-label={t.language} value={language} onChange={(event) => setLanguage(event.target.value as keyof typeof copy)}>
              <option value="pt-BR">PT-BR</option><option value="en">EN</option>
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <header className={styles.formHeader}>
            <h2 id="login-title">{t.welcome}</h2>
            <p>{t.subtitle}</p>
          </header>
          <div className={styles.field}>
            <label htmlFor="login-email">{t.email}</label>
            <div className={styles.inputWrap}>
              <Mail size={22} aria-hidden="true" />
              <input id="login-email" name="email" type="email" autoComplete="username" placeholder={t.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} required disabled={isSubmitting} aria-describedby={error ? "login-error" : undefined} />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password">{t.password}</label>
            <div className={styles.inputWrap}>
              <LockKeyhole size={22} aria-hidden="true" />
              <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={t.passwordPlaceholder} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isSubmitting} aria-describedby={error ? "login-error" : undefined} />
              <button type="button" className={styles.iconButton} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t.hide : t.show} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
          </div>
          <div className={styles.options}>
            <label className={styles.remember}>
              <input type="checkbox" name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={isSubmitting} />
              <span className={styles.check}><Check size={17} strokeWidth={2.5} /></span>
              <span>{t.remember}</span>
            </label>
            <button type="button" className={styles.textButton} onClick={() => setHelpOpen(true)}>{t.forgot}</button>
          </div>
          {error && <p id="login-error" className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? <><LoaderCircle size={21} className={styles.spinner} />{t.loading}</> : <>{t.enter}<ArrowRight size={22} strokeWidth={1.6} /></>}
          </button>
          <div className={styles.divider}><span />{t.or}<span /></div>
          <button type="button" className={styles.helpButton} onClick={() => setHelpOpen(true)}>{t.help}</button>
        </form>
        <footer className={styles.footer}>Alvo Essencial <span>v1.0</span><span className={styles.footerBar}>|</span> {t.footer}</footer>
      </section>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent showCloseButton={false} className="rounded-2xl border-[#d6dcd9] bg-[#fcfcfb] p-8 text-[#142124]">
          <DialogTitle>{t.recoveryTitle}</DialogTitle>
          <DialogDescription className="text-base leading-7 text-[#5e6b73]">{t.recovery}</DialogDescription>
          <button type="button" onClick={() => setHelpOpen(false)} className="mt-2 rounded-lg bg-[#075951] px-5 py-3 text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#075951]">{t.close}</button>
        </DialogContent>
      </Dialog>
    </main>
  )
}
