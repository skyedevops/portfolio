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
  role: RoleType
  createdAt: string
}

const DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/app/backend/data'
  : join(import.meta.dir, '../data')

const CONTACTS_FILE = join(DATA_DIR, 'contacts.json')
const USERS_FILE = join(DATA_DIR, 'users.json')

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
}

function readJson<T>(filePath: string): T {
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

export function getContacts(): ContactRecord[] {
  return readJson<ContactRecord[]>(CONTACTS_FILE)
}

export function addContact(contact: ContactRecord): ContactRecord {
  const contacts = getContacts()
  contacts.push(contact)
  writeJson(CONTACTS_FILE, contacts)
  return contact
}

export function getUsers(): UserRecord[] {
  return readJson<UserRecord[]>(USERS_FILE)
}

export function addUser(user: UserRecord): UserRecord {
  const users = getUsers()
  users.push(user)
  writeJson(USERS_FILE, users)
  return user
}

export function removeUser(userId: string): boolean {
  const users = getUsers()
  const filtered = users.filter((u) => u.id !== userId)
  if (filtered.length === users.length) {
    return false
  }
  writeJson(USERS_FILE, filtered)
  return true
}
