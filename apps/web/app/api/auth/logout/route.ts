import { NextRequest, NextResponse } from "next/server"

import { authenticateRequest, clearSessionCookie, revokeSession } from "@/lib/auth"
import { isSameOriginMutation } from "@/lib/security"

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 })
  const user = await authenticateRequest(request).catch(() => null)
  await revokeSession(request, user)

  const response = NextResponse.json({ authenticated: false })
  clearSessionCookie(response)
  return response
}
