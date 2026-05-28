import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `You are reading one or more documents about a self-storage facility for sale.
The documents may include an offering memorandum, rent roll, T12, photos, broker package, or any combination.
Extract all available deal information and merge it into one complete profile.
Return ONLY a valid JSON object — no markdown fences, no commentary, no extra text. Use null for any field you cannot find.

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

type FileInput = { fileName?: string; mimeType: string; data: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fileToBlocks(f: FileInput): Promise<any[]> {
  const { fileName, mimeType, data } = f
  const label = fileName || 'document'

  if (mimeType === 'application/pdf') {
    return [
      { type: 'text', text: `--- File: ${label} ---` },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
    ]
  }

  if (mimeType.startsWith('image/')) {
    return [
      { type: 'text', text: `--- File: ${label} ---` },
      { type: 'image', source: { type: 'base64', media_type: mimeType, data } },
    ]
  }

  let text = ''
  if (mimeType.includes('spreadsheetml') || fileName?.toLowerCase().endsWith('.xlsx')) {
    const xlsx = await import('xlsx')
    const buf = Buffer.from(data, 'base64')
    const wb = xlsx.read(buf, { type: 'buffer' })
    text = wb.SheetNames.map(n => `Sheet: ${n}\n${xlsx.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n')
  } else if (mimeType.includes('wordprocessingml') || fileName?.toLowerCase().endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const buf = Buffer.from(data, 'base64')
    const result = await mammoth.extractRawText({ buffer: buf })
    text = result.value
  } else if (mimeType.includes('presentationml') || fileName?.toLowerCase().endsWith('.pptx')) {
    const JSZip = (await import('jszip')).default
    const buf = Buffer.from(data, 'base64')
    const zip = await JSZip.loadAsync(buf)
    const slideFiles = Object.keys(zip.files)
      .filter(sf => /ppt\/slides\/slide\d+\.xml$/.test(sf))
      .sort()
    const parts: string[] = []
    for (const sf of slideFiles) {
      const xml = await zip.files[sf].async('text')
      parts.push(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    }
    text = parts.join('\n\n')
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  return [{ type: 'text', text: `--- File: ${label} ---\n\n${text.slice(0, 20000)}` }]
}

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { files } = req.body as { files: FileInput[] }
  if (!files?.length) return res.status(400).json({ error: 'No files provided' })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentBlocks: any[] = []
    for (const f of files) {
      const blocks = await fileToBlocks(f)
      contentBlocks.push(...blocks)
    }
    contentBlocks.push({ type: 'text', text: EXTRACTION_PROMPT })

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: contentBlocks }],
    })
    const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()
    const extracted = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
    return res.status(200).json(extracted)
  } catch (err) {
    console.error('upload-deal extraction error:', err)
    return res.status(500).json({ error: 'Extraction failed', detail: String(err) })
  }
}
