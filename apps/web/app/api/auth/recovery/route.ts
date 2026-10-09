import { NextRequest, NextResponse } from "next/server"
import { isSameOriginMutation } from "@/lib/security"
export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 })
  return NextResponse.json({ error: "Solicite a recuperação de acesso à administração da clínica.", delivery: "administration" }, { status: 503 })
}
