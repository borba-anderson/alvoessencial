export type AppRecord = {
  state_key: string
  collection: string
  record_id: string
  payload: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return {
    url,
    serviceRoleKey,
    anonKey,
    enabled: Boolean(url && serviceRoleKey),
  }
}

export async function supabaseAuthSignInWithPassword(email: string, password: string) {
  const config = getSupabaseConfig()
  const apiKey = config.anonKey || config.serviceRoleKey

  if (!config.enabled || !config.url || !apiKey) {
    return null
  }

  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: email.trim(), password }),
    })

    const data = await response.json().catch(() => null)

    if (response.status >= 500 || response.status === 429) throw new Error("Serviço de autenticação indisponível. Tente novamente.")
    if (!response.ok || !data?.user) {
      return null
    }

    const normalizedEmail = String(data.user.email || email).trim().toLowerCase()
    const metadata = data.user.user_metadata || {}
    const fullName = String(
      metadata.full_name || metadata.name || metadata.first_name || normalizedEmail.split("@")[0]
    ).trim()

    return {
      id: String(data.user.id),
      email: normalizedEmail,
      fullName: fullName || normalizedEmail,
    }
  } catch {
    throw new Error("Serviço de autenticação indisponível. Tente novamente.")
  }
}

export async function supabaseRest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getSupabaseConfig()

  if (!config.enabled || !config.url || !config.serviceRoleKey) {
    throw new Error("Supabase nao configurado")
  }

  const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })

  const text = await response.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { throw new SupabaseError("UPSTREAM", response.status) }

  if (!response.ok) {
    throw new SupabaseError(data?.code || "UPSTREAM", response.status)
  }

  return data as T
}

export class SupabaseError extends Error {
  constructor(public code: string, public status: number) { super("Falha no serviço de dados.") }
}
