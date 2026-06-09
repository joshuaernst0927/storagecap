/**
 * /api/underwrite
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DO_API = 'http://157.230.186.240:8000'

const EXTRACTION_PROMPT = `You are analyzing self-storage acquisition documents (rent roll, T12 P&L, offering memorandum, proforma, or deal memo).

Extract ALL available inputs for financial underwriting. Return ONLY a valid JSON object — no markdown fences, no commentary, no extra text. Use null for any field you cannot find.

IMPORTANT: Extract the SELLER'S projected numbers exactly as presented. Do not adjust or haircut them — that happens separately.

{
  "propertyName": string,
  "address": string,
  "city": string,
  "state": string,
  "msaName": string,
  "dealType": "value-add" | "stabilized" | "distressed" | null,

  "totalUnits": number,
  "totalSF": number (net rentable square feet — self storage units only, not parking),
  "yearBuilt": number,
  "currentOccupancy": number (percent, e.g. 85 for 85%),
  "occupancy12MonthsAgo": number (percent, if available),
  "occupancy24MonthsAgo": number (percent, if available),
  "currentAvgRentPerUnit": number (monthly $/unit),
  "marketAvgRentPerUnit": number (monthly $/unit — from market comparables in doc),

  "broker1Name": string (first listing broker full name),
  "broker2Name": string (second listing broker full name, if any),
  "brokerPhone1": string,
  "brokerPhone2": string,
  "brokerEmail1": string,
  "brokerEmail2": string,
  "brokerageName": string (brokerage firm name, e.g. CBRE, Marcus and Millichap),

  "t12NOI": number (dollars — trailing 12 month NOI),
  "t3NOI": number (dollars — last 3 months NOI annualized, i.e. multiply by 4),
  "t12Revenue": number (dollars — trailing 12 month gross revenue),
  "t12Expenses": number (dollars — trailing 12 month total expenses),
  "t12ExpenseRatio": number (decimal, e.g. 0.38 for 38%),

  "t12Payroll": number (dollars — T-12 payroll / labor costs),
  "t12ManagementFees": number (dollars — T-12 management fees),
  "t12Marketing": number (dollars — T-12 marketing / advertising),
  "t12Utilities": number (dollars — T-12 utilities),
  "t12OfficeEmployee": number (dollars — T-12 office / employee expenses),
  "t12Administrative": number (dollars — T-12 administrative expenses),
  "t12RepairsMaintenance": number (dollars — T-12 repairs and maintenance),
  "t12Tax": number (dollars — T-12 property tax),
  "t12Insurance": number (dollars — T-12 insurance),
  "t12OtherExpenses": number (dollars — T-12 any other expenses not listed above),

  "sellerY1Revenue": number (dollars — seller projected Year 1 revenue),
  "sellerY1Expenses": number (dollars — seller projected Year 1 expenses),
  "sellerY1NOI": number (dollars — seller projected Year 1 NOI),
  "sellerY2Revenue": number (dollars — seller projected Year 2 revenue),
  "sellerY2Expenses": number (dollars — seller projected Year 2 expenses),
  "sellerY2NOI": number (dollars — seller projected Year 2 NOI),
  "sellerY3Revenue": number (dollars — seller projected Year 3 revenue),
  "sellerY3Expenses": number (dollars — seller projected Year 3 expenses),
  "sellerY3NOI": number (dollars — seller projected Year 3 NOI),
  "sellerY4Revenue": number (dollars — seller projected Year 4 revenue, if available),
  "sellerY4NOI": number (dollars — seller projected Year 4 NOI, if available),
  "sellerY5Revenue": number (dollars — seller projected Year 5 revenue, if available),
  "sellerY5NOI": number (dollars — seller projected Year 5 NOI, if available),

  "monthsToStabilization": number (seller's projected months to stabilization),
  "projectedStabilizedOccupancy": number (percent — seller's stabilized occupancy target),
  "projectedStabilizedNOI": number (dollars — seller's stabilized NOI),

  "purchasePrice": number (dollars — asking price),
  "closingCostsPct": number (decimal e.g. 0.03 for 3%),
  "initialRepairs": number (dollars),
  "acquisitionFeePct": number (decimal),
  "assetMgmtFeePct": number (decimal),
  "dispositionFeePct": number (decimal),
  "startOccupancy": number (decimal e.g. 0.85 for 85%),
  "stabilizedOccupancy": number (decimal),
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
      "sqft": number,
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

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action: string }

  // ── Max Offer: proxy to DO server ─────────────────────────────────
  if (action === 'max-offer') {
    try {
      const { action: _a, ...params } = req.body
      const doRes = await fetch(`${DO_API}/max-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!doRes.ok) {
        const err = await doRes.text()
        return res.status(502).json({ error: 'DO server error', detail: err })
      }
      const data = await doRes.json()
      return res.status(200).json(data)
    } catch (err) {
      console.error('max-offer proxy error:', err)
      return res.status(500).json({ error: 'Max offer calculation failed', detail: String(err) })
    }
  }

  // ── Calc IRR at Price: proxy to DO server ─────────────────────────
  if (action === 'calc-irr') {
    try {
      const { action: _a, ...params } = req.body
      const doRes = await fetch(`${DO_API}/calc-irr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!doRes.ok) {
        const err = await doRes.text()
        return res.status(502).json({ error: 'DO server error', detail: err })
      }
      const data = await doRes.json()
      return res.status(200).json(data)
    } catch (err) {
      console.error('calc-irr proxy error:', err)
      return res.status(500).json({ error: 'IRR calculation failed', detail: String(err) })
    }
  }

  // ── Calc IRR v2 (Levered + Unlevered): proxy to DO server ─────────
  if (action === 'calc-irr-v2') {
    try {
      const { action: _a, ...params } = req.body
      const doRes = await fetch(`${DO_API}/calc-irr-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!doRes.ok) {
        const err = await doRes.text()
        return res.status(502).json({ error: 'DO server error', detail: err })
      }
      const data = await doRes.json()
      return res.status(200).json(data)
    } catch (err) {
      console.error('calc-irr-v2 proxy error:', err)
      return res.status(500).json({ error: 'IRR v2 calculation failed', detail: String(err) })
    }
  }

  // ── Build Proforma: proxy to DO server ────────────────────────────
  if (action === 'build-proforma') {
    try {
      const { action: _a, ...params } = req.body
      const doRes = await fetch(`${DO_API}/build-proforma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!doRes.ok) {
        const err = await doRes.text()
        return res.status(502).json({ error: 'DO server error', detail: err })
      }
      const data = await doRes.json()
      return res.status(200).json(data)
    } catch (err) {
      console.error('build-proforma proxy error:', err)
      return res.status(500).json({ error: 'Proforma build failed', detail: String(err) })
    }
  }

  // ── Extract: call Claude to parse documents ───────────────────────
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
        max_tokens: 3000,
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

  // ── Build: populate Excel template via Python ─────────────────────
  if (action === 'build') {
    const { inputs, propertyAddress } = req.body as { inputs: UWData; propertyAddress?: string }
    if (!inputs) return res.status(400).json({ error: 'Missing inputs' })

    const ts = Date.now()
    const tmpDir = os.tmpdir()
    const inputsFile = path.join(tmpDir, `uw_in_${ts}.json`)
    const outputFile = path.join(tmpDir, `uw_out_${ts}.xlsx`)

    try {
      fs.writeFileSync(inputsFile, JSON.stringify(inputs), 'utf-8')

      const script = path.join(process.cwd(), 'backend', 'underwrite.py')
      execFileSync('python', [script, '--inputs-file', inputsFile, '--output', outputFile], {
        timeout: 30_000,
        encoding: 'utf-8',
      })

      const buffer = fs.readFileSync(outputFile)
      const safeName = (propertyAddress || 'underwrite')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 60)

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_UW.xlsx"`)
      return res.end(buffer)
    } catch (err) {
      console.error('underwrite build error:', err)
      return res.status(500).json({ error: 'Model build failed', detail: String(err) })
    } finally {
      for (const f of [inputsFile, outputFile]) {
        try { fs.unlinkSync(f) } catch { /* ignore */ }
      }
    }
  }

  return res.status(400).json({ error: 'Unknown action.' })
}
