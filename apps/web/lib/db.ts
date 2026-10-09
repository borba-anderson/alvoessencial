import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export type Database = DatabaseSync

declare global {
  // eslint-disable-next-line no-var
  var __alvoEssencialDb: Database | undefined
}

export function getProjectRoot() {
  const cwd = process.cwd()
  if (path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps") {
    return path.resolve(cwd, "../..")
  }
  return cwd
}

export function getDatabasePath() {
  return process.env.ALVO_DB_PATH || path.join(getProjectRoot(), "data", "alvo-essencial.sqlite")
}

export function getDb(): Database {
  if (globalThis.__alvoEssencialDb) return globalThis.__alvoEssencialDb

  const dbPath = getDatabasePath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new DatabaseSync(dbPath)
  db.exec("pragma foreign_keys = on;")
  db.exec("pragma journal_mode = wal;")
  globalThis.__alvoEssencialDb = db
  return db
}

export function assertMigrated() {
  const db = getDb()
  const row = db.prepare(`
    select name from sqlite_master
    where type = 'table' and name = 'app_users'
  `).get()

  if (!row) {
    throw new Error("Banco nao migrado. Execute npm run db:migrate antes de iniciar o sistema.")
  }
}
