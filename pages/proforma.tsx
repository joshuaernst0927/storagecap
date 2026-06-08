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
  totalUnits: string
  currentOccupancy: string
  targetOccupancy: string
  monthsToStabilization: string
  currentAvgRent: string
  marketAvgRent: string
  monthsToMarketRent: string
  expenseRatio: string
  revenueGrowthPostStab: string
  expenseGrowth: string
  sellerY1: SellerYear
  sellerY2: SellerYear
  sellerY3: SellerYear
  sellerY4: SellerYear
  sellerY5: SellerYear
  t12NOI: string
  t3NOI: string
  t12Occupancy: string
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
  exitCapRate: string
  exitMonth: string
  offerPrice: string
  manualNOI: string
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
}

type IRRResult = {
  irr_at_max: number
  going_in_cap: number
  stabilized_cap: number
  target_irr: number
  in_place_noi: number
  stabilized_noi: number
  method: string
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

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
  sellerY1: { ...EMPTY_SELLER },
  sellerY2: { ...EMPTY_SELLER },
  sellerY3: { ...EMPTY_SELLER },
  sellerY4: { ...EMPTY_SELLER },
  sellerY5: { ...EMPTY_SELLER },
  t12NOI: '', t3NOI: '', t12Occupancy: '',
  t12Revenue: '', t12TotalExpenses: '',
  t12Payroll: '', t12ManagementFees: '', t12Marketing: '',
  t12Utilities: '', t12OfficeEmployee: '', t12Administrative: '',
  t12RepairsMaintenance: '', t12Tax: '', t12Insurance: '', t12OtherExpenses: '',
  exitCapRate: '7.25', exitMonth: '60', offerPrice: '', manualNOI: '',
}

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  'value-add': 'Value-Add',
  'stabilized': 'Stabilized',
  'distressed': 'Distressed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(v: number) {
  if (isNaN(v)) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}
function fmtPct(v: number, dec = 1) {
  if (isNaN(v)) return '—'
  return (v * 100).toFixed(dec) + '%'
}
function n(s: string, fallback = 0) {
  const v = parseFloat(s)
  return isNaN(v) ? fallback : v
}

// ─── Small UI Components ──────────────────────────────────────────────────────

