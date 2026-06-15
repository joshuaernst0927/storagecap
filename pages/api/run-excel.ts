/**
 * /api/run-excel
 * Populates the institutional Excel model with deal inputs,
 * returns a downloadable populated workbook.
 * Runs entirely on Vercel using the xlsx library.
 * No LibreOffice, no droplet dependency.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const MODEL_PATH = path.join(process.cwd(), 'backend', 'models', 'acquisition_model.xlsx')

// ── Field → [sheet, cell] mapping ────────────────────────────────────────────
const INPUTS_MAP: Record<string, [string, string]> = {
  purchasePrice:         ['Inputs', 'B4'],
  closingCostsPct:       ['Inputs', 'B5'],
  initialRepairs:        ['Inputs', 'B6'],
  acquisitionFeePct:     ['Inputs', 'B7'],
  assetMgmtFeePct:       ['Inputs', 'B8'],
  dispositionFeePct:     ['Inputs', 'B9'],
  sponsorCoInvestPct:    ['Inputs', 'B10'],
  startOccupancy:        ['Inputs', 'B13'],
  stabilizedOccupancy:   ['Inputs', 'B14'],
  monthsToStabilization: ['Inputs', 'B15'],
  annualRentGrowth:      ['Inputs', 'B18'],
  opexGrowth:            ['Inputs', 'B22'],
  initialLTV:            ['Inputs', 'B26'],
  initialRate:           ['Inputs', 'B27'],
  initialAmortYears:     ['Inputs', 'B28'],
  ioPeriodMonths:        ['Inputs', 'B29'],
  minDSCR:               ['Inputs', 'B30'],
  refiMonth:             ['Inputs', 'B31'],
  refiLTV:               ['Inputs', 'B32'],
  refiRate:              ['Inputs', 'B33'],
  refiAmortYears:        ['Inputs', 'B34'],
  exitCapRate:           ['Inputs', 'B35'],
  exitMonth:             ['Inputs', 'B36'],
  sellingCostsPct:       ['Inputs', 'B37'],
  preferredReturn:       ['Inputs', 'B44'],
  lpResidual:            ['Inputs', 'B45'],
  gpResidual:            ['Inputs', 'B46'],
}

// Operating Expenses T12 actuals → B column (Year 1 base)
const OPEX_CELLS: [string, string][] = [
  ['t12Tax',                'B5'],  // Property Taxes
  ['t12Insurance',          'B6'],  // Insurance
  ['t12Utilities',          'B7'],  // Utilities
  ['t12RepairsMaintenance', 'B8'],  // Repairs & Maintenance
  ['t12Payroll',            'B9'],  // Payroll / On-Site Staff
  ['t12OfficeEmployee',     'B9'],  // add to payroll
  ['t12Marketing',          'B11'], // Marketing / Admin
  ['t12Administrative',     'B11'], // add to marketing/admin
  ['t12OtherExpenses',      'B12'], // Software / Call Center catch-all
]

// Unit Mix sheet rows
const UNIT_ROWS: Record<string, number> = {
  '5x5': 5, '5x10': 6, '10x10': 7, '10x15': 8, '10x20': 9, 'parking': 10, 'outdoor': 10,
}
function unitRow(type: string): number {
  const t = type.toLowerCase().replace(/\s/g, '')
  for (const [key, row] of Object.entries(UNIT_ROWS)) {
    if (t.includes(key) || key.includes(t)) return row
  }
  return 11
}

function setCell(sheet: XLSX.WorkSheet, ref: string, value: number | string): void {
  const addr = XLSX.utils.decode_cell(ref)
  sheet[ref] = { t: typeof value === 'number' ? 'n' : 's', v: value }
  // Expand sheet range if needed
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1')
  if (addr.r > range.e.r) range.e.r = addr.r
  if (addr.c > range.e.c) range.e.c = addr.c
  sheet['!ref'] = XLSX.utils.encode_range(range)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const inputs = req.body as Record<string, unknown>

    // Load the model
    const fileBuffer = fs.readFileSync(MODEL_PATH)
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellFormula: true, cellStyles: true })

    const wsIn = wb.Sheets['Inputs']
    const wsOpex = wb.Sheets['Operating Expenses']
    const wsUM = wb.Sheets['Unit Mix & Market Comps']

    // ── Populate Inputs sheet ─────────────────────────────────────────────
    for (const [field, [, cell]] of Object.entries(INPUTS_MAP)) {
      const v = inputs[field]
      if (v != null) {
        const n = parseFloat(String(v))
        if (!isNaN(n)) setCell(wsIn, cell, n)
      }
    }

    // Levered/unlevered toggle
    const ltv = parseFloat(String(inputs.initialLTV ?? '0'))
    setCell(wsIn, 'B49', ltv > 0 ? 'No' : 'Yes')

    // ── Populate Operating Expenses sheet ─────────────────────────────────
    const opexTotals: Record<string, number> = {}
    for (const [field, cell] of OPEX_CELLS) {
      const v = inputs[field]
      if (v != null) {
        const n = parseFloat(String(v))
        if (!isNaN(n) && n > 0) {
          opexTotals[cell] = (opexTotals[cell] || 0) + n
        }
      }
    }
    for (const [cell, total] of Object.entries(opexTotals)) {
      if (total > 0) setCell(wsOpex, cell, Math.round(total))
    }

    // ── Populate Unit Mix sheet ───────────────────────────────────────────
    const unitMix = inputs.unitMix as Record<string, unknown>[] | undefined
    if (Array.isArray(unitMix)) {
      for (const item of unitMix) {
        const row = unitRow(String(item.type ?? ''))
        const cols: [string, string][] = [['B', 'units'], ['C', 'sqft'], ['D', 'currentRent'], ['E', 'marketRent']]
        for (const [col, field] of cols) {
          const v = item[field]
          if (v != null) {
            const n = parseFloat(String(v))
            if (!isNaN(n)) setCell(wsUM, `${col}${row}`, n)
          }
        }
      }
    }

    // ── Write populated workbook ──────────────────────────────────────────
    const outBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // ── Return populated Excel for download ───────────────────────────────
    const propertyName = String(inputs.propertyName || inputs.purchasePrice || 'deal').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="YEM_Model_${propertyName}.xlsx"`)
    res.setHeader('Content-Length', outBuffer.length)
    return res.send(outBuffer)

  } catch (err) {
    console.error('run-excel error:', err)
    return res.status(500).json({ error: 'Excel population failed', detail: String(err) })
  }
}
