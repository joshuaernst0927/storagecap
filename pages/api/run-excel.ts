/**
 * /api/run-excel
 *
 * Institutional Excel model calculation engine.
 *
 * Model: backend/models/Institutional_Self_Storage_Acquisition_Model_v3_Toggle_Waterfall_Metrics.xlsx
 *
 * Architecture:
 *   1. Load the workbook via xlsx (reads cached cell values + formula strings)
 *   2. Build a HyperFormula instance from all 14 sheets
 *   3. Write approved input values into mapped input cells
 *   4. HyperFormula recalculates the full dependency graph synchronously
 *   5. Read output cells from Dashboard, Returns Summary, and GP-LP Waterfall
 *   6. Return a JSON payload with all inputs echoed and all outputs computed
 *
 * Why HyperFormula:
 *   The xlsx library alone only reads/writes cell values — it does NOT recalculate
 *   Excel formulas. HyperFormula is a full formula engine (MIT/GPL-v3) that evaluates
 *   Excel-compatible formulas in Node.js, including IRR, XIRR, NPV, PMT, IF, VLOOKUP.
 *   This means all financial calculations (IRR, DSCR, waterfall, refi) stay in the
 *   Excel workbook where the investment committee can audit and update them.
 *
 * Workbook bug workaround:
 *   Debt & Refi!B5 formula reads Inputs!B25 (a blank section-header row) instead of
 *   Inputs!B26 (Initial LTV). This is a formula reference error in the workbook.
 *   Workaround: write initialLTV to BOTH B25 (row index 24) AND B26 (row index 25)
 *   until the workbook formula is corrected to reference B26.
 *   See: WORKBOOK_BUG_LTV_WORKAROUND below.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import * as XLSX from 'xlsx'
import { HyperFormula } from 'hyperformula'
import { requireAuth } from '@/lib/serverAuth'
import path from 'path'
import fs from 'fs'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

// ── Model path ────────────────────────────────────────────────────────────────

const MODEL_PATH = path.join(
  process.cwd(),
  'backend',
  'models',
  'Institutional_Self_Storage_Acquisition_Model_v3_Toggle_Waterfall_Metrics.xlsx',
)

// ── Input cell map ────────────────────────────────────────────────────────────
// Maps incoming request field names → [HF sheet name, 0-based row, 0-based col]
// All inputs are in column B (col index 1) of the Inputs sheet.
// Excel row N → HF row index N-1.
//
// Only cells confirmed as hard-coded [V] values are listed here.
// Formula cells [F] are never overwritten.

type CellAddr = { sheet: string; row: number; col: number }

const INPUT_MAP: Record<string, CellAddr> = {
  // Acquisition
  purchasePrice:         { sheet: 'Inputs', row: 3,  col: 1 }, // B4
  closingCostsPct:       { sheet: 'Inputs', row: 4,  col: 1 }, // B5
  initialRepairs:        { sheet: 'Inputs', row: 5,  col: 1 }, // B6
  acquisitionFeePct:     { sheet: 'Inputs', row: 6,  col: 1 }, // B7
  assetMgmtFeePct:       { sheet: 'Inputs', row: 7,  col: 1 }, // B8
  dispositionFeePct:     { sheet: 'Inputs', row: 8,  col: 1 }, // B9
  sponsorCoInvestPct:    { sheet: 'Inputs', row: 9,  col: 1 }, // B10
  // Operations
  startOccupancy:        { sheet: 'Inputs', row: 12, col: 1 }, // B13
  stabilizedOccupancy:   { sheet: 'Inputs', row: 13, col: 1 }, // B14
  monthsToStabilization: { sheet: 'Inputs', row: 14, col: 1 }, // B15
  econOccDiscount:       { sheet: 'Inputs', row: 16, col: 1 }, // B17
  annualRentGrowth:      { sheet: 'Inputs', row: 17, col: 1 }, // B18
  adminFeesPct:          { sheet: 'Inputs', row: 18, col: 1 }, // B19
  tenantInsurancePct:    { sheet: 'Inputs', row: 19, col: 1 }, // B20
  otherIncomePerMonth:   { sheet: 'Inputs', row: 20, col: 1 }, // B21
  opexGrowth:            { sheet: 'Inputs', row: 21, col: 1 }, // B22
  // Debt / Refi / Exit
  // NOTE: initialLTV is handled separately due to workbook bug — see WORKBOOK_BUG_LTV_WORKAROUND
  initialRate:           { sheet: 'Inputs', row: 26, col: 1 }, // B27
  initialAmortYears:     { sheet: 'Inputs', row: 27, col: 1 }, // B28
  ioPeriodMonths:        { sheet: 'Inputs', row: 28, col: 1 }, // B29
  minDSCR:               { sheet: 'Inputs', row: 29, col: 1 }, // B30
  refiMonth:             { sheet: 'Inputs', row: 30, col: 1 }, // B31
  refiLTV:               { sheet: 'Inputs', row: 31, col: 1 }, // B32
  refiRate:              { sheet: 'Inputs', row: 32, col: 1 }, // B33
  refiAmortYears:        { sheet: 'Inputs', row: 33, col: 1 }, // B34
  exitCapRate:           { sheet: 'Inputs', row: 34, col: 1 }, // B35
  exitMonth:             { sheet: 'Inputs', row: 35, col: 1 }, // B36
  sellingCostsPct:       { sheet: 'Inputs', row: 36, col: 1 }, // B37
  // GP-LP Waterfall parameters
  preferredReturn:       { sheet: 'Inputs', row: 39, col: 1 }, // B40
  returnOfCapitalLP:     { sheet: 'Inputs', row: 40, col: 1 }, // B41
  catchUpSplitLP:        { sheet: 'Inputs', row: 41, col: 1 }, // B42
  catchUpSplitGP:        { sheet: 'Inputs', row: 42, col: 1 }, // B43
  residualHurdle:        { sheet: 'Inputs', row: 43, col: 1 }, // B44
  residualSplitLP:       { sheet: 'Inputs', row: 44, col: 1 }, // B45
  residualSplitGP:       { sheet: 'Inputs', row: 45, col: 1 }, // B46
  // LP contributes 100% equity toggle
  lpContributes100Pct:   { sheet: 'Inputs', row: 50, col: 1 }, // B51 — string "Yes"/"No"
}

// Operating Expenses: T12 actuals → Operating Expenses sheet column B (Year 1 base)
// These cells accumulate values (some fields are summed into the same cell).
// Row index = Excel row - 1.
const OPEX_MAP: { field: string; row: number }[] = [
  { field: 't12Tax',                row: 4  }, // B5  Property Taxes
  { field: 't12Insurance',          row: 5  }, // B6  Insurance
  { field: 't12Utilities',          row: 6  }, // B7  Utilities
  { field: 't12RepairsMaintenance', row: 7  }, // B8  Repairs & Maintenance
  { field: 't12Payroll',            row: 8  }, // B9  Payroll (primary)
  { field: 't12OfficeEmployee',     row: 8  }, // B9  Payroll (add on)
  { field: 't12Marketing',          row: 10 }, // B11 Marketing / Admin (primary)
  { field: 't12Administrative',     row: 10 }, // B11 Marketing / Admin (add on)
  { field: 't12OtherExpenses',      row: 11 }, // B12 Software / Call Center
  { field: 't12Reserves',           row: 13 }, // B14 Replacement Reserves
]

// Unit Mix: per-unit-type data → Unit Mix & Market Comps sheet
// Row index = Excel row - 1. Columns: B=units, C=avgSF, D=currentRent, E=marketRent.
const UNIT_MIX_ROWS: Record<string, number> = {
  '5x5':    4,  // Excel row 5
  '5x10':   5,  // Excel row 6
  '10x10':  6,  // Excel row 7
  '10x15':  7,  // Excel row 8
  '10x20':  8,  // Excel row 9
  'parking': 9, // Excel row 10
  'outdoor': 9,
}
function unitTypeRow(type: string): number {
  const t = type.toLowerCase().replace(/\s/g, '')
  for (const [key, row] of Object.entries(UNIT_MIX_ROWS)) {
    if (t.includes(key) || key.includes(t)) return row
  }
  return 10 // catch-all row 11
}

// ── Output cell map ───────────────────────────────────────────────────────────
// All formula [F] cells — never written, only read after recalculation.

const OUTPUT_MAP: Record<string, CellAddr & { label: string }> = {
  // Dashboard
  totalProjectCost:    { sheet: 'Dashboard', row: 4,  col: 1, label: 'Total Project Cost' },      // B5
  equityRequired:      { sheet: 'Dashboard', row: 5,  col: 1, label: 'Equity Required' },          // B6
  year1NOI:            { sheet: 'Dashboard', row: 6,  col: 1, label: 'Year 1 NOI' },               // B7
  year5NOI:            { sheet: 'Dashboard', row: 7,  col: 1, label: 'Year 5 NOI' },               // B8
  leveredIRR:          { sheet: 'Dashboard', row: 8,  col: 1, label: 'Levered IRR' },              // B9
  equityMultiple:      { sheet: 'Dashboard', row: 9,  col: 1, label: 'Equity Multiple' },          // B10
  avgCashOnCash:       { sheet: 'Dashboard', row: 10, col: 1, label: 'Avg Cash-on-Cash' },         // B11
  year1DSCR:           { sheet: 'Dashboard', row: 11, col: 1, label: 'Year 1 DSCR' },             // B12
  year1DebtYield:      { sheet: 'Dashboard', row: 12, col: 1, label: 'Year 1 Debt Yield' },       // B13
  exitValue:           { sheet: 'Dashboard', row: 13, col: 1, label: 'Exit Value' },               // B14
  dscrStatus:          { sheet: 'Dashboard', row: 17, col: 1, label: 'DSCR Status' },             // B18
  debtYieldStatus:     { sheet: 'Dashboard', row: 18, col: 1, label: 'Debt Yield Status' },       // B19
  exitCapSpreadBps:    { sheet: 'Dashboard', row: 19, col: 1, label: 'Exit Cap Spread (bps)' },   // B20
  stabilizedOccCheck:  { sheet: 'Dashboard', row: 20, col: 1, label: 'Stabilized Occ' },          // B21
  unleveredIRR:        { sheet: 'Dashboard', row: 23, col: 1, label: 'Unlevered IRR' },            // B24
  unleveredEqMultiple: { sheet: 'Dashboard', row: 24, col: 1, label: 'Unlevered Equity Multiple' },// B25
  unleveredCashOnCash: { sheet: 'Dashboard', row: 25, col: 1, label: 'Unlevered Avg C-o-C' },     // B26
  lpEquityMultiple:    { sheet: 'Dashboard', row: 30, col: 1, label: 'LP Equity Multiple' },       // B31
  gpEquityMultiple:    { sheet: 'Dashboard', row: 31, col: 1, label: 'GP Equity Multiple' },       // B32
  moic:                { sheet: 'Dashboard', row: 32, col: 1, label: 'MOIC' },                     // B33
  yieldOnCost:         { sheet: 'Dashboard', row: 33, col: 1, label: 'Yield on Cost' },            // B34
  pricePerSF:          { sheet: 'Dashboard', row: 37, col: 1, label: 'Price per Rentable SF' },    // B38
  pricePerUnit:        { sheet: 'Dashboard', row: 38, col: 1, label: 'Price per Unit' },           // B39
  stabilizedCap:       { sheet: 'Dashboard', row: 39, col: 1, label: 'Stabilized Cap' },           // B40
  goingInCap:          { sheet: 'Dashboard', row: 40, col: 1, label: 'Going-In Cap' },             // B41
  // Returns Summary
  totalEquity:         { sheet: 'Returns Summary', row: 13, col: 1, label: 'Total Equity' },       // B14
  retLeveredIRR:       { sheet: 'Returns Summary', row: 15, col: 1, label: 'Levered IRR (RS)' },   // B16
  retEquityMultiple:   { sheet: 'Returns Summary', row: 16, col: 1, label: 'Equity Multiple (RS)' },// B17
  retAvgCashOnCash:    { sheet: 'Returns Summary', row: 17, col: 1, label: 'Avg C-o-C (RS)' },    // B18
  retDSCR:             { sheet: 'Returns Summary', row: 18, col: 1, label: 'Year 1 DSCR (RS)' },  // B19
  // GP-LP Waterfall
  lpTotalDistributions:{ sheet: 'GP-LP Waterfall', row: 17, col: 1, label: 'LP Total Distributions' }, // B18
  gpTotalDistributions:{ sheet: 'GP-LP Waterfall', row: 18, col: 1, label: 'GP Total Distributions' }, // B19
  lpEqMultipleWF:      { sheet: 'GP-LP Waterfall', row: 19, col: 1, label: 'LP Equity Multiple (WF)' },// B20
  lpIRR:               { sheet: 'GP-LP Waterfall', row: 21, col: 1, label: 'LP IRR' },             // B22
  totalMOIC:           { sheet: 'GP-LP Waterfall', row: 23, col: 1, label: 'Total MOIC (WF)' },    // B24
}

// ── HyperFormula loader ───────────────────────────────────────────────────────

function loadWorkbookIntoHF(): HyperFormula {
  const fileBuffer = fs.readFileSync(MODEL_PATH)
  const wb = XLSX.read(fileBuffer, { cellFormula: true, cellStyles: true, sheetStubs: true })

  const sheetsData: Record<string, (string | number | boolean | null)[][]> = {}
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws || !ws['!ref']) {
      sheetsData[name] = [[]]
      continue
    }
    const range = XLSX.utils.decode_range(ws['!ref'])
    const rows: (string | number | boolean | null)[][] = []
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: (string | number | boolean | null)[] = []
      for (let c = range.s.c; c <= range.e.c; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        const cell = ws[ref]
        if (!cell) {
          row.push(null)
        } else if (cell.f) {
          row.push('=' + cell.f)
        } else {
          row.push(cell.v ?? null)
        }
      }
      rows.push(row)
    }
    sheetsData[name] = rows
  }

  return HyperFormula.buildFromSheets(sheetsData, { licenseKey: 'gpl-v3' })
}

// ── Safe cell reader ──────────────────────────────────────────────────────────

function readCell(hf: HyperFormula, addr: CellAddr): number | string | boolean | null {
  const sheetId = hf.getSheetId(addr.sheet)
  if (sheetId === undefined) return null
  try {
    const val = hf.getCellValue({ sheet: sheetId, row: addr.row, col: addr.col })
    // HyperFormula returns DetailedCellError objects for errors — convert to null
    if (val !== null && typeof val === 'object' && 'type' in val) return null
    return val as number | string | boolean | null
  } catch {
    return null
  }
}

// ── Request type ──────────────────────────────────────────────────────────────

interface RunExcelInputs {
  // Scalar inputs (matching INPUT_MAP keys + initialLTV + unlevered)
  purchasePrice?: number
  closingCostsPct?: number
  initialRepairs?: number
  acquisitionFeePct?: number
  assetMgmtFeePct?: number
  dispositionFeePct?: number
  sponsorCoInvestPct?: number
  startOccupancy?: number
  stabilizedOccupancy?: number
  monthsToStabilization?: number
  econOccDiscount?: number
  annualRentGrowth?: number
  adminFeesPct?: number
  tenantInsurancePct?: number
  otherIncomePerMonth?: number
  opexGrowth?: number
  initialLTV?: number
  initialRate?: number
  initialAmortYears?: number
  ioPeriodMonths?: number
  minDSCR?: number
  refiMonth?: number
  refiLTV?: number
  refiRate?: number
  refiAmortYears?: number
  exitCapRate?: number
  exitMonth?: number
  sellingCostsPct?: number
  preferredReturn?: number
  returnOfCapitalLP?: number
  catchUpSplitLP?: number
  catchUpSplitGP?: number
  residualHurdle?: number
  residualSplitLP?: number
  residualSplitGP?: number
  unlevered?: boolean
  lpContributes100Pct?: boolean
  // T12 operating expenses
  t12Tax?: number
  t12Insurance?: number
  t12Utilities?: number
  t12RepairsMaintenance?: number
  t12Payroll?: number
  t12OfficeEmployee?: number
  t12Marketing?: number
  t12Administrative?: number
  t12OtherExpenses?: number
  t12Reserves?: number
  // Unit mix (array of { type, units, avgSF, currentRent, marketRent })
  unitMix?: Array<{
    type: string
    units?: number
    avgSF?: number
    currentRent?: number
    marketRent?: number
  }>
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const t0 = Date.now()

  try {
    const inputs = req.body as RunExcelInputs

    // ── 1. Load workbook into HyperFormula ──────────────────────────────────
    const hf = loadWorkbookIntoHF()
    const inpId  = hf.getSheetId('Inputs')
    const opexId = hf.getSheetId('Operating Expenses')
    const umId   = hf.getSheetId('Unit Mix & Market Comps')

    if (inpId === undefined || opexId === undefined || umId === undefined) {
      return res.status(500).json({ error: 'Workbook sheet not found — check model path' })
    }

    // ── 2. Write scalar inputs from INPUT_MAP ────────────────────────────────
    for (const [field, addr] of Object.entries(INPUT_MAP)) {
      const raw = (inputs as Record<string, unknown>)[field]
      if (raw == null) continue

      const sheetId = hf.getSheetId(addr.sheet)
      if (sheetId === undefined) continue

      // LP toggle fields are strings
      if (field === 'lpContributes100Pct') {
        const toggle = raw === true || String(raw).toLowerCase() === 'yes' ? 'Yes' : 'No'
        hf.setCellContents({ sheet: sheetId, row: addr.row, col: addr.col }, [[toggle]])
        continue
      }

      const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
      if (!isNaN(n)) {
        hf.setCellContents({ sheet: sheetId, row: addr.row, col: addr.col }, [[n]])
      }
    }

    // ── 3. Write initialLTV to both B25 and B26 ──────────────────────────────
    // WORKBOOK_BUG_LTV_WORKAROUND:
    // Debt & Refi!B5 formula = IF(Inputs!B49="Yes", 0, Inputs!B4 * Inputs!B25)
    // It references Inputs!B25 — the section-header row ("Debt / Refi / Exit") which is blank.
    // The actual LTV input lives at Inputs!B26. This is a formula reference error in the workbook.
    // Workaround: write the LTV value to both B25 (row 24) and B26 (row 25) so the Debt & Refi
    // formula reads the correct value from B25 while the labeled input cell B26 is also populated.
    // TODO: correct the workbook formula from B25 → B26 in the next model revision.
    if (inputs.initialLTV != null) {
      const ltv = typeof inputs.initialLTV === 'number'
        ? inputs.initialLTV
        : parseFloat(String(inputs.initialLTV))
      if (!isNaN(ltv)) {
        hf.setCellContents({ sheet: inpId, row: 24, col: 1 }, [[ltv]]) // B25 — what formula reads
        hf.setCellContents({ sheet: inpId, row: 25, col: 1 }, [[ltv]]) // B26 — labeled input cell
      }
    }

    // ── 4. Write Unlevered toggle ────────────────────────────────────────────
    // Inputs!B49 = "Yes" → unlevered mode (zeros all debt service)
    // Inputs!B49 = "No"  → levered mode
    const unleveredToggle = inputs.unlevered === true ? 'Yes' : 'No'
    hf.setCellContents({ sheet: inpId, row: 48, col: 1 }, [[unleveredToggle]]) // B49

    // ── 5. Write T12 operating expenses ─────────────────────────────────────
    // Accumulate into a totals map (some fields share the same row)
    const opexTotals: Record<number, number> = {}
    for (const { field, row } of OPEX_MAP) {
      const raw = (inputs as Record<string, unknown>)[field]
      if (raw == null) continue
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
      if (!isNaN(n) && n > 0) {
        opexTotals[row] = (opexTotals[row] ?? 0) + n
      }
    }
    for (const [rowStr, total] of Object.entries(opexTotals)) {
      hf.setCellContents({ sheet: opexId, row: Number(rowStr), col: 1 }, [[Math.round(total)]])
    }

    // ── 6. Write unit mix ────────────────────────────────────────────────────
    if (Array.isArray(inputs.unitMix)) {
      for (const item of inputs.unitMix) {
        const row = unitTypeRow(item.type ?? '')
        const colFields: [number, keyof typeof item][] = [
          [1, 'units'], [2, 'avgSF'], [3, 'currentRent'], [4, 'marketRent'],
        ]
        for (const [col, field] of colFields) {
          const raw = item[field]
          if (raw == null) continue
          const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
          if (!isNaN(n)) {
            hf.setCellContents({ sheet: umId, row, col }, [[n]])
          }
        }
      }
    }

    // ── 7. Read all output cells ─────────────────────────────────────────────
    // HyperFormula has already recalculated everything synchronously above.
    const outputs: Record<string, number | string | boolean | null> = {}
    for (const [key, addr] of Object.entries(OUTPUT_MAP)) {
      outputs[key] = readCell(hf, addr)
    }

    // ── 8. Build response ────────────────────────────────────────────────────
    const elapsed = Date.now() - t0

    return res.status(200).json({
      ok: true,
      elapsed_ms: elapsed,
      inputs_received: {
        purchasePrice:         inputs.purchasePrice,
        startOccupancy:        inputs.startOccupancy,
        stabilizedOccupancy:   inputs.stabilizedOccupancy,
        monthsToStabilization: inputs.monthsToStabilization,
        exitCapRate:           inputs.exitCapRate,
        exitMonth:             inputs.exitMonth,
        initialLTV:            inputs.initialLTV,
        unlevered:             inputs.unlevered ?? false,
      },
      outputs,
    })

  } catch (err) {
    console.error('[run-excel] error:', err)
    return res.status(500).json({
      error: 'Excel engine failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
