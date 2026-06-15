import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const p = req.body

  const distressLines: string[] = []
  if (p.distressSignals?.taxDelinquency) {
    distressLines.push(`Tax delinquency of $${p.distressSignals.taxDelinquencyAmount?.toLocaleString()} (${p.distressSignals.taxDelinquencyYears} year${p.distressSignals.taxDelinquencyYears !== 1 ? 's' : ''})`)
  }
  if (p.distressSignals?.fireCodeViolations) {
    distressLines.push(`${p.distressSignals.fireCodeCount} open fire code violations`)
  }
  if (p.distressSignals?.lisPendens) {
    distressLines.push(`Active lis pendens ($${p.distressSignals.lisPendensAmount?.toLocaleString()})`)
  }
  if (p.distressSignals?.codeViolations?.length) {
    distressLines.push(`${p.distressSignals.codeViolations.length} unresolved code violations`)
  }
  if (p.distressSignals?.decliningOccupancy) {
    distressLines.push(`Declining occupancy (${p.distressSignals.occupancyTrend}% YoY)`)
  }
  if (p.distressSignals?.ownerAge >= 65) {
    distressLines.push(`Owner is approximately ${p.distressSignals.ownerAge} years old`)
  }
  if (p.distressSignals?.yearsOwned >= 15) {
    distressLines.push(`Owner has held the property for ${p.distressSignals.yearsOwned} years`)
  }

  const prompt = `You are a professional real estate acquisitions specialist writing a personal, direct-mail outreach letter to the owner of a self-storage facility. The goal is to start a relationship — not to make a hard pitch.

Property Information:
- Facility: ${p.facilityName}
- Address: ${p.address || ''}, ${p.city}, ${p.state}
- Owner Name: ${p.ownerName || 'Owner'}
- Owner Entity: ${p.ownerEntity || 'not known'}
- Unit Count: ${p.unitCount}
- Year Built: ${p.yearBuilt}
- Occupancy: ${p.occupancy}%

Observed Signals (use these to show you've done research, but reference them gently and without accusation):
${distressLines.map(l => `- ${l}`).join('\n')}

Write a 4-paragraph direct-mail letter that:
1. Opens with a warm, personal introduction (no corporate boilerplate). Mention the facility by name and city. Do not open with "I hope this letter finds you well."
2. Shows you've done your homework on the facility — reference something specific but don't list every signal. Be empathetic, not pushy.
3. Explains briefly who we are (YEM Acquisitions, private buyer, focused on self-storage, close quickly) and what we offer sellers.
4. Makes a soft, no-pressure ask for a 10-minute phone call. Closes with a name placeholder "[Your Name]" and contact info "[Phone] | [Email]".

Tone: Direct, warm, professional. No sales jargon. Write as if from one real person to another. The letter should feel like it came from someone who genuinely wants to help them solve a problem — not a form letter.

Format: Plain paragraphs only. No bullet points. No subject line. Start with the salutation "Dear [Mr./Ms. Last Name]," using the owner's actual last name.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    const letter = message.content[0].type === 'text' ? message.content[0].text : ''
    return res.status(200).json({ letter })
  } catch (err) {
    console.error('Anthropic error:', err)
    return res.status(500).json({ error: 'Letter generation failed. Check your ANTHROPIC_API_KEY.' })
  }
}