function Field({ label, value, onChange, suffix, note, step, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  suffix?: string; note?: string; step?: string; placeholder?: string
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
        placeholder={placeholder}
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

// ─── Proforma Table ───────────────────────────────────────────────────────────

function ProformaTable({ proformaResult }: { proformaResult: ProformaResult }) {
  const { t12, years } = proformaResult
  const cols = ['T-12', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']

  function Row({ label, values, bold, gold, indent, pct }: {
    label: string; values: (number | null)[]; bold?: boolean; gold?: boolean; indent?: boolean; pct?: boolean
  }) {
    return (
      <tr className={bold ? 'bg-navy/5' : ''}>
        <td className={`py-2.5 pr-4 text-xs uppercase tracking-widest
          ${bold ? 'font-semibold text-[#1B2B5E]' : 'text-dark-muted'}
          ${indent ? 'pl-4' : ''}
          ${gold ? 'text-gold font-semibold' : ''}`}>
          {label}
        </td>
        {values.map((v, i) => (
          <td key={i} className={`py-2.5 px-2 text-right text-sm
            ${bold ? 'font-bold text-[#1B2B5E]' : 'text-[#1B2B5E]'}
            ${gold ? 'text-gold font-semibold' : ''}`}>
            {v === null ? '—' : pct ? fmtPct(v) : fmt$(v)}
          </td>
        ))}
      </tr>
    )
  }

  function Divider({ label }: { label: string }) {
    return (
      <tr className="bg-dark-surface">
        <td colSpan={7} className="py-1.5 px-3 text-xs uppercase tracking-widest text-dark-muted font-medium">{label}</td>
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-border">
            <th className="text-left text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-44">Line Item</th>
            {cols.map(c => (
              <th key={c} className="text-right text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 px-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-border/40">
          <Row label="Occupancy" pct values={[t12.occupancy, ...years.map(y => y.occupancy)]} />
          <Row label="Avg Rent/Unit/Mo" values={[t12.avg_rent_mo, ...years.map(y => y.avg_rent_mo)]} />
          <Divider label="Revenue" />
          <Row label="Total Revenue" bold values={[t12.revenue, ...years.map(y => y.revenue)]} />
          <Divider label="Expenses" />
          <Row label="Payroll" indent values={[t12.expense_breakdown.payroll, ...years.map(y => y.expenses.payroll)]} />
          <Row label="Mgmt Fees (5% ESMI)" indent values={[t12.expense_breakdown.management_fees, ...years.map(y => y.expenses.management_fees)]} />
          <Row label="Marketing" indent values={[t12.expense_breakdown.marketing, ...years.map(y => y.expenses.marketing)]} />
          <Row label="Utilities" indent values={[t12.expense_breakdown.utilities, ...years.map(y => y.expenses.utilities)]} />
          <Row label="Office/Employee" indent values={[t12.expense_breakdown.office_employee, ...years.map(y => y.expenses.office_employee)]} />
          <Row label="Administrative" indent values={[t12.expense_breakdown.administrative, ...years.map(y => y.expenses.administrative)]} />
          <Row label="Repairs & Maint" indent values={[t12.expense_breakdown.repairs_maintenance, ...years.map(y => y.expenses.repairs_maintenance)]} />
          <Row label="Tax" indent values={[t12.expense_breakdown.tax, ...years.map(y => y.expenses.tax)]} />
          <Row label="Insurance" indent values={[t12.expense_breakdown.insurance, ...years.map(y => y.expenses.insurance)]} />
          <Row label="Other" indent values={[t12.expense_breakdown.other, ...years.map(y => y.expenses.other)]} />
          <Row label="Total Expenses" bold values={[t12.expenses, ...years.map(y => y.expenses.total)]} />
          <Divider label="Net Operating Income" />
          <Row label="NOI" bold gold values={[t12.noi, ...years.map(y => y.noi)]} />
          <Row label="NOI Margin" pct values={[
            t12.revenue > 0 ? t12.noi / t12.revenue : null,
            ...years.map(y => y.noi_margin)
          ]} />
        </tbody>
      </table>
    </div>
  )
}

// ─── Broker vs Investor Table ─────────────────────────────────────────────────

function BrokerInvestorTable({
  proformaResult, sellerYears, revenueHaircut, capRates,
}: {
  proformaResult: ProformaResult
  sellerYears: SellerYear[]
  revenueHaircut: number
  capRates: string[]
}) {
  const cols = ['T-12', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']
  const t12noi = proformaResult.t12.noi

  const brokerNOI: (number | null)[] = [
    t12noi,
    ...sellerYears.map(s => {
      const noi = parseFloat(s.noi)
      if (!isNaN(noi) && noi > 0) return noi
      const rev = parseFloat(s.revenue)
      const exp = parseFloat(s.expenses)
      if (!isNaN(rev) && !isNaN(exp)) return rev - exp
      return null
    })
  ]

  const investorNOI: (number | null)[] = [
    t12noi,
    ...sellerYears.map(s => {
      const rev = parseFloat(s.revenue)
      const exp = parseFloat(s.expenses)
      if (isNaN(rev) || isNaN(exp) || rev === 0) return null
      return (rev * (1 - revenueHaircut)) - exp
    })
  ]

  const gap: (number | null)[] = brokerNOI.map((b, i) => {
    if (i === 0 || b === null || investorNOI[i] === null) return null
    return (investorNOI[i] as number) - b
  })

  const gapPct: (number | null)[] = brokerNOI.map((b, i) => {
    if (i === 0 || b === null || b === 0 || investorNOI[i] === null) return null
    return ((investorNOI[i] as number) - b) / b
  })

  const brokerY5 = brokerNOI[5]
  const investorY5 = investorNOI[5]

  function Row({ label, values, bold, red, pct }: {
    label: string; values: (number | null)[]; bold?: boolean; red?: boolean; pct?: boolean
  }) {
    return (
      <tr className={bold ? 'bg-navy/5' : ''}>
        <td className={`py-2.5 pr-4 text-xs uppercase tracking-widest
          ${bold ? 'font-semibold text-[#1B2B5E]' : 'text-dark-muted'}`}>
          {label}
        </td>
        {values.map((v, i) => (
          <td key={i} className={`py-2.5 px-2 text-right text-sm
            ${bold ? 'font-bold text-[#1B2B5E]' : ''}
            ${red && v !== null && (v as number) < 0 ? 'text-red-500 font-semibold' : 'text-[#1B2B5E]'}`}>
            {v === null ? '—' : pct ? fmtPct(v) : fmt$(v)}
          </td>
        ))}
      </tr>
    )
  }

  function Divider({ label }: { label: string }) {
    return (
      <tr className="bg-dark-surface">
        <td colSpan={7} className="py-1.5 px-3 text-xs uppercase tracking-widest text-dark-muted font-medium">{label}</td>
      </tr>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="text-left text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-44">Metric</th>
              {cols.map(c => (
                <th key={c} className="text-right text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 px-2">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/40">
            <Divider label="Broker (OM) Projections" />
            <Row label="Broker NOI" bold values={brokerNOI} />
            <Divider label={`Investor Underwrite (−${Math.round(revenueHaircut * 100)}% Revenue Haircut)`} />
            <Row label="Investor NOI" bold values={investorNOI} />
            <Divider label="Gap Analysis" />
            <Row label="NOI Gap ($)" red values={gap} />
            <Row label="NOI Gap (%)" red pct values={gapPct} />
          </tbody>
        </table>
      </div>

      {brokerY5 !== null && investorY5 !== null && (
        <div className="mt-6 pt-6 border-t border-dark-border">
          <div className="text-xs uppercase tracking-widest text-dark-muted font-medium mb-4">Year 5 Exit Comparison</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-28">Cap Rate</th>
                  <th className="text-right text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 px-3">Broker Exit Value</th>
                  <th className="text-right text-xs uppercase tracking-widest text-gold font-semibold pb-3 px-3">Investor Exit Value</th>
                  <th className="text-right text-xs uppercase tracking-widest text-red-400 font-semibold pb-3 px-3">Valuation Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {capRates.map((cr, i) => {
                  const cap = parseFloat(cr) / 100
                  if (!cap) return null
                  const brokerExit = (brokerY5 as number) / cap
                  const investorExit = (investorY5 as number) / cap
                  const exitGap = investorExit - brokerExit
                  const exitGapPct = exitGap / brokerExit
                  return (
                    <tr key={i} className="hover:bg-gold/5 transition-colors">
                      <td className="py-3 pr-4 text-xs uppercase tracking-widest text-dark-muted font-medium">{cr}% Cap</td>
                      <td className="py-3 px-3 text-right font-semibold text-[#1B2B5E]">{fmt$(brokerExit)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-gold">{fmt$(investorExit)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-red-500">
                        {fmt$(exitGap)} ({fmtPct(exitGapPct)})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-dark-muted mt-3">
            The valuation gap shows how much less the property is worth at your conservative underwrite vs the broker&apos;s OM.
            Use this to anchor your offer in negotiations.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── IRR Result Box ───────────────────────────────────────────────────────────

function IRRBox({ result, offerPrice }: { result: IRRResult; offerPrice: string }) {
  return (
    <div className="border-2 border-gold bg-gold/5 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold font-medium mb-1">
            Your Return at {offerPrice ? '$' + parseInt(offerPrice).toLocaleString() : 'This Offer'}
          </div>
          <div className="font-serif text-5xl font-light text-[#1B2B5E]">
            {fmtPct(result.irr_at_max, 1)} IRR
          </div>
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
  const [irrResult, setIrrResult] = useState<IRRResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [hasCalculated, setHasCalculated] = useState(false)
  const [maxOfferAnchor, setMaxOfferAnchor] = useState<'t12' | 'y1' | 'stabilized' | 'manual'>('y1')
  const [capRates, setCapRates] = useState(['6.50', '7.00', '7.50', '8.00'])
  const [revenueHaircut, setRevenueHaircut] = useState('8')
  const setCapRate = (i: number, v: string) => setCapRates(prev => prev.map((c, idx) => idx === i ? v : c))

  const set = (k: keyof ProformaInputs, v: string) => setInputs(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (router.query.data) {
      try {
        const data = JSON.parse(decodeURIComponent(router.query.data as string))
        setInputs(prev => ({
          ...prev,
          ...data,
          sellerY1: { ...prev.sellerY1, ...(data.sellerY1 ?? {}) },
          sellerY2: { ...prev.sellerY2, ...(data.sellerY2 ?? {}) },
          sellerY3: { ...prev.sellerY3, ...(data.sellerY3 ?? {}) },
          sellerY4: { ...prev.sellerY4, ...(data.sellerY4 ?? {}) },
          sellerY5: { ...prev.sellerY5, ...(data.sellerY5 ?? {}) },
        }))
      } catch { /* ignore */ }
    }
  }, [router.query.data])

  async function handleCalculate(anchorOverride?: string) {
    setCalculating(true)
    setCalcError('')
    try {
      const t12Data = {
        total_revenue:       n(inputs.t12Revenue) || n(inputs.t12NOI) / 0.6,
        payroll:             n(inputs.t12Payroll),
        management_fees:     n(inputs.t12ManagementFees),
        marketing:           n(inputs.t12Marketing),
        utilities:           n(inputs.t12Utilities),
        office_employee:     n(inputs.t12OfficeEmployee),
        administrative:      n(inputs.t12Administrative),
        repairs_maintenance: n(inputs.t12RepairsMaintenance),
        tax:                 n(inputs.t12Tax),
        insurance:           n(inputs.t12Insurance),
        other_expenses:      n(inputs.t12OtherExpenses),
        total_expenses:      n(inputs.t12TotalExpenses),
        noi:                 n(inputs.t12NOI),
      }

      const assumptions = {
        total_units:          n(inputs.totalUnits, 100),
        current_occupancy:    n(inputs.currentOccupancy) / 100,
        rent_uplift_y1:       0.12,
        rent_growth:          n(inputs.revenueGrowthPostStab, 3) / 100,
        opex_growth:          n(inputs.expenseGrowth, 3) / 100,
        tax_insurance_growth: 0.05,
        mgmt_fee_pct:         0.05,
        occ_schedule: [
          Math.min(n(inputs.targetOccupancy, 80) / 100, 0.92),
          Math.min((n(inputs.targetOccupancy, 80) + 6) / 100, 0.92),
          Math.min((n(inputs.targetOccupancy, 80) + 10) / 100, 0.92),
          Math.min((n(inputs.targetOccupancy, 80) + 11) / 100, 0.92),
          Math.min((n(inputs.targetOccupancy, 80) + 12) / 100, 0.92),
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

      const activeAnchor = anchorOverride ?? maxOfferAnchor
      const y1NOI = proformaData.years[0]?.noi ?? 0
      const y5NOI = proformaData.years[4]?.noi ?? y1NOI
      const t12NOIval = n(inputs.t12NOI) || proformaData.t12.noi
      const manualNOIval = n(inputs.manualNOI)

      let anchorNOI = y1NOI
      if (activeAnchor === 't12') anchorNOI = t12NOIval
      else if (activeAnchor === 'stabilized') anchorNOI = y5NOI
      else if (activeAnchor === 'manual' && manualNOIval > 0) anchorNOI = manualNOIval

      const offerPriceVal = n(inputs.offerPrice)

      const irrBody = {
        action: 'max-offer',
        target_irr: offerPriceVal > 0 ? null : 0.15,
        purchase_price: offerPriceVal > 0 ? offerPriceVal : null,
        deal_type: inputs.dealType,
        in_place_noi: anchorNOI,
        stabilized_noi: y5NOI,
        start_occupancy: n(inputs.currentOccupancy) / 100,
        stabilized_occupancy: n(inputs.targetOccupancy, 92) / 100,
        exit_cap_rate: n(inputs.exitCapRate, 7.25) / 100,
        exit_month: n(inputs.exitMonth, 60),
        months_to_stabilization: n(inputs.monthsToStabilization, 18),
        rent_growth: n(inputs.revenueGrowthPostStab, 3) / 100,
        opex_growth: n(inputs.expenseGrowth, 3) / 100,
        closing_costs_pct: 0.03,
        acquisition_fee_pct: 0.02,
        initial_repairs: 0,
        selling_costs_pct: 0.02,
      }

      const irrRes = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(irrBody),
      })
      if (irrRes.ok) {
        const irrData = await irrRes.json()
        setIrrResult(irrData)
      }

      setHasCalculated(true)
    } catch (err) {
      setCalcError(String(err))
    } finally {
      setCalculating(false)
    }
  }

  function handleContinueToModel() {
    const data = {
      propertyName: inputs.propertyName,
      address: inputs.address,
      dealType: inputs.dealType,
      inPlaceNOI: String(Math.round(ourYears[0]?.noi ?? 0)),
      stabilizedNOI: String(Math.round(ourYears[4]?.noi ?? 0)),
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
    const data = {
      propertyName: inputs.propertyName,
      address: inputs.address,
      purchasePrice: inputs.offerPrice || String(Math.round((ourYears[0]?.noi ?? 0) / 0.075)),
      year1NOI: String(Math.round(ourYears[0]?.noi ?? 0)),
      year2NOI: String(Math.round(ourYears[1]?.noi ?? 0)),
      year3NOI: String(Math.round(ourYears[2]?.noi ?? 0)),
      goingInCap: irrResult ? String((irrResult.going_in_cap * 100).toFixed(2)) : '',
      stabilizedCap: irrResult ? String((irrResult.stabilized_cap * 100).toFixed(2)) : '',
      dealType: inputs.dealType,
    }
    router.push(`/generate-loi?data=${encodeURIComponent(JSON.stringify(data))}`)
  }

  const sellerYears = [inputs.sellerY1, inputs.sellerY2, inputs.sellerY3, inputs.sellerY4, inputs.sellerY5]
  const hasSeller = sellerYears.some(s => s.revenue || s.noi)

  return (
    <AuthGate>
      <>
        <Head>
          <title>Proforma Builder — YEM Acquisitions</title>
          <meta name="description" content="Build a defensible underwritten proforma with lease-up modeling and broker vs investor analysis." />
        </Head>

        <section className="page-hero border-b border-dark-border">
          <div className="section-label">Proforma Builder</div>
          <h1 className="display-heading text-5xl md:text-7xl max-w-3xl mb-6">
            Their numbers.<br />
            <em className="text-gold">Our underwrite.</em>
          </h1>
          <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
            Build a true 5-year proforma from T-12 actuals. Compare broker projections to your conservative underwrite.
            Enter your offer price and see your actual IRR.
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
                  note="Last 3 months × 4" />
                <Field label="Current Occupancy" value={inputs.t12Occupancy} onChange={v => set('t12Occupancy', v)} suffix="%" />
              </div>
            </div>

            {/* Unit Economics */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Unit Economics & Lease-Up" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Total Units" value={inputs.totalUnits} onChange={v => set('totalUnits', v)} />
                <Field label="Current Occupancy" value={inputs.currentOccupancy} onChange={v => set('currentOccupancy', v)} suffix="%" />
                <Field label="Target Occupancy" value={inputs.targetOccupancy} onChange={v => set('targetOccupancy', v)} suffix="%" />
                <Field label="Months to Stabilization" value={inputs.monthsToStabilization} onChange={v => set('monthsToStabilization', v)} suffix="mo" />
                <Field label="Current Avg Rent/Unit" value={inputs.currentAvgRent} onChange={v => set('currentAvgRent', v)} suffix="$/mo" />
                <Field label="Market Avg Rent/Unit" value={inputs.marketAvgRent} onChange={v => set('marketAvgRent', v)} suffix="$/mo" />
              </div>
            </div>

            {/* Growth Assumptions */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Growth Assumptions" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Revenue Growth (post-stab)" value={inputs.revenueGrowthPostStab} onChange={v => set('revenueGrowthPostStab', v)} suffix="% / yr" step="0.5" />
                <Field label="Expense Growth" value={inputs.expenseGrowth} onChange={v => set('expenseGrowth', v)} suffix="% / yr" step="0.5" />
              </div>
            </div>

            {/* Exit & Offer */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Exit & Offer Price" subtitle="Enter your offer price to calculate your actual IRR" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Exit Cap Rate" value={inputs.exitCapRate} onChange={v => set('exitCapRate', v)} suffix="%" step="0.25" />
                <Field label="Hold Period" value={inputs.exitMonth} onChange={v => set('exitMonth', v)} suffix="mo" />
                <div className="md:col-span-2">
                  <label className="label-text">
                    Your Offer Price <span className="text-gold text-xs">(enter to see your IRR)</span>
                  </label>
                  <input
                    className="input-field border-gold/50"
                    type="number"
                    step="any"
                    value={inputs.offerPrice}
                    onChange={e => set('offerPrice', e.target.value)}
                    placeholder="e.g. 3500000"
                  />
                </div>
              </div>
            </div>

            {/* NOI Anchor + Calculate */}
            <div className="pt-2">
              {calcError && (
                <div className="mb-4 p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">{calcError}</div>
              )}
              <div className="mb-6">
                <label className="label-text mb-2 block">Anchor NOI to</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    ['t12', 'T-12 NOI', 'Conservative'],
                    ['y1', 'Year 1 NOI', 'Base case'],
                    ['stabilized', 'Stabilized NOI', 'Aggressive'],
                    ['manual', 'Manual NOI', 'Custom'],
                  ] as const).map(([val, label, desc]) => (
                    <button
                      key={val}
                      onClick={() => { setMaxOfferAnchor(val); if (hasCalculated) handleCalculate(val); }}
                      className={`flex-1 p-3 border text-left transition-colors duration-150 min-w-[110px]
                        ${maxOfferAnchor === val ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}
                    >
                      <div className={`text-xs font-semibold mb-0.5 ${maxOfferAnchor === val ? 'text-gold' : 'text-[#1B2B5E]'}`}>{label}</div>
                      <div className="text-xs text-dark-muted">{desc}</div>
                    </button>
                  ))}
                </div>
                {maxOfferAnchor === 'manual' && (
                  <div className="mt-3 max-w-xs">
                    <Field
                      label="Manual NOI ($)"
                      value={inputs.manualNOI}
                      onChange={v => set('manualNOI', v)}
                      note="Type any NOI to anchor your analysis to this number"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleCalculate()}
                disabled={calculating}
                className="btn-gold disabled:opacity-60 text-base px-10 py-4 w-full md:w-auto"
              >
                {calculating ? 'Calculating...' : 'Build Proforma & Calculate'}
              </button>
            </div>

            {/* Results */}
            {hasCalculated && ourYears.length > 0 && (
              <div className="space-y-8">

                {/* Our Proforma Table */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Our Underwritten Proforma" subtitle="T-12 actuals → 5-year projection. ESMI management at 5% of EGI." />
                  {proformaResult && <ProformaTable proformaResult={proformaResult} />}
                </div>

                {/* Broker vs Investor */}
                {hasSeller && proformaResult && (
                  <div className="border border-dark-border p-7">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <SectionHead
                          title="Broker vs Investor Analysis"
                          subtitle="OM projections vs your conservative underwrite — adjust the revenue haircut to stress-test"
                        />
                      </div>
                      <div className="flex items-center gap-2 ml-6 mt-1">
                        <label className="text-xs uppercase tracking-widest text-dark-muted whitespace-nowrap">Revenue Haircut</label>
                        <input
                          className="input-field text-sm w-16"
                          type="number"
                          step="1"
                          min="0"
                          max="30"
                          value={revenueHaircut}
                          onChange={e => setRevenueHaircut(e.target.value)}
                        />
                        <span className="text-dark-muted text-xs">%</span>
                      </div>
                    </div>
                    <BrokerInvestorTable
                      proformaResult={proformaResult}
                      sellerYears={sellerYears}
                      revenueHaircut={n(revenueHaircut) / 100}
                      capRates={capRates}
                    />
                  </div>
                )}

                {/* Offer Matrix */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Offer Matrix" subtitle="Our NOI ÷ cap rate — adjust cap rates to match your market" />
                  <div className="flex gap-3 mb-4 flex-wrap">
                    {capRates.map((cr, i) => (
                      <div key={i} style={{ width: 100 }}>
                        <label className="label-text">Cap Rate {i + 1}</label>
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
                          ['T-12', proformaResult?.t12.noi ?? null],
                          ['Year 1', ourYears[0]?.noi ?? null],
                          ['Year 2', ourYears[1]?.noi ?? null],
                          ['Year 3', ourYears[2]?.noi ?? null],
                          ['Year 4', ourYears[3]?.noi ?? null],
                          ['Year 5', ourYears[4]?.noi ?? null],
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
                  <p className="text-xs text-dark-muted mt-3">Offer = Our NOI ÷ cap rate. Use this to anchor your bid.</p>
                </div>

                {/* IRR Result */}
                <div className="border border-dark-border p-7">
                  <SectionHead
                    title="Your IRR"
                    subtitle="IRR is a result of your offer price — not a target. Enter an offer price above to see your actual return."
                  />
                  {irrResult ? (
                    <IRRBox result={irrResult} offerPrice={inputs.offerPrice} />
                  ) : (
                    <div className="p-6 border border-dark-border bg-dark-surface text-center">
                      <p className="text-dark-muted text-sm">Enter your offer price in the Exit & Offer Price section above, then recalculate.</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Next Steps" />
                  <div className="flex flex-wrap gap-4">
                    <button onClick={handleContinueToModel} className="btn-gold text-base px-8 py-3">
                      Continue to Full Model →
                    </button>
                    <button
                      onClick={handleGenerateLOI}
                      className="px-8 py-3 border border-[#1B2B5E] text-[#1B2B5E] text-sm uppercase tracking-widest hover:bg-[#1B2B5E] hover:text-white transition-colors"
                    >
                      Generate LOI →
                    </button>
                  </div>
                  <p className="text-dark-muted text-xs mt-3">
                    &ldquo;Continue to Full Model&rdquo; loads these numbers into the underwriting model and downloads the Excel.
                    &ldquo;Generate LOI&rdquo; pre-fills the LOI with your offer price and key terms.
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
