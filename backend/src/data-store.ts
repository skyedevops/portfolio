import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type RoleType = 'admin' | 'team' | 'freelancer' | 'client'

export interface ContactRecord {
  id: string
  name: string
  email: string
  discord?: string
  role?: RoleType
  subject: string
  message: string
  createdAt: string
}

export interface UserRecord {
  id: string
  name: string
  email: string
  password?: string
  role: RoleType
  createdAt: string
}

export interface DevopsService {
  id: string
  title: string
  description: string
  category: 'infrastructure' | 'security' | 'observability' | 'automation' | 'platform'
  createdAt: string
}

const DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/app/backend/data'
  : join(import.meta.dir, '../data')

const CONTACTS_FILE = join(DATA_DIR, 'contacts.json')
const USERS_FILE = join(DATA_DIR, 'users.json')
const SERVICES_FILE = join(DATA_DIR, 'devops-services.json')
const DB_FILE = join(DATA_DIR, 'portfolio.sqlite')

let sqliteDb: Bun.Sqlite | null = null

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!existsSync(CONTACTS_FILE)) {
    writeFileSync(CONTACTS_FILE, '[]', 'utf8')
  }
  if (!existsSync(USERS_FILE)) {
    writeFileSync(USERS_FILE, '[]', 'utf8')
  }
  if (!existsSync(SERVICES_FILE)) {
    writeFileSync(SERVICES_FILE, '[]', 'utf8')
  }
}

function loadJson<T>(filePath: string): T {
  ensureDataDir()
  const raw = readFileSync(filePath, 'utf8')
  try {
    return JSON.parse(raw) as T
  } catch {
    return [] as unknown as T
  }
}

function writeJson(filePath: string, data: unknown) {
  ensureDataDir()
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function initDb() {
  if (sqliteDb) return sqliteDb

  try {
    sqliteDb = new Bun.Sqlite(DB_FILE)

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        discord TEXT,
        role TEXT,
        subject TEXT,
        message TEXT,
        createdAt TEXT
      )
    `)

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        role TEXT,
        createdAt TEXT
      )
    `)

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT,
        createdAt TEXT
      )
    `)
  } catch (error) {
    sqliteDb = null
  }

  return sqliteDb
}

function dbQuery(query: string, values: any[] = []) {
  const db = initDb()
  if (!db) return null
  return db.query(query, ...values)
}

export function getContacts(): ContactRecord[] {
  const db = initDb()
  if (db) {
    const rows = [...db.query(`SELECT * FROM contacts ORDER BY createdAt DESC`)]
    return rows.map((r: any) => ({
      id: r[0],
      name: r[1],
      email: r[2],
      discord: r[3] || '',
      role: r[4] as RoleType,
      subject: r[5],
      message: r[6],
      createdAt: r[7]
    }))
  }

  return loadJson<ContactRecord[]>(CONTACTS_FILE)
}

export function addContact(contact: ContactRecord): ContactRecord {
  const db = initDb()
  if (db) {
    db.run(
      `INSERT OR REPLACE INTO contacts (id,name,email,discord,role,subject,message,createdAt) VALUES (?,?,?,?,?,?,?,?)`,
      contact.id,
      contact.name,
      contact.email,
      contact.discord || '',
      contact.role || 'client',
      contact.subject,
      contact.message,
      contact.createdAt
    )
    return contact
  }

  const contacts = getContacts()
  contacts.push(contact)
  writeJson(CONTACTS_FILE, contacts)
  return contact
}

export function getUsers(): UserRecord[] {
  const db = initDb()
  if (db) {
    const rows = [...db.query(`SELECT id,name,email,password,role,createdAt FROM users ORDER BY createdAt DESC`)]
    return rows.map((r: any) => ({
      id: r[0],
      name: r[1],
      email: r[2],
      password: r[3],
      role: r[4] as RoleType,
      createdAt: r[5]
    }))
  }
  return loadJson<UserRecord[]>(USERS_FILE)
}

export function addUser(user: UserRecord): UserRecord {
  const db = initDb()
  if (db) {
    db.run(
      `INSERT OR REPLACE INTO users (id,name,email,password,role,createdAt) VALUES (?,?,?,?,?,?)`,
      user.id,
      user.name,
      user.email,
      user.password || '',
      user.role,
      user.createdAt
    )
    return user
  }
  const users = getUsers()
  users.push(user)
  writeJson(USERS_FILE, users)
  return user
}

export function removeUser(userId: string): boolean {
  const db = initDb()
  if (db) {
    const result = db.query(`DELETE FROM users WHERE id = ?`, userId)
    return (result as any).changes > 0
  }

  const users = getUsers()
  const filtered = users.filter((u) => u.id !== userId)
  if (filtered.length === users.length) {
    return false
  }
  writeJson(USERS_FILE, filtered)
  return true
}

export function getServices(): DevopsService[] {
  const db = initDb()
  if (db) {
    const rows = [...db.query(`SELECT id,title,description,category,createdAt FROM services ORDER BY createdAt DESC`)]
    return rows.map((r: any) => ({
      id: r[0],
      title: r[1],
      description: r[2],
      category: r[3],
      createdAt: r[4]
    }))
  }
  return loadJson<DevopsService[]>(SERVICES_FILE)
}

export function addService(service: DevopsService): DevopsService {
  const db = initDb()
  if (db) {
    db.run(
      `INSERT OR REPLACE INTO services (id,title,description,category,createdAt) VALUES (?,?,?,?,?)`,
      service.id,
      service.title,
      service.description,
      service.category,
      service.createdAt
    )
    return service
  }
  const services = getServices()
  services.push(service)
  writeJson(SERVICES_FILE, services)
  return service
}

export function removeService(serviceId: string): boolean {
  const db = initDb()
  if (db) {
    const result = db.query(`DELETE FROM services WHERE id = ?`, serviceId)
    return (result as any).changes > 0
  }

  const services = getServices()
  const filtered = services.filter((s) => s.id !== serviceId)
  if (filtered.length === services.length) return false
  writeJson(SERVICES_FILE, filtered)
  return true
}
