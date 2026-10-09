import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { applySessionCookie, loginWithPassword } from "@/lib/auth"
import { isSameOriginMutation } from "@/lib/security"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  remember: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 })
  const parsed = loginSchema.safeParse(await request.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ error: "Credenciais invalidas" }, { status: 400 })
  }

  try {
    const result = await loginWithPassword(request, parsed.data.email, parsed.data.password)

    if (!result) {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 })
    }

    const response = NextResponse.json({ authenticated: true, user: result.user })
    applySessionCookie(response, result.token, result.expiresAt, parsed.data.remember)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao autenticar"
    if (message.startsWith("Muitas tentativas")) return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": "900" } })
    return NextResponse.json({ error: "Não foi possível autenticar. Verifique a disponibilidade do serviço." }, { status: 503 })
  }
}
