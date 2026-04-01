const FORMSPREE_ID = 'meelkpqg'

export interface ContactMessage {
  name: string
  email: string
  discord?: string
  role?: 'admin' | 'team' | 'freelancer' | 'client'
  subject: string
  message: string
}

export async function sendContactEmail(data: ContactMessage) {
  // Fast-path for tests and local development without external network dependency
  if (process.env.NODE_ENV === 'test' || process.env.FORMSPREE_MOCK === '1') {
    return {
      success: true,
      message: 'Test mode: message received (mock)',
    }
  }

  try {
    const response = await fetch(
      `https://formspree.io/f/${FORMSPREE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          discord: data.discord,
          role: data.role,
          subject: data.subject,
          message: data.message,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Formspree error: ${response.status}`)
    }

    return {
      success: true,
      message: 'Message received. I will respond shortly!',
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to send message. Please try again later.',
    }
  }
}
