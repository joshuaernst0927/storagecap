/**
 * /api/underwrite — YEM Acquisitions
 * ALL computation runs on Vercel. No droplet dependency for any financial math.
 * Droplet port 8000 is not externally reachable — all math is self-contained here.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Extraction prompt ─────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are analyzing self-storage acquisition documents (rent roll, T12 P&L, offering memorandum, proforma, or deal memo).

Extract ALL available inputs for financial underwriting. Return ONLY a valid JSON object — no markdown fences, no commentary, no extra text. Use null for any field you cannot find.

IMPORTANT: Extract the SELLER'S projected numbers exactly as presented. Do not adjust or haircut them.

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
  "currentOccupancy": number (percent e.g. 70.7),
  "currentAvgRentPerUnit": number (monthly $/unit),
  "marketAvgRentPerUnit": number (monthly $/unit from comparables),
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
  "t12StorageRent": number (storage unit rental income only),
  "t12ParkingIncome": number (parking/outdoor storage income),
  "t12AdminFees": number,
  "t12LateFees": number,
  "t12OtherFees": number,
  "t12MerchandiseSales": number,
  "t12OtherIncome": number,
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
  "exitCapRate": number,
  "exitMonth": number,
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

// ── Proforma Engine ───────────────────────────────────────────────────────────

interface T12Data {
  total_revenue: number
  payroll: number
  management_fees: number
  marketing: number
  utilities: number
  office_employee: number
  administrative: number
  repairs_maintenance: number
  tax: number
  insurance: number
  other_expenses: number
  total_expenses: number
  noi: number
  seller_years?: { revenue: number; expenses: number; noi: number }[]
}

interface Assumptions {
  total_units: number
  current_occupancy: number
  rent_uplift_y1: number
  rent_growth: number
  opex_growth: number
  tax_insurance_growth: number
  mgmt_fee_pct: number
  revenue_haircut: number
  occ_schedule: number[]
}

interface OurYear {
  year: number
  occupancy: number
  avg_rent_mo: number
  revenue: number
  expenses: {
    payroll: number
    management_fees: number
    marketing: number
    utilities: number
    office_employee: number
    administrative: number
    repairs_maintenance: number
    tax: number
    insurance: number
    other: number
    total: number
  }
  noi: number
  noi_margin: number
  expense_ratio: number
}

function buildProforma(t12: T12Data, assumptions: Assumptions) {
  const {
    current_occupancy,
    rent_uplift_y1 = 0.12,
    rent_growth = 0.04,
    opex_growth = 0.02,
    tax_insurance_growth = 0.02,
    mgmt_fee_pct = 0.05,
    revenue_haircut = 0,
    occ_schedule = [0.75, 0.82, 0.88, 0.90, 0.90],
  } = assumptions

  const t12Revenue = t12.total_revenue || 0
  const t12NOI = t12.noi || (t12Revenue - (t12.total_expenses || t12Revenue * 0.38))
  const t12Expenses = t12.total_expenses || (t12Revenue - t12NOI)
  const t12Occupancy = (current_occupancy > 1 ? current_occupancy / 100 : current_occupancy) || 0.70

  // Expense breakdown — use provided or distribute by industry defaults
  const expBreak = {
    payroll:             t12.payroll || 0,
    management_fees:     t12.management_fees || 0,
    marketing:           t12.marketing || 0,
    utilities:           t12.utilities || 0,
    office_employee:     t12.office_employee || 0,
    administrative:      t12.administrative || 0,
    repairs_maintenance: t12.repairs_maintenance || 0,
    tax:                 t12.tax || 0,
    insurance:           t12.insurance || 0,
    other:               t12.other_expenses || 0,
  }

  const breakdownTotal = Object.values(expBreak).reduce((a, b) => a + b, 0)
  let scaledBreak = { ...expBreak }

  if (breakdownTotal === 0 && t12Expenses > 0) {
    // Distribute using self-storage industry defaults
    scaledBreak = {
      payroll:             t12Expenses * 0.22,
      management_fees:     t12Revenue * mgmt_fee_pct,
      marketing:           t12Expenses * 0.07,
      utilities:           t12Expenses * 0.12,
      office_employee:     t12Expenses * 0.03,
      administrative:      t12Expenses * 0.03,
      repairs_maintenance: t12Expenses * 0.08,
      tax:                 t12Expenses * 0.20,
      insurance:           t12Expenses * 0.05,
      other:               t12Expenses * 0.02,
    }
  } else if (breakdownTotal > 0 && Math.abs(breakdownTotal - t12Expenses) / Math.max(t12Expenses, 1) > 0.05) {
    const scale = t12Expenses / breakdownTotal
    scaledBreak = Object.fromEntries(Object.entries(expBreak).map(([k, v]) => [k, v * scale])) as typeof expBreak
  }

  // Build 5-year projection — grow from T12 revenue using occ ramp + rent growth
  const baseRevenue = t12Revenue > 0 ? t12Revenue : (t12NOI / 0.62)
  const years: OurYear[] = []

  for (let yr = 1; yr <= 5; yr++) {
    const occ = occ_schedule[yr - 1] ?? occ_schedule[occ_schedule.length - 1] ?? 0.90
    const occFactor = t12Occupancy > 0 ? occ / t12Occupancy : 1
    const rentGrowthFactor = yr === 1
      ? (1 + rent_uplift_y1)
      : (1 + rent_uplift_y1) * Math.pow(1 + rent_growth, yr - 1)
    const revenue = Math.round(baseRevenue * occFactor * rentGrowthFactor * (1 - revenue_haircut))

    const opexFactor = Math.pow(1 + opex_growth, yr - 1)
    const tiFactor = Math.pow(1 + tax_insurance_growth, yr - 1)
    const mgmtFees = Math.round(revenue * mgmt_fee_pct)
    const payroll = Math.round((scaledBreak.payroll || 0) * opexFactor)
    const marketing = Math.round((scaledBreak.marketing || 0) * opexFactor)
    const utilities = Math.round((scaledBreak.utilities || 0) * opexFactor)
    const officeEmployee = Math.round((scaledBreak.office_employee || 0) * opexFactor)
    const administrative = Math.round((scaledBreak.administrative || 0) * opexFactor)
    const repairsMaint = Math.round((scaledBreak.repairs_maintenance || 0) * opexFactor)
    const tax = Math.round((scaledBreak.tax || 0) * tiFactor)
    const insurance = Math.round((scaledBreak.insurance || 0) * tiFactor)
    const other = Math.round((scaledBreak.other || 0) * opexFactor)
    const totalExp = mgmtFees + payroll + marketing + utilities + officeEmployee + administrative + repairsMaint + tax + insurance + other
    const noi = revenue - totalExp

    years.push({
      year: yr,
      occupancy: Math.round(occ * 1000) / 1000,
      avg_rent_mo: 0,
      revenue,
      expenses: {
        payroll, management_fees: mgmtFees, marketing, utilities,
        office_employee: officeEmployee, administrative, repairs_maintenance: repairsMaint,
        tax, insurance, other, total: totalExp,
      },
      noi,
      noi_margin: revenue > 0 ? Math.round(noi / revenue * 1000) / 1000 : 0,
      expense_ratio: revenue > 0 ? Math.round(totalExp / revenue * 1000) / 1000 : 0,
    })
  }

  // Broker years
  let brokerYears: OurYear[] | undefined
  if (t12.seller_years && t12.seller_years.length > 0) {
    brokerYears = t12.seller_years.map((sy, i) => {
      const revenue = sy.revenue || 0
      const noi = sy.noi || (revenue - (sy.expenses || 0))
      const expenses = sy.expenses || (revenue - noi)
      return {
        year: i + 1, occupancy: 0, avg_rent_mo: 0, revenue,
        expenses: { payroll: 0, management_fees: 0, marketing: 0, utilities: 0, office_employee: 0, administrative: 0, repairs_maintenance: 0, tax: 0, insurance: 0, other: 0, total: expenses },
        noi, noi_margin: revenue > 0 ? noi / revenue : 0, expense_ratio: revenue > 0 ? expenses / revenue : 0,
      }
    })
  }

  return {
    t12: {
      revenue: Math.round(t12Revenue),
      expenses: Math.round(t12Expenses),
      noi: Math.round(t12NOI),
      occupancy: t12Occupancy,
      avg_rent_mo: 0,
      expense_breakdown: {
        payroll:             Math.round(scaledBreak.payroll || 0),
        management_fees:     Math.round(scaledBreak.management_fees || 0),
        marketing:           Math.round(scaledBreak.marketing || 0),
        utilities:           Math.round(scaledBreak.utilities || 0),
        office_employee:     Math.round(scaledBreak.office_employee || 0),
        administrative:      Math.round(scaledBreak.administrative || 0),
        repairs_maintenance: Math.round(scaledBreak.repairs_maintenance || 0),
        tax:                 Math.round(scaledBreak.tax || 0),
        insurance:           Math.round(scaledBreak.insurance || 0),
        other:               Math.round(scaledBreak.other || 0),
      },
    },
    years,
    broker_years: brokerYears,
  }
}

// ── IRR Engine ────────────────────────────────────────────────────────────────

function interpNOI(noiYears: number[], month: number): number {
  if (!noiYears.length) return 0
  const yr = month / 12
  const lo = Math.max(0, Math.floor(yr) - 1)
  const hi = Math.min(noiYears.length - 1, lo + 1)
  const frac = yr - Math.floor(yr)
  const loNOI = noiYears[lo] ?? 0
  const hiNOI = noiYears[hi] ?? loNOI
  if (lo === hi || frac === 0) return loNOI
  return loNOI + frac * (hiNOI - loNOI)
}

function loanBalance(loan: number, rate: number, amort: number, ioMos: number, elapsed: number): number {
  if (elapsed <= ioMos) return loan
  const amortElapsed = Math.floor(elapsed - ioMos)
  if (amort <= 0 || rate <= 0) return loan
  const mr = rate / 12, np = amort * 12
  const pmt = loan * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
  let bal = loan
  for (let i = 0; i < amortElapsed; i++) bal -= (pmt - bal * mr)
  return Math.max(0, bal)
}

function irr(cfs: number[]): number {
  const npv = (r: number) => cfs.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0)
  let lo = -0.9, hi = 10
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (npv(m) > 0) lo = m; else hi = m }
  return (lo + hi) / 2
}

interface IRRParams {
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

function calcIRR(p: IRRParams) {
  const {
    purchase_price: pp, noi_years, exit_cap_rate = 0.0725, exit_month = 60,
    exit_value_override = null, selling_costs_pct = 0.02, closing_costs_pct = 0.03,
    acquisition_fee_pct = 0.02, initial_repairs = 0, ltv = 0, interest_rate = 0.07,
    amort_years = 30, io_months = 0, refi_month = null, refi_ltv = null,
    refi_rate = null, refi_amort_years = null, refi_dscr = null, refi_fee_pct = null,
  } = p

  const holdMos = Math.round(exit_month)
  const holdYrs = noi_years.length
  const exitYr = Math.max(1, Math.min(holdYrs, Math.round(holdMos / 12)))
  const totalCost = pp * (1 + closing_costs_pct + acquisition_fee_pct) + initial_repairs
  const exitNOI = interpNOI(noi_years, holdMos)
  const exitVal = (exit_value_override && exit_value_override > 0)
    ? exit_value_override
    : (exit_cap_rate > 0 ? exitNOI / exit_cap_rate : 0)
  const netSale = exitVal * (1 - selling_costs_pct)

  // Unlevered
  const ucf = [-totalCost]
  for (let yr = 1; yr <= exitYr; yr++) {
    const noi = yr <= noi_years.length ? noi_years[yr - 1] : noi_years[noi_years.length - 1]
    ucf.push(yr === exitYr ? noi + netSale : noi)
  }

  // Levered
  const loan = pp * ltv
  const equity = totalCost - loan
  const ioYrs = Math.floor(io_months / 12)
  const annDsIO = loan * interest_rate
  let annDsBridge = loan * interest_rate
  if (amort_years > 0 && interest_rate > 0) {
    const mr = interest_rate / 12, np = amort_years * 12
    annDsBridge = loan * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1) * 12
  }

  let refiCashOut = 0, refiFeePaid = 0, newLoan = loan, newLoanDs = annDsBridge
  let refiYr: number | null = null, rr = interest_rate, ra = amort_years
  const doRefi = !!(refi_month && refi_month > 0 && ltv > 0)

  if (doRefi && refi_month) {
    refiYr = Math.max(1, Math.min(exitYr, Math.round(refi_month / 12)))
    const refiNOI = interpNOI(noi_years, refi_month)
    rr = refi_rate ?? interest_rate
    ra = refi_amort_years ?? 30
    const rc = refi_ltv ?? 0.70, rd = refi_dscr ?? 1.30, rf = refi_fee_pct ?? 0.01
    const gic = noi_years[0] / pp
    const stabVal = gic > 0 ? refiNOI / gic : 0
    newLoan = Math.min(stabVal * rc, rr > 0 ? refiNOI / rd / rr : 0)
    const bridgeBal = loanBalance(loan, interest_rate, amort_years, io_months, refi_month)
    refiCashOut = Math.max(0, newLoan - bridgeBal)
    refiFeePaid = newLoan * rf
    if (ra > 0 && rr > 0) {
      const mr2 = rr / 12, np2 = ra * 12
      newLoanDs = newLoan * (mr2 * Math.pow(1 + mr2, np2)) / (Math.pow(1 + mr2, np2) - 1) * 12
    } else { newLoanDs = newLoan * rr }
  }

  const lcf = [-equity]
  for (let yr = 1; yr <= exitYr; yr++) {
    const noi = yr <= noi_years.length ? noi_years[yr - 1] : noi_years[noi_years.length - 1]
    const ds = (doRefi && refiYr && yr > refiYr) ? newLoanDs : (yr <= ioYrs ? annDsIO : annDsBridge)
    if (yr < exitYr) {
      let cf = noi - ds
      if (doRefi && refiYr && yr === refiYr) cf += refiCashOut - refiFeePaid
      lcf.push(cf)
    } else {
      const mosSinceRefi = doRefi && refiYr ? (exitYr - refiYr) * 12 : 0
      const remBal = doRefi && refiYr
        ? loanBalance(newLoan, rr, ra, 0, mosSinceRefi)
        : loanBalance(loan, interest_rate, amort_years, io_months, holdMos)
      let cf = noi - ds + netSale - remBal
      if (doRefi && refiYr && yr === refiYr) cf += refiCashOut - refiFeePaid
      lcf.push(cf)
    }
  }

  const uIRR = irr(ucf)
  const lIRR = ltv > 0 ? irr(lcf) : uIRR
  const em = equity > 0 ? lcf.filter(c => c > 0).reduce((a, b) => a + b, 0) / equity : 0

  return {
    unlevered_irr:       Math.round(uIRR * 10000) / 10000,
    levered_irr:         Math.round(lIRR * 10000) / 10000,
    equity_multiple:     Math.round(em * 100) / 100,
    equity_required:     Math.round(equity),
    loan_amount:         Math.round(loan),
    annual_debt_service: Math.round(doRefi ? newLoanDs : annDsBridge),
    going_in_cap:        pp > 0 ? Math.round(noi_years[0] / pp * 10000) / 10000 : 0,
    stabilized_cap:      pp > 0 ? Math.round(exitNOI / pp * 10000) / 10000 : 0,
    exit_value:          Math.round(exitVal),
    exit_noi:            Math.round(exitNOI),
    refi_cash_out:       Math.round(refiCashOut),
    new_loan:            Math.round(newLoan),
  }
}

function findMaxOffer(params: IRRParams & { target_irr: number }) {
  const { target_irr, ...base } = params
  let lo = 100000, hi = 50000000
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    try {
      const r = calcIRR({ ...base, purchase_price: m })
      const irrVal = base.ltv ? r.levered_irr : r.unlevered_irr
      if (irrVal >= target_irr) lo = m; else hi = m
    } catch { hi = m }
  }
  const maxOffer = Math.round((lo + hi) / 2 / 1000) * 1000
  const result = calcIRR({ ...base, purchase_price: maxOffer })
  return { max_offer: maxOffer, irr_at_max: base.ltv ? result.levered_irr : result.unlevered_irr, exit_value: result.exit_value, exit_noi: result.exit_noi }
}

// ── API Handler ───────────────────────────────────────────────────────────────

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action: string }

  // ── Build Proforma ────────────────────────────────────────────────
  if (action === 'build-proforma') {
    try {
      const { t12_data, assumptions } = req.body as { t12_data: T12Data; assumptions: Assumptions }
      return res.status(200).json(buildProforma(t12_data, assumptions))
    } catch (err) {
      console.error('build-proforma error:', err)
      return res.status(500).json({ error: 'Proforma build failed', detail: String(err) })
    }
  }

  // ── Calc IRR v2 ───────────────────────────────────────────────────
  if (action === 'calc-irr-v2') {
    try {
      return res.status(200).json(calcIRR(req.body as IRRParams))
    } catch (err) {
      console.error('calc-irr-v2 error:', err)
      return res.status(500).json({ error: 'IRR calculation failed', detail: String(err) })
    }
  }

  // ── Max Offer ─────────────────────────────────────────────────────
  if (action === 'max-offer') {
    try {
      return res.status(200).json(findMaxOffer(req.body as IRRParams & { target_irr: number }))
    } catch (err) {
      console.error('max-offer error:', err)
      return res.status(500).json({ error: 'Max offer failed', detail: String(err) })
    }
  }

  // ── Extract ───────────────────────────────────────────────────────
  if (action === 'extract') {
    const { files } = req.body as { files: FileInput[] }
    if (!files?.length) return res.status(400).json({ error: 'No files provided' })
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentBlocks: any[] = []
      for (const f of files) contentBlocks.push(...await fileToBlocks(f))
      contentBlocks.push({ type: 'text', text: EXTRACTION_PROMPT })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 3000,
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

  // ── Build Excel ───────────────────────────────────────────────────
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
      execFileSync('python', [script, '--inputs-file', inputsFile, '--output', outputFile], { timeout: 30_000, encoding: 'utf-8' })
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
