// Shared names only. Credentials and authorization remain on the server.
export const collectionModules = {
  patients: "patients", leads: "patients", appointments: "appointments",
  encounters: "records", documents: "records", attendance: "records",
  prescriptions: "records", files: "records", billing: "financial",
  billing_entries: "financial", returns: "crm", clinic_settings: "settings",
} as const
export type PersistedCollection = keyof typeof collectionModules
export type RecordValue = { id: string; [key: string]: unknown }
export type RecordChange = {
  collection: PersistedCollection
  id: string
  before: RecordValue | null
  after: RecordValue | null
}
export function isCollection(value: string): value is PersistedCollection {
  return Object.prototype.hasOwnProperty.call(collectionModules, value)
}
export function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJSON(v)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}
