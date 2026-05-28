import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `Extract self-storage facility deal information from this document. Return ONLY a valid JSON object with no markdown fences, no commentary, and no extra text. Use null for any field you cannot find.

{
  "facilityName": string or null,
  "address": string or null,
  "city": string or null,
  "state": string (2-letter code) or null,
  "zipCode": string or null,
  "askingPrice": number (in dollars) or null,
  "unitCount": number or null,
  "capRate": number (as decimal e.g. 0.065 for 6.5%) or null,
  "noi": number (annual, in dollars) or null,
  "occupancy": number (percentage 0-100) or null,
  "yearBuilt": number or null,
  "sqft": number or null,
  "highlights": array of up to 5 key deal highlight strings
}`

type Extracted = {
  facilityName: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  askingPrice: number | null
  unitCount: number | null
  capRate: number | null
  noi: number | null
  occupancy: number | null
  yearBuilt: number | null
  sqft: number | null
  highlights: string[]
}

async function extractFromText(text: string): Promise<Extracted> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nDocument text:\n${text.slice(0, 20000)}` }],
  })
  const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()
  return JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
}

async function extractFromBase64(base64: string, mimeType: string): Promise<Extracted> {
  const isImage = mimeType.startsWith('image/')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlock: any = isImage
    ? { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [contentBlock, { type: 'text', text: EXTRACTION_PROMPT }],
    }],
  })
  const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()
  return JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
}

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { fileName, mimeType, data } = req.body as { fileName?: string; mimeType: string; data: string }
  if (!data || !mimeType) return res.status(400).json({ error: 'Missing data or mimeType' })

  try {
    let extracted: Extracted

    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      extracted = await extractFromBase64(data, mimeType)

    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileName?.toLowerCase().endsWith('.xlsx')
    ) {
      const xlsx = await import('xlsx')
      const buf = Buffer.from(data, 'base64')
      const wb = xlsx.read(buf, { type: 'buffer' })
      const text = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name]
        return `Sheet: ${name}\n${xlsx.utils.sheet_to_csv(ws)}`
      }).join('\n\n')
      extracted = await extractFromText(text)

    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName?.toLowerCase().endsWith('.docx')
    ) {
      const mammoth = await import('mammoth')
      const buf = Buffer.from(data, 'base64')
      const result = await mammoth.extractRawText({ buffer: buf })
      extracted = await extractFromText(result.value)

    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileName?.toLowerCase().endsWith('.pptx')
    ) {
      const JSZip = (await import('jszip')).default
      const buf = Buffer.from(data, 'base64')
      const zip = await JSZip.loadAsync(buf)
      const slideFiles = Object.keys(zip.files)
        .filter(f => /ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort()
      const slideTexts: string[] = []
      for (const sf of slideFiles) {
        const xml = await zip.files[sf].async('text')
        slideTexts.push(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      }
      extracted = await extractFromText(slideTexts.join('\n\n'))

    } else {
      return res.status(400).json({ error: `Unsupported file type: ${mimeType}` })
    }

    return res.status(200).json(extracted)
  } catch (err) {
    console.error('upload-deal extraction error:', err)
    return res.status(500).json({ error: 'Extraction failed', detail: String(err) })
  }
}
