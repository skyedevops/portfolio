import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { sendContactEmail, ContactMessage } from './routes/contact'
import { getContacts, addContact, getUsers, addUser, removeUser, getServices, addService, removeService, UserRecord, DevopsService } from './data-store'
import { login, getSession, requireAuth, requireAdmin, cleanupExpiredSessions } from './auth'

const PORT = 3001
const PUBLIC_DIR = process.env.NODE_ENV === 'production'
  ? '/app/backend/public'
  : join(import.meta.dir, '../public')

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'txt': 'text/plain',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function getCacheHeaders(filePath: string): Record<string, string> {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (filePath.includes('/assets/')) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' }
  }
  if (['woff', 'woff2', 'ttf'].includes(ext)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' }
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico'].includes(ext)) {
    return { 'Cache-Control': 'public, max-age=604800' }
  }
  if (ext === 'html') {
    return { 'Cache-Control': 'public, max-age=3600, must-revalidate' }
  }
  return { 'Cache-Control': 'public, max-age=0, must-revalidate' }
}

function isRegularFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function apiJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function isAdminRequest(request: any): boolean {
  // legacy support for x-admin-token fallback
  const token = request.headers.get('x-admin-token') || ''
  const expected = process.env.ADMIN_TOKEN || 'admin-secret'
  return token === expected
}

