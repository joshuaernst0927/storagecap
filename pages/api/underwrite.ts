/**
 * /api/underwrite — YEM Acquisitions
 * Handles: extract, build, build-proforma, calc-irr-v2, max-offer, run-excel
 * build-proforma, calc-irr-v2, max-offer, run-excel → proxy to DO droplet
 * extract, build → run locally on Vercel
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
  "totalSF": number,
  "yearBuilt": number,
  "currentOccupancy": number,
  "currentAvgRentPerUnit": number,
  "marketAvgRentPerUnit": number,
  "broker1Name": string,
  "broker2Name": string,
  "brokerPhone1": string,
  "brokerPhone2": string,
  "brokerEmail1": string,
  "brokerEmail2": string,
  "brokerageName": string,
  "t12NOI": number,
  "t3NOI": number,
  "t12Revenue": number,
  "t12Expenses": number,
  "t12ExpenseRatio": number,
  "t12Payroll": number,
  "t12ManagementFees": number,
  "t12Marketing": number,
  "t12Utilities": number,
  "t12OfficeEmployee": number,
  "t12Administrative": number,
  "t12RepairsMaintenance": number,
  "t12Tax": number,
  "t12Insurance": number,
  "t12OtherExpenses": number,
  "sellerY1Revenue": number,
  "sellerY1Expenses": number,
  "sellerY1NOI": number,
  "sellerY2Revenue": number,
  "sellerY2Expenses": number,
  "sellerY2NOI": number,
  "sellerY3Revenue": number,
  "sellerY3Expenses": number,
  "sellerY3NOI": number,
  "sellerY4Revenue": number,
  "sellerY4NOI": number,
  "sellerY5Revenue": number,
  "sellerY5NOI": number,
  "monthsToStabilization": number,
  "projectedStabilizedOccupancy": number,
  "projectedStabilizedNOI": number,
  "purchasePrice": number,
  "closingCostsPct": number,
  "initialRepairs": number,
  "acquisitionFeePct": number,
  "assetMgmtFeePct": number,
  "dispositionFeePct": number,
  "startOccupancy": number,
  "stabilizedOccupancy": number,
  "annualRentGrowth": number,
  "opexGrowth": number,
  "initialLTV": number,
  "initialRate": number,
  "initialAmortYears": number,
  "ioPeriodMonths": number,
  "minDSCR": number,
  "refiMonth": number,
  "refiLTV": number,
  "refiRate": number,
  "refiAmortYears": number,
  "exitCapRate": number,
  "exitMonth": number,
  "sellingCostsPct": number,
  "preferredReturn": number,
  "lpCatchUp": number,
  "gpCatchUp": number,
  "lpResidual": number,
  "gpResidual": number,
  "unitMix": [{ "type": string, "units": number, "sqft": number, "currentRent": number, "marketRent": number }]
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
    const slideFiles = Object.keys(zip.files).filter(sf => /ppt\/slides\/slide\d+\.xml$/.test(sf)).sort()
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

async function proxyToDroplet(endpoint: string, params: Record<string, unknown>, res: NextApiResponse, timeoutMs = 30000) {
  try {
    const doRes = await fetch(`${DO_API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!doRes.ok) {
      const err = await doRes.text()
      return res.status(502).json({ error: `Droplet error on ${endpoint}`, detail: err })
    }
    const data = await doRes.json()
    return res.status(200).json(data)
  } catch (err) {
    console.error(`${endpoint} proxy error:`, err)
    return res.status(500).json({ error: `${endpoint} failed`, detail: String(err) })
  }
}

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, ...params } = req.body as { action: string } & Record<string, unknown>

  // ── Proxy to droplet ──────────────────────────────────────────────
  if (action === 'build-proforma') return proxyToDroplet('build-proforma', params, res)
  if (action === 'calc-irr-v2')   return proxyToDroplet('calc-irr-v2', params, res)
  if (action === 'max-offer')     return proxyToDroplet('max-offer', params, res)
  if (action === 'calc-irr')      return proxyToDroplet('calc-irr', params, res)
  if (action === 'run-excel')     return proxyToDroplet('run-model', params, res, 120000)

  // ── Extract: Claude parses documents ─────────────────────────────
  if (action === 'extract') {
    const { files } = req.body as { files: FileInput[] }
    if (!files?.length) return res.status(400).json({ error: 'No files provided' })
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentBlocks: any[] = []
      for (const f of files) contentBlocks.push(...await fileToBlocks(f))
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
      console.error('extract error:', err)
      return res.status(500).json({ error: 'Extraction failed', detail: String(err) })
    }
  }

  // ── Build: populate Excel via Python ─────────────────────────────
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
        timeout: 30_000, encoding: 'utf-8',
      })
      const buffer = fs.readFileSync(outputFile)
      const safeName = (propertyAddress || 'underwrite').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_UW.xlsx"`)
      return res.end(buffer)
    } catch (err) {
      console.error('build error:', err)
      return res.status(500).json({ error: 'Model build failed', detail: String(err) })
    } finally {
      for (const f of [inputsFile, outputFile]) { try { fs.unlinkSync(f) } catch { /* ignore */ } }
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
