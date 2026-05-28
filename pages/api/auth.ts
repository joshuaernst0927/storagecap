import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { password } = req.body ?? {}
  const adminPw = process.env.ADMIN_PASSWORD || 'YEM2025'
  if (password && password === adminPw) {
    res.json({ ok: true })
  } else {
    res.status(401).json({ ok: false })
  }
}
