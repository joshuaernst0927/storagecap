import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { Lead } from '@/lib/leadsData'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const lead: Lead = req.body

  const signalLines: string[] = []
  if (lead.distressSignals.taxDelinquency) signalLines.push('Property tax delinquency')
  if (lead.distressSignals.fireCodeViolations) signalLines.push('Open fire code violations')
  if (lead.distressSignals.lisPendens) signalLines.push('Active court filing / lis pendens')
  if (lead.distressSignals.decliningOccupancy) signalLines.push('Declining occupancy trend')
  if (lead.distressSignals.outOfStateOwner) signalLines.push('Out-of-state ownership')
  if (lead.distressSignals.longTermOwner) signalLines.push(`Long-term holder (${lead.distressSignals.yearsOwned ?? '15+'} years)`)
  if ((lead.distressSignals.ownerAge ?? 0) >= 65) signalLines.push(`Owner approximately ${lead.distressSignals.ownerAge} years old`)

  const prompt = `You are a professional real estate acquisitions specialist at YEM Acquisitions writing a personal, direct-mail outreach letter to the owner of a self-storage facility. The goal is to start a relationship — not to make a hard pitch.

Property Information:
- Facility: ${lead.facilityName || 'Self-Storage Facility'}
- Address: ${lead.address}, ${lead.city}, ${lead.state}${lead.zipCode ? ' ' + lead.zipCode : ''}
- Owner Name: ${lead.ownerName}
${lead.ownerEntity ? `- Owner Entity: ${lead.ownerEntity}` : ''}
${lead.unitCount ? `- Unit Count: ${lead.unitCount}` : ''}
${lead.askingPrice ? `- Listed Asking Price: $${lead.askingPrice.toLocaleString()}` : ''}
- Lead Source: ${lead.source}

Observed Signals (use these to show you've done research, but reference them gently and without accusation):
${signalLines.length ? signalLines.map(l => `- ${l}`).join('\n') : '- Property identified as a potential acquisition opportunity'}

Write a 4-paragraph direct-mail letter that:
1. Opens with a warm, personal introduction. Mention the facility by city. Do not open with "I hope this letter finds you well."
2. Shows you've done your homework — reference one specific signal gently and empathetically.
3. Explains who we are: YEM Acquisitions, private buyer focused exclusively on self-storage, close in 30-45 days, no brokers required.
4. Makes a soft, no-pressure ask for a 10-minute conversation. Close with "[Your Name]" and "[Phone] | [Email]".

Tone: Direct, warm, professional. No sales jargon. One real person to another.
Format: Plain paragraphs only. No bullets. No subject line. Start with "Dear [Mr./Ms. Last Name],"`

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
    return res.status(500).json({ error: 'Letter generation failed.' })
  }
}
