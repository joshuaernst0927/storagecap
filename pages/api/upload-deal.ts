import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Extraction tool schema ────────────────────────────────────────────────────
// Claude is forced to call this tool — it cannot emit free-form text.
// The SDK validates the response is a ToolUseBlock with structured input.
// This eliminates all JSON hand-writing and parse errors permanently.

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'extract_deal',
  description:
    'Extract all available self-storage deal information from the provided documents ' +
    '(OM, T12, P&L, rent roll, Excel, broker package) and return it as structured data. ' +
    'Use null for any field that cannot be found.',
  input_schema: {
    type: 'object' as const,
    properties: {
      facilityName:            { type: ['string', 'null'], description: 'Facility or property name' },
      address:                 { type: ['string', 'null'], description: 'Full street address' },
      city:                    { type: ['string', 'null'], description: 'City — REQUIRED, parse from address if needed' },
      state:                   { type: ['string', 'null'], description: '2-letter state code — REQUIRED, parse from address if needed' },
      zipCode:                 { type: ['string', 'null'], description: 'ZIP code' },
      msaName:                 { type: ['string', 'null'], description: 'Metropolitan Statistical Area name if mentioned' },
      askingPrice:             { type: ['number', 'null'], description: 'Asking price in dollars' },
      unitCount:               { type: ['number', 'null'], description: 'Total number of storage units' },
      totalUnits:              { type: ['number', 'null'], description: 'Same as unitCount' },
      capRate:                 { type: ['number', 'null'], description: 'Cap rate as decimal e.g. 0.065 for 6.5%' },
      noi:                     { type: ['number', 'null'], description: 'Annual NOI in dollars' },
      t12NOI:                  { type: ['number', 'null'], description: 'Trailing 12-month NOI in dollars' },
      t3NOI:                   { type: ['number', 'null'], description: 'Trailing 3-month NOI annualized (multiply 3-month by 4). Must differ from t12NOI.' },
      t12Revenue:              { type: ['number', 'null'], description: 'Trailing 12-month total revenue in dollars' },
      t12TotalExpenses:        { type: ['number', 'null'], description: 'Trailing 12-month total expenses in dollars' },
      t12Payroll:              { type: ['number', 'null'], description: 'T12 payroll expense' },
      t12ManagementFees:       { type: ['number', 'null'], description: 'T12 management fees' },
      t12Marketing:            { type: ['number', 'null'], description: 'T12 marketing expense' },
      t12Utilities:            { type: ['number', 'null'], description: 'T12 utilities expense' },
      t12OfficeEmployee:       { type: ['number', 'null'], description: 'T12 office/employee expense' },
      t12Administrative:       { type: ['number', 'null'], description: 'T12 administrative expense' },
      t12RepairsMaintenance:   { type: ['number', 'null'], description: 'T12 repairs and maintenance' },
      t12Tax:                  { type: ['number', 'null'], description: 'T12 property tax' },
      t12Insurance:            { type: ['number', 'null'], description: 'T12 insurance expense' },
      t12OtherExpenses:        { type: ['number', 'null'], description: 'T12 other expenses not elsewhere categorized' },
      occupancy:               { type: ['number', 'null'], description: 'Occupancy percentage 0-100' },
      currentOccupancy:        { type: ['number', 'null'], description: 'Current occupancy percentage 0-100' },
      targetOccupancy:         { type: ['number', 'null'], description: 'Target/stabilized occupancy percentage' },
      currentAvgRentPerUnit:   { type: ['number', 'null'], description: 'Average monthly rent per unit in dollars' },
      marketAvgRentPerUnit:    { type: ['number', 'null'], description: 'Market rate average monthly rent per unit in dollars' },
      monthsToStabilization:   { type: ['number', 'null'], description: 'Estimated months to reach stabilized occupancy' },
      yearBuilt:               { type: ['number', 'null'], description: 'Year the facility was built' },
      sqft:                    { type: ['number', 'null'], description: 'Total rentable square footage' },
      totalSF:                 { type: ['number', 'null'], description: 'Same as sqft — total net rentable area' },
      broker1Name:             { type: ['string', 'null'], description: 'Primary listing broker or agent name' },
      broker2Name:             { type: ['string', 'null'], description: 'Secondary broker name if present' },
      brokerPhone1:            { type: ['string', 'null'], description: 'Primary broker phone' },
      brokerPhone2:            { type: ['string', 'null'], description: 'Secondary broker phone' },
      brokerEmail1:            { type: ['string', 'null'], description: 'Primary broker email' },
      brokerEmail2:            { type: ['string', 'null'], description: 'Secondary broker email' },
      brokerageName:           { type: ['string', 'null'], description: 'Brokerage firm name' },
      sellerY1: {
        type: ['object', 'null'],
        description: 'Seller projected Year 1',
        properties: {
          revenue:  { type: ['number', 'null'] },
          expenses: { type: ['number', 'null'] },
          noi:      { type: ['number', 'null'] },
        },
      },
      sellerY2: {
        type: ['object', 'null'],
        description: 'Seller projected Year 2',
        properties: {
          revenue:  { type: ['number', 'null'] },
          expenses: { type: ['number', 'null'] },
          noi:      { type: ['number', 'null'] },
        },
      },
      sellerY3: {
        type: ['object', 'null'],
        description: 'Seller projected Year 3',
        properties: {
          revenue:  { type: ['number', 'null'] },
          expenses: { type: ['number', 'null'] },
          noi:      { type: ['number', 'null'] },
        },
      },
      sellerY4: {
        type: ['object', 'null'],
        description: 'Seller projected Year 4',
        properties: {
          revenue:  { type: ['number', 'null'] },
          expenses: { type: ['number', 'null'] },
          noi:      { type: ['number', 'null'] },
        },
      },
      sellerY5: {
        type: ['object', 'null'],
        description: 'Seller projected Year 5',
        properties: {
          revenue:  { type: ['number', 'null'] },
          expenses: { type: ['number', 'null'] },
          noi:      { type: ['number', 'null'] },
        },
      },
      highlights: {
        type: 'array',
        description: 'Up to 5 key deal highlight strings',
        items: { type: 'string' },
      },
      operatingExpensesDetailAvailable: {
        type: 'boolean',
        description:
          'true if individual named expense rows were found (Property Taxes, Insurance, etc.), ' +
          'false if only a single total or no detail was found',
      },
      operatingExpenses: {
        type: ['array', 'null'],
        description:
          'Every individual named operating expense row found in any document. ' +
          'EXCLUDE summary/total rows: never include rows labeled ' +
          '"Total Operating Expenses", "Total Expenses", "Operating Expenses", "Other Expenses", "Total". ' +
          'Only include a summary row if NO individual rows exist. ' +
          'For multi-column T12 (12 monthly + annual total): use the annual total column as amount. ' +
          'Multiply monthly amounts by 12, quarterly by 4.',
        items: {
          type: 'object',
          properties: {
            label:      { type: 'string',           description: 'Exact label from document — never rename or generalize' },
            amount:     { type: 'number',           description: 'Annual dollars' },
            source:     { type: ['string', 'null'], description: 'T12, P&L, OM, Excel, or Rent Roll' },
            confidence: { type: ['number', 'null'], description: 'Confidence 0.0 to 1.0' },
          },
          required: ['label', 'amount'],
        },
      },
    },
    required: ['city', 'state'],
  },
}

const EXTRACTION_INSTRUCTIONS =
  'You are reading one or more documents about a self-storage facility for sale. ' +
  'Documents may include an offering memorandum, rent roll, T12, P&L, Excel workbook, photos, or broker package. ' +
  'Call the extract_deal tool with every piece of deal information you can find. ' +
  'Use null for fields you cannot find. Do not guess.'

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
    contentBlocks.push({ type: 'text', text: EXTRACTION_INSTRUCTIONS })

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_deal' },
      messages: [{ role: 'user', content: contentBlocks }],
    })

    // With tool_choice forced, the response MUST be a tool_use block.
    // No JSON parsing required — the SDK delivers structured input directly.
    const toolBlock = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'extract_deal'
    )

    if (!toolBlock) {
      console.error('[upload-deal] No tool_use block in response. stop_reason:', msg.stop_reason)
      console.error('[upload-deal] Content types:', msg.content.map(b => b.type).join(', '))
      return res.status(500).json({ error: 'Extraction failed', detail: 'Model did not call extract_deal tool' })
    }

    // toolBlock.input is already a parsed JS object — no JSON.parse needed
    return res.status(200).json(toolBlock.input)
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
