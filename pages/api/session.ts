/**
 * /api/session
 *
 * GET — returns { ok: true } if a valid session cookie exists, { ok: false } otherwise.
 * Used by AuthGate on every page load to validate the session server-side.
 * Public endpoint (safe — returns no data, just boolean).
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { isSessionValid } from '@/lib/serverAuth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  res.json({ ok: isSessionValid(req) })
}
