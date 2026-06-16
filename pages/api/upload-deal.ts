import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = [
  'You are reading one or more documents about a self-storage facility for sale.',
  'The documents may include an offering memorandum, rent roll, T12, photos, broker package, or any combination.',
  'Extract all available deal information and merge it into one complete profile.',
  '',
  'CRITICAL OUTPUT FORMAT - YOU MUST FOLLOW THESE RULES EXACTLY:',
  '- Return ONLY a single raw JSON object. Nothing before it. Nothing after it.',
  '- No markdown. No backticks. No ```json fences. No code blocks of any kind.',
  '- No comments, explanations, or prose outside the JSON.',
  '- No trailing commas. No JavaScript-style comments inside JSON.',
  '- Every key and string value must use double quotes.',
  '- Use null (not the string "null") for any field you cannot find.',
  '- The entire response must be valid JSON parseable by JSON.parse() with zero preprocessing.',
  '',
  'Return ONLY the following JSON object filled in with extracted values:',
  '{',
  '  "facilityName": null,',
  '  "address": null,',
  '  "city": null,',
  '  "state": null,',
  '  "zipCode": null,',
  '  "msaName": null,',
  '  "askingPrice": null,',
  '  "unitCount": null,',
  '  "totalUnits": null,',
  '  "capRate": null,',
  '  "noi": null,',
  '  "t12NOI": null,',
  '  "t3NOI": null,',
  '  "t12Revenue": null,',
  '  "t12TotalExpenses": null,',
  '  "t12Payroll": null,',
  '  "t12ManagementFees": null,',
  '  "t12Marketing": null,',
  '  "t12Utilities": null,',
  '  "t12OfficeEmployee": null,',
  '  "t12Administrative": null,',
  '  "t12RepairsMaintenance": null,',
  '  "t12Tax": null,',
  '  "t12Insurance": null,',
  '  "t12OtherExpenses": null,',
  '  "occupancy": null,',
  '  "currentOccupancy": null,',
  '  "targetOccupancy": null,',
  '  "currentAvgRentPerUnit": null,',
  '  "marketAvgRentPerUnit": null,',
  '  "monthsToStabilization": null,',
  '  "yearBuilt": null,',
  '  "sqft": null,',
  '  "totalSF": null,',
  '  "broker1Name": null,',
  '  "broker2Name": null,',
  '  "brokerPhone1": null,',
  '  "brokerPhone2": null,',
  '  "brokerEmail1": null,',
  '  "brokerEmail2": null,',
  '  "brokerageName": null,',
  '  "sellerY1": { "revenue": null, "expenses": null, "noi": null },',
  '  "sellerY2": { "revenue": null, "expenses": null, "noi": null },',
  '  "sellerY3": { "revenue": null, "expenses": null, "noi": null },',
  '  "sellerY4": { "revenue": null, "expenses": null, "noi": null },',
  '  "sellerY5": { "revenue": null, "expenses": null, "noi": null },',
  '  "highlights": [],',
  '  "operatingExpensesDetailAvailable": false,',
  '  "operatingExpenses": null',
  '}',
  '',
  'FIELD NOTES:',
  '- city: REQUIRED. Parse from address if needed e.g. "Tulsa" from "12331 East 11th St, Tulsa, OK"',
  '- state: REQUIRED. 2-letter code. Parse from address if needed e.g. "OK" from "Tulsa, OK"',
  '- capRate: decimal e.g. 0.065 for 6.5%',
  '- t3NOI: trailing 3-month NOI annualized (multiply 3-month figure by 4). Must differ from t12NOI. null if not found.',
  '- currentAvgRentPerUnit: average monthly rent per unit in dollars',
  '- marketAvgRentPerUnit: market rate average monthly rent per unit in dollars',
  '',
  'OPERATING EXPENSE EXTRACTION RULES:',
  '1. Extract EVERY individual named expense row. Preserve original label exactly as it appears.',
  '2. If individual rows exist, EXCLUDE all summary and total rows.',
  '   Never include rows labeled: "Total Operating Expenses", "Total Expenses", "Operating Expenses",',
  '   "Other Expenses", "Total", "Expenses Total". These are summaries - skip them.',
  '3. Only include a summary row if NO individual rows exist anywhere in the documents.',
  '4. Multi-column T12 with 12 monthly columns plus annual total: use the annual total column as amount.',
  '5. Do not include revenue lines. Do not double-count rows.',
  '6. If no expense detail exists at all, set operatingExpenses to null and operatingExpensesDetailAvailable to false.',
  '7. If you find individual rows, set operatingExpensesDetailAvailable to true.',
  '',
  'EXAMPLE - correct operatingExpenses when individual rows exist:',
  '[',
  '  { "label": "Property Taxes", "amount": 37200, "source": "T12", "confidence": 0.97 },',
  '  { "label": "Insurance", "amount": 16800, "source": "T12", "confidence": 0.95 },',
  '  { "label": "Snow Removal", "amount": 1720, "source": "T12", "confidence": 0.88 },',
  '  { "label": "Merchant Processing Fees", "amount": 1410, "source": "T12", "confidence": 0.85 }',
  ']',
  'Each operatingExpenses element: label (string), amount (number, annual dollars), source (string or null), confidence (number 0.0-1.0)',
].join('\n')

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
  if (!requireAuth(req, res)) return
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
      max_tokens: 3000,
      messages: [{ role: 'user', content: contentBlocks }],
    })
    const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()

    // Strip markdown fences then isolate the JSON object between first { and last }
    let jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const jsonStart = jsonStr.indexOf('{')
    const jsonEnd   = jsonStr.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1)
    }

    let extracted: unknown
    try {
      extracted = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('[upload-deal] JSON.parse failed:', String(parseErr))
      console.error('[upload-deal] raw output (first 2000):', raw.slice(0, 2000))
      throw parseErr
    }

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
