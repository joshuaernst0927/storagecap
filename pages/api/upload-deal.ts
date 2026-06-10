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
  "city": string or null (REQUIRED — parse from address field if needed, e.g. "Tulsa" from "12331 East 11th St, Tulsa, OK"),
  "state": string (2-letter code) or null (REQUIRED — parse from address field if needed, e.g. "OK" from "Tulsa, OK"),
  "zipCode": string or null,
  "msaName": string or null (Metropolitan Statistical Area name if mentioned),
  "askingPrice": number (in dollars) or null,
  "unitCount": number or null,
  "totalUnits": number or null,
  "capRate": number (as decimal e.g. 0.065 for 6.5%) or null,
  "noi": number (annual, in dollars) or null,
  "t12NOI": number (trailing 12-month NOI in dollars) or null,
  "t3NOI": number (trailing 3-month NOI annualized in dollars) or null,
  "t12Revenue": number (trailing 12-month total revenue in dollars) or null,
  "t12TotalExpenses": number (trailing 12-month total expenses in dollars) or null,
  "t12Payroll": number or null,
  "t12ManagementFees": number or null,
  "t12Marketing": number or null,
  "t12Utilities": number or null,
  "t12OfficeEmployee": number or null,
  "t12Administrative": number or null,
  "t12RepairsMaintenance": number or null,
  "t12Tax": number or null,
  "t12Insurance": number or null,
  "t12OtherExpenses": number or null,
  "occupancy": number (percentage 0-100) or null,
  "currentOccupancy": number (percentage 0-100) or null,
  "targetOccupancy": number (percentage 0-100) or null,
  "currentAvgRentPerUnit": number (average monthly rent per unit in dollars) or null,
  "marketAvgRentPerUnit": number (market rate average monthly rent per unit in dollars — look at rent comparables, competitor rents, or market rate tables and average them if needed) or null,
  "monthsToStabilization": number or null,
  "yearBuilt": number or null (look for year built, year constructed, or built in XXXX),
  "sqft": number or null (total rentable square footage),
  "totalSF": number or null (same as sqft — total net rentable area),
  "broker1Name": string or null (look for listing broker, contact, or agent name),
  "broker2Name": string or null,
  "brokerPhone1": string or null,
  "brokerPhone2": string or null,
  "brokerEmail1": string or null,
  "brokerEmail2": string or null,
  "sellerY1": { "revenue": number or null, "expenses": number or null, "noi": number or null } or null,
  "sellerY2": { "revenue": number or null, "expenses": number or null, "noi": number or null } or null,
  "sellerY3": { "revenue": number or null, "expenses": number or null, "noi": number or null } or null,
  "sellerY4": { "revenue": number or null, "expenses": number or null, "noi": number or null } or null,
  "sellerY5": { "revenue": number or null, "expenses": number or null, "noi": number or null } or null,
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

  if (mimeType === 'text/plain') {
    const text = Buffer.from(data, 'base64').toString('utf-8')
    return [{ type: 'text', text: `--- File: ${label} (text extracted from PDF) ---\n\n${text}` }]
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

  return [{ type: 'text', text: `--- File: ${label} ---\n\n${text.slice(0, 60000)}` }]
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
      max_tokens: 2048,
      messages: [{ role: 'user', content: contentBlocks }],
    })
    const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()
    const extracted = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
    return res.status(200).json(extracted)
  } catch (err: unknown) {
    let detail = String(err)
    if (err instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ae = err as any
      if (ae.status && ae.error?.error?.message) {
        detail = `Anthropic ${ae.status}: ${ae.error.error.message}`
      } else if (ae.status) {
        detail = `Anthropic ${ae.status}: ${err.message}`
      } else {
        detail = err.message
      }
    }
    console.error('[upload-deal] extraction failed:', detail)
    return res.status(500).json({ error: 'Extraction failed', detail })
  }
}
