import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AuthGate from '@/components/AuthGate'

// ─── Types ────────────────────────────────────────────────────────────────────

type DealType = 'value-add' | 'stabilized' | 'distressed'

type SellerYear = {
  revenue: string
  expenses: string
  noi: string
}

type ProformaInputs = {
  propertyName: string
  address: string
  dealType: DealType
  // Unit economics
  totalUnits: string
  currentOccupancy: string
  targetOccupancy: string
  monthsToStabilization: string
  currentAvgRent: string
  marketAvgRent: string
  monthsToMarketRent: string
  // Expense normalization
  expenseRatio: string
  revenueGrowthPostStab: string
  expenseGrowth: string
  // Haircuts per year
  haircutY1: string
  haircutY2: string
  haircutY3: string
  // Seller proforma
  sellerY1: SellerYear
  sellerY2: SellerYear
  sellerY3: SellerYear
  // T12 / T3
  t12NOI: string
  t3NOI: string
  t12Occupancy: string
  // T-12 expense line items
  t12Revenue: string
  t12TotalExpenses: string
  t12Payroll: string
  t12ManagementFees: string
  t12Marketing: string
  t12Utilities: string
  t12OfficeEmployee: string
  t12Administrative: string
  t12RepairsMaintenance: string
  t12Tax: string
  t12Insurance: string
  t12OtherExpenses: string
  // Exit
  exitCapRate: string
  exitMonth: string
  targetIRR: string
}

type OurYear = {
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

type ProformaResult = {
  t12: {
    revenue: number
    expenses: number
    noi: number
    occupancy: number
    avg_rent_mo: number
    expense_breakdown: {
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
    }
  }
  years: OurYear[]
}expenseRatio: number
}

type MaxOfferResult = {
  max_offer: number
  deal_type: string
  method: string
  in_place_noi: number
  stabilized_noi: number
  going_in_cap: number
  stabilized_cap: number
  irr_at_max: number
  target_irr: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const HAIRCUT_DEFAULTS: Record<DealType, { y1: string; y2: string; y3: string }> = {
  'value-add':  { y1: '18', y2: '12', y3: '7' },
  'stabilized': { y1: '10', y2: '8',  y3: '5' },
  'distressed': { y1: '28', y2: '20', y3: '12' },
}

const EXPENSE_DEFAULTS: Record<DealType, string> = {
  'value-add':  '37',
  'stabilized': '33',
  'distressed': '42',
}

const EMPTY_SELLER: SellerYear = { revenue: '', expenses: '', noi: '' }

const EMPTY: ProformaInputs = {
  propertyName: '', address: '',
  dealType: 'value-add',
  totalUnits: '',
  currentOccupancy: '', targetOccupancy: '92',
  monthsToStabilization: '18',
  currentAvgRent: '', marketAvgRent: '',
  monthsToMarketRent: '24',
  expenseRatio: '37',
  revenueGrowthPostStab: '3',
  expenseGrowth: '3',
  haircutY1: '18', haircutY2: '12', haircutY3: '7',
  sellerY1: { ...EMPTY_SELLER },
  sellerY2: { ...EMPTY_SELLER },
  sellerY3: { ...EMPTY_SELLER },
  t12NOI: '', t3NOI: '', t12Occupancy: '',
  t12Revenue: '', t12TotalExpenses: '',
  t12Payroll: '', t12ManagementFees: '', t12Marketing: '',
  t12Utilities: '', t12OfficeEmployee: '', t12Administrative: '',
  t12RepairsMaintenance: '', t12Tax: '', t12Insurance: '', t12OtherExpenses: '',
  exitCapRate: '7.25', exitMonth: '60', targetIRR: '15',
}

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  'value-add': 'Value-Add',
  'stabilized': 'Stabilized',
  'distressed': 'Distressed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  if (isNaN(n)) return '—'
  return '$' + Math.round(n).toLocaleString('en-US')
}
function fmtPct(n: number, dec = 1) {
  if (isNaN(n)) return '—'
  return (n * 100).toFixed(dec) + '%'
}
function n(s: string, fallback = 0) {
  const v = parseFloat(s)
  return isNaN(v) ? fallback : v
}



// ─── Small UI Components ──────────────────────────────────────────────────────

