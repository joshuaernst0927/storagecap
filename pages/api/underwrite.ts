/**a
 * /api/underwrite
 * calc-irr-v2 runs entirely on Vercel — no droplet needed.
 * All other actions proxy to the droplet as before.
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

// ── IRR Engine (runs on Vercel, no droplet needed) ────────────────────────────

function interpNOIAtMonth(noiYears: number[], month: number): number {
  if (!noiYears.length) return 0
  const yearExact = month / 12
  const lowerIdx = Math.max(0, Math.floor(yearExact) - 1)
  const upperIdx = Math.min(noiYears.length - 1, lowerIdx + 1)
  const frac = yearExact - Math.floor(yearExact)
  const lowerNOI = lowerIdx < noiYears.length ? noiYears[lowerIdx] : 0
  const upperNOI = upperIdx < noiYears.length ? noiYears[upperIdx] : lowerNOI
  if (lowerIdx === upperIdx || frac === 0) return lowerNOI
  return lowerNOI + frac * (upperNOI - lowerNOI)
}

function calcLoanBalance(originalLoan: number, interestRate: number, amortYears: number, ioMonths: number, monthsElapsed: number): number {
  if (monthsElapsed <= ioMonths) return originalLoan
  const amortMonthsElapsed = Math.floor(monthsElapsed - ioMonths)
  if (amortYears <= 0 || interestRate <= 0) return originalLoan
  const monthlyRate = interestRate / 12
  const nPayments = amortYears * 12
  const monthlyPayment = originalLoan * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1)
  let balance = originalLoan
  for (let i = 0; i < amortMonthsElapsed; i++) {
    const interest = balance * monthlyRate
    const principal = monthlyPayment - interest
    balance -= principal
  }
  return Math.max(0, balance)
}

function irrCalc(cashflows: number[]): number {
  const npv = (r: number) => cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + r, i), 0)
  let lo = -0.9, hi = 10.0
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (npv(mid) > 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

interface CalcIRRV2Params {
  purchase_price: number
  noi_years: number[]
  exit_cap_rate?: number
  exit_month?: number
  exit_value_override?: number | null
  selling_costs_pct?: number
  closing_costs_pct?: number
  acquisition_fee_pct?: number
  initial_repairs?: number
  ltv?: number
  interest_rate?: number
  amort_years?: number
  io_months?: number
  refi_month?: number | null
  refi_ltv?: number | null
  refi_rate?: number | null
  refi_amort_years?: number | null
  refi_dscr?: number | null
  refi_fee_pct?: number | null
}

function calcIRRv2(p: CalcIRRV2Params) {
  const {
    purchase_price,
    noi_years,
    exit_cap_rate = 0.075,
    exit_month = 60,
    exit_value_override = null,
    selling_costs_pct = 0.02,
    closing_costs_pct = 0.03,
    acquisition_fee_pct = 0.02,
    initial_repairs = 0,
    ltv = 0,
    interest_rate = 0.07,
    amort_years = 30,
    io_months = 0,
    refi_month = null,
    refi_ltv = null,
    refi_rate = null,
    refi_amort_years = null,
    refi_dscr = null,
    refi_fee_pct = null,
  } = p

  const holdMonths = Math.round(exit_month)
  const holdYears = noi_years.length
  const exitYear = Math.max(1, Math.min(holdYears, Math.round(holdMonths / 12)))
  const totalCost = purchase_price * (1 + closing_costs_pct + acquisition_fee_pct) + initial_repairs
  const exitNOI = interpNOIAtMonth(noi_years, holdMonths)
  const exitValue = (exit_value_override && exit_value_override > 0)
    ? exit_value_override
    : (exit_cap_rate > 0 ? exitNOI / exit_cap_rate : 0)
  const netSale = exitValue * (1 - selling_costs_pct)

  // Unlevered cash flows
  const ucf: number[] = [-totalCost]
  for (let yr = 1; yr <= exitYear; yr++) {
    const noi = yr <= noi_years.length ? noi_years[yr - 1] : noi_years[noi_years.length - 1]
    ucf.push(yr === exitYear ? noi + netSale : noi)
  }

  // Levered cash flows
  const loan = purchase_price * ltv
  const equity = totalCost - loan
  const ioYears = Math.floor(io_months / 12)
  const annualDsIO = loan * interest_rate

  let annualDsBridge = loan * interest_rate
  if (amort_years > 0 && interest_rate > 0) {
    const mr = interest_rate / 12
    const np = amort_years * 12
    const mp = loan * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
    annualDsBridge = mp * 12
  }

  let refiCashOut = 0
  let refiFeePaid = 0
  let newLoan = loan
  let newLoanDs = annualDsBridge
  let refiYear: number | null = null
  let rr = interest_rate
  let ra = amort_years
  const refiOccurs = !!(refi_month && refi_month > 0 && ltv > 0)

  if (refiOccurs && refi_month) {
    refiYear = Math.max(1, Math.min(exitYear, Math.round(refi_month / 12)))
    const refiNOI = interpNOIAtMonth(noi_years, refi_month)
    rr = refi_rate ?? interest_rate
    ra = refi_amort_years ?? 30
    const rc = refi_ltv ?? 0.70
    const rd = refi_dscr ?? 1.30
    const rf = refi_fee_pct ?? 0.01
    const goingInCap = noi_years[0] / purchase_price
    const refiStabValue = goingInCap > 0 ? refiNOI / goingInCap : 0
    const ltvMax = refiStabValue * rc
    const dscrMax = rr > 0 ? refiNOI / rd / rr : 0
    newLoan = Math.min(ltvMax, dscrMax)
    const bridgeBalance = calcLoanBalance(loan, interest_rate, amort_years, io_months, refi_month)
    refiCashOut = Math.max(0, newLoan - bridgeBalance)
    refiFeePaid = newLoan * rf
    if (ra > 0 && rr > 0) {
      const mr2 = rr / 12
      const np2 = ra * 12
      const mp2 = newLoan * (mr2 * Math.pow(1 + mr2, np2)) / (Math.pow(1 + mr2, np2) - 1)
      newLoanDs = mp2 * 12
    } else {
      newLoanDs = newLoan * rr
    }
  }

  const lcf: number[] = [-equity]
  for (let yr = 1; yr <= exitYear; yr++) {
    const noi = yr <= noi_years.length ? noi_years[yr - 1] : noi_years[noi_years.length - 1]
    let ds: number
    if (refiOccurs && refiYear && yr > refiYear) ds = newLoanDs
    else if (yr <= ioYears) ds = annualDsIO
    else ds = annualDsBridge

    if (yr < exitYear) {
      let cf = noi - ds
      if (refiOccurs && refiYear && yr === refiYear) cf += refiCashOut - refiFeePaid
      lcf.push(cf)
    } else {
      const monthsSinceRefi = refiOccurs && refiYear ? (exitYear - refiYear) * 12 : 0
      const remainingBalance = (refiOccurs && refiYear)
        ? calcLoanBalance(newLoan, rr, ra, 0, monthsSinceRefi)
        : calcLoanBalance(loan, interest_rate, amort_years, io_months, holdMonths)
      let cf = noi - ds + netSale - remainingBalance
      if (refiOccurs && refiYear && yr === refiYear) cf += refiCashOut - refiFeePaid
      lcf.push(cf)
    }
  }

  const uIRR = irrCalc(ucf)
  const lIRR = ltv > 0 ? irrCalc(lcf) : uIRR
  const equityMultiple = equity > 0 ? lcf.filter(cf => cf > 0).reduce((a, b) => a + b, 0) / equity : 0
  const annualDsDisplay = refiOccurs ? newLoanDs : annualDsBridge

  return {
    unlevered_irr:       Math.round(uIRR * 10000) / 10000,
    levered_irr:         Math.round(lIRR * 10000) / 10000,
    equity_multiple:     Math.round(equityMultiple * 100) / 100,
    equity_required:     Math.round(equity),
    loan_amount:         Math.round(loan),
    annual_debt_service: Math.round(annualDsDisplay),
    going_in_cap:        purchase_price > 0 ? Math.round(noi_years[0] / purchase_price * 10000) / 10000 : 0,
    stabilized_cap:      purchase_price > 0 ? Math.round(exitNOI / purchase_price * 10000) / 10000 : 0,
    exit_value:          Math.round(exitValue),
    refi_cash_out:       Math.round(refiCashOut),
    refi_fee_paid:       Math.round(refiFeePaid),
    new_loan:            Math.round(newLoan),
  }
}

// ── API Handler ───────────────────────────────────────────────────────────────

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action: string }

  // ── Calc IRR v2 — runs on Vercel, no droplet ──────────────────────
  if (action === 'calc-irr-v2') {
    try {
      const result = calcIRRv2(req.body as CalcIRRV2Params)
      return res.status(200).json(result)
    } catch (err) {
      console.error('calc-irr-v2 error:', err)
      return res.status(500).json({ error: 'IRR calculation failed', detail: String(err) })
    }
  }

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

  // ── Calc IRR: proxy to DO server ──────────────────────────────────
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

  // ── Run Excel Model: proxy to DO server ───────────────────────────
  if (action === 'run-excel') {
    try {
      const { action: _a, ...params } = req.body
      const doRes = await fetch(`${DO_API}/run-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(120000),
      })
      if (!doRes.ok) {
        const err = await doRes.text()
        return res.status(502).json({ error: 'Excel model error', detail: err })
      }
      const data = await doRes.json()
      return res.status(200).json(data)
    } catch (err) {
      console.error('run-excel error:', err)
      return res.status(500).json({ error: 'Excel model failed', detail: String(err) })
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
