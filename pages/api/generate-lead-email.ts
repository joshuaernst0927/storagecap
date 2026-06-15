import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'
import { Lead } from '@/lib/leadsData'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const lead: Lead = req.body
  const firstName = lead.ownerName.split(' ')[0] || lead.ownerName

  // Map distress signals to natural language — never name the specific record
  const distressHints: string[] = []
  if (lead.distressSignals.taxDelinquency) distressHints.push('the property may have some financial challenges')
  if (lead.distressSignals.fireCodeViolations) distressHints.push('there may be some deferred maintenance')
  if (lead.distressSignals.lisPendens) distressHints.push('there may be some legal complexities with the property')
  if (lead.distressSignals.decliningOccupancy) distressHints.push('occupancy may have softened recently')
  if (lead.distressSignals.longTermOwner) distressHints.push(`you have owned it for ${lead.distressSignals.yearsOwned ?? 'many'} years`)
  if ((lead.distressSignals.ownerAge ?? 0) >= 65) distressHints.push('you may be thinking about your next chapter')
  if (lead.distressSignals.outOfStateOwner) distressHints.push('managing it from a distance can be challenging')

  const distressContext = distressHints.length > 0
    ? `Context about the owner/property (incorporate ONE naturally, never cite the source): ${distressHints[0]}`
    : 'No specific distress signals — write a general warm outreach.'

  const prompt = `You are writing a brief, personal outreach email from Joshua Ernst at YEM Acquisitions to the owner of a self-storage facility. This is a cold email — keep it short, warm, and non-pushy.

Lead Details:
- Owner first name: ${firstName}
- Facility / Property: ${lead.facilityName || 'self-storage facility'} in ${lead.city}, ${lead.state}
- Owner entity: ${lead.ownerEntity || 'unknown'}
${lead.distressSignals.yearsOwned ? `- Years of ownership: ${lead.distressSignals.yearsOwned}` : ''}
${lead.distressSignals.ownerAge ? `- Estimated owner age: ${lead.distressSignals.ownerAge}` : ''}
${lead.askingPrice ? `- Listed asking price: $${lead.askingPrice.toLocaleString()}` : ''}
${distressContext}

Write a cold outreach email with:
1. A subject line that is personal and specific (mention the city, not generic). No clickbait.
2. A body that is 3 short paragraphs:
   - Para 1: Personal intro. Mention the facility/city. Show you know something specific about their situation (use the context above, but naturally — don't reveal how you found them).
   - Para 2: Who we are: YEM Acquisitions, private buyer focused exclusively on self-storage, no brokers required, close in 30-45 days, confidential process.
   - Para 3: Soft ask — just want a 10-minute call to see if there's a fit. No obligation.
3. Sign off as "Joshua Ernst" with title "YEM Acquisitions | 516.305.2484"

Rules:
- Never say "I hope this email finds you well"
- Never say "I came across your property" or reference how you found them
- Write like a real person, not a marketing email
- Keep total body under 180 words
- Subject line max 60 characters

Return in this exact JSON format:
{"subject": "...", "body": "..."}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON from response (may be wrapped in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Could not parse email from AI response' })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string }
    return res.status(200).json({ subject: parsed.subject, body: parsed.body })
  } catch (err) {
    console.error('Email generation error:', err)
    return res.status(500).json({ error: 'Email generation failed.' })
  }
}
