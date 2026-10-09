
import { loadPersistentCollection, savePersistentCollection } from "@/lib/persistence"

export type ClinicContact = {
  id: string
  name: string
  whatsappId: string
  whatsappName: string
}

export type ContactOverrides = Record<string, Partial<ClinicContact>>

export type AttendanceRecord = {
  id: string
  contactId: string
  date: string
  type: string
  professional: string
  summary: string
  template?: string
  source?: "atendimento" | "prontuario"
}

export type ClinicalAnamnesis = {
  id: string
  patientId: string
  appointmentId?: string
  patientName: string
  professional: string
  service: string
  scheduledAt: string
  startedAt?: string
  updatedAt?: string
  chiefComplaint: string
  history: string
  allergies: string
  medications: string
  observations: string
  status: "draft" | "in_progress" | "completed"
}

export type ClinicalDocument = {
  id: string
  patientId: string
  appointmentId?: string
  encounterId: string
  title: string
  content: string
  generatedAt: string
  status: "draft" | "final"
  viewedAt?: string
}

export type ClinicalEncounter = {
  id: string
  appointmentId: string
  patientId: string
  patientName: string
  professional: string
  service: string
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  status: "agendado" | "em_atendimento" | "concluido"
  anamnese?: ClinicalAnamnesis | null
  finalDocument?: ClinicalDocument | null
  updatedAt: string
}

export const clinicContacts: ClinicContact[] = []
export const HISTORY_KEY = "alvo-essencial-attendance-history"
export const CONTACT_OVERRIDES_KEY = "alvo-essencial-contact-overrides"

export function applyContactOverrides(baseContacts: ClinicContact[], overrides: ContactOverrides) {
  return baseContacts.map((contact) => ({
    ...contact,
    ...(overrides[contact.id] || {}),
  }))
}

export function getContactName(contact: ClinicContact) {
  const name = contact.name?.trim() || contact.whatsappName?.trim()
  if (!name || /^\d+$/.test(name)) return `Contato ${formatWhatsApp(contact.whatsappId)}`
  return name
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function formatWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "")
  if (digits.length < 12 || !digits.startsWith("55")) return value || "Sem telefone"
  const ddd = digits.slice(2, 4)
  const phone = digits.slice(4)
  if (phone.length === 8) return `+55 (${ddd}) ${phone.slice(0, 4)}-${phone.slice(4)}`
  return `+55 (${ddd}) ${phone.slice(0, 5)}-${phone.slice(5)}`
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export function getStoredHistory() {
  return []
}

export function saveStoredHistory(records: AttendanceRecord[]) {
  void records
}

export function getStoredContactOverrides() {
  return {}
}

export function saveStoredContactOverrides(overrides: ContactOverrides) {
  void overrides
}

export async function loadAttendanceHistory() {
  const { records } = await loadPersistentCollection<AttendanceRecord>("encounters", [])
  return records
}

export async function saveAttendanceHistory(records: AttendanceRecord[]) {
  return savePersistentCollection("encounters", records)
}

export async function loadContactOverrides() {
  const { records } = await loadPersistentCollection<Partial<ClinicContact> & { id: string }>(
    "patients",
    []
  )

  const overrides = records.reduce<ContactOverrides>((acc, record) => {
    if (!record.id) return acc

    acc[record.id] = {
      name: record.name,
      whatsappName: record.whatsappName,
      whatsappId: record.whatsappId,
    }

    return acc
  }, {})

  return overrides
}

export async function saveContactOverrides(overrides: ContactOverrides) {
  const records = Object.entries(overrides).map(([id, override]) => ({
    id,
    ...override,
  }))

  return savePersistentCollection("patients", records)
}

export async function loadClinicalEncounters() {
  const fallback: ClinicalEncounter[] = []
  const { records, source } = await loadPersistentCollection<ClinicalEncounter>("encounters", fallback)
  return { records, source }
}

export async function saveClinicalEncounters(records: ClinicalEncounter[]) {
  return savePersistentCollection("encounters", records)
}

export async function loadClinicalDocuments() {
  const fallback: ClinicalDocument[] = []
  const { records, source } = await loadPersistentCollection<ClinicalDocument>("documents", fallback)
  return { records, source }
}

export async function saveClinicalDocuments(records: ClinicalDocument[]) {
  return savePersistentCollection("documents", records)
}

export function buildClinicalDocument(encounter: ClinicalEncounter, patientName: string): ClinicalDocument {
  const textarea = encounter.anamnese || {
    chiefComplaint: "",
    history: "",
    allergies: "",
    medications: "",
    observations: "",
  }

  const content = [
    "Alvo Essencial - Documento final do atendimento",
    `Paciente: ${patientName}`,
    `Profissional: ${encounter.professional}`,
    `Serviço: ${encounter.service}`,
    `Data: ${encounter.scheduledAt}`,
    "",
    "Anamnese",
    `Queixa principal: ${textarea.chiefComplaint || "Não informado"}`,
    `Histórico: ${textarea.history || "Não informado"}`,
    `Alergias: ${textarea.allergies || "Não informado"}`,
    `Medicamentos: ${textarea.medications || "Não informado"}`,
    `Observações: ${textarea.observations || "Não informado"}`,
    "",
    "Atendimento finalizado",
    `Status: ${encounter.status === "concluido" ? "Concluído" : "Em andamento"}`,
  ].join("\n")

  return {
    id: `doc-${Date.now()}`,
    patientId: encounter.patientId,
    appointmentId: encounter.appointmentId,
    encounterId: encounter.id,
    title: `Atendimento - ${patientName}`,
    content,
    generatedAt: new Date().toLocaleString("pt-BR"),
    status: "final",
  }
}

export function generateEncounterFromAppointment(appointment: { id: string; patient?: string; service?: string; professional?: string; startDate?: Date | string; channel?: string; phone?: string }, patientId?: string): ClinicalEncounter {
  const scheduledAt = appointment.startDate
    ? new Date(appointment.startDate).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("pt-BR")

  return {
    id: `encounter-${appointment.id}`,
    appointmentId: appointment.id,
    patientId: patientId || `patient-${appointment.id}`,
    patientName: appointment.patient || "Paciente",
    professional: appointment.professional || appointment.channel || "Profissional responsável",
    service: appointment.service || "Consulta",
    scheduledAt,
    status: "agendado",
    updatedAt: new Date().toISOString(),
    anamnese: {
      id: `anamnesis-${appointment.id}`,
      patientId: patientId || `patient-${appointment.id}`,
      appointmentId: appointment.id,
      patientName: appointment.patient || "Paciente",
      professional: appointment.professional || appointment.channel || "Profissional responsável",
      service: appointment.service || "Consulta",
      scheduledAt,
      chiefComplaint: "",
      history: "",
      allergies: "",
      medications: "",
      observations: "",
      status: "draft",
    },
  }
}
