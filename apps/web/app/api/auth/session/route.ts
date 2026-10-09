import { NextRequest, NextResponse } from "next/server"

import { authenticateRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({ authenticated: true, user })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar sessao"
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 })
  }
}
