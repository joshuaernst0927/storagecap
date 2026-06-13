/**
 * /api/underwrite — YEM Acquisitions
 * All computation runs on Vercel. No droplet dependency.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DO_API = 'http://157.230.186.240:8000'

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

// ── Proforma Engine (Vercel-native) ───────────────────────────────────────────

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

function buildProforma(t12: T12Data, assumptions: Assumptions): {
  t12: {
    revenue: number; expenses: number; noi: number; occupancy: number; avg_rent_mo: number
    expense_breakdown: {
      payroll: number; management_fees: number; marketing: number; utilities: number
      office_employee: number; administrative: number; repairs_maintenance: number
      tax: number; insurance: number; other: number
    }
  }
  years: OurYear[]
  broker_years?: OurYear[]
} {
  const {
    total_units,
    current_occupancy,
    rent_uplift_y1 = 0.12,
    rent_growth = 0.04,
    opex_growth = 0.02,
    tax_insurance_growth = 0.02,
    mgmt_fee_pct = 0.05,
    revenue_haircut = 0,
    occ_schedule = [0.75, 0.82, 0.88, 0.90, 0.90],
  } = assumptions

  // Derive T12 base metrics
  const t12Revenue = t12.total_revenue || 0
  const t12NOI = t12.noi || (t12Revenue - (t12.total_expenses || t12Revenue * 0.38))
  const t12Expenses = t12.total_expenses || (t12Revenue - t12NOI)
  const t12Occupancy = current_occupancy || 0.80
  const avgRentMo = total_units > 0 && t12Occupancy > 0
    ? t12Revenue / (total_units * t12Occupancy * 12)
    : 0

  // T12 expense breakdown
  const expBreak = {
    payroll:             t12.payroll || 0,
    management_fees:     t12.management_fees || t12Revenue * mgmt_fee_pct,
    marketing:           t12.marketing || 0,
    utilities:           t12.utilities || 0,
    office_employee:     t12.office_employee || 0,
    administrative:      t12.administrative || 0,
    repairs_maintenance: t12.repairs_maintenance || 0,
    tax:                 t12.tax || 0,
    insurance:           t12.insurance || 0,
    other:               t12.other_expenses || 0,
  }

  // If breakdown doesn't add up, scale to match total
  const breakdownTotal = Object.values(expBreak).reduce((a, b) => a + b, 0)
  let scaledBreak = { ...expBreak }
  if (breakdownTotal > 0 && Math.abs(breakdownTotal - t12Expenses) / Math.max(t12Expenses, 1) > 0.05) {
    const scale = t12Expenses / breakdownTotal
    scaledBreak = Object.fromEntries(Object.entries(expBreak).map(([k, v]) => [k, v * scale])) as typeof expBreak
  }

  // Build 5-year projection
  const years: OurYear[] = []
  for (let yr = 1; yr <= 5; yr++) {
    const occ = occ_schedule[yr - 1] ?? occ_schedule[occ_schedule.length - 1] ?? 0.90
    const rentGrowthFactor = yr === 1 ? (1 + rent_uplift_y1) : (1 + rent_uplift_y1) * Math.pow(1 + rent_growth, yr - 1)
    const baseRent = avgRentMo > 0 ? avgRentMo : (t12Revenue / Math.max(total_units * t12Occupancy * 12, 1))
    const projRent = baseRent * rentGrowthFactor
    const revenue = Math.round(total_units * occ * projRent * 12 * (1 - revenue_haircut))
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
      avg_rent_mo: Math.round(projRent * 100) / 100,
      revenue,
      expenses: {
        payroll,
        management_fees: mgmtFees,
        marketing,
        utilities,
        office_employee: officeEmployee,
        administrative,
        repairs_maintenance: repairsMaint,
        tax,
        insurance,
        other,
        total: totalExp,
      },
      noi,
      noi_margin: revenue > 0 ? Math.round(noi / revenue * 1000) / 1000 : 0,
      expense_ratio: revenue > 0 ? Math.round(totalExp / revenue * 1000) / 1000 : 0,
    })
  }

  // Broker years from seller_years if provided
  let brokerYears: OurYear[] | undefined
  if (t12.seller_years && t12.seller_years.length > 0) {
    brokerYears = t12.seller_years.map((sy, i) => {
      const revenue = sy.revenue || 0
      const noi = sy.noi || (revenue - (sy.expenses || 0))
      const expenses = sy.expenses || (revenue - noi)
      return {
        year: i + 1,
        occupancy: 0,
        avg_rent_mo: 0,
        revenue,
        expenses: {
          payroll: 0, management_fees: 0, marketing: 0, utilities: 0,
          office_employee: 0, administrative: 0, repairs_maintenance: 0,
          tax: 0, insurance: 0, other: 0, total: expenses,
        },
        noi,
        noi_margin: revenue > 0 ? noi / revenue : 0,
        expense_ratio: revenue > 0 ? expenses / revenue : 0,
      }
    })
  }

  return {
    t12: {
      revenue: Math.round(t12Revenue),
      expenses: Math.round(t12Expenses),
      noi: Math.round(t12NOI),
      occupancy: t12Occupancy,
      avg_rent_mo: Math.round(avgRentMo * 100) / 100,
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
  const mr = interestRate / 12
  const np = amortYears * 12
  const mp = originalLoan * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
  let balance = originalLoan
  for (let i = 0; i < amortMonthsElapsed; i++) {
    balance -= (mp - balance * mr)
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

  const ucf: number[] = [-totalCost]
  for (let yr = 1; yr <= exitYear; yr++) {
    const noi = yr <= noi_years.length ? noi_years[yr - 1] : noi_years[noi_years.length - 1]
    ucf.push(yr === exitYear ? noi + netSale : noi)
  }

  const loan = purchase_price * ltv
  const equity = totalCost - loan
  const ioYears = Math.floor(io_months / 12)
  const annualDsIO = loan * interest_rate
  let annualDsBridge = loan * interest_rate
  if (amort_years > 0 && interest_rate > 0) {
    const mr = interest_rate / 12
    const np = amort_years * 12
    annualDsBridge = loan * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1) * 12
  }

  let refiCashOut = 0, refiFeePaid = 0, newLoan = loan, newLoanDs = annualDsBridge
  let refiYear: number | null = null, rr = interest_rate, ra = amort_years
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
      newLoanDs = newLoan * (mr2 * Math.pow(1 + mr2, np2)) / (Math.pow(1 + mr2, np2) - 1) * 12
    } else {
      newLoanDs = newLoan * rr
    }
  }

  const lcf: number[] = [-equity]
  for (let yr = 1; yr <= exitYear; yr++) {
    const noi = yr <= noi_years.length ? noi_years[yr - 1] : noi_years[noi_years.length - 1]
    const ds = (refiOccurs && refiYear && yr > refiYear) ? newLoanDs : (yr <= ioYears ? annualDsIO : annualDsBridge)
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

  return {
    unlevered_irr:       Math.round(uIRR * 10000) / 10000,
    levered_irr:         Math.round(lIRR * 10000) / 10000,
    equity_multiple:     Math.round(equityMultiple * 100) / 100,
    equity_required:     Math.round(equity),
    loan_amount:         Math.round(loan),
    annual_debt_service: Math.round(refiOccurs ? newLoanDs : annualDsBridge),
    going_in_cap:        purchase_price > 0 ? Math.round(noi_years[0] / purchase_price * 10000) / 10000 : 0,
    stabilized_cap:      purchase_price > 0 ? Math.round(exitNOI / purchase_price * 10000) / 10000 : 0,
    exit_value:          Math.round(exitValue),
    exit_noi:            Math.round(exitNOI),
    refi_cash_out:       Math.round(refiCashOut),
    new_loan:            Math.round(newLoan),
  }
}

// ── Max Offer (Vercel-native) ─────────────────────────────────────────────────

function findMaxOffer(params: CalcIRRV2Params & { target_irr: number }): {
  max_offer: number; irr_at_max: number; exit_value: number; exit_noi: number
} {
  const { target_irr, ...baseParams } = params
  let lo = 100000, hi = 50000000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    try {
      const r = calcIRRv2({ ...baseParams, purchase_price: mid })
      const irr = baseParams.ltv ? r.levered_irr : r.unlevered_irr
      if (irr >= target_irr) lo = mid
      else hi = mid
    } catch { hi = mid }
  }
  const maxOffer = Math.round((lo + hi) / 2 / 1000) * 1000
  const result = calcIRRv2({ ...baseParams, purchase_price: maxOffer })
  return {
    max_offer: maxOffer,
    irr_at_max: baseParams.ltv ? result.levered_irr : result.unlevered_irr,
    exit_value: result.exit_value,
    exit_noi: result.exit_noi,
  }
}

// ── API Handler ───────────────────────────────────────────────────────────────

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action: string }

  // ── Build Proforma — Vercel-native ────────────────────────────────
  if (action === 'build-proforma') {
    try {
      const { t12_data, assumptions } = req.body as { t12_data: T12Data; assumptions: Assumptions }
      const result = buildProforma(t12_data, assumptions)
      return res.status(200).json(result)
    } catch (err) {
      console.error('build-proforma error:', err)
      return res.status(500).json({ error: 'Proforma build failed', detail: String(err) })
    }
  }

  // ── Calc IRR v2 — Vercel-native ───────────────────────────────────
  if (action === 'calc-irr-v2') {
    try {
      const result = calcIRRv2(req.body as CalcIRRV2Params)
      return res.status(200).json(result)
    } catch (err) {
      console.error('calc-irr-v2 error:', err)
      return res.status(500).json({ error: 'IRR calculation failed', detail: String(err) })
    }
  }

  // ── Max Offer — Vercel-native ─────────────────────────────────────
  if (action === 'max-offer') {
    try {
      const result = findMaxOffer(req.body as CalcIRRV2Params & { target_irr: number })
      return res.status(200).json(result)
    } catch (err) {
      console.error('max-offer error:', err)
      return res.status(500).json({ error: 'Max offer failed', detail: String(err) })
    }
  }

  // ── Calc IRR (legacy) — proxy to droplet ──────────────────────────
  if (action === 'calc-irr') {
    try {
      const { action: _a, ...params } = req.body
      const doRes = await fetch(`${DO_API}/calc-irr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!doRes.ok) return res.status(502).json({ error: 'DO server error', detail: await doRes.text() })
      return res.status(200).json(await doRes.json())
    } catch (err) {
      return res.status(500).json({ error: 'IRR calculation failed', detail: String(err) })
    }
  }

  // ── Run Excel Model — proxy to droplet ────────────────────────────
  if (action === 'run-excel') {
    try {
      const { action: _a, ...params } = req.body
      const doRes = await fetch(`${DO_API}/run-model`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params), signal: AbortSignal.timeout(120000),
      })
      if (!doRes.ok) return res.status(502).json({ error: 'Excel model error', detail: await doRes.text() })
      return res.status(200).json(await doRes.json())
    } catch (err) {
      return res.status(500).json({ error: 'Excel model failed', detail: String(err) })
    }
  }

  // ── Extract — Claude ──────────────────────────────────────────────
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
      return res.status(500).json({ error: 'Extraction failed', detail: String(err) })
    }
  }

  // ── Build Excel — Python ──────────────────────────────────────────
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
      return res.status(500).json({ error: 'Model build failed', detail: String(err) })
    } finally {
      for (const f of [inputsFile, outputFile]) { try { fs.unlinkSync(f) } catch { /* ignore */ } }
    }
  }

  return res.status(400).json({ error: 'Unknown action.' })
}
