import { stableJSON, type PersistedCollection, type RecordChange, type RecordValue } from "./collections"
export type { PersistedCollection } from "./collections"
export type PersistenceSource = "supabase" | "unavailable"
const snapshots = new Map<PersistedCollection, RecordValue[]>()
const pending = new Set<PersistedCollection>()

export function clearPersistenceSession() { snapshots.clear(); pending.clear() }
function notifyFailure(message: string, status?: number) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alvo:persistence-error", { detail: { message, status } }))
}
async function requestJSON(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000) })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.enabled) {
    const message = data?.error || "Não foi possível acessar os dados. Tente novamente."
    notifyFailure(message, response.status)
    throw new Error(message)
  }
  return data
}

export async function loadPersistentCollection<T>(collection: PersistedCollection, _fallback: T[] = []): Promise<{ records: T[]; source: PersistenceSource; updatedAt?: string | null; error?: string }> {
  const data = await requestJSON("/api/app-records?collection=" + encodeURIComponent(collection))
  if (!Array.isArray(data.records)) throw new Error("Resposta inválida ao carregar os registros.")
  snapshots.set(collection, structuredClone(data.records))
  return { records: data.records, source: "supabase", updatedAt: data.updatedAt }
}

// Send only changed rows with original values; never replace a whole collection.
export async function savePersistentCollections(updates: { collection: PersistedCollection; records: { id?: string }[] }[]) {
  const names = updates.map(item => item.collection)
  if (new Set(names).size !== names.length || names.some(name => pending.has(name))) throw new Error("Aguarde o salvamento em andamento.")
  const changes: RecordChange[] = []
  for (const { collection, records } of updates) {
    const baseline = snapshots.get(collection)
    if (!baseline) throw new Error("Recarregue os dados antes de salvar.")
    const next = JSON.parse(JSON.stringify(records)) as RecordValue[]
    if (next.some(item => !item || typeof item.id !== "string" || !item.id) || new Set(next.map(item => item.id)).size !== next.length) throw new Error("Registros sem identificador único.")
    const previous = new Map(baseline.map(item => [item.id, item]))
    const nextById = new Map(next.map(item => [item.id, item]))
    for (const id of new Set([...previous.keys(), ...nextById.keys()])) {
      const before = previous.get(id) || null
      const after = nextById.get(id) || null
      if (stableJSON(before) !== stableJSON(after)) changes.push({ collection, id, before, after })
    }
  }
  if (!changes.length) return { source: "supabase" as const, count: 0 }
  names.forEach(name => pending.add(name))
  try {
    const result = await requestJSON("/api/app-records", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) })
    updates.forEach(({ collection, records }) => snapshots.set(collection, JSON.parse(JSON.stringify(records))))
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alvo:records-saved", { detail: { collections: names } }))
    return { source: "supabase" as const, count: changes.length, updatedAt: result.updatedAt }
  } finally { names.forEach(name => pending.delete(name)) }
}
export async function savePersistentCollection<T extends { id?: string }>(collection: PersistedCollection, records: T[]) {
  return savePersistentCollections([{ collection, records }])
}

export async function mutateRecords(changes: RecordChange[]) {
  const result = await requestJSON("/api/app-records", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) })
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alvo:records-saved", { detail: { collections: [...new Set(changes.map(c => c.collection))] } }))
  return result
}