export function startServer() {
  cleanupExpiredSessions()

  const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0',
    development: process.env.NODE_ENV !== 'production',
    async fetch(request: any) {
      const url = new URL(request.url)
      const pathname = url.pathname

      if (pathname === '/health') {
        return apiJson({ status: 'ok', timestamp: new Date().toISOString() })
      }

      if (pathname === '/payment-success') {
        return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Payment Success</title></head><body style="background:#050a16;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>Payment completed</h1><p>Thank you! Your transaction was successful.</p><a href="/" style="color:#22d3ee;text-decoration:none;">Return to homepage</a></div></body></html>`, { headers: { 'Content-Type': 'text/html' } })
      }

      if (pathname === '/payment-cancel') {
        return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Payment Canceled</title></head><body style="background:#050a16;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>Payment canceled</h1><p>Your payment was canceled. You can retry or contact us if you need help.</p><a href="/" style="color:#22d3ee;text-decoration:none;">Return to homepage</a></div></body></html>`, { headers: { 'Content-Type': 'text/html' } })
      }

      if (pathname === '/api/contact' && request.method === 'POST') {
        try {
          const body = await request.json()
          const data: ContactMessage = {
            name: body.name || '',
            email: body.email || '',
            discord: body.discord || '',
            role: ['admin', 'team', 'freelancer', 'client'].includes(body.role) ? body.role : 'client',
            subject: body.subject || '',
            message: body.message || ''
          }

          const result = await sendContactEmail(data)
          const contactEntry = {
            id: crypto.randomUUID(),
            ...data,
            createdAt: new Date().toISOString()
          }
          addContact(contactEntry)

          return apiJson({ success: true, ...result, contact: contactEntry })
        } catch (error) {
          return apiJson({ error: 'Failed to process contact form' }, 500)
        }
      }

      if (pathname === '/api/contacts' && request.method === 'GET') {
        const session = requireAdmin(request)
        if (!session && !isAdminRequest(request)) {
          return apiJson({ success: false, error: 'Unauthorized' }, 401)
        }

        const role = url.searchParams.get('role') as 'admin' | 'team' | 'freelancer' | 'client' | null
        const search = url.searchParams.get('search')?.toLowerCase() || ''
        let contacts = getContacts()

        if (role) contacts = contacts.filter((c) => c.role === role)
        if (search) {
          contacts = contacts.filter((c) =>
            c.name.toLowerCase().includes(search) ||
            c.email.toLowerCase().includes(search) ||
            (c.discord || '').toLowerCase().includes(search) ||
            c.subject.toLowerCase().includes(search) ||
            c.message.toLowerCase().includes(search)
          )
        }

        return apiJson({ success: true, data: contacts })
      }

      if (pathname === '/api/users' && request.method === 'GET') {
        const session = requireAdmin(request)
        if (!session && !isAdminRequest(request)) {
          return apiJson({ success: false, error: 'Unauthorized' }, 401)
        }

        const role = url.searchParams.get('role') as 'admin' | 'team' | 'freelancer' | 'client' | null
        let users = getUsers()
        if (role) users = users.filter((u) => u.role === role)

        const currentSession = getSession((request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''))

        return apiJson({ success: true, data: users, currentUser: currentSession ? { id: currentSession.userId, role: currentSession.role } : null })
      }

      if (pathname === '/api/users' && request.method === 'POST') {
        const session = requireAdmin(request)
        if (!session && !isAdminRequest(request)) {
          return apiJson({ success: false, error: 'Unauthorized' }, 401)
        }

        const body = await request.json()
        const user: UserRecord = {
          id: crypto.randomUUID(),
          name: body.name || 'Unnamed',
          email: body.email || '',
          password: body.password || '',
          role: ['admin', 'team', 'freelancer', 'client'].includes(body.role) ? body.role : 'client',
          createdAt: new Date().toISOString()
        }

        addUser(user)
        return apiJson({ success: true, data: user })
      }

      if (pathname.startsWith('/api/users/') && request.method === 'DELETE') {
        const session = requireAdmin(request)
        if (!session && !isAdminRequest(request)) {
          return apiJson({ success: false, error: 'Unauthorized' }, 401)
        }

        const userId = pathname.replace('/api/users/', '')
        const deleted = removeUser(userId)
        if (!deleted) return apiJson({ success: false, error: 'User not found' }, 404)

        return apiJson({ success: true, id: userId })
      }

      if (pathname === '/api/services' && request.method === 'GET') {
        const services = getServices()
        return apiJson({ success: true, data: services })
      }

      if (pathname === '/api/services' && request.method === 'POST') {
        const session = requireAdmin(request)
        if (!session && !isAdminRequest(request)) {
          return apiJson({ success: false, error: 'Unauthorized' }, 401)
        }

        const body = await request.json()
        const service: DevopsService = {
          id: crypto.randomUUID(),
          title: body.title || 'Untitled Service',
          description: body.description || '',
          category: ['infrastructure', 'security', 'observability', 'automation', 'platform'].includes(body.category) ? body.category : 'infrastructure',
          createdAt: new Date().toISOString()
        }
        addService(service)
        return apiJson({ success: true, data: service })
      }

      if (pathname.startsWith('/api/services/') && request.method === 'DELETE') {
        const session = requireAdmin(request)
        if (!session && !isAdminRequest(request)) {
          return apiJson({ success: false, error: 'Unauthorized' }, 401)
        }

        const serviceId = pathname.replace('/api/services/', '')
        const deleted = removeService(serviceId)
        if (!deleted) return apiJson({ success: false, error: 'Service not found' }, 404)
        return apiJson({ success: true, id: serviceId })
      }

      if (pathname === '/api/auth/login' && request.method === 'POST') {
        try {
          const body = await request.json()
          const result = login(body.email || '', body.password || '')
          if (!result) {
            return apiJson({ success: false, error: 'Invalid credentials' }, 401)
          }
          return apiJson({ success: true, data: result })
        } catch {
          return apiJson({ success: false, error: 'Invalid login request' }, 400)
        }
      }

      if (pathname === '/api/auth/me' && request.method === 'GET') {
        const session = requireAuth(request)
        if (!session) {
          return apiJson({ success: false, error: 'Unauthorized' }, 401)
        }
        // Fetch user details from store
        const user = getUsers().find((u) => u.id === session.userId)
        return apiJson({ success: true, data: { user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null } })
      }

      if (pathname === '/api/payment/checkout' && request.method === 'POST') {
        const stripeSecret = process.env.STRIPE_SECRET
        if (!stripeSecret) {
          return apiJson({ success: false, error: 'Stripe not configured' }, 500)
        }

        try {
          const body = await request.json()
          const amount = Number(body.amount || 19900)
          const currency = (body.currency || 'usd').toLowerCase()
          const description = body.description || 'Portfolio consultation'
          const successUrl = body.successUrl || 'https://skyedev.org/payment-success'
          const cancelUrl = body.cancelUrl || 'https://skyedev.org/payment-cancel'

          const stripeBody = new URLSearchParams()
          stripeBody.append('payment_method_types[]', 'card')
          stripeBody.append('mode', 'payment')
          stripeBody.append('success_url', successUrl)
          stripeBody.append('cancel_url', cancelUrl)
          stripeBody.append('line_items[0][price_data][currency]', currency)
          stripeBody.append('line_items[0][price_data][product_data][name]', description)
          stripeBody.append('line_items[0][price_data][unit_amount]', String(amount))
          stripeBody.append('line_items[0][quantity]', '1')

          const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Bearer ${stripeSecret}`
            },
            body: stripeBody.toString()
          })

          const stripeData = await stripeResponse.json()
          if (!stripeResponse.ok) {
            throw new Error(stripeData.error?.message || 'Stripe checkout failed')
          }

          return apiJson({ success: true, data: stripeData })
        } catch (error) {
          return apiJson({ success: false, error: error instanceof Error ? error.message : 'Payment creation failed' }, 500)
        }
      }

      if (pathname.startsWith('/api/')) {
        return apiJson({ error: 'API endpoint not found' }, 404)
      }

      // Static files
      const filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname)
      if (existsSync(filePath) && isRegularFile(filePath)) {
        const file = Bun.file(filePath)
        const mimeType = getMimeType(filePath)
        const cacheHeaders = getCacheHeaders(filePath)
        return new Response(file, { headers: { 'Content-Type': mimeType, ...cacheHeaders } })
      }

      if (pathname.startsWith('/assets/') || pathname.startsWith('/.well-known/')) {
        return new Response('Not found', { status: 404 })
      }

      const indexFile = Bun.file(join(PUBLIC_DIR, 'index.html'))
      return new Response(indexFile, { headers: { 'Content-Type': 'text/html' } })
    }
  })

  console.log(`🚀 Server running at http://localhost:${PORT}`)
  console.log(`📁 Serving static files from: ${PUBLIC_DIR}`)

  return server
}
