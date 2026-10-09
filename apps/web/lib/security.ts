import crypto from "node:crypto"
import type { NextRequest } from "next/server"

const PASSWORD_ITERATIONS = 210000
const PASSWORD_KEY_LENGTH = 32
const DIGEST = "sha256"

export type PasswordHash = {
  hash: string
  salt: string
  iterations: number
}

export function hashPassword(password: string): PasswordHash {
  const salt = crypto.randomBytes(16).toString("base64url")
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, DIGEST)
    .toString("base64url")

  return { hash, salt, iterations: PASSWORD_ITERATIONS }
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
  iterations: number
) {
  const actualHash = crypto
    .pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, DIGEST)
    .toString("base64url")

  const actual = Buffer.from(actualHash)
  const expected = Buffer.from(expectedHash)

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url")
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function hashRequestValue(value: string | null) {
  if (!value) return null
  return sha256(value)
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isSameOriginMutation(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true
  if (request.headers.get("sec-fetch-site") === "cross-site") return false
  const origin = request.headers.get("origin")
  if (!origin) return true
  try { return new URL(origin).host === request.headers.get("host") } catch { return false }
}
