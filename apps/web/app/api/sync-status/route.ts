import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth"
import { requirePermission } from "@/lib/rbac"
import { getSupabaseConfig, supabaseRest } from "@/lib/supabase"
export async function GET(request:NextRequest){
  try{
    const permission=await requirePermission(request,"settings","read",authenticateRequest)
    if(permission.response)return permission.response
    const config=getSupabaseConfig()
    if(!config.enabled)return NextResponse.json({enabled:false,source:"unavailable",error:"Banco não configurado."},{status:503})
    await supabaseRest("app_records?select=record_id&limit=0")
    const schema=await supabaseRest<{paths?:Record<string,unknown>}>("",{headers:{Accept:"application/openapi+json"}})
    return NextResponse.json({enabled:true,source:"supabase",transactions:Boolean(schema.paths?.["/rpc/mutate_app_records"]),checkedAt:new Date().toISOString()})
  }catch{return NextResponse.json({enabled:false,source:"unavailable",error:"Não foi possível verificar a conexão."},{status:503})}
}
