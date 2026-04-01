import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { sendContactEmail, ContactMessage } from './routes/contact'
import { getContacts, addContact, getUsers, addUser, removeUser, UserRecord } from './data-store'

const PORT = 3001
// Use absolute path in container, relative path in dev
const PUBLIC_DIR = process.env.NODE_ENV === 'production'
  ? '/app/backend/public'
  : join(import.meta.dir, '../public')

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-token'
  const isAdminRequest = (request: any) => request.headers.get('x-admin-token') === ADMIN_TOKEN
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
    'ttf': 'font/ttf',
  }

  return mimeTypes[ext || ''] || 'application/octet-stream'
}

function getCacheHeaders(filePath: string): Record<string, string> {
  const ext = filePath.split('.').pop()?.toLowerCase()

  // Immutable assets (hashed filenames)
  if (filePath.includes('/assets/')) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' } // 1 year
  }

  // Long cache for fonts
  if (['woff', 'woff2', 'ttf'].includes(ext || '')) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' } // 1 year
  }

  // Medium cache for images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico'].includes(ext || '')) {
    return { 'Cache-Control': 'public, max-age=604800' } // 1 week
  }

  // Short cache for HTML
  if (ext === 'html') {
    return { 'Cache-Control': 'public, max-age=3600, must-revalidate' } // 1 hour, with revalidation
  }

  // No cache for everything else
  return { 'Cache-Control': 'public, max-age=0, must-revalidate' }
}

function isRegularFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function isAdminRequest(request: any): boolean {
  const token = request.headers.get('x-admin-token') || ''
  const expected = process.env.ADMIN_TOKEN || 'admin-secret'
  return token === expected
}

export function startServer() {
  const server = Bun.serve({
    port: PORT,
    hostname: '0.0.0.0',
    development: process.env.NODE_ENV !== 'production',
    async fetch(request: any) {
      const url = new URL(request.url)
      const pathname = url.pathname

      // Health check endpoint
      if (pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString()
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Payment return pages (success/cancel)
      if (pathname === '/payment-success') {
        return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Payment Success</title></head><body style="background:#050a16;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>Payment completed</h1><p>Thank you! Your transaction was successful.</p><a href="/" style="color:#22d3ee;text-decoration:none;">Return to homepage</a></div></body></html>`, {
          headers: { 'Content-Type': 'text/html' }
        })
      }

      if (pathname === '/payment-cancel') {
        return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Payment Canceled</title></head><body style="background:#050a16;color:#f8fafc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1>Payment canceled</h1><p>Your payment was canceled. You can retry or contact us if you need help.</p><a href="/" style="color:#22d3ee;text-decoration:none;">Return to homepage</a></div></body></html>`, {
          headers: { 'Content-Type': 'text/html' }
        })
      }

      // API endpoints
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

          return new Response(JSON.stringify({ ...result, contact: contactEntry }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to process contact form' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }

      if (pathname === '/api/contacts' && request.method === 'GET') {
        const url = new URL(request.url)
        const role = url.searchParams.get('role') as 'admin' | 'team' | 'freelancer' | 'client' | null
        const search = url.searchParams.get('search')?.toLowerCase() || ''

        let contacts = getContacts()

        if (role) {
          contacts = contacts.filter((c) => c.role === role)
        }

        if (search) {
          contacts = contacts.filter((c) =>
            c.name.toLowerCase().includes(search) ||
            c.email.toLowerCase().includes(search) ||
            (c.discord || '').toLowerCase().includes(search) ||
            c.subject.toLowerCase().includes(search) ||
            c.message.toLowerCase().includes(search)
          )
        }

        return new Response(JSON.stringify({ success: true, data: contacts }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (pathname === '/api/users' && request.method === 'GET') {
        const url = new URL(request.url)
        const role = url.searchParams.get('role') as 'admin' | 'team' | 'freelancer' | 'client' | null
        let users = getUsers()

        if (role) {
          users = users.filter((u) => u.role === role)
        }

        return new Response(JSON.stringify({ success: true, data: users }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (pathname === '/api/users' && request.method === 'POST') {
        if (!isAdminRequest(request)) {
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const body = await request.json()
        const user: UserRecord = {
          id: crypto.randomUUID(),
          name: body.name || 'Unnamed',
          email: body.email || '',
          role: ['admin', 'team', 'freelancer', 'client'].includes(body.role) ? body.role : 'client',
          createdAt: new Date().toISOString()
        }

        addUser(user)

        return new Response(JSON.stringify({ success: true, data: user }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (pathname.startsWith('/api/users/') && request.method === 'DELETE') {
        if (!isAdminRequest(request)) {
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const userId = pathname.replace('/api/users/', '')
        const deleted = removeUser(userId)

        if (!deleted) {
          return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ success: true, id: userId }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (pathname === '/api/payment/checkout' && request.method === 'POST') {
        const stripeSecret = process.env.STRIPE_SECRET
        if (!stripeSecret) {
          return new Response(JSON.stringify({ success: false, error: 'Stripe not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
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

          return new Response(JSON.stringify({ success: true, data: stripeData }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Payment creation failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }

      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'API endpoint not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Static file serving
      let filePath = join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname)

      if (existsSync(filePath) && isRegularFile(filePath)) {
        const file = Bun.file(filePath)
        const mimeType = getMimeType(filePath)
        const cacheHeaders = getCacheHeaders(filePath)
        return new Response(file, {
          headers: {
            'Content-Type': mimeType,
            ...cacheHeaders
          }
        })
      }

      // Fallback to index.html for SPA routing
      if (pathname.startsWith('/assets/')) {
        return new Response('Not found', { status: 404 })
      }

      if (pathname.startsWith('/.well-known/')) {
        return new Response('Not found', { status: 404 })
      }

      const indexFile = Bun.file(join(PUBLIC_DIR, 'index.html'))
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
  })

  console.log(`🚀 Server running at http://localhost:${PORT}`)
  console.log(`📁 Serving static files from: ${PUBLIC_DIR}`)

  return server
}
