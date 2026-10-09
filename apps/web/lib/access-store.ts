import { supabaseRest } from "@/lib/supabase"

export type RemoteUser = { id: string; unit_id: string; full_name: string; email: string; status: "active" | "inactive" | "locked" }

export async function remoteRows<T>(path: string) { return supabaseRest<T[]>(path) }
export async function remoteInsert<T>(table: string, values: unknown) {
  return supabaseRest<T[]>(table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(values) })
}
export async function remoteUpdate<T>(path: string, values: unknown) {
  return supabaseRest<T[]>(path, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(values) })
}
export async function remoteDelete(path: string) { return supabaseRest<unknown>(path, { method: "DELETE", headers: { Prefer: "return=minimal" } }) }
