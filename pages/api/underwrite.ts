/**
 * /api/underwrite
 *
 * POST { action: 'extract', fileName, mimeType, data (base64) }
 *   → Calls Claude to extract UW inputs from a document.
 *   → Returns JSON with all underwriting fields (decimals for %).
 *
 * POST { action: 'build', inputs: object, propertyAddress: string }
 *   → Spawns backend/underwrite.py, returns populated .xlsx as download.
 *
 * Note: 'build' requires Python in PATH and runs only in local dev.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

async function extractFromText(text: string): Promise<UWData> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nDocument:\n${text.slice(0, 25000)}` }],
  })
  const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()
  return JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
}

async function extractFromBase64(base64: string, mimeType: string): Promise<UWData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block: any = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: [block, { type: 'text', text: EXTRACTION_PROMPT }] }],
  })
  const raw = ((msg.content[0] as { type: string; text: string }).text ?? '').trim()
  return JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
}

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action: string }

  // ── Extract: call Claude to parse a document ────────────────────────────
  if (action === 'extract') {
    const { fileName, mimeType, data } = req.body as { fileName?: string; mimeType: string; data: string }
    if (!data || !mimeType) return res.status(400).json({ error: 'Missing data or mimeType' })

    try {
      let extracted: UWData

      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        extracted = await extractFromBase64(data, mimeType)
      } else if (mimeType.includes('spreadsheetml') || fileName?.toLowerCase().endsWith('.xlsx')) {
        const xlsx = await import('xlsx')
        const buf = Buffer.from(data, 'base64')
        const wb = xlsx.read(buf, { type: 'buffer' })
        const text = wb.SheetNames
          .map(n => `Sheet: ${n}\n${xlsx.utils.sheet_to_csv(wb.Sheets[n])}`)
          .join('\n\n')
        extracted = await extractFromText(text)
      } else if (mimeType.includes('wordprocessingml') || fileName?.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const buf = Buffer.from(data, 'base64')
        const result = await mammoth.extractRawText({ buffer: buf })
        extracted = await extractFromText(result.value)
      } else {
        return res.status(400).json({ error: `Unsupported file type: ${mimeType}` })
      }

      return res.status(200).json(extracted)
    } catch (err) {
      console.error('underwrite extract error:', err)
      return res.status(500).json({ error: 'Extraction failed', detail: String(err) })
    }
  }

  // ── Build: populate Excel template via Python ────────────────────────────
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

  return res.status(400).json({ error: 'Unknown action. Use "extract" or "build".' })
}
