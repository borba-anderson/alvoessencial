import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, getRequestIdentity } from "@/lib/auth"
import { requirePermission } from "@/lib/rbac"
import { appendAuditEvent } from "@/lib/audit"
import { getSupabaseConfig, supabaseRest, type AppRecord } from "@/lib/supabase"
import { randomUUID } from "node:crypto"
const state = () => process.env.SUPABASE_STATE_KEY || "clinic-main"
const bucket = () => process.env.SUPABASE_DOCUMENTS_BUCKET || "clinical-documents"
async function storage(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig()
  if (!config.url || !config.serviceRoleKey) throw new Error("Storage não configurado.")
  return fetch(config.url.replace(/\/$/,"") + "/storage/v1/" + path, { ...init, signal: AbortSignal.timeout(30000), cache:"no-store", headers:{ apikey:config.serviceRoleKey, Authorization:"Bearer "+config.serviceRoleKey,...init.headers } })
}
function rowFilter(collection: string, id: string) { return "app_records?state_key=eq."+encodeURIComponent(state())+"&collection=eq."+collection+"&record_id=eq."+encodeURIComponent(id)+"&select=state_key,collection,record_id,payload" }
export async function POST(request: NextRequest) {
  try {
    const permission = await requirePermission(request,"records","create",authenticateRequest)
    if (permission.response) return permission.response
    if (Number(request.headers.get("content-length") || 0)>11*1024*1024) return NextResponse.json({error:"O arquivo deve ter até 10 MB."},{status:413})
    const form = await request.formData()
    const file = form.get("file")
    const patientId = String(form.get("patientId") || "")
    if (!(file instanceof File) || !file.size || file.size>10*1024*1024) return NextResponse.json({error:"Envie um arquivo de até 10 MB."},{status:422})
    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    const types: Record<string,string> = { pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",txt:"text/plain",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    if (!types[extension]) return NextResponse.json({error:"Formato não permitido."},{status:422})
    const patients = await supabaseRest<AppRecord[]>(rowFilter("patients",patientId))
    if (!patients.length) return NextResponse.json({error:"Paciente não encontrado."},{status:404})
    const bytes = Buffer.from(await file.arrayBuffer())
    const signatures: Record<string,boolean> = {pdf:bytes.subarray(0,5).toString()==="%PDF-",png:bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg:bytes[0]===255&&bytes[1]===216,jpeg:bytes[0]===255&&bytes[1]===216,docx:bytes[0]===80&&bytes[1]===75,txt:!bytes.includes(0)}
    if (!signatures[extension]) return NextResponse.json({error:"O conteúdo não corresponde ao formato informado."},{status:422})
    // Storage must be a private bucket; never create a public URL.
    const check = await storage("bucket/"+encodeURIComponent(bucket()))
    if (!check.ok) return NextResponse.json({error:"O armazenamento privado ainda não foi configurado."},{status:503})
    const configuration = await check.json()
    if (configuration.public) return NextResponse.json({error:"O armazenamento clínico deve ser privado."},{status:503})
    const id = randomUUID()
    const objectPath = encodeURIComponent(state())+"/"+id+"."+extension
    const stored = await storage("object/"+encodeURIComponent(bucket())+"/"+objectPath,{method:"POST",headers:{"Content-Type":types[extension],"x-upsert":"false"},body:bytes})
    if (!stored.ok) return NextResponse.json({error:"Não foi possível armazenar o arquivo."},{status:503})
    try {
      const name = file.name.replace(/[\\/\r\n"]/g,"-").slice(0,200)
      await supabaseRest("app_records",{method:"POST",body:JSON.stringify({state_key:state(),collection:"files",record_id:id,payload:{id,patientId,name,size:file.size,mime:types[extension],objectPath,uploadedAt:new Date().toISOString(),uploadedBy:permission.user!.id}})})
      appendAuditEvent({actorUserId:permission.user!.id,module:"records",action:"create",entityType:"file",entityId:id,result:"success",...getRequestIdentity(request)})
      return NextResponse.json({id},{status:201})
    } catch {
      await storage("object/"+encodeURIComponent(bucket()),{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({prefixes:[objectPath]})})
      return NextResponse.json({error:"Não foi possível registrar o anexo. Tente novamente."},{status:503})
    }
  } catch { return NextResponse.json({error:"Serviço de arquivos indisponível."},{status:503}) }
}
export async function GET(request: NextRequest) {
  try {
    const permission = await requirePermission(request,"records","read",authenticateRequest)
    if (permission.response) return permission.response
    const id = request.nextUrl.searchParams.get("id") || ""
    const rows = await supabaseRest<AppRecord[]>(rowFilter("files",id))
    const file = rows[0]?.payload
    if (!file || typeof file.objectPath!=="string" || !file.objectPath.startsWith(encodeURIComponent(state())+"/") || file.objectPath.includes("..")) return NextResponse.json({error:"Arquivo não encontrado."},{status:404})
    const response = await storage("object/"+encodeURIComponent(bucket())+"/"+file.objectPath)
    if (!response.ok) return NextResponse.json({error:"Arquivo indisponível."},{status:503})
    appendAuditEvent({actorUserId:permission.user!.id,module:"records",action:"read",entityType:"file",entityId:id,result:"success",...getRequestIdentity(request)})
    return new NextResponse(response.body,{headers:{"Content-Type":String(file.mime || "application/octet-stream"),"Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(String(file.name || "documento")),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})
  } catch { return NextResponse.json({error:"Não foi possível baixar o arquivo."},{status:503}) }
}
