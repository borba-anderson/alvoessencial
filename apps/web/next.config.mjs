import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appDir = path.dirname(fileURLToPath(import.meta.url))
const rootEnvPath = path.resolve(appDir, "../../.env")

if (fs.existsSync(rootEnvPath)) {
  fs.readFileSync(rootEnvPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) return

      const [, key, rawValue] = match
      if (process.env[key]) return

      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "")
    })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }, { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
