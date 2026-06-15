import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' })

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()
    const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(clean)

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('[generate-loi-narrative] error:', err)
    return res.status(500).json({ error: 'Narrative generation failed', detail: String(err) })
  }
}