function Field({ label, value, onChange, suffix, note, step }: {
  label: string; value: string; onChange: (v: string) => void
  suffix?: string; note?: string; step?: string
}) {
  return (
    <div>
      <label className="label-text">
        {label}
        {suffix && <span className="text-dark-muted ml-1">({suffix})</span>}
      </label>
      <input
        className="input-field"
        type="number"
        step={step ?? 'any'}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {note && <p className="text-xs text-dark-muted mt-1">{note}</p>}
    </div>
  )
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-dark-border pb-2 mb-5">
      <div className="section-label-sm">{title}</div>
      {subtitle && <p className="text-dark-muted text-xs mt-0.5">{subtitle}</p>}
    </div>
  )
}

function SellerYearFields({ label, value, onChange }: {
  label: string
  value: SellerYear
  onChange: (v: SellerYear) => void
}) {
  const autoNOI = (rev: string, exp: string) => {
    const r = parseFloat(rev)
    const e = parseFloat(exp)
    if (!isNaN(r) && !isNaN(e)) onChange({ ...value, revenue: rev, expenses: exp, noi: String(Math.round(r - e)) })
    else onChange({ ...value, revenue: rev !== undefined ? rev : value.revenue, expenses: exp !== undefined ? exp : value.expenses })
  }
  return (
    <div className="border border-dark-border p-4 bg-dark-surface">
      <div className="text-xs uppercase tracking-widest text-dark-muted font-medium mb-3">{label}</div>
      <div className="space-y-3">
        <div>
          <label className="label-text">Revenue ($)</label>
          <input className="input-field" type="number" step="any" value={value.revenue}
            onChange={e => autoNOI(e.target.value, value.expenses)} />
        </div>
        <div>
          <label className="label-text">Expenses ($)</label>
          <input className="input-field" type="number" step="any" value={value.expenses}
            onChange={e => autoNOI(value.revenue, e.target.value)} />
        </div>
        <div>
          <label className="label-text text-dark-muted">NOI ($) — auto-calculated</label>
          <input className="input-field bg-dark-surface text-dark-muted" type="number" readOnly value={value.noi} />
        </div>
      </div>
    </div>
  )
}

// ─── Proforma Table ───────────────────────────────────────────────────────────

