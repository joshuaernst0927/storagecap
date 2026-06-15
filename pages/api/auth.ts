/**
 * /api/auth
 *
 * POST { password } — verify password server-side, issue HTTP-only session cookie.
 * POST { action: 'logout' } — clear session cookie.
 *
 * Public endpoint — no auth required to reach it.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { setSessionCookie, clearSessionCookie } from '@/lib/serverAuth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Logout
  if (req.body?.action === 'logout') {
    clearSessionCookie(res)
    return res.json({ ok: true })
  }

  // Login
  const { password } = req.body ?? {}
  const adminPw = process.env.ADMIN_PASSWORD

  if (!adminPw) {
    console.error('ADMIN_PASSWORD environment variable is not set')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  if (password && password === adminPw) {
    setSessionCookie(res)
    return res.json({ ok: true })
  }

  return res.status(401).json({ ok: false })
}
