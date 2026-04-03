import { getUsers } from './data-store'

const TOKEN_TTL_MS = 1000 * 60 * 60 * 2 // 2h
const sessions = new Map<string, { userId: string; role: string; expiresAt: number }>()

function generateRandomToken() {
  return crypto.randomUUID() + '.' + crypto.randomUUID()
}

export function login(email: string, password: string) {
  const user = getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
  if (!user) return null

  const token = generateRandomToken()
  sessions.set(token, {
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + TOKEN_TTL_MS
  })

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  }
}

export function getSession(token: string | null) {
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return session
}

export function requireAuth(request: any) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const session = getSession(token)
  if (!session) {
    return null
  }
  return session
}

export function requireAdmin(request: any) {
  const session = requireAuth(request)
  if (!session || session.role !== 'admin') {
    return null
  }
  return session
}

export function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(token)
    }
  }
}
