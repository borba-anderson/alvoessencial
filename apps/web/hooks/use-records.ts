"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { loadPersistentCollection, mutateRecords } from "@/lib/persistence"
import type { PersistedCollection, RecordValue } from "@/lib/collections"

export function useRecords<T extends { id: string }>(collection: PersistedCollection, enabled = true) {
  const [records, setRecords] = useState<T[]>([])
  const [loading, setLoading] = useState(enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const busy = useRef(false)
  const reload = useCallback(async () => {
    const generation = ++sequence.current
    if (!enabled) { setRecords([]); setLoading(false); return }
    setLoading(true)
    try {
      const data = await loadPersistentCollection<T>(collection)
      if (generation === sequence.current) { setRecords(data.records); setError(null) }
    } catch (failure) {
      if (generation === sequence.current) setError(failure instanceof Error ? failure.message : "Falha ao carregar os dados.")
    } finally { if (generation === sequence.current) setLoading(false) }
  }, [collection, enabled])
  useEffect(() => {
    void reload()
    const changed = (event: Event) => { if ((event as CustomEvent).detail?.collections?.includes(collection)) void reload() }
    window.addEventListener("alvo:records-saved", changed)
    return () => { sequence.current++; window.removeEventListener("alvo:records-saved", changed) }
  }, [reload, collection])
  const save = async (record: T) => {
    if (busy.current || loading || error || !enabled) throw new Error(error || "Aguarde o carregamento dos dados.")
    busy.current = true; setSaving(true)
    try {
      await mutateRecords([{ collection, id: record.id, before: (records.find(r => r.id === record.id) || null) as RecordValue | null, after: record as unknown as RecordValue }])
      setRecords(current => current.some(item => item.id === record.id) ? current.map(item => item.id === record.id ? record : item) : [record, ...current])
    } finally { busy.current = false; setSaving(false) }
  }
  return { records, loading, saving, error, reload, save }
}
