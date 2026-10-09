export type Patient = { id: string; name: string; whatsappName: string; whatsappId: string; email?: string; birthDate?: string; archived?: boolean }
export type BillingEntry = { id: string; patientId: string; patientName: string; description: string; amount: number; dueDate: string; status: "pending" | "paid" | "cancelled"; paidAt?: string; createdAt: string }
export type FollowUp = { id: string; name: string; phone: string; note: string; status: string; dueDate?: string; createdAt: string; patientId?: string }
export type Prescription = { id: string; patientId: string; title: string; content: string; professional: string; status: "draft" | "final"; createdAt: string; signedAt?: string; parentId?: string }
export const todayISO = () => { const now = new Date(); return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-") }
export const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
