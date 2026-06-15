/**
 * /api/underwrite
 * All engines run natively on Vercel — no droplet needed.
 * calc-irr-v2, max-offer, build-proforma: Vercel-native TypeScript
 * run-excel / download-excel: proxied to /api/run-excel (also Vercel)
 * extract: calls Anthropic Claude
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/serverAuth'
import fs from 'fs'
import path from 'path'
import os from 'os'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Extraction prompt ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are analyzing self-storage acquisition documents (rent roll, T12 P&L, offering memorandum, proforma, or deal memo).

Extract ALL available inputs for financial underwriting. Return ONLY a valid JSON object — no markdown fences, no commentary, no extra text. Use null for any field you cannot find.

IMPORTANT: Extract the SELLER'S projected numbers exactly as presented.

{
  "propertyName": string,
  "address": string,
  "city": string,
  "state": string,
  "squareFeet": number,
  "yearBuilt": number,
  "broker": string,
  "purchasePrice": number,
  "askingPrice": number,
  "closingCostsPct": number,
  "initialRepairs": number,
  "totalUnits": number,
  "currentOccupancy": number,
  "marketOccupancy": number,
  "currentAvgRent": number,
  "marketAvgRent": number,
  "t12Revenue": number,
  "t12NOI": number,
  "t12Expenses": number,
  "goingInCapRate": number,
  "t12Tax": number,
  "t12Insurance": number,
  "t12Utilities": number,
  "t12RepairsMaintenance": number,
  "t12Payroll": number,
  "t12OfficeEmployee": number,
  "t12Marketing": number,
  "t12Administrative": number,
  "t12OtherExpenses": number,
  "t12ManagementFees": number,
  "brokerY1NOI": number,
  "brokerY2NOI": number,
  "brokerY3NOI": number,
  "brokerY4NOI": number,
  "brokerY5NOI": number,
  "brokerY1Revenue": number,
  "brokerY2Revenue": number,
  "brokerY3Revenue": number,
  "brokerY4Revenue": number,
  "brokerY5Revenue": number,
  "brokerY1Occupancy": number,
  "brokerY2Occupancy": number,
  "brokerY3Occupancy": number,
  "brokerY4Occupancy": number,
  "brokerY5Occupancy": number,
  "brokerY1AvgRent": number,
  "brokerY2AvgRent": number,
  "brokerY3AvgRent": number,
  "brokerY4AvgRent": number,
  "brokerY5AvgRent": number,
  "brokerY1Expenses": number,
  "brokerY2Expenses": number,
  "brokerY3Expenses": number,
  "brokerY4Expenses": number,
  "brokerY5Expenses": number,
  "unitMix": [
    { "type": string, "units": number, "sqft": number, "currentRent": number, "marketRent": number }
  ]
}`

// ── Type definitions ──────────────────────────────────────────────────────────

interface T12Data {
  total_revenue: number
  total_expenses: number
  noi: number
  occupancy?: number
  avg_rent_mo?: number
  payroll?: number
  management_fees?: number
  marketing?: number
  utilities?: number
  office_employee?: number
  administrative?: number
  repairs_maintenance?: number
  tax?: number
  insurance?: number
  other_expenses?: number
  broker_years?: { revenue: number; expenses: number; noi: number }[]
}

interface Assumptions {
  total_units: number
  current_occupancy: number
  rent_uplift_y1?: number
  rent_growth?: number
  opex_growth?: number
  tax_insurance_growth?: number
  mgmt_fee_pct?: number
  revenue_haircut?: number
  occ_schedule?: number[]
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

interface CalcIRRV2Params {
  purchase_price: number
  noi_years: number[]
  exit_cap_rate?: number
  exit_month?: number
  exit_value_override?: number
  ltv?: number
  interest_rate?: number
  amort_years?: number
  io_months?: number
  selling_costs_pct?: number
  closing_costs_pct?: number
  capex?: number
  refi_month?: number
  refi_ltv?: number
  refi_rate?: number
  refi_amort_years?: number
  refi_dscr?: number
  refi_fee_pct?: number
}

// ── IRR helpers ───────────────────────────────────────────────────────────────

function irrCalc(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0
  let rate = 0.1
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0
    let dnpv = 0
    for (let i = 0; i < cashFlows.length; i++) {
      const d = Math.pow(1 + rate, i)
      npv += cashFlows[i] / d
      dnpv -= i * cashFlows[i] / (d * (1 + rate))
    }
    if (Math.abs(dnpv) < 1e-12) break
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-10) { rate = newRate; break }
    rate = newRate
  }
  return isFinite(rate) ? rate : 0
}

function calcLoanBalance(principal: number, annualRate: number, amortYears: number, ioMonths: number, monthsElapsed: number): number {
  if (principal <= 0) return 0
  const mr = annualRate / 12
  const np = amortYears * 12
  if (monthsElapsed <= ioMonths) return principal
  const amortMonths = monthsElapsed - ioMonths
  if (mr < 1e-8) return Math.max(0, principal - (principal / np) * amortMonths)
  const mp = principal * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
  return Math.max(0, principal * Math.pow(1 + mr, amortMonths) - mp * (Math.pow(1 + mr, amortMonths) - 1) / mr)
}

function interpNOIAtMonth(noiYears: number[], month: number): number {
  const yr = month / 12
  const lo = Math.max(0, Math.floor(yr) - 1)
  const hi = Math.min(noiYears.length - 1, Math.ceil(yr) - 1)
  if (lo === hi) return noiYears[lo] || noiYears[noiYears.length - 1]
  const frac = yr - Math.floor(yr)
  return noiYears[lo] * (1 - frac) + noiYears[hi] * frac
}

// ── CalcIRRv2 ─────────────────────────────────────────────────────────────────

function calcIRRv2(params: CalcIRRV2Params) {
  const {
    purchase_price,
    noi_years,
    exit_cap_rate = 0.06,
    exit_month = 60,
    exit_value_override,
    ltv = 0,
    interest_rate = 0.065,
    amort_years = 30,
    io_months = 0,
    selling_costs_pct = 0.01,
    closing_costs_pct = 0.02,
    capex = 0,
    refi_month,
    refi_ltv,
    refi_rate,
    refi_amort_years,
    refi_dscr,
    refi_fee_pct,
  } = params

  const holdMonths = exit_month
  const exitYear = Math.max(1, Math.round(holdMonths / 12))
  const totalCost = purchase_price * (1 + closing_costs_pct) + capex

  const exitNOI = noi_years.length > 0
    ? interpNOIAtMonth(noi_years, holdMonths)
    : 0
  const exitValue = exit_value_override && exit_value_override > 0
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

// ── Max Offer ─────────────────────────────────────────────────────────────────

function findMaxOffer(params: CalcIRRV2Params & { target_irr: number }) {
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

// ── Build Proforma ────────────────────────────────────────────────────────────

function buildProforma(t12: T12Data, assumptions: Assumptions) {
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

  const t12Revenue = t12.total_revenue || 0
  const t12NOI = t12.noi || (t12Revenue - (t12.total_expenses || t12Revenue * 0.38))
  const t12Expenses = t12.total_expenses || (t12Revenue - t12NOI)
  const t12Occupancy = current_occupancy || 0.80
  const avgRentMo = total_units > 0 && t12Occupancy > 0
    ? t12Revenue / (total_units * t12Occupancy * 12)
    : 0

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

  const breakdownTotal = Object.values(expBreak).reduce((a, b) => a + b, 0)
  let scaledBreak = { ...expBreak }
  if (breakdownTotal > 0 && Math.abs(breakdownTotal - t12Expenses) / Math.max(t12Expenses, 1) > 0.05) {
    const scale = t12Expenses / breakdownTotal
    scaledBreak = Object.fromEntries(Object.entries(expBreak).map(([k, v]) => [k, v * scale])) as typeof expBreak
  }

  const years: OurYear[] = []
  for (let yr = 1; yr <= 5; yr++) {
    const occ = occ_schedule[yr - 1] ?? occ_schedule[occ_schedule.length - 1]
    const rentGrowthFactor = yr === 1
      ? (1 + rent_uplift_y1)
      : Math.pow(1 + rent_growth, yr - 1) * (1 + rent_uplift_y1)
    const rentMo = avgRentMo * rentGrowthFactor
    const revenue = Math.round(total_units * occ * rentMo * 12 * (1 - revenue_haircut))
    const growFactor = Math.pow(1 + opex_growth, yr - 1)
    const tiGrowFactor = Math.pow(1 + tax_insurance_growth, yr - 1)
    const exp = {
      payroll:             Math.round((scaledBreak.payroll || 0) * growFactor),
      management_fees:     Math.round(revenue * mgmt_fee_pct),
      marketing:           Math.round((scaledBreak.marketing || 0) * growFactor),
      utilities:           Math.round((scaledBreak.utilities || 0) * growFactor),
      office_employee:     Math.round((scaledBreak.office_employee || 0) * growFactor),
      administrative:      Math.round((scaledBreak.administrative || 0) * growFactor),
      repairs_maintenance: Math.round((scaledBreak.repairs_maintenance || 0) * growFactor),
      tax:                 Math.round((scaledBreak.tax || 0) * tiGrowFactor),
      insurance:           Math.round((scaledBreak.insurance || 0) * tiGrowFactor),
      other:               Math.round((scaledBreak.other || 0) * growFactor),
      total:               0,
    }
    exp.total = Object.entries(exp).filter(([k]) => k !== 'total').reduce((a, [, v]) => a + v, 0)
    const noi = revenue - exp.total
    years.push({
      year: yr,
      occupancy: occ,
      avg_rent_mo: Math.round(rentMo * 100) / 100,
      revenue,
      expenses: exp,
      noi,
      noi_margin: revenue > 0 ? Math.round(noi / revenue * 10000) / 10000 : 0,
      expense_ratio: revenue > 0 ? Math.round(exp.total / revenue * 10000) / 10000 : 0,
    })
  }

  return {
    t12: {
      revenue: Math.round(t12Revenue),
      expenses: Math.round(t12Expenses),
      noi: Math.round(t12NOI),
      occupancy: t12Occupancy,
      avg_rent_mo: Math.round(avgRentMo * 100) / 100,
      expense_breakdown: scaledBreak,
    },
    years,
    broker_years: t12.broker_years,
  }
}

// ── API config ────────────────────────────────────────────────────────────────

export const config = { api: { bodyParser: { sizeLimit: '50mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body as { action: string }

  // ── Extract ───────────────────────────────────────────────────────────
  if (action === 'extract') {
    try {
      const { files } = req.body as {
        files: { fileName: string; mimeType: string; data: string }[]
      }
      if (!files?.length) return res.status(400).json({ error: 'No files provided' })

      const contentParts: any[] = []
      for (const f of files) {
        const mt = f.mimeType as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
        if (mt === 'application/pdf' || mt.startsWith('image/')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contentParts.push({
            type: mt === 'application/pdf' ? 'document' : 'image',
            source: { type: 'base64', media_type: mt, data: f.data },
          } as any)
        }
      }
      contentParts.push({ type: 'text', text: EXTRACTION_PROMPT })

      const msg = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: contentParts }],
      })

      const raw = msg.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('')
      const extracted = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
      return res.status(200).json(extracted)
    } catch (err) {
      console.error('extract error:', err)
      return res.status(500).json({ error: 'Extraction failed', detail: String(err) })
    }
  }

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
      return res.status(500).json({ error: 'Max offer calculation failed', detail: String(err) })
    }
  }

  // ── Run Excel / Download Excel — Vercel-native ────────────────────
  if (action === 'run-excel' || action === 'download-excel') {
    try {
      const { action: _a, ...inputs } = req.body
      const origin = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000'
      const excelRes = await fetch(`${origin}/api/run-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      })
      if (!excelRes.ok) {
        const err = await excelRes.text()
        return res.status(502).json({ error: 'Excel engine error', detail: err })
      }
      const buffer = Buffer.from(await excelRes.arrayBuffer())
      const filename = excelRes.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'YEM_Model.xlsx'
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', buffer.length)
      return res.send(buffer)
    } catch (err) {
      console.error('run-excel error:', err)
      return res.status(500).json({ error: 'Excel model failed', detail: String(err) })
    }
  }

  // ── Generate LOI — proxy to generate-loi route ────────────────────
  if (action === 'generate-loi') {
    try {
      const { action: _a, ...loiInputs } = req.body
      const origin = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000'
      const loiRes = await fetch(`${origin}/api/generate-loi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loiInputs),
      })
      if (!loiRes.ok) {
        const err = await loiRes.text()
        return res.status(502).json({ error: 'LOI generation error', detail: err })
      }
      const data = await loiRes.json()
      return res.status(200).json(data)
    } catch (err) {
      console.error('generate-loi error:', err)
      return res.status(500).json({ error: 'LOI generation failed', detail: String(err) })
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
