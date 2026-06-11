import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const upstream = await fetch('http://157.230.186.240:8000/generate-loi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(60000),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}`, detail: text })
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    const filename = `LOI-${String(req.body?.property_name || 'property').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', buffer.length)
    res.send(buffer)
  } catch (err) {
    console.error('generate-loi proxy error:', err)
    res.status(500).json({ error: 'Failed to reach LOI generation server', detail: String(err) })
  }
}