function ProformaTable({
  ourYears,
  sellerY1, sellerY2, sellerY3,
  haircutY1, haircutY2, haircutY3,
}: {
  ourYears: OurYear[]
  sellerY1: SellerYear; sellerY2: SellerYear; sellerY3: SellerYear
  haircutY1: string; haircutY2: string; haircutY3: string
}) {
  const sellers = [sellerY1, sellerY2, sellerY3]
  const haircuts = [n(haircutY1) / 100, n(haircutY2) / 100, n(haircutY3) / 100]

  const hasSeller = sellers.some(s => s.revenue || s.noi)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-border">
            <th className="text-left text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 pr-6 w-40">Metric</th>
            {[1, 2, 3].map(yr => (
              <th key={yr} className="text-right text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 px-3">
                Year {yr}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-border/40">

          {/* Occupancy */}
          <tr>
            <td className="py-3 pr-6 text-dark-muted text-xs uppercase tracking-widest">Occupancy</td>
            {ourYears.map((y, i) => (
              <td key={i} className="py-3 px-3 text-right font-semibold text-[#1B2B5E]">{fmtPct(y.occupancy)}</td>
            ))}
          </tr>

          {/* Avg Rent */}
          <tr>
            <td className="py-3 pr-6 text-dark-muted text-xs uppercase tracking-widest">Avg Rent/Unit</td>
            {ourYears.map((y, i) => (
              <td key={i} className="py-3 px-3 text-right text-[#1B2B5E]">{fmt$(y.avgRent)}/mo</td>
            ))}
          </tr>

          {/* Divider */}
          <tr className="bg-gold/5">
            <td colSpan={4} className="py-1.5 px-3 text-xs uppercase tracking-widest text-gold font-medium">
              Our Underwritten Numbers
            </td>
          </tr>

          {/* Our Revenue */}
          <tr>
            <td className="py-3 pr-6 text-dark-muted text-xs uppercase tracking-widest pl-3">EGI</td>
            {ourYears.map((y, i) => (
              <td key={i} className="py-3 px-3 text-right text-[#1B2B5E]">{fmt$(y.egi)}</td>
            ))}
          </tr>

          {/* Our Expenses */}
          <tr>
            <td className="py-3 pr-6 text-dark-muted text-xs uppercase tracking-widest pl-3">Expenses</td>
            {ourYears.map((y, i) => (
              <td key={i} className="py-3 px-3 text-right text-[#1B2B5E]">
                {fmt$(y.expenses)}
                <span className="text-dark-muted text-xs ml-1">({fmtPct(y.expenseRatio)})</span>
              </td>
            ))}
          </tr>

          {/* Our NOI */}
          <tr className="bg-navy/5">
            <td className="py-3 pr-6 text-xs uppercase tracking-widest font-semibold text-[#1B2B5E] pl-3">Our NOI</td>
            {ourYears.map((y, i) => (
              <td key={i} className="py-3 px-3 text-right font-bold text-[#1B2B5E] text-base">{fmt$(y.noi)}</td>
            ))}
          </tr>

          {/* Seller comparison — only if entered */}
          {hasSeller && (
            <>
              <tr className="bg-dark-surface">
                <td colSpan={4} className="py-1.5 px-3 text-xs uppercase tracking-widest text-dark-muted font-medium">
                  Seller Proforma (with haircut applied)
                </td>
              </tr>

              {/* Seller Revenue */}
              <tr>
                <td className="py-3 pr-6 text-dark-muted text-xs uppercase tracking-widest pl-3">Seller Revenue</td>
                {sellers.map((s, i) => (
                  <td key={i} className="py-3 px-3 text-right text-dark-muted">
                    {s.revenue ? fmt$(n(s.revenue)) : '—'}
                  </td>
                ))}
              </tr>

              {/* Haircut */}
              <tr>
                <td className="py-3 pr-6 text-dark-muted text-xs uppercase tracking-widest pl-3">Haircut Applied</td>
                {haircuts.map((h, i) => (
                  <td key={i} className="py-3 px-3 text-right text-red-500 text-xs font-medium">
                    -{(h * 100).toFixed(0)}%
                  </td>
                ))}
              </tr>

              {/* Seller NOI haircutted */}
              <tr>
                <td className="py-3 pr-6 text-dark-muted text-xs uppercase tracking-widest pl-3">Haircutted NOI</td>
                {sellers.map((s, i) => {
                  const rev = n(s.revenue)
                  const exp = n(s.expenses)
                  const haircuttedRev = rev * (1 - haircuts[i])
                  const haircuttedNOI = rev > 0 ? haircuttedRev - exp : (s.noi ? n(s.noi) * (1 - haircuts[i]) : null)
                  return (
                    <td key={i} className="py-3 px-3 text-right text-dark-muted">
                      {haircuttedNOI !== null ? fmt$(haircuttedNOI) : '—'}
                    </td>
                  )
                })}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Max Offer Result Box ─────────────────────────────────────────────────────

function MaxOfferBox({ result }: { result: MaxOfferResult }) {
  return (
    <div className="border-2 border-gold bg-gold/5 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold font-medium mb-1">
            Max Offer — {DEAL_TYPE_LABELS[result.deal_type as DealType]}
          </div>
          <div className="font-serif text-5xl font-light text-[#1B2B5E]">
            {'$' + result.max_offer.toLocaleString('en-US')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-dark-muted uppercase tracking-widest mb-1">Target IRR</div>
          <div className="text-2xl font-semibold text-[#1B2B5E]">{fmtPct(result.target_irr)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gold/30">
        <div>
          <div className="text-xs text-dark-muted uppercase tracking-widest mb-0.5">Going-In Cap</div>
          <div className="font-semibold text-[#1B2B5E]">{fmtPct(result.going_in_cap)}</div>
        </div>
        <div>
          <div className="text-xs text-dark-muted uppercase tracking-widest mb-0.5">Stabilized Cap</div>
          <div className="font-semibold text-[#1B2B5E]">{fmtPct(result.stabilized_cap)}</div>
        </div>
        <div>
          <div className="text-xs text-dark-muted uppercase tracking-widest mb-0.5">Y1 NOI</div>
          <div className="font-semibold text-[#1B2B5E]">{fmt$(result.in_place_noi)}</div>
        </div>
        <div>
          <div className="text-xs text-dark-muted uppercase tracking-widest mb-0.5">Stabilized NOI</div>
          <div className="font-semibold text-[#1B2B5E]">{fmt$(result.stabilized_noi)}</div>
        </div>
      </div>
      <p className="text-xs text-dark-muted mt-3 italic">{result.method}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Proforma() {
  const router = useRouter()
  const [inputs, setInputs] = useState<ProformaInputs>(EMPTY)
  const [ourYears, setOurYears] = useState<OurYear[]>([])
  const [proformaResult, setProformaResult] = useState<ProformaResult | null>(null)
  const [maxOfferResult, setMaxOfferResult] = useState<MaxOfferResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [hasCalculated, setHasCalculated] = useState(false)
  const [maxOfferAnchor, setMaxOfferAnchor] = useState<'t12' | 'y1' | 'stabilized'>('y1')
  const [capRates, setCapRates] = useState(['6.50', '7.00', '7.50', '8.00'])
  const setCapRate = (i: number, v: string) => setCapRates(prev => prev.map((c, idx) => idx === i ? v : c))

  const set = (k: keyof ProformaInputs, v: string) => setInputs(p => ({ ...p, [k]: v }))
  const setSeller = (yr: 'sellerY1' | 'sellerY2' | 'sellerY3', v: SellerYear) =>
    setInputs(p => ({ ...p, [yr]: v }))

  // Load from underwrite page if data was passed
  useEffect(() => {
    if (router.query.data) {
      try {
        const data = JSON.parse(decodeURIComponent(router.query.data as string))
        // Safely merge — ensure nested objects like sellerY1/Y2/Y3 are handled
        setInputs(prev => ({
          ...prev,
          ...data,
          sellerY1: { ...prev.sellerY1, ...(data.sellerY1 ?? {}) },
          sellerY2: { ...prev.sellerY2, ...(data.sellerY2 ?? {}) },
          sellerY3: { ...prev.sellerY3, ...(data.sellerY3 ?? {}) },
        }))
      } catch { /* ignore */ }
    }
  }, [router.query.data])

  // Auto-set haircut defaults when deal type changes
  useEffect(() => {
    const defaults = HAIRCUT_DEFAULTS[inputs.dealType] ?? HAIRCUT_DEFAULTS['value-add']
    const expDefault = EXPENSE_DEFAULTS[inputs.dealType] ?? EXPENSE_DEFAULTS['value-add']
    setInputs(p => ({
      ...p,
      haircutY1: defaults?.y1 ?? '18',
      haircutY2: defaults?.y2 ?? '12',
      haircutY3: defaults?.y3 ?? '7',
      expenseRatio: expDefault ?? '37',
    }))
  }, [inputs.dealType])

 async function handleCalculate(anchorOverride?: string) {
    setCalculating(true)
    setCalcError('')
    try {
      // ── Call /build-proforma on the server ──────────────────────
      const t12Data = {
        total_revenue:        n(inputs.t12Revenue) || n(inputs.t12NOI) / 0.6,
        payroll:              n(inputs.t12Payroll),
        management_fees:      n(inputs.t12ManagementFees),
        marketing:            n(inputs.t12Marketing),
        utilities:            n(inputs.t12Utilities),
        office_employee:      n(inputs.t12OfficeEmployee),
        administrative:       n(inputs.t12Administrative),
        repairs_maintenance:  n(inputs.t12RepairsMaintenance),
        tax:                  n(inputs.t12Tax),
        insurance:            n(inputs.t12Insurance),
        other_expenses:       n(inputs.t12OtherExpenses),
        total_expenses:       n(inputs.t12TotalExpenses),
        noi:                  n(inputs.t12NOI),
      }

      const assumptions = {
        total_units:          n(inputs.totalUnits, 100),
        current_occupancy:    n(inputs.currentOccupancy) / 100,
        rent_uplift_y1:       0.12,
        rent_growth:          n(inputs.revenueGrowthPostStab, 3) / 100,
        opex_growth:          n(inputs.expenseGrowth, 3) / 100,
        tax_insurance_growth: 0.05,
        mgmt_fee_pct:         0.06,
        occ_schedule:         [
          n(inputs.targetOccupancy, 80) / 100,
          Math.min((n(inputs.targetOccupancy, 80) + 6) / 100, 0.95),
          Math.min((n(inputs.targetOccupancy, 80) + 10) / 100, 0.95),
          Math.min((n(inputs.targetOccupancy, 80) + 11) / 100, 0.95),
          Math.min((n(inputs.targetOccupancy, 80) + 12) / 100, 0.95),
        ],
      }

      const proformaRes = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build-proforma', t12_data: t12Data, assumptions }),
      })
      if (!proformaRes.ok) throw new Error('Proforma build failed')
      const proformaData: ProformaResult = await proformaRes.json()
      setProformaResult(proformaData)
      setOurYears(proformaData.years)

      // ── Calculate max offer via API ──────────────────────────────
      const y1NOI = proformaData.years[0]?.noi ?? 0
      const y5NOI = proformaData.years[4]?.noi ?? y1NOI
      const t12NOIval = n(inputs.t12NOI) || proformaData.t12.noi
      const activeAnchor = anchorOverride ?? maxOfferAnchor ?? 'y1'
      const anchorNOI = activeAnchor === 't12' ? t12NOIval : activeAnchor === 'stabilized' ? y5NOI : y1NOI
      const stabNOI = y5NOI
      const startOcc = n(inputs.currentOccupancy) / 100
      const stabOcc = n(inputs.targetOccupancy, 92) / 100
      const exitCap = n(inputs.exitCapRate, 7.25) / 100
      const exitMonth = n(inputs.exitMonth, 60)
      const monthsToStab = n(inputs.monthsToStabilization, 18)
      const rentGrowth = n(inputs.revenueGrowthPostStab, 3) / 100
      const expGrowth = n(inputs.expenseGrowth, 3) / 100

      const body = {
        action: 'max-offer',
        target_irr: n(inputs.targetIRR, 15) / 100,
        deal_type: inputs.dealType,
        in_place_noi: anchorNOI,
        stabilized_noi: stabNOI,
        start_occupancy: startOcc,
        stabilized_occupancy: stabOcc,
        exit_cap_rate: exitCap,
        exit_month: exitMonth,
        months_to_stabilization: monthsToStab,
        rent_growth: rentGrowth,
        opex_growth: expGrowth,
        closing_costs_pct: 0.03,
        acquisition_fee_pct: 0.02,
        initial_repairs: 0,
        selling_costs_pct: 0.02,
      }

      const res = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Calculation failed')
      const data = await res.json()
      setMaxOfferResult(data)
      setHasCalculated(true)
    } catch (err) {
      setCalcError(String(err))
    } finally {
      setCalculating(false)
    }
  }

      // Calculate max offer via API — use selected anchor NOI
      const y1NOI = years[0]?.noi ?? 0
      const y3NOI = years[2]?.noi ?? y1NOI
      const t12NOIval = parseFloat(inputs.t12NOI) || y1NOI
      const activeAnchor = anchorOverride ?? maxOfferAnchor ?? 'y1'
      const anchorNOI = activeAnchor === 't12' ? t12NOIval : activeAnchor === 'stabilized' ? y3NOI : y1NOI
      const stabNOI = maxOfferAnchor === 'stabilized' ? y3NOI : y3NOI
      const startOcc = n(inputs.currentOccupancy) / 100
      const stabOcc = n(inputs.targetOccupancy, 92) / 100
      const exitCap = n(inputs.exitCapRate, 7.25) / 100
      const exitMonth = n(inputs.exitMonth, 60)
      const monthsToStab = n(inputs.monthsToStabilization, 18)
      const rentGrowth = n(inputs.revenueGrowthPostStab, 3) / 100
      const expGrowth = n(inputs.expenseGrowth, 3) / 100

      const body = {
        action: 'max-offer',
        target_irr: n(inputs.targetIRR, 15) / 100,
        deal_type: inputs.dealType,
        in_place_noi: anchorNOI,
        stabilized_noi: stabNOI,
        start_occupancy: startOcc,
        stabilized_occupancy: stabOcc,
        exit_cap_rate: exitCap,
        exit_month: exitMonth,
        months_to_stabilization: monthsToStab,
        rent_growth: rentGrowth,
        opex_growth: expGrowth,
        closing_costs_pct: 0.03,
        acquisition_fee_pct: 0.02,
        initial_repairs: 0,
        selling_costs_pct: 0.02,
      }

      const res = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Calculation failed')
      const data = await res.json()
      setMaxOfferResult(data)
      setHasCalculated(true)
    } catch (err) {
      setCalcError(String(err))
    } finally {
      setCalculating(false)
    }
  }

  function handleContinueToModel() {
    // Pass proforma results back to underwrite page
    const data = {
      propertyName: inputs.propertyName,
      address: inputs.address,
      dealType: inputs.dealType,
      inPlaceNOI: String(Math.round(ourYears[0]?.noi ?? 0)),
      stabilizedNOI: String(Math.round(ourYears[2]?.noi ?? 0)),
      startOccupancy: inputs.currentOccupancy,
      stabilizedOccupancy: inputs.targetOccupancy,
      monthsToStabilization: inputs.monthsToStabilization,
      annualRentGrowth: inputs.revenueGrowthPostStab,
      opexGrowth: inputs.expenseGrowth,
      exitCapRate: inputs.exitCapRate,
      exitMonth: inputs.exitMonth,
    }
    router.push(`/underwrite?data=${encodeURIComponent(JSON.stringify(data))}`)
  }

  function handleGenerateLOI() {
    if (!maxOfferResult) return
    const data = {
      propertyName: inputs.propertyName,
      address: inputs.address,
      purchasePrice: String(maxOfferResult.max_offer),
      year1NOI: String(Math.round(ourYears[0]?.noi ?? 0)),
      year2NOI: String(Math.round(ourYears[1]?.noi ?? 0)),
      year3NOI: String(Math.round(ourYears[2]?.noi ?? 0)),
      goingInCap: String((maxOfferResult.going_in_cap * 100).toFixed(2)),
      stabilizedCap: String((maxOfferResult.stabilized_cap * 100).toFixed(2)),
      dealType: inputs.dealType,
    }
    router.push(`/generate-loi?data=${encodeURIComponent(JSON.stringify(data))}`)
  }

  return (
    <AuthGate>
      <>
        <Head>
          <title>Proforma Builder — YEM Acquisitions</title>
          <meta name="description" content="Build a defensible underwritten proforma with lease-up modeling, rent-to-FMV, and seller haircuts." />
        </Head>

        {/* Hero */}
        <section className="page-hero border-b border-dark-border">
          <div className="section-label">Proforma Builder</div>
          <h1 className="display-heading text-5xl md:text-7xl max-w-3xl mb-6">
            Their numbers.<br />
            <em className="text-gold">Our underwrite.</em>
          </h1>
          <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
            Model lease-up, rent-to-FMV, and expense normalization. Apply deal-type haircuts to seller projections.
            Get a defensible max offer backed by your own numbers.
          </p>
        </section>

        <section className="py-14">
          <div className="section-container max-w-4xl space-y-10">

            {/* Deal Type */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Deal Type" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['value-add', 'stabilized', 'distressed'] as DealType[]).map(dt => (
                  <button
                    key={dt}
                    onClick={() => set('dealType', dt)}
                    className={`p-4 border text-left transition-colors duration-150
                      ${inputs.dealType === dt ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${inputs.dealType === dt ? 'text-gold' : 'text-[#1B2B5E]'}`}>
                      {DEAL_TYPE_LABELS[dt]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Property */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Property" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Property Name</label>
                  <input className="input-field" type="text" value={inputs.propertyName} onChange={e => set('propertyName', e.target.value)} />
                </div>
                <div>
                  <label className="label-text">Address</label>
                  <input className="input-field" type="text" value={inputs.address} onChange={e => set('address', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Historical Data */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Historical Data" subtitle="From T12, T3, and available occupancy records" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="T-12 NOI" value={inputs.t12NOI} onChange={v => set('t12NOI', v)} suffix="$" />
                <Field label="T-3 NOI (annualized)" value={inputs.t3NOI} onChange={v => set('t3NOI', v)} suffix="$"
                  note="Last 3 months × 4 — shows momentum" />
                <Field label="Current Occupancy" value={inputs.t12Occupancy} onChange={v => set('t12Occupancy', v)} suffix="%" />
              </div>
            </div>

            {/* Unit Economics */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Unit Economics & Lease-Up" subtitle="Drive the revenue build-up from current state to stabilized" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Total Units" value={inputs.totalUnits} onChange={v => set('totalUnits', v)} />
                <Field label="Current Occupancy" value={inputs.currentOccupancy} onChange={v => set('currentOccupancy', v)} suffix="%" />
                <Field label="Target Occupancy" value={inputs.targetOccupancy} onChange={v => set('targetOccupancy', v)} suffix="%" />
                <Field label="Months to Stabilization" value={inputs.monthsToStabilization} onChange={v => set('monthsToStabilization', v)} suffix="mo" />
                <Field label="Current Avg Rent/Unit" value={inputs.currentAvgRent} onChange={v => set('currentAvgRent', v)} suffix="$/mo" />
                <Field label="Market Avg Rent/Unit" value={inputs.marketAvgRent} onChange={v => set('marketAvgRent', v)} suffix="$/mo"
                  note="FMV — what you'll push to" />
                <Field label="Months to Reach Market Rent" value={inputs.monthsToMarketRent} onChange={v => set('monthsToMarketRent', v)} suffix="mo" />
              </div>
            </div>

            {/* Expense Normalization */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Expense Normalization" subtitle="Applied to EGI each year, then grown at inflation rate" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Target Expense Ratio" value={inputs.expenseRatio} onChange={v => set('expenseRatio', v)} suffix="% of EGI"
                  note="Industry standard: 30-40%" step="0.5" />
                <Field label="Revenue Growth (post-stab)" value={inputs.revenueGrowthPostStab} onChange={v => set('revenueGrowthPostStab', v)} suffix="% / yr" step="0.5" />
                <Field label="Expense Growth" value={inputs.expenseGrowth} onChange={v => set('expenseGrowth', v)} suffix="% / yr" step="0.5" />
              </div>
            </div>

            {/* Seller Proforma */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Seller Proforma" subtitle="Enter their numbers — we apply your haircut and show the difference" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <SellerYearFields label="Seller Year 1" value={inputs.sellerY1} onChange={v => setSeller('sellerY1', v)} />
                <SellerYearFields label="Seller Year 2" value={inputs.sellerY2} onChange={v => setSeller('sellerY2', v)} />
                <SellerYearFields label="Seller Year 3" value={inputs.sellerY3} onChange={v => setSeller('sellerY3', v)} />
              </div>

              {/* Haircut controls */}
              <div className="border-t border-dark-border pt-5">
                <div className="text-xs uppercase tracking-widest text-dark-muted font-medium mb-3">
                  Revenue Haircut — pre-filled for {DEAL_TYPE_LABELS[inputs.dealType]}, adjust as needed
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Year 1 Haircut" value={inputs.haircutY1} onChange={v => set('haircutY1', v)} suffix="%" step="1" />
                  <Field label="Year 2 Haircut" value={inputs.haircutY2} onChange={v => set('haircutY2', v)} suffix="%" step="1" />
                  <Field label="Year 3 Haircut" value={inputs.haircutY3} onChange={v => set('haircutY3', v)} suffix="%" step="1" />
                </div>
              </div>
            </div>

            {/* Exit & Return Target */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Exit & Return Target" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Exit Cap Rate" value={inputs.exitCapRate} onChange={v => set('exitCapRate', v)} suffix="%" step="0.25" />
                <Field label="Hold Period" value={inputs.exitMonth} onChange={v => set('exitMonth', v)} suffix="mo" />
                <Field label="Target IRR" value={inputs.targetIRR} onChange={v => set('targetIRR', v)} suffix="%" step="0.5" />
              </div>
            </div>

            {/* Calculate Button */}
            <div className="pt-2">
              {calcError && (
                <div className="mb-4 p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">{calcError}</div>
              )}
              <div className="mb-4">
                <label className="label-text">Anchor max offer to</label>
                <div className="flex gap-2 mt-2">
                  {([
                    ['t12', 'T-12 NOI', 'Conservative'],
                    ['y1', 'Year 1 NOI', 'Base case'],
                    ['stabilized', 'Stabilized NOI', 'Aggressive'],
                  ] as const).map(([val, label, desc]) => (
                    <button
                      key={val}
                      onClick={() => { setMaxOfferAnchor(val); if (hasCalculated) handleCalculate(val as string); }}
                      className={`flex-1 p-3 border text-left transition-colors duration-150 ${maxOfferAnchor === val ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}
                    >
                      <div className={`text-xs font-semibold mb-0.5 ${maxOfferAnchor === val ? 'text-gold' : 'text-[#1B2B5E]'}`}>{label}</div>
                      <div className="text-xs text-dark-muted">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleCalculate()}
                disabled={calculating}
                className="btn-gold disabled:opacity-60 text-base px-10 py-4 w-full md:w-auto"
              >
                {calculating ? 'Calculating...' : 'Apply Haircut & Calculate'}
              </button>
            </div>

            {/* Results */}
            {hasCalculated && ourYears.length > 0 && (
              <div className="space-y-8">

                {/* Proforma Table */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Underwritten Proforma" subtitle="Our numbers vs seller — Y1 through Y3" />
                  <ProformaTable
                    ourYears={ourYears}
                    sellerY1={inputs.sellerY1}
                    sellerY2={inputs.sellerY2}
                    sellerY3={inputs.sellerY3}
                    haircutY1={inputs.haircutY1}
                    haircutY2={inputs.haircutY2}
                    haircutY3={inputs.haircutY3}
                  />
                </div>

                {/* Offer Matrix */}
                {ourYears.length > 0 && (
                  <div className="border border-dark-border p-7">
                    <SectionHead title="Offer Matrix" subtitle="Our haircutted NOI ÷ cap rate — adjust cap rates to match your market" />
                    <div className="flex gap-3 mb-4 flex-wrap">
                      {capRates.map((cr, i) => (
                        <div key={i} style={{width: 100}}>
                          <label className="label-text">Cap Rate {i+1}</label>
                          <div className="flex items-center">
                            <input
                              className="input-field text-sm"
                              type="number"
                              step="0.25"
                              value={cr}
                              onChange={e => setCapRate(i, e.target.value)}
                            />
                            <span className="text-dark-muted text-xs ml-1">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-dark-border">
                            <th className="text-left text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-28">NOI Year</th>
                            <th className="text-right text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 px-3">Our NOI</th>
                            {capRates.map((cr, i) => (
                              <th key={i} className="text-right text-xs uppercase tracking-widest text-gold font-semibold pb-3 px-3">
                                {cr}% Cap
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/40">
                          {[
                            ['T-12', parseFloat(inputs.t12NOI) || null],
                            ['Year 1', ourYears[0]?.noi ?? null],
                            ['Year 2', ourYears[1]?.noi ?? null],
                            ['Year 3', ourYears[2]?.noi ?? null],
                          ].filter(([, noi]) => noi && (noi as number) > 0).map(([label, noi]) => (
                            <tr key={label as string} className="hover:bg-gold/5 transition-colors">
                              <td className="py-3 pr-4 text-xs uppercase tracking-widest text-dark-muted font-medium">{label as string}</td>
                              <td className="py-3 px-3 text-right font-semibold text-[#1B2B5E]">
                                ${Math.round(noi as number).toLocaleString()}
                              </td>
                              {capRates.map((cr, i) => {
                                const cap = parseFloat(cr) / 100
                                const offer = cap > 0 ? Math.round((noi as number) / cap) : 0
                                return (
                                  <td key={i} className="py-3 px-3 text-right">
                                    <span className="font-semibold text-[#1B2B5E]">
                                      ${offer > 0 ? offer.toLocaleString() : '—'}
                                    </span>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-dark-muted mt-3">Offer = Our haircutted NOI ÷ cap rate. Use this to anchor your bid — then check IRR below to confirm your return at that price.</p>
                  </div>
                )}

                {/* Max Offer — IRR check */}
                {maxOfferResult && (
                  <div className="border border-dark-border p-7">
                    <SectionHead title="IRR Check" subtitle="What return do you get at your chosen offer price?" />
                    <MaxOfferBox result={maxOfferResult} />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Next Steps" />
                  <div className="flex flex-wrap gap-4">
                    <button onClick={handleContinueToModel} className="btn-gold text-base px-8 py-3">
                      Continue to Full Model →
                    </button>
                    <button
                      onClick={handleGenerateLOI}
                      disabled={!maxOfferResult}
                      className="px-8 py-3 border border-[#1B2B5E] text-[#1B2B5E] text-sm uppercase tracking-widest hover:bg-[#1B2B5E] hover:text-white transition-colors disabled:opacity-40"
                    >
                      Generate LOI →
                    </button>
                  </div>
                  <p className="text-dark-muted text-xs mt-3">
                    "Continue to Full Model" loads these numbers into the underwriting model and downloads the Excel.
                    "Generate LOI" pre-fills the LOI with our offer price and key terms.
                  </p>
                </div>

              </div>
            )}

          </div>
        </section>
      </>
    </AuthGate>
  )
}
