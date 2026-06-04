/**
 * /api/underwrite
 *
 * POST { action: 'extract', files: FileInput[] }
 *   → Calls Claude to extract UW inputs from documents.
 *   → Returns JSON with all underwriting fields (decimals for %).
 *
 * POST { action: 'run', inputs: object }
 *   → Calls DigitalOcean /run-model API.
 *   → Returns JSON results (IRR, NOI, MOIC, exit value, etc.)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DO_API = 'http://157.230.186.240:8000'

const EXTRACTION_PROMPT = `You are analyzing a self-storage acquisition document (rent roll, T12 P&L, offering memorandum, or deal memo).
Extract all available inputs for a financial underwriting model.
Return ONLY a valid JSON object — no markdown fences, no commentary, no extra text.
Use null for any field you cannot find or infer.

{
  "propertyName": string,
  "address": string,
  "purchasePrice": number (dollars),
  "closingCostsPct": number (decimal e.g. 0.03 for 3%),
  "initialRepairs": number (dollars),
  "acquisitionFeePct": number (decimal),
  "assetMgmtFeePct": number (decimal),
  "dispositionFeePct": number (decimal),
  "startOccupancy": number (decimal e.g. 0.85 for 85%),
  "stabilizedOccupancy": number (decimal),
  "monthsToStabilization": number,
  "annualRentGrowth": number (decimal),
  "opexGrowth": number (decimal),
  "initialLTV": number (decimal),
  "initialRate": number (decimal),
  "initialAmortYears": number,
  "ioPeriodMonths": number,
  "minDSCR": number,
  "refiMonth": number,
  "refiLTV": number (decimal),
  "refiRate": number (decimal),
  "refiAmortYears": number,
  "exitCapRate": number (decimal),
  "exitMonth": number,
  "sellingCostsPct": number (decimal),
  "preferredReturn": number (decimal),
  "lpCatchUp": number (decimal),
  "gpCatchUp": number (decimal),
  "lpResidual": number (decimal),
  "gpResidual": number (decimal),
  "unitMix": [
    {
      "type": "5x5" | "5x10" | "10x10" | "10x15" | "10x20" | "other",
      "units": number,
      "sqft": number (avg sq ft per unit),
      "currentRent": number (monthly $/unit),
      "marketRent": number (monthly $/unit)
    }
  ]
}`

type UWData = Record<string, unknown>
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

  return [{ type: 'text', text: `--- File: ${label} ---\n\n${text.slice(0, 25000)}` }]
}

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action: string }

  // ── Extract: call Claude to parse documents ──────────────────────────────
  if (action === 'extract') {
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
      const extracted: UWData = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
      return res.status(200).json(extracted)
    } catch (err) {
      console.error('underwrite extract error:', err)
      return res.status(500).json({ error: 'Extraction failed', detail: String(err) })
    }
  }

  // ── Run: call DigitalOcean model API ─────────────────────────────────────
  if (action === 'run') {
    const { inputs } = req.body as { inputs: UWData }
    if (!inputs) return res.status(400).json({ error: 'Missing inputs' })

    try {
      // Map frontend field names to DO API field names
      const payload = {
        // Strip nulls — DO API rejects null for numeric fields
const raw: Record<string, unknown> = {
  purchase_price:       inputs.purchasePrice,
  closing_costs_pct:    inputs.closingCostsPct,
  initial_repairs:      inputs.initialRepairs,
  acquisition_fee_pct:  inputs.acquisitionFeePct,
  start_occupancy:      inputs.startOccupancy,
  stabilized_occupancy: inputs.stabilizedOccupancy,
  months_to_stabilize:  inputs.monthsToStabilization,
  rent_growth:          inputs.annualRentGrowth,
  other_income_month:   inputs.otherIncomeMonth ?? 0,
  initial_ltv:          inputs.initialLTV,
  initial_rate:         inputs.initialRate,
  refi_ltv:             inputs.refiLTV,
  refi_rate:            inputs.refiRate,
  exit_cap_rate:        inputs.exitCapRate,
  exit_month:           inputs.exitMonth,
  unlevered:            'No',
  unit_mix:             inputs.unitMix ?? undefined,
}
const payload = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && v !== undefined))
      }

      const doRes = await fetch(`${DO_API}/run-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!doRes.ok) {
        const err = await doRes.text()
        throw new Error(`DO API error ${doRes.status}: ${err}`)
      }

      const results = await doRes.json()
      return res.status(200).json(results)
    } catch (err) {
      console.error('underwrite run error:', err)
      return res.status(500).json({ error: 'Model run failed', detail: String(err) })
    }
  }
// ── Download: return populated Excel file ────────────────────────────────
  if (action === 'download') {
    const { inputs } = req.body as { inputs: UWData }
    if (!inputs) return res.status(400).json({ error: 'Missing inputs' })

    try {
      const raw: Record<string, unknown> = {
        purchase_price:       inputs.purchasePrice,
        closing_costs_pct:    inputs.closingCostsPct,
        initial_repairs:      inputs.initialRepairs,
        acquisition_fee_pct:  inputs.acquisitionFeePct,
        start_occupancy:      inputs.startOccupancy,
        stabilized_occupancy: inputs.stabilizedOccupancy,
        months_to_stabilize:  inputs.monthsToStabilization,
        rent_growth:          inputs.annualRentGrowth,
        initial_ltv:          inputs.initialLTV,
        initial_rate:         inputs.initialRate,
        refi_ltv:             inputs.refiLTV,
        refi_rate:            inputs.refiRate,
        exit_cap_rate:        inputs.exitCapRate,
        exit_month:           inputs.exitMonth,
        unlevered:            'No',
      }
      const payload = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null && v !== undefined))

      const doRes = await fetch(`${DO_API}/download-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!doRes.ok) {
        const err = await doRes.text()
        throw new Error(`DO API error ${doRes.status}: ${err}`)
      }

      const buffer = Buffer.from(await doRes.arrayBuffer())
      const safeName = (inputs.propertyName as string || inputs.address as string || 'underwrite')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 60)

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_UW.xlsx"`)
      return res.end(buffer)
    } catch (err) {
      console.error('underwrite download error:', err)
      return res.status(500).json({ error: 'Download failed', detail: String(err) })
    }
  }
  return res.status(400).json({ error: 'Unknown action. Use "extract" or "run".' })
}
