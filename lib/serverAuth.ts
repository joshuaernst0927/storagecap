/**
 * lib/serverAuth.ts
 * Server-side session cookie helpers.
 * Never imported by client code — Next.js tree-shakes server-only imports safely,
 * but this file uses 'crypto' (Node built-in) so it must only run server-side.
 *
 * Cookie: yem_session=<hmac>.<timestamp>
 * HMAC signed with SESSION_SECRET env var.
 * 7-day expiry validated both by cookie MaxAge and by timestamp in the value.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createHmac } from 'crypto'

const COOKIE_NAME = 'yem_session'
const SESSION_DAYS = 7
const SESSION_MS   = SESSION_DAYS * 24 * 60 * 60 * 1000

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET environment variable is not set')
  return s
}

function sign(timestamp: number): string {
  return createHmac('sha256', getSecret())
    .update(`authenticated:${timestamp}`)
    .digest('hex')
}

/** Build the signed cookie value. */
export function buildSessionValue(): string {
  const ts = Date.now()
  return `${sign(ts)}.${ts}`
}

/** Verify a cookie value. Returns true if valid and not expired. */
export function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false
  const dot = value.lastIndexOf('.')
  if (dot < 0) return false
  const hmac = value.slice(0, dot)
  const ts   = parseInt(value.slice(dot + 1), 10)
  if (!isNaN(ts) && Date.now() - ts > SESSION_MS) return false
  try {
    const expected = sign(ts)
    // Constant-time compare via HMAC of both values
    const a = createHmac('sha256', getSecret()).update(hmac).digest('hex')
    const b = createHmac('sha256', getSecret()).update(expected).digest('hex')
    return a === b
  } catch {
    return false
  }
}

/** Set the session cookie on a response. */
export function setSessionCookie(res: NextApiResponse): void {
  const value   = buildSessionValue()
  const maxAge  = SESSION_DAYS * 24 * 60 * 60
  const secure  = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${value}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  )
}

/** Clear the session cookie (logout). */
export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  )
}

/** Read and verify the session cookie from an incoming request. */
export function isSessionValid(req: NextApiRequest): boolean {
  const raw = req.cookies?.[COOKIE_NAME]
  return verifySessionValue(raw)
}

/**
 * requireAuth — call at the top of any protected API route.
 * Returns true if the request is authenticated.
 * Returns false AND sends a 401 response if not.
 * Usage:
 *   if (!requireAuth(req, res)) return
 */
export function requireAuth(req: NextApiRequest, res: NextApiResponse): boolean {
  if (isSessionValid(req)) return true
  res.status(401).json({ error: 'Unauthorized' })
  return false
}
