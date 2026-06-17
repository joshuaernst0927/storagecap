import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AuthGate from '@/components/AuthGate'
import { loadSavedProperties } from '@/lib/pipelineStore'
import type { PipelineProperty } from '@/lib/pipelineData'

type DealType = 'value-add' | 'stabilized' | 'distressed'
type LeverageType = 'all-cash' | 'levered'
type LoanType = 'bridge-to-perm' | 'permanent'

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
  exitSalePrice: string
  // Closing costs
  closingCostsPct: string
  brokerFeePct: string
  acquisitionFeePct: string
  initialRepairs: string
  leaseUpReserve: string
  workingCapital: string
  capexReserve: string
  // Bridge loan
  bridgeLTV: string
  bridgeRate: string
  bridgeTerm: string
  bridgeExtensions: string
  bridgeGuaranteedIOMonths: string
  bridgePrepaidInterestMonths: string
  // Refi
  refiMonth: string
  refiLTV: string
  refiRate: string
  refiAmortYears: string
  refiIOMonths: string
  refiFeePct: string
  // Perm loan
  permLTV: string
  permRate: string
  permAmortYears: string
  permIOMonths: string
  // Refi sizing
  refiCapRate: string
  refiDSCR: string
  refiLoanRate: string
  // Interest reserves
  interestReserveY2Source: 'closing' | 'operations'
  interestReserveY3Source: 'closing' | 'operations'
  // Broker info (extracted from OM)
  broker1Name: string
  broker2Name: string
  brokerPhone1: string
  brokerPhone2: string
  brokerEmail1: string
  brokerEmail2: string
  brokerageName: string
  totalSF: string
  yearBuilt: string
  city: string
  state: string
  msaName: string
  // Waterfall
  lpPreferredReturn: string
  lpSplit: string
  gpSplit: string
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
  broker_years?: OurYear[]
}

type IRRResult = {
  irr_at_max: number
  levered_irr?: number
  unlevered_irr?: number
  equity_multiple?: number
  equity_required?: number
  loan_amount?: number
  annual_debt_service?: number
  going_in_cap: number
  stabilized_cap: number
  target_irr: number
  in_place_noi: number
  stabilized_noi: number
  method: string
  exit_value?: number
}

type EquityBreakdown = {
  downPayment: number
  closingCosts: number
  brokerFee: number
  acquisitionFee: number
  prepaidInterest: number
  initialRepairs: number
  leaseUpReserve: number
  workingCapital: number
  capexReserve: number
  total: number
}

type WaterfallResult = {
  totalProceeds: number
  debtPayoff: number
  netProceeds: number
  lpCapitalReturn: number
  lpPreferredReturn: number
  remainingProceeds: number
  lpShare: number
  gpShare: number
  gpAcquisitionFee: number
  gpRefiFee: number
  lpTotal: number
  gpTotal: number
  lpMOIC: number
  gpMOIC: number
  refiLoanAmount: number
  refiCashOut: number
  lpRemainingEquity: number
  stabilizedValue: number
  refiOccurs: boolean
  bridgeRunwayMonths: number
}

const EMPTY_SELLER: SellerYear = { revenue: '', expenses: '', noi: '' }

const EMPTY: ProformaInputs = {
  propertyName: '', address: '',
  dealType: 'value-add',
  totalUnits: '',
  currentOccupancy: '', targetOccupancy: '92',
  monthsToStabilization: '24',
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
  exitCapRate: '7.25', exitMonth: '60', offerPrice: '', manualNOI: '', exitSalePrice: '',
  // Closing costs
  closingCostsPct: '3',
  brokerFeePct: '3',
  acquisitionFeePct: '2',
  initialRepairs: '50000',
  leaseUpReserve: '100000',
  workingCapital: '50000',
  capexReserve: '0',
  // Bridge loan
  bridgeLTV: '65',
  bridgeRate: '8',
  bridgeTerm: '24',
  bridgeExtensions: '2',
  bridgeGuaranteedIOMonths: '12',
  bridgePrepaidInterestMonths: '12',
  // Refi
  refiMonth: '36',
  refiLTV: '70',
  refiRate: '6.5',
  refiAmortYears: '30',
  refiIOMonths: '0',
  refiFeePct: '1',
  // Perm loan
  permLTV: '65',
  permRate: '6.5',
  permAmortYears: '30',
  permIOMonths: '24',
  // Broker info
  broker1Name: '',
  broker2Name: '',
  brokerPhone1: '',
  brokerPhone2: '',
  brokerEmail1: '',
  brokerEmail2: '',
  brokerageName: '',
  totalSF: '',
  yearBuilt: '',
  city: '',
  state: '',
  msaName: '',
  // Refi sizing
  refiCapRate: '7',
  refiDSCR: '1.30',
  refiLoanRate: '6',
  // Interest reserves
  interestReserveY2Source: 'operations',
  interestReserveY3Source: 'operations',
  // Waterfall
  lpPreferredReturn: '8',
  lpSplit: '85',
  gpSplit: '15',
}

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  'value-add': 'Value-Add',
  'stabilized': 'Stabilized',
  'distressed': 'Distressed',
}

function fmt$(v: number) {
  if (isNaN(v) || !isFinite(v)) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}
function fmtPct(v: number, dec = 1) {
  if (isNaN(v) || !isFinite(v)) return '—'
  return (v * 100).toFixed(dec) + '%'
}
function n(s: string, fallback = 0) {
  const v = parseFloat(s)
  return isNaN(v) ? fallback : v
}

function computeEquityBreakdown(inputs: ProformaInputs, loanAmount: number, leverageType: LeverageType): EquityBreakdown {
  const price = n(inputs.offerPrice)
  const downPayment = leverageType === 'levered' ? price - loanAmount : price
  const closingCosts = price * (n(inputs.closingCostsPct) / 100)
  const brokerFee = price * (n(inputs.brokerFeePct) / 100)
  const acquisitionFee = price * (n(inputs.acquisitionFeePct) / 100)
  const annualInterest = leverageType === 'levered' ? loanAmount * (n(inputs.bridgeRate) / 100) : 0
  const prepaidInterestY1 = annualInterest
  const prepaidInterestY2 = leverageType === 'levered' && inputs.interestReserveY2Source === 'closing' ? annualInterest : 0
  const prepaidInterestY3 = leverageType === 'levered' && inputs.interestReserveY3Source === 'closing' ? annualInterest : 0
  const prepaidInterest = prepaidInterestY1 + prepaidInterestY2 + prepaidInterestY3
  const initialRepairs = n(inputs.initialRepairs)
  const leaseUpReserve = n(inputs.leaseUpReserve)
  const workingCapital = n(inputs.workingCapital)
  const capexReserve = n(inputs.capexReserve)
  const total = downPayment + closingCosts + brokerFee + acquisitionFee + prepaidInterest + initialRepairs + leaseUpReserve + workingCapital + capexReserve
  return { downPayment, closingCosts, brokerFee, acquisitionFee, prepaidInterest, initialRepairs, leaseUpReserve, workingCapital, capexReserve, total }
}

function computeWaterfall(
  inputs: ProformaInputs,
  equityBreakdown: EquityBreakdown,
  exitValue: number,
  loanAmount: number,
  leverageType: LeverageType,
  loanType: LoanType,
  noiYears: number[]
): WaterfallResult {
  const price = n(inputs.offerPrice)
  const acquisitionFee = price * (n(inputs.acquisitionFeePct) / 100)

  let refiLoanAmount = loanAmount
  let refiCashOut = 0
  let refiFeePaid = 0

  // refiOccurs whenever the user is on bridge-to-perm — the refi month field
  // controls WHEN the refi happens (and therefore which year's NOI sizes the
  // perm loan). The user can refi in Y2, Y3, or any month they choose.
  const refiOccurs = leverageType === 'levered' && loanType === 'bridge-to-perm'
  const bridgeRunwayMonths = n(inputs.bridgeTerm, 24) + n(inputs.bridgeExtensions, 0) * 6

  if (refiOccurs) {
    // True monthly interpolation: month 30 = halfway between Y2 and Y3 NOI.
    // This means the perm loan is sized on the exact NOI for that month,
    // not rounded to the nearest annual bucket.
    const refiMonthVal = n(inputs.refiMonth, 36)
    const refiYearExact = refiMonthVal / 12          // e.g. month 30 → 2.5
    const lowerIdx = Math.max(0, Math.floor(refiYearExact) - 1)   // 0-based index of year before
    const upperIdx = Math.min(noiYears.length - 1, lowerIdx + 1)  // 0-based index of year after
    const frac = refiYearExact - Math.floor(refiYearExact)         // fractional part (0–1)
    const lowerNOI = noiYears[lowerIdx] ?? 0
    const upperNOI = noiYears[upperIdx] ?? lowerNOI
    // Linear interpolation between the two surrounding annual NOI values
    const refiNOI = lowerIdx === upperIdx ? lowerNOI : lowerNOI + frac * (upperNOI - lowerNOI)
    const refiCapRate = n(inputs.refiCapRate, 7) / 100
    const refiDSCR = n(inputs.refiDSCR, 1.30)
    const refiLoanRate = n(inputs.refiLoanRate, 6) / 100
    const stabilizedValue = refiCapRate > 0 ? refiNOI / refiCapRate : 0
    const ltvMaxLoan = stabilizedValue * (n(inputs.refiLTV) / 100)
    const dscrMaxLoan = refiLoanRate > 0 ? refiNOI / refiDSCR / refiLoanRate : 0
    refiLoanAmount = Math.min(ltvMaxLoan, dscrMaxLoan)
    const grossCashOut = Math.max(0, refiLoanAmount - loanAmount)
    refiCashOut = Math.min(grossCashOut, equityBreakdown.total)
    refiFeePaid = refiLoanAmount * (n(inputs.refiFeePct) / 100)
  }

  const lpEquityAtClosing = equityBreakdown.total
  const lpRemainingEquity = Math.max(0, lpEquityAtClosing - refiCashOut)

  const debtPayoff = leverageType === 'levered' ? refiLoanAmount : 0
  const sellingCosts = exitValue * 0.02
  const netProceeds = exitValue - debtPayoff - sellingCosts

  const lpCapitalReturn = Math.min(netProceeds, lpRemainingEquity)
  const afterCapital = Math.max(0, netProceeds - lpRemainingEquity)

  // Preferred return accrues on exact months — no rounding to years
  const lpPref = lpEquityAtClosing * (n(inputs.lpPreferredReturn) / 100) * (n(inputs.exitMonth, 60) / 12)
  const lpPreferredPaid = Math.min(afterCapital, lpPref)
  const afterPref = Math.max(0, afterCapital - lpPreferredPaid)

  const lpSplitPct = n(inputs.lpSplit) / 100
  const gpSplitPct = n(inputs.gpSplit) / 100
  const lpShare = afterPref * lpSplitPct
  const gpShare = afterPref * gpSplitPct

  const lpTotal = lpCapitalReturn + lpPreferredPaid + lpShare + refiCashOut
  const gpTotal = gpShare + acquisitionFee + refiFeePaid
  const lpMOIC = lpEquityAtClosing > 0 ? lpTotal / lpEquityAtClosing : 0
  const gpMOIC = acquisitionFee > 0 ? gpTotal / acquisitionFee : 0

  return {
    totalProceeds: exitValue,
    debtPayoff,
    netProceeds,
    lpCapitalReturn,
    lpPreferredReturn: lpPreferredPaid,
    remainingProceeds: afterPref,
    lpShare,
    gpShare,
    gpAcquisitionFee: acquisitionFee,
    gpRefiFee: refiFeePaid,
    lpTotal,
    gpTotal,
    lpMOIC,
    gpMOIC,
    refiLoanAmount,
    refiCashOut,
    lpRemainingEquity,
    stabilizedValue: refiOccurs
      ? ((() => {
          // Same monthly interpolation used above — keep in sync
          const rm = n(inputs.refiMonth, 36)
          const ryExact = rm / 12
          const li = Math.max(0, Math.floor(ryExact) - 1)
          const ui = Math.min(noiYears.length - 1, li + 1)
          const fr = ryExact - Math.floor(ryExact)
          const lNOI = noiYears[li] ?? 0
          const uNOI = noiYears[ui] ?? lNOI
          const rNOI = li === ui ? lNOI : lNOI + fr * (uNOI - lNOI)
          const rc = n(inputs.refiCapRate, 7) / 100
          return rc > 0 ? rNOI / rc : 0
        })())
      : 0,
    refiOccurs,
    bridgeRunwayMonths,
  }
}

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
      {note && <p className="text-sm text-dark-muted mt-1">{note}</p>}
    </div>
  )
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-dark-border pb-2 mb-5">
      <div className="section-label-sm">{title}</div>
      {subtitle && <p className="text-dark-muted text-sm mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Toggle({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string; desc?: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="label-text mb-2 block">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 p-3 border text-left transition-colors duration-150 min-w-[120px] ${value === opt.value ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}
          >
            <div className={`text-sm font-semibold mb-0.5 ${value === opt.value ? 'text-gold' : 'text-[#1B2B5E]'}`}>{opt.label}</div>
            {opt.desc && <div className="text-sm text-dark-muted">{opt.desc}</div>}
          </button>
        ))}
      </div>
    </div>
  )
}

function EquityBreakdownBox({ breakdown, leverageType, loanType, inputs }: {
  breakdown: EquityBreakdown
  leverageType: LeverageType
  loanType: LoanType
  inputs: ProformaInputs
}) {
  const bridgeLoanAmount = leverageType === 'levered' ? n(inputs.offerPrice) * (n(inputs.bridgeLTV) / 100) : 0
  const annualInterest = bridgeLoanAmount * (n(inputs.bridgeRate) / 100)
  const rows = [
    { label: 'Down Payment', value: breakdown.downPayment, note: leverageType === 'all-cash' ? 'All cash — no debt' : `Purchase price minus loan` },
    { label: `Closing Costs (${inputs.closingCostsPct}%)`, value: breakdown.closingCosts },
    { label: `Broker Fee (${inputs.brokerFeePct}%)`, value: breakdown.brokerFee },
    { label: `Acquisition Fee (${inputs.acquisitionFeePct}% — GP)`, value: breakdown.acquisitionFee, note: 'Paid to GP at closing' },
    ...(leverageType === 'levered' && loanType === 'bridge-to-perm' ? [
      { label: 'Year 1 Interest Reserve (hard)', value: annualInterest, note: 'Always funded at closing by LP' },
      { label: `Year 2 Interest Reserve`, value: inputs.interestReserveY2Source === 'closing' ? annualInterest : 0, note: inputs.interestReserveY2Source === 'closing' ? 'Funded at closing' : 'From operations (contingency)' },
      { label: `Year 3 Interest Reserve`, value: inputs.interestReserveY3Source === 'closing' ? annualInterest : 0, note: inputs.interestReserveY3Source === 'closing' ? 'Funded at closing' : 'From operations (contingency)' },
    ] : []),
    { label: 'Initial Repairs', value: breakdown.initialRepairs },
    { label: 'Lease-Up Reserve', value: breakdown.leaseUpReserve },
    { label: 'Working Capital', value: breakdown.workingCapital },
    ...(breakdown.capexReserve > 0 ? [{ label: 'CapEx Reserve', value: breakdown.capexReserve }] : []),
  ]

  return (
    <div className="border border-dark-border p-6">
      <div className="section-label-sm mb-4">Equity Required at Closing — Funded 100% by LP</div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between items-start py-1.5 border-b border-dark-border/30">
            <div>
              <div className="text-sm uppercase tracking-widest text-[#1B2B5E]">{row.label}</div>
              {row.note && <div className="text-sm text-dark-muted mt-0.5">{row.note}</div>}
            </div>
            <div className="text-base font-semibold text-[#1B2B5E] ml-4">{fmt$(row.value)}</div>
          </div>
        ))}
        <div className="flex justify-between items-center pt-3">
          <div className="text-sm uppercase tracking-widest font-bold text-gold">Total LP Equity Required</div>
          <div className="text-lg font-bold text-gold">{fmt$(breakdown.total)}</div>
        </div>
        <div className="flex justify-between items-center pt-1">
          <div className="text-sm uppercase tracking-widest text-dark-muted">GP Equity Invested</div>
          <div className="text-base font-semibold text-[#1B2B5E]">$0</div>
        </div>
      </div>
    </div>
  )
}

function WaterfallBox({ waterfall, inputs, leverageType, loanType }: {
  waterfall: WaterfallResult; inputs: ProformaInputs; leverageType: LeverageType; loanType: LoanType
}) {
  const bridgeLoan = n(inputs.offerPrice) * (n(inputs.bridgeLTV) / 100)
  return (
    <div className="border border-dark-border p-6">
      <div className="section-label-sm mb-4">GP / LP Waterfall at Exit</div>

      {waterfall.refiOccurs && waterfall.stabilizedValue > 0 && (
        <div className="mb-6 p-4 border border-gold/40 bg-gold/5">
          <div className="section-label-sm mb-3">Refi Event — Month {n(inputs.refiMonth, 36)}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Stabilized Value</div>
              <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.stabilizedValue)}</div>
              <div className="text-sm text-dark-muted">Month {n(inputs.refiMonth,36)} NOI ÷ {inputs.refiCapRate}% cap</div>
            </div>
            <div>
              <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">New Perm Loan</div>
              <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.refiLoanAmount)}</div>
              <div className="text-sm text-dark-muted">Lower of LTV or DSCR test</div>
            </div>
            <div>
              <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Bridge Payoff</div>
              <div className="text-base font-semibold text-red-500">({fmt$(bridgeLoan)})</div>
            </div>
            <div>
              <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Cash Out to LP</div>
              <div className="text-base font-bold text-gold">{fmt$(waterfall.refiCashOut)}</div>
              <div className="text-sm text-dark-muted">Reduces LP outstanding equity</div>
            </div>
          </div>
          <div className="flex justify-between pt-3 border-t border-gold/20">
            <div className="text-sm text-dark-muted uppercase tracking-widest">LP Remaining Equity After Refi</div>
            <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.lpRemainingEquity)}</div>
          </div>
          {waterfall.gpRefiFee > 0 && (
            <div className="flex justify-between pt-2 border-t border-gold/20 mt-2">
              <div className="text-sm text-dark-muted uppercase tracking-widest">GP Refi Fee ({inputs.refiFeePct}%)</div>
              <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.gpRefiFee)}</div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 mb-6">
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div className="text-sm uppercase tracking-widest text-dark-muted">Gross Exit Proceeds</div>
          <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.totalProceeds)}</div>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div className="text-sm uppercase tracking-widest text-dark-muted">Debt Payoff</div>
          <div className="text-base font-semibold text-red-500">({fmt$(waterfall.debtPayoff)})</div>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div className="text-sm uppercase tracking-widest text-dark-muted">Selling Costs (2%)</div>
          <div className="text-base font-semibold text-red-500">({fmt$(waterfall.totalProceeds * 0.02)})</div>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div className="text-sm uppercase tracking-widest font-semibold text-[#1B2B5E]">Net Proceeds</div>
          <div className="text-base font-bold text-[#1B2B5E]">{fmt$(waterfall.netProceeds)}</div>
        </div>
      </div>

      <div className="section-label-sm mb-3">Distribution Waterfall</div>
      <div className="space-y-2 mb-6">
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div>
            <div className="text-sm uppercase tracking-widest text-[#1B2B5E]">① LP Capital Return</div>
            <div className="text-sm text-dark-muted">100% of invested equity returned first</div>
          </div>
          <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.lpCapitalReturn)}</div>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div>
            <div className="text-sm uppercase tracking-widest text-[#1B2B5E]">② LP Preferred Return ({inputs.lpPreferredReturn}%)</div>
            <div className="text-sm text-dark-muted">On invested capital over hold period</div>
          </div>
          <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.lpPreferredReturn)}</div>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div>
            <div className="text-sm uppercase tracking-widest text-[#1B2B5E]">③ Remaining Proceeds</div>
            <div className="text-sm text-dark-muted">Split {inputs.lpSplit}% LP / {inputs.gpSplit}% GP</div>
          </div>
          <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.remainingProceeds)}</div>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div className="text-sm uppercase tracking-widest text-dark-muted pl-4">LP Share ({inputs.lpSplit}%)</div>
          <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.lpShare)}</div>
        </div>
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div className="text-sm uppercase tracking-widest text-dark-muted pl-4">GP Carried Interest ({inputs.gpSplit}%)</div>
          <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.gpShare)}</div>
        </div>
      </div>

      <div className="section-label-sm mb-3">GP Fee Income</div>
      <div className="space-y-2 mb-6">
        <div className="flex justify-between py-1.5 border-b border-dark-border/30">
          <div className="text-sm uppercase tracking-widest text-[#1B2B5E]">Acquisition Fee ({inputs.acquisitionFeePct}%)</div>
          <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.gpAcquisitionFee)}</div>
        </div>
        {waterfall.gpRefiFee > 0 && (
          <div className="flex justify-between py-1.5 border-b border-dark-border/30">
            <div className="text-sm uppercase tracking-widest text-[#1B2B5E]">Refi Fee ({inputs.refiFeePct}%)</div>
            <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(waterfall.gpRefiFee)}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-gold/40">
        <div className="border border-dark-border p-4">
          <div className="text-sm uppercase tracking-widest text-dark-muted mb-1">LP Total Return</div>
          <div className="text-2xl font-bold text-[#1B2B5E]">{fmt$(waterfall.lpTotal)}</div>
          <div className="text-sm text-dark-muted mt-1">MOIC: {waterfall.lpMOIC.toFixed(2)}x</div>
        </div>
        <div className="border border-gold bg-gold/5 p-4">
          <div className="text-sm uppercase tracking-widest text-gold mb-1">GP Total Earnings</div>
          <div className="text-2xl font-bold text-[#1B2B5E]">{fmt$(waterfall.gpTotal)}</div>
          <div className="text-sm text-dark-muted mt-1">On $0 invested capital</div>
        </div>
      </div>
    </div>
  )
}

function IRRBox({ result, offerPrice, exitSalePrice, equityBreakdown }: {
  result: IRRResult; offerPrice: string; exitSalePrice?: string; equityBreakdown?: EquityBreakdown
}) {
  const isOverride = !!(exitSalePrice && parseInt(exitSalePrice) > 0)
  const exitVal = isOverride ? parseInt(exitSalePrice!) : (result.exit_value ?? 0)
  const displayPrice = exitVal > 0 ? exitVal : parseInt(offerPrice)
  const hasDebt = result.levered_irr !== undefined && result.levered_irr !== result.unlevered_irr
  return (
    <div className="border-2 border-gold bg-gold/5 p-6">
      <div className="section-label-sm text-gold mb-4">
        Returns at {displayPrice ? '$' + displayPrice.toLocaleString() : 'This Offer'}
        {isOverride ? ' (exit override)' : ' (cap rate exit)'}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="border border-gold/30 p-4 bg-white/50">
          <div className="text-sm uppercase tracking-widest text-dark-muted mb-1">Levered IRR</div>
          <div className="font-serif text-4xl font-light text-[#1B2B5E]">
            {hasDebt ? fmtPct(result.levered_irr!, 1) : fmtPct(result.irr_at_max, 1)}
          </div>
          <div className="text-sm text-dark-muted mt-1">After debt service</div>
        </div>
        <div className="border border-dark-border p-4">
          <div className="text-sm uppercase tracking-widest text-dark-muted mb-1">Unlevered IRR</div>
          <div className="font-serif text-4xl font-light text-[#1B2B5E]">
            {hasDebt ? fmtPct(result.unlevered_irr!, 1) : fmtPct(result.irr_at_max, 1)}
          </div>
          <div className="text-sm text-dark-muted mt-1">All cash, no debt</div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gold/30">
        <div>
          <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Going-In Cap</div>
          <div className="font-semibold text-[#1B2B5E]">{fmtPct(result.going_in_cap)}</div>
        </div>
        <div>
          <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Stabilized Cap</div>
          <div className="font-semibold text-[#1B2B5E]">{fmtPct(result.stabilized_cap)}</div>
        </div>
        {result.equity_multiple && (
          <div>
            <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Equity Multiple</div>
            <div className="font-semibold text-[#1B2B5E]">{result.equity_multiple.toFixed(2)}x</div>
          </div>
        )}
        {equityBreakdown && (
          <div>
            <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">LP Equity In</div>
            <div className="font-semibold text-[#1B2B5E]">{fmt$(equityBreakdown.total)}</div>
          </div>
        )}
      </div>
      {result.loan_amount && result.loan_amount > 0 && (
        <div className="mt-4 pt-4 border-t border-gold/20 grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Loan Amount</div>
            <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(result.loan_amount)}</div>
          </div>
          <div>
            <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">Annual Debt Service</div>
            <div className="text-base font-semibold text-[#1B2B5E]">{fmt$(result.annual_debt_service ?? 0)}</div>
          </div>
          <div>
            <div className="text-sm text-dark-muted uppercase tracking-widest mb-0.5">DSCR (Y1)</div>
            <div className="text-base font-semibold text-[#1B2B5E]">
              {result.annual_debt_service && result.annual_debt_service > 0
                ? (result.in_place_noi / result.annual_debt_service).toFixed(2) + 'x'
                : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProformaTable({ proformaResult }: { proformaResult: ProformaResult }) {
  const { t12, years } = proformaResult
  const cols = ['T-12', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']

  function Row({ label, values, bold, gold, indent, pct }: {
    label: string; values: (number | null)[]; bold?: boolean; gold?: boolean; indent?: boolean; pct?: boolean
  }) {
    return (
      <tr className={bold ? 'bg-navy/5' : ''}>
        <td className={`py-2.5 pr-4 text-sm uppercase tracking-widest ${bold ? 'font-semibold text-[#1B2B5E]' : 'text-dark-muted'} ${indent ? 'pl-4' : ''} ${gold ? 'text-gold font-semibold' : ''}`}>
          {label}
        </td>
        {values.map((v, i) => (
          <td key={i} className={`py-2.5 px-2 text-right text-base ${bold ? 'font-bold text-[#1B2B5E]' : 'text-[#1B2B5E]'} ${gold ? 'text-gold font-semibold' : ''}`}>
            {v === null ? '—' : pct ? fmtPct(v) : fmt$(v)}
          </td>
        ))}
      </tr>
    )
  }

  function Divider({ label }: { label: string }) {
    return (
      <tr className="bg-dark-surface">
        <td colSpan={7} className="py-1.5 px-3 text-sm uppercase tracking-widest text-dark-muted font-medium">{label}</td>
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead>
          <tr className="border-b border-dark-border">
            <th className="text-left text-sm uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-44">Line Item</th>
            {cols.map(c => (
              <th key={c} className="text-right text-base uppercase tracking-widest text-dark-muted font-normal pb-3 px-2">{c}</th>
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
          <Row label="NOI Margin" pct values={[t12.revenue > 0 ? t12.noi / t12.revenue : null, ...years.map(y => y.noi_margin)]} />
        </tbody>
      </table>
    </div>
  )
}

function BrokerInvestorTable({ proformaResult, sellerYears, revenueHaircut, capRates }: {
  proformaResult: ProformaResult; sellerYears: SellerYear[]; revenueHaircut: number; capRates: string[]
}) {
  const cols = ['T-12', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']
  const t12noi = proformaResult.t12.noi

  const brokerNOI: (number | null)[] = [t12noi, ...sellerYears.map(s => {
    const noi = parseFloat(s.noi)
    if (!isNaN(noi) && noi > 0) return noi
    const rev = parseFloat(s.revenue)
    const exp = parseFloat(s.expenses)
    if (!isNaN(rev) && !isNaN(exp)) return rev - exp
    return null
  })]

  const investorNOI: (number | null)[] = [t12noi, ...sellerYears.map(s => {
    const rev = parseFloat(s.revenue)
    const exp = parseFloat(s.expenses)
    const noi = parseFloat(s.noi)
    if (!isNaN(rev) && !isNaN(exp) && rev > 0) return (rev * (1 - revenueHaircut)) - exp
    if (!isNaN(noi) && noi > 0) return noi * (1 - revenueHaircut)
    return null
  })]

  const gap: (number | null)[] = brokerNOI.map((b, i) => {
    if (i === 0 || b === null || investorNOI[i] === null) return null
    return (investorNOI[i] as number) - b
  })

  const gapPct: (number | null)[] = brokerNOI.map((b, i) => {
    if (i === 0 || b === null || b === 0 || investorNOI[i] === null) return null
    return ((investorNOI[i] as number) - b) / b
  })

  const brokerY5 = brokerNOI[5] ?? (sellerYears.length >= 5 ? brokerNOI[sellerYears.length] : null)
  const investorY5 = proformaResult.years[4]?.noi ?? investorNOI[5] ?? null

  function Row({ label, values, bold, red, pct }: {
    label: string; values: (number | null)[]; bold?: boolean; red?: boolean; pct?: boolean
  }) {
    return (
      <tr className={bold ? 'bg-navy/5' : ''}>
        <td className={`py-2.5 pr-4 text-sm uppercase tracking-widest ${bold ? 'font-semibold text-[#1B2B5E]' : 'text-dark-muted'}`}>{label}</td>
        {values.map((v, i) => (
          <td key={i} className={`py-2.5 px-2 text-right text-base ${bold ? 'font-bold text-[#1B2B5E]' : ''} ${red && v !== null && (v as number) < 0 ? 'text-red-500 font-semibold' : 'text-[#1B2B5E]'}`}>
            {v === null ? '—' : pct ? fmtPct(v) : fmt$(v)}
          </td>
        ))}
      </tr>
    )
  }

  function Divider({ label }: { label: string }) {
    return (
      <tr className="bg-dark-surface">
        <td colSpan={7} className="py-1.5 px-3 text-sm uppercase tracking-widest text-dark-muted font-medium">{label}</td>
      </tr>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-dark-border">
              <th className="text-left text-sm uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-44">Metric</th>
              {cols.map(c => (
                <th key={c} className="text-right text-base uppercase tracking-widest text-dark-muted font-normal pb-3 px-2">{c}</th>
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
          <div className="section-label-sm mb-4">Year 5 Exit Comparison</div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-sm uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-28">Cap Rate</th>
                  <th className="text-right text-base uppercase tracking-widest text-dark-muted font-normal pb-3 px-3">Broker Exit Value</th>
                  <th className="text-right text-base uppercase tracking-widest text-gold font-semibold pb-3 px-3">Investor Exit Value</th>
                  <th className="text-right text-base uppercase tracking-widest text-red-400 font-semibold pb-3 px-3">Valuation Gap</th>
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
                      <td className="py-3 pr-4 text-sm uppercase tracking-widest text-dark-muted font-medium">{cr}% Cap</td>
                      <td className="py-3 px-3 text-right font-semibold text-[#1B2B5E]">{fmt$(brokerExit)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-gold">{fmt$(investorExit)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-red-500">{fmt$(exitGap)} ({fmtPct(exitGapPct)})</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Proforma() {
  const router = useRouter()
  const [inputs, setInputs] = useState<ProformaInputs>(EMPTY)
  const [leverageType, setLeverageType] = useState<LeverageType>('levered')
  const [loanType, setLoanType] = useState<LoanType>('bridge-to-perm')
  const [ourYears, setOurYears] = useState<OurYear[]>([])
  const [proformaResult, setProformaResult] = useState<ProformaResult | null>(null)
  const [irrResult, setIrrResult] = useState<IRRResult | null>(null)
  const [equityBreakdown, setEquityBreakdown] = useState<EquityBreakdown | null>(null)
  const [waterfallResult, setWaterfallResult] = useState<WaterfallResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')

  // Institutional model (Excel engine) state
  const [excelRunning, setExcelRunning]     = useState(false)
  const [excelOutputs, setExcelOutputs]     = useState<Record<string, number | string | boolean | null> | null>(null)
  const [excelError, setExcelError]         = useState('')
  const [excelElapsed, setExcelElapsed]     = useState<number | null>(null)
  const [hasCalculated, setHasCalculated] = useState(false)
  const [maxOfferAnchor, setMaxOfferAnchor] = useState<'t12' | 'y1' | 'stabilized' | 'manual'>('y1')
  const [capRates, setCapRates] = useState(['6.50', '7.00', '7.25', '7.50'])
  const [revenueHaircut, setRevenueHaircut] = useState('8')
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [savedToPipeline, setSavedToPipeline] = useState(false)
  const [exitDriver, setExitDriver] = useState<'caprate' | 'override'>('caprate')
  const setCapRate = (i: number, v: string) => setCapRates(prev => prev.map((c, idx) => idx === i ? v : c))
  const set = (k: keyof ProformaInputs, v: string) => setInputs(p => ({ ...p, [k]: v }))
  const [restored, setRestored] = useState(false)

  // Active deal dropdown
  const [activeDeals, setActiveDeals]         = useState<PipelineProperty[]>([])
  const [selectedDealId, setSelectedDealId]   = useState<string>('')

  // Draft resume prompt — shown when localStorage has unsaved data
  // and no deal is explicitly selected
  const [draftData, setDraftData]             = useState<Partial<ProformaInputs> | null>(null)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)

  // On mount:
  // 1. Load active deals from localStorage + /data/pipeline.json for the dropdown.
  // 2. Check for a saved localStorage draft.
  //    - If a ?data= query param is present: ignore draft (explicit deal load).
  //    - Otherwise: show a visible Resume/Start Fresh prompt instead of silently loading.
  // 3. Never silently auto-load stale assumptions.
  useEffect(() => {
    // Load active deals for dropdown
    const INACTIVE = new Set(['dead', 'closed'])
    const isActive = (p: PipelineProperty) =>
      !INACTIVE.has(p.stage) && !p.portfolioEntry

    const localDeals = loadSavedProperties().filter(isActive)
    setActiveDeals(localDeals)

    // Also fetch /data/pipeline.json for deals saved from other devices
    fetch('/data/pipeline.json')
      .then(r => r.ok ? r.json() : [])
      .then((remote: PipelineProperty[]) => {
        const localIds = new Set(localDeals.map(p => p.id))
        const merged = [
          ...localDeals,
          ...remote.filter(p => !localIds.has(p.id) && isActive(p)),
        ]
        // Sort: most recently added first
        merged.sort((a, b) =>
          (b.addedDate ?? '').localeCompare(a.addedDate ?? '')
        )
        setActiveDeals(merged)
      })
      .catch(() => {})

    // Handle localStorage draft
    const hasQueryData = typeof window !== 'undefined' &&
      window.location.search.includes('data=')
    if (!hasQueryData) {
      try {
        const saved = localStorage.getItem('yem_proforma_inputs')
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<ProformaInputs>
          delete parsed.exitSalePrice
          // Only show prompt if the draft has meaningful content
          const hasMeaningfulContent = !!(parsed.propertyName || parsed.address ||
            parsed.offerPrice || parsed.t12NOI)
          if (hasMeaningfulContent) {
            setDraftData(parsed)
            setShowDraftPrompt(true)
          }
        }
      } catch { /* ignore */ }
    }
    setRestored(true)
  }, [])

  // Persist inputs on every change (debounced) so the latest values —
  // including offer price — are always what flows into the LOI.
  useEffect(() => {
    if (!restored) return
    const t = setTimeout(() => {
      try { localStorage.setItem('yem_proforma_inputs', JSON.stringify(inputs)) } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(t)
  }, [inputs, restored])

  async function handleExtractOM() {
    if (!uploadFiles || uploadFiles.length === 0) return
    setExtracting(true)
    setExtractError('')
    try {
      const files = await Promise.all(Array.from(uploadFiles).map(async (file) => {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        return { fileName: file.name, mimeType: file.type, data }
      }))
      const res = await fetch('/api/upload-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })
      if (!res.ok) throw new Error('Extraction failed')
      const data = await res.json()
      setInputs(prev => ({
        ...prev,
        propertyName: data.facilityName ?? data.propertyName ?? prev.propertyName,
        address: data.address ?? prev.address,
        city: data.city ?? prev.city,
        state: data.state ?? prev.state,
        msaName: data.msaName ?? prev.msaName,
        totalSF: data.sqft ? String(data.sqft) : (data.totalSF ? String(data.totalSF) : prev.totalSF),
        yearBuilt: data.yearBuilt ? String(data.yearBuilt) : prev.yearBuilt,
        totalUnits: data.unitCount ? String(data.unitCount) : (data.totalUnits ? String(data.totalUnits) : prev.totalUnits),
        currentOccupancy: data.occupancy ? String(data.occupancy) : (data.currentOccupancy ? String(data.currentOccupancy) : prev.currentOccupancy),
        targetOccupancy: data.targetOccupancy ? String(data.targetOccupancy) : prev.targetOccupancy,
        monthsToStabilization: data.monthsToStabilization ? String(data.monthsToStabilization) : prev.monthsToStabilization,
        currentAvgRent: data.currentAvgRentPerUnit ? String(data.currentAvgRentPerUnit) : (data.currentAvgRent ? String(data.currentAvgRent) : prev.currentAvgRent),
        marketAvgRent: data.marketAvgRentPerUnit ? String(data.marketAvgRentPerUnit) : (data.marketAvgRent ? String(data.marketAvgRent) : prev.marketAvgRent),
        t12NOI: data.t12NOI ? String(data.t12NOI) : (data.noi ? String(data.noi) : prev.t12NOI),
        t3NOI: data.t3NOI ? String(data.t3NOI) : prev.t3NOI,
        t12Occupancy: data.t12Occupancy ? String(data.t12Occupancy) : prev.t12Occupancy,
        t12Revenue: data.t12Revenue ? String(data.t12Revenue) : prev.t12Revenue,
        t12TotalExpenses: data.t12TotalExpenses ? String(data.t12TotalExpenses) : prev.t12TotalExpenses,
        t12Payroll: data.t12Payroll ? String(data.t12Payroll) : prev.t12Payroll,
        t12ManagementFees: data.t12ManagementFees ? String(data.t12ManagementFees) : prev.t12ManagementFees,
        t12Marketing: data.t12Marketing ? String(data.t12Marketing) : prev.t12Marketing,
        t12Utilities: data.t12Utilities ? String(data.t12Utilities) : prev.t12Utilities,
        t12OfficeEmployee: data.t12OfficeEmployee ? String(data.t12OfficeEmployee) : prev.t12OfficeEmployee,
        t12Administrative: data.t12Administrative ? String(data.t12Administrative) : prev.t12Administrative,
        t12RepairsMaintenance: data.t12RepairsMaintenance ? String(data.t12RepairsMaintenance) : prev.t12RepairsMaintenance,
        t12Tax: data.t12Tax ? String(data.t12Tax) : prev.t12Tax,
        t12Insurance: data.t12Insurance ? String(data.t12Insurance) : prev.t12Insurance,
        t12OtherExpenses: data.t12OtherExpenses ? String(data.t12OtherExpenses) : prev.t12OtherExpenses,
        broker1Name: data.broker1Name ?? prev.broker1Name,
        broker2Name: data.broker2Name ?? prev.broker2Name,
        brokerPhone1: data.brokerPhone1 ?? prev.brokerPhone1,
        brokerPhone2: data.brokerPhone2 ?? prev.brokerPhone2,
        brokerEmail1: data.brokerEmail1 ?? prev.brokerEmail1,
        brokerEmail2: data.brokerEmail2 ?? prev.brokerEmail2,
        brokerageName: data.brokerageName ?? prev.brokerageName,
        sellerY1: { ...prev.sellerY1, ...(data.sellerY1 ?? {}) },
        sellerY2: { ...prev.sellerY2, ...(data.sellerY2 ?? {}) },
        sellerY3: { ...prev.sellerY3, ...(data.sellerY3 ?? {}) },
        sellerY4: { ...prev.sellerY4, ...(data.sellerY4 ?? {}) },
        sellerY5: { ...prev.sellerY5, ...(data.sellerY5 ?? {}) },
      }))
      setUploadFiles(null)
    } catch (err) {
      setExtractError(String(err))
    } finally {
      setExtracting(false)
    }
  }

  function handleSaveToPipeline() {
    // BUG-03 fix: if a deal was loaded via the Active Deal dropdown, reuse its id
    // so this save updates that record instead of creating a duplicate, and merge
    // against the full existing record (already in activeDeals) so fields this
    // function doesn't know about — T12 expenses, broker contact, deal score,
    // distress signals, note/activity logs, etc. — are preserved rather than
    // dropped. Fields below are explicitly set on every save (facilityName,
    // address, stage, priority, source, addedDate, notes, etc.) and intentionally
    // overwrite the existing record's values for those fields only, matching
    // current behavior for what this function has always controlled.
    const isExistingDeal = selectedDealId !== '' && selectedDealId !== '__new__'
    const existingRecord = isExistingDeal
      ? activeDeals.find(d => d.id === selectedDealId)
      : undefined
    const dealId = existingRecord ? existingRecord.id : `proforma-${Date.now()}`

    const partialUpdate = {
      id: dealId,
      facilityName: inputs.propertyName || 'Unnamed Facility',
      address: inputs.address,
      city: inputs.city,
      state: inputs.state,
      unitCount: inputs.totalUnits ? parseInt(inputs.totalUnits) : 0,
      yearBuilt: inputs.yearBuilt ? parseInt(inputs.yearBuilt) : 0,
      estimatedValue: inputs.offerPrice ? parseFloat(inputs.offerPrice) : 0,
      askingPrice: inputs.offerPrice ? parseFloat(inputs.offerPrice) : undefined,
      noi: inputs.t12NOI ? parseFloat(inputs.t12NOI) : undefined,
      occupancy: inputs.currentOccupancy ? parseFloat(inputs.currentOccupancy) : 0,
      stage: 'identified',
      priority: 'high',
      source: 'broker',
      addedDate: new Date().toISOString().split('T')[0],
      notes: [
        irrResult ? `Levered IRR: ${((irrResult.levered_irr ?? 0) * 100).toFixed(1)}%` : '',
        waterfallResult ? `LP MOIC: ${waterfallResult.lpMOIC.toFixed(2)}x` : '',
        inputs.brokerageName ? `Broker: ${inputs.brokerageName}` : '',
      ].filter(Boolean).join('\n') || undefined,
    }

    // Existing record spread first, partial update second — preserves every
    // field the existing record has that this function doesn't explicitly set.
    const deal = existingRecord
      ? { ...existingRecord, ...partialUpdate }
      : partialUpdate

    try {
      const existing = JSON.parse(localStorage.getItem('yem_pipeline_saved') || '[]')
      const updated = [deal, ...existing.filter((d: {id: string}) => d.id !== deal.id)]
      localStorage.setItem('yem_pipeline_saved', JSON.stringify(updated))
    } catch { /* ignore */ }
    fetch('/api/pipeline-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([deal]),
    }).catch(() => {})
    setSavedToPipeline(true)
    setTimeout(() => setSavedToPipeline(false), 3000)
  }

  useEffect(() => {
    if (router.query.data) {
      try {
        const data = JSON.parse(decodeURIComponent(router.query.data as string))
        // Start from EMPTY, not from prev. This prevents stale localStorage values
        // from contaminating the incoming deal. Only fields present in the query
        // param will be non-empty; everything else resets to defaults.
        setInputs({
          ...EMPTY,
          // Property info
          propertyName: data.propertyName ?? EMPTY.propertyName,
          address: data.address ?? EMPTY.address,
          city: data.city ?? EMPTY.city,
          state: data.state ?? EMPTY.state,
          msaName: data.msaName ?? EMPTY.msaName,
          totalSF: data.totalSF ? String(data.totalSF) : EMPTY.totalSF,
          yearBuilt: data.yearBuilt ? String(data.yearBuilt) : EMPTY.yearBuilt,
          // Unit economics
          totalUnits: data.totalUnits ? String(data.totalUnits) : EMPTY.totalUnits,
          currentOccupancy: data.currentOccupancy ? String(data.currentOccupancy) : EMPTY.currentOccupancy,
          targetOccupancy: data.targetOccupancy ? String(data.targetOccupancy) : EMPTY.targetOccupancy,
          monthsToStabilization: data.monthsToStabilization ? String(data.monthsToStabilization) : EMPTY.monthsToStabilization,
          currentAvgRent: data.currentAvgRentPerUnit ? String(data.currentAvgRentPerUnit) : data.currentAvgRent ? String(data.currentAvgRent) : data.avgRent ? String(data.avgRent) : data.avg_rent ? String(data.avg_rent) : EMPTY.currentAvgRent,
          marketAvgRent: data.marketAvgRentPerUnit ? String(data.marketAvgRentPerUnit) : data.marketAvgRent ? String(data.marketAvgRent) : data.marketRent ? String(data.marketRent) : data.market_rent ? String(data.market_rent) : EMPTY.marketAvgRent,
          // Historical data
          t12NOI: data.t12NOI ? String(data.t12NOI) : data.t12Noi ? String(data.t12Noi) : data.noi ? String(data.noi) : EMPTY.t12NOI,
          t3NOI: data.t3NOI ? String(data.t3NOI) : data.t3Noi ? String(data.t3Noi) : data.trailing3NOI ? String(data.trailing3NOI) : data.t3_noi ? String(data.t3_noi) : EMPTY.t3NOI,
          t12Occupancy: data.t12Occupancy ? String(data.t12Occupancy) : EMPTY.t12Occupancy,
          t12Revenue: data.t12Revenue ? String(data.t12Revenue) : EMPTY.t12Revenue,
          t12TotalExpenses: data.t12TotalExpenses ? String(data.t12TotalExpenses) : EMPTY.t12TotalExpenses,
          t12Payroll: data.t12Payroll ? String(data.t12Payroll) : EMPTY.t12Payroll,
          t12ManagementFees: data.t12ManagementFees ? String(data.t12ManagementFees) : EMPTY.t12ManagementFees,
          t12Marketing: data.t12Marketing ? String(data.t12Marketing) : EMPTY.t12Marketing,
          t12Utilities: data.t12Utilities ? String(data.t12Utilities) : EMPTY.t12Utilities,
          t12OfficeEmployee: data.t12OfficeEmployee ? String(data.t12OfficeEmployee) : EMPTY.t12OfficeEmployee,
          t12Administrative: data.t12Administrative ? String(data.t12Administrative) : EMPTY.t12Administrative,
          t12RepairsMaintenance: data.t12RepairsMaintenance ? String(data.t12RepairsMaintenance) : EMPTY.t12RepairsMaintenance,
          t12Tax: data.t12Tax ? String(data.t12Tax) : EMPTY.t12Tax,
          t12Insurance: data.t12Insurance ? String(data.t12Insurance) : EMPTY.t12Insurance,
          t12OtherExpenses: data.t12OtherExpenses ? String(data.t12OtherExpenses) : EMPTY.t12OtherExpenses,
          // Broker info
          broker1Name: data.broker1Name ?? EMPTY.broker1Name,
          broker2Name: data.broker2Name ?? EMPTY.broker2Name,
          brokerPhone1: data.brokerPhone1 ?? EMPTY.brokerPhone1,
          brokerPhone2: data.brokerPhone2 ?? EMPTY.brokerPhone2,
          brokerEmail1: data.brokerEmail1 ?? EMPTY.brokerEmail1,
          brokerEmail2: data.brokerEmail2 ?? EMPTY.brokerEmail2,
          brokerageName: data.brokerageName ?? EMPTY.brokerageName,
          // Seller years
          sellerY1: { ...EMPTY.sellerY1, ...(data.sellerY1 ?? {}) },
          sellerY2: { ...EMPTY.sellerY2, ...(data.sellerY2 ?? {}) },
          sellerY3: { ...EMPTY.sellerY3, ...(data.sellerY3 ?? {}) },
          sellerY4: { ...EMPTY.sellerY4, ...(data.sellerY4 ?? {}) },
          sellerY5: { ...EMPTY.sellerY5, ...(data.sellerY5 ?? {}) },
        })
      } catch { /* ignore */ }
    }
  }, [router.query.data])

  // ── Deal dropdown helpers ─────────────────────────────────────────────────

  // Phase A mapping: PipelineProperty → ProformaInputs (property + basic financials only).
  // All underwriting assumptions (debt, exit, waterfall) fall back to EMPTY defaults.
  function mapDealToProforma(deal: PipelineProperty): ProformaInputs {
    return {
      ...EMPTY,
      // Property identity
      propertyName:   deal.facilityName ?? EMPTY.propertyName,
      address:        deal.address ?? EMPTY.address,
      city:           deal.city ?? EMPTY.city,
      state:          deal.state ?? EMPTY.state,
      // Basic financials
      totalUnits:     deal.unitCount  > 0 ? String(deal.unitCount)  : EMPTY.totalUnits,
      // Pipeline stores occupancy as 0-100; Proforma field is also 0-100 string
      currentOccupancy: deal.occupancy > 0 ? String(deal.occupancy) : EMPTY.currentOccupancy,
      t12NOI:         deal.noi            ? String(Math.round(deal.noi))               : EMPTY.t12NOI,
      t3NOI:          deal.t3NOI          ? String(Math.round(deal.t3NOI))             : EMPTY.t3NOI,
      t12Revenue:     deal.grossRevenue   ? String(Math.round(deal.grossRevenue))      : EMPTY.t12Revenue,
      currentAvgRent: deal.currentAvgRentPerUnit
                        ? String(deal.currentAvgRentPerUnit)  : EMPTY.currentAvgRent,
      marketAvgRent:  deal.marketAvgRentPerUnit
                        ? String(deal.marketAvgRentPerUnit)   : EMPTY.marketAvgRent,
      // askingPrice pre-fills offer price as a starting-point only
      offerPrice:     deal.askingPrice    ? String(Math.round(deal.askingPrice))       : EMPTY.offerPrice,
      yearBuilt:      deal.yearBuilt      > 0 ? String(deal.yearBuilt)                : EMPTY.yearBuilt,
      // T12 expense detail — required so Run Institutional Model sends real
      // expense values instead of zeros when a deal is loaded via this dropdown
      // (BUG-01). Mirrors the field set already handled in the router.query.data
      // effect above.
      t12Tax:                deal.t12Tax                != null ? String(deal.t12Tax)                : EMPTY.t12Tax,
      t12Insurance:           deal.t12Insurance          != null ? String(deal.t12Insurance)          : EMPTY.t12Insurance,
      t12Utilities:           deal.t12Utilities          != null ? String(deal.t12Utilities)          : EMPTY.t12Utilities,
      t12RepairsMaintenance:  deal.t12RepairsMaintenance != null ? String(deal.t12RepairsMaintenance) : EMPTY.t12RepairsMaintenance,
      t12Payroll:             deal.t12Payroll            != null ? String(deal.t12Payroll)            : EMPTY.t12Payroll,
      t12OfficeEmployee:      deal.t12OfficeEmployee     != null ? String(deal.t12OfficeEmployee)     : EMPTY.t12OfficeEmployee,
      t12ManagementFees:      deal.t12ManagementFees     != null ? String(deal.t12ManagementFees)     : EMPTY.t12ManagementFees,
      t12Marketing:           deal.t12Marketing          != null ? String(deal.t12Marketing)          : EMPTY.t12Marketing,
      t12Administrative:      deal.t12Administrative     != null ? String(deal.t12Administrative)     : EMPTY.t12Administrative,
      t12OtherExpenses:       deal.t12OtherExpenses      != null ? String(deal.t12OtherExpenses)      : EMPTY.t12OtherExpenses,
      t12TotalExpenses:       deal.t12TotalExpenses      != null ? String(deal.t12TotalExpenses)      : EMPTY.t12TotalExpenses,
      // Broker contact — PipelineProperty only carries the first broker slot
      brokerPhone1:   deal.brokerPhone ?? EMPTY.brokerPhone1,
      brokerEmail1:   deal.brokerEmail ?? EMPTY.brokerEmail1,
      // Broker info from extraction
      brokerageName:  EMPTY.brokerageName,
    }
  }

  function handleSelectDeal(dealId: string) {
    setSelectedDealId(dealId)
    setShowDraftPrompt(false) // dismiss draft prompt when explicitly selecting
    setDraftData(null)
    // Reset all calculation results
    setProformaResult(null)
    setIrrResult(null)
    setWaterfallResult(null)
    setHasCalculated(false)
    setExcelOutputs(null)
    setExcelError('')
    setExcelElapsed(null)

    if (dealId === '' || dealId === '__new__') {
      // New Underwriting or blank selection — clear everything
      setInputs(EMPTY)
      try { localStorage.removeItem('yem_proforma_inputs') } catch { /* ignore */ }
      return
    }

    const deal = activeDeals.find(d => d.id === dealId)
    if (!deal) return

    const mapped = mapDealToProforma(deal)
    setInputs(mapped)
    // Save the mapped inputs to localStorage so LOI generation etc. can use them
    try { localStorage.setItem('yem_proforma_inputs', JSON.stringify(mapped)) } catch { /* ignore */ }
  }

  // ── Institutional Model (Excel Engine) ──────────────────────────────────
  async function handleRunInstitutionalModel() {
    setExcelRunning(true)
    setExcelError('')
    setExcelOutputs(null)
    setExcelElapsed(null)
    try {
      // ── Field mapping: ProformaInputs → /api/run-excel ─────────────────
      // Proforma stores percentages as strings like '7.25' (meaning 7.25%).
      // /api/run-excel expects decimals like 0.0725.
      // Occupancy stored as '82' meaning 82% → send 0.82.
      // LTV stored as '65' meaning 65% → send 0.65.
      const pct = (s: string, fallback = 0) => { const v = parseFloat(s); return isNaN(v) ? fallback : v / 100 }
      const num = (s: string, fallback = 0) => { const v = parseFloat(s); return isNaN(v) ? fallback : v }

      const body: Record<string, unknown> = {
        // Acquisition
        purchasePrice:         num(inputs.offerPrice),
        closingCostsPct:       pct(inputs.closingCostsPct),     // '3' → 0.03
        initialRepairs:        num(inputs.initialRepairs),
        acquisitionFeePct:     pct(inputs.acquisitionFeePct),   // '2' → 0.02
        // Operations
        startOccupancy:        pct(inputs.currentOccupancy),    // '82' → 0.82
        stabilizedOccupancy:   pct(inputs.targetOccupancy),     // '92' → 0.92
        monthsToStabilization: num(inputs.monthsToStabilization),
        annualRentGrowth:      pct(inputs.revenueGrowthPostStab), // '3' → 0.03
        opexGrowth:            pct(inputs.expenseGrowth),         // '3' → 0.03
        // Debt / refi / exit
        initialLTV:            pct(inputs.bridgeLTV),           // '65' → 0.65
        initialRate:           pct(inputs.bridgeRate),          // '8' → 0.08
        ioPeriodMonths:        num(inputs.bridgeGuaranteedIOMonths),
        refiMonth:             num(inputs.refiMonth),
        refiLTV:               pct(inputs.refiLTV),             // '70' → 0.70
        refiRate:              pct(inputs.refiRate),            // '6.5' → 0.065
        refiAmortYears:        num(inputs.refiAmortYears),
        exitCapRate:           pct(inputs.exitCapRate),         // '7.25' → 0.0725
        exitMonth:             num(inputs.exitMonth),
        sellingCostsPct:       pct(inputs.brokerFeePct),        // '3' → 0.03
        // Waterfall
        preferredReturn:       pct(inputs.lpPreferredReturn),   // '8' → 0.08
        residualSplitLP:       pct(inputs.lpSplit),             // '85' → 0.85
        residualSplitGP:       pct(inputs.gpSplit),             // '15' → 0.15
        // Levered / unlevered toggle
        unlevered:             leverageType === 'all-cash',
        // T12 operating expenses (stored as dollar strings)
        t12Tax:                num(inputs.t12Tax),
        t12Insurance:          num(inputs.t12Insurance),
        t12Utilities:          num(inputs.t12Utilities),
        t12RepairsMaintenance: num(inputs.t12RepairsMaintenance),
        t12Payroll:            num(inputs.t12Payroll),
        t12OfficeEmployee:     num(inputs.t12OfficeEmployee),
        t12Marketing:          num(inputs.t12Marketing),
        t12Administrative:     num(inputs.t12Administrative),
        t12OtherExpenses:      num(inputs.t12OtherExpenses),
      }

      const res = await fetch('/api/run-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      const data = await res.json() as {
        ok?: boolean; elapsed_ms?: number;
        outputs?: Record<string, number | string | boolean | null>
        error?: string; detail?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.detail ?? data.error ?? `HTTP ${res.status}`)
      }
      setExcelOutputs(data.outputs ?? {})
      setExcelElapsed(data.elapsed_ms ?? null)
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : String(err))
    } finally {
      setExcelRunning(false)
    }
  }

  async function handleCalculate(anchorOverride?: string, inputOverrides?: Partial<ProformaInputs>) {
    setCalculating(true)
    setCalcError('')
    // Determine if this call is explicitly using an exit price override
    const overrideHasExitPrice = !!(inputOverrides?.exitSalePrice && inputOverrides.exitSalePrice !== '')
    // Always clear stale exit sale price from state and force cap rate as default
    if (!overrideHasExitPrice) {
      set('exitSalePrice', '')
      setExitDriver('caprate')
    }
    // Build effectiveInputs — force exitSalePrice to '' unless explicitly overriding
    const effectiveInputs = {
      ...inputs,
      ...(inputOverrides ?? {}),
      exitSalePrice: overrideHasExitPrice ? (inputOverrides?.exitSalePrice ?? '') : '',
    }
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
        rent_growth:          0.04,
        opex_growth:          0.02,
        tax_insurance_growth: 0.02,
        mgmt_fee_pct:         0.05,
        revenue_haircut:      n(revenueHaircut) / 100,
        occ_schedule: (() => {
          // Ramp linearly from current occupancy to target over monthsToStabilization.
          // After stabilization, hold at target. Never exceed target.
          const current = n(inputs.currentOccupancy, 70) / 100
          const target = n(inputs.targetOccupancy, 90) / 100
          const stabMonths = n(inputs.monthsToStabilization, 24)
          const years = [1, 2, 3, 4, 5]
          return years.map(yr => {
            const monthsElapsed = yr * 12
            if (stabMonths <= 0) return target
            const progress = Math.min(monthsElapsed / stabMonths, 1)
            return Math.min(current + progress * (target - current), target)
          })
        })(),
      }

      const sellerYearsData = [
        inputs.sellerY1, inputs.sellerY2, inputs.sellerY3, inputs.sellerY4, inputs.sellerY5
      ].map(sy => ({
        revenue: n(sy.revenue),
        expenses: n(sy.expenses),
        noi: n(sy.noi),
      })).filter(sy => sy.revenue > 0 || sy.noi > 0)

      const t12DataWithSeller = {
        ...t12Data,
        seller_years: sellerYearsData,
      }

      const proformaRes = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build-proforma', t12_data: t12DataWithSeller, assumptions }),
      })
      if (!proformaRes.ok) throw new Error('Proforma build failed')
      const proformaData: ProformaResult = await proformaRes.json()
      setProformaResult(proformaData)
      setOurYears(proformaData.years)

      const activeAnchor = anchorOverride ?? maxOfferAnchor
      const y1NOI = proformaData.years[0]?.noi ?? 0
      const y5NOI = proformaData.years[4]?.noi ?? y1NOI
      // Exit NOI: interpolate based on actual hold period months, not hardcoded Y5
      const exitMonthVal = n(effectiveInputs.exitMonth, 60)
      const exitYearExact = exitMonthVal / 12
      const exitLowerIdx = Math.max(0, Math.floor(exitYearExact) - 1)
      const exitUpperIdx = Math.min(proformaData.years.length - 1, exitLowerIdx + 1)
      const exitFrac = exitYearExact - Math.floor(exitYearExact)
      const exitLowerNOI = proformaData.years[exitLowerIdx]?.noi ?? y1NOI
      const exitUpperNOI = proformaData.years[exitUpperIdx]?.noi ?? exitLowerNOI
      const exitNOI = exitLowerIdx === exitUpperIdx ? exitLowerNOI : exitLowerNOI + exitFrac * (exitUpperNOI - exitLowerNOI)
      const t12NOIval = n(inputs.t12NOI) || proformaData.t12.noi
      const manualNOIval = n(inputs.manualNOI)

      let anchorNOI = y1NOI
      if (activeAnchor === 't12') anchorNOI = t12NOIval
      else if (activeAnchor === 'stabilized') anchorNOI = y5NOI
      else if (activeAnchor === 'manual' && manualNOIval > 0) anchorNOI = manualNOIval

      const offerPriceVal = n(inputs.offerPrice)
      const exitSalePriceVal = n(effectiveInputs.exitSalePrice)

      const exitCapVal = n(effectiveInputs.exitCapRate, 7.25) / 100
      const capRateExitValue = exitCapVal > 0 ? exitNOI / exitCapVal : offerPriceVal
      // exitDriver tracks which was touched last — cap rate field or override button
      const exitValue = (exitSalePriceVal > 0 && exitDriver === 'override') ? exitSalePriceVal : capRateExitValue

      let loanAmount = 0
      if (leverageType === 'levered') {
        if (loanType === 'bridge-to-perm') {
          loanAmount = offerPriceVal * (n(inputs.bridgeLTV, 65) / 100)
        } else {
          loanAmount = offerPriceVal * (n(inputs.permLTV, 65) / 100)
        }
      }

      const breakdown = computeEquityBreakdown(inputs, loanAmount, leverageType)
      setEquityBreakdown(breakdown)

      if (offerPriceVal > 0) {
        const noiYears = proformaData.years.map((y: OurYear) => y.noi)

        const ltv = leverageType === 'levered'
          ? (loanType === 'bridge-to-perm' ? n(inputs.bridgeLTV, 65) / 100 : n(inputs.permLTV, 65) / 100)
          : 0
        const rate = leverageType === 'levered'
          ? (loanType === 'bridge-to-perm' ? n(inputs.bridgeRate, 8) / 100 : n(inputs.permRate, 6.5) / 100)
          : 0
        const amortYears = leverageType === 'levered'
          ? (loanType === 'bridge-to-perm' ? 30 : Math.round(n(inputs.permAmortYears, 30)))
          : 30
        const ioMonths = leverageType === 'levered'
          ? (loanType === 'bridge-to-perm' ? Math.round(n(inputs.bridgeTerm, 24)) : Math.round(n(inputs.permIOMonths, 0)))
          : 0

        const irrBody = {
          action: 'calc-irr-v2',
          purchase_price: offerPriceVal,
          noi_years: noiYears,
          exit_cap_rate: exitCapVal,
          exit_month: n(effectiveInputs.exitMonth, 60),
          exit_value_override: (exitSalePriceVal > 0 && exitDriver === 'override') ? exitSalePriceVal : null,
          selling_costs_pct: 0.02,
          closing_costs_pct: n(inputs.closingCostsPct, 3) / 100,
          acquisition_fee_pct: n(inputs.acquisitionFeePct, 2) / 100,
          initial_repairs: n(inputs.initialRepairs),
          ltv,
          interest_rate: rate,
          amort_years: amortYears,
          io_months: ioMonths,
          // Refi params — only sent when bridge-to-perm
          refi_month: loanType === 'bridge-to-perm' ? n(inputs.refiMonth, 36) : null,
          refi_ltv: loanType === 'bridge-to-perm' ? n(inputs.refiLTV, 70) / 100 : null,
          refi_rate: loanType === 'bridge-to-perm' ? n(inputs.refiLoanRate, 6) / 100 : null,
          refi_amort_years: 30,
          refi_dscr: loanType === 'bridge-to-perm' ? n(inputs.refiDSCR, 1.30) : null,
          refi_fee_pct: loanType === 'bridge-to-perm' ? n(inputs.refiFeePct, 1) / 100 : null,
        }

        const irrRes = await fetch('/api/underwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(irrBody),
        })
        if (irrRes.ok) {
          const irrData = await irrRes.json()
          setIrrResult({
            irr_at_max: irrData.levered_irr ?? 0,
            levered_irr: leverageType === 'levered' ? (irrData.levered_irr ?? 0) : (irrData.unlevered_irr ?? 0),
            unlevered_irr: irrData.unlevered_irr ?? 0,
            equity_multiple: irrData.equity_multiple ?? 0,
            equity_required: breakdown.total,
            loan_amount: loanAmount,
            annual_debt_service: irrData.annual_debt_service ?? 0,
            going_in_cap: irrData.going_in_cap ?? 0,
            stabilized_cap: irrData.stabilized_cap ?? 0,
            target_irr: 0,
            in_place_noi: anchorNOI,
            stabilized_noi: y5NOI,
            method: '',
            exit_value: irrData.exit_value ?? Math.round(exitValue),
          })

          const wf = computeWaterfall(inputs, breakdown, exitValue, loanAmount, leverageType, loanType, noiYears)
          setWaterfallResult(wf)
        }
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
    const offerPriceVal = n(inputs.offerPrice)
    const bridgeLoan = leverageType !== 'all-cash'
      ? Math.round(offerPriceVal * (n(inputs.bridgeLTV, 65) / 100))
      : 0
    const annualInterest = bridgeLoan * (n(inputs.bridgeRate, 8) / 100)
    const lpEquityTotal = equityBreakdown?.total ?? 0
    const y3NOI = ourYears[2]?.noi ?? 0
    const y5NOI = ourYears[4]?.noi ?? 0
    const y3Cap = offerPriceVal > 0 ? ((y3NOI / offerPriceVal) * 100).toFixed(2) : ''
    const pfCap = offerPriceVal > 0 ? ((y5NOI / offerPriceVal) * 100).toFixed(2) : ''

    const b1 = inputs.broker1Name?.split(' ')[0] ?? ''
    const b2 = inputs.broker2Name?.split(' ')[0] ?? ''
    const salutation = b1 && b2 ? `Dear ${b1} and ${b2},` : b1 ? `Dear ${b1},` : ''

    const waterfall = `${n(inputs.lpPreferredReturn, 8)}% preferred return to LP, then ${inputs.lpSplit}/${inputs.gpSplit} split (LP/GP)`

    const data = {
      propertyName: inputs.propertyName,
      address: inputs.address,
      city: inputs.city,
      state: inputs.state,
      msaName: inputs.msaName,
      dealType: inputs.dealType,
      units: inputs.totalUnits,
      sf: inputs.totalSF,
      yearBuilt: inputs.yearBuilt,
      occupancy: inputs.currentOccupancy ? `${inputs.currentOccupancy}%` : '',
      currentAvgRent: inputs.currentAvgRent,
      marketAvgRent: inputs.marketAvgRent,
      monthsToStabilization: inputs.monthsToStabilization,
      broker1Name: inputs.broker1Name,
      broker2Name: inputs.broker2Name,
      brokerPhone1: inputs.brokerPhone1,
      brokerPhone2: inputs.brokerPhone2,
      brokerEmail1: inputs.brokerEmail1,
      brokerEmail2: inputs.brokerEmail2,
      brokerageName: inputs.brokerageName,
      salutation,
      offerPrice: inputs.offerPrice,
      allInCost: String(Math.round(offerPriceVal + lpEquityTotal)),
      bridgeLoan: String(bridgeLoan),
      bridgeRate: inputs.bridgeRate,
      annualDS: String(Math.round(annualInterest)),
      interestReserve: String(Math.round(annualInterest)),
      capexReserve: inputs.capexReserve,
      gpFeeTotal: String(Math.round(offerPriceVal * (n(inputs.acquisitionFeePct, 2) / 100))),
      gpFeePct: inputs.acquisitionFeePct,
      lpEquity: String(Math.round(lpEquityTotal)),
      waterfall,
      goingInCap: irrResult ? (irrResult.going_in_cap * 100).toFixed(2) : '',
      yr3Cap: y3Cap,
      pfCap: pfCap,
      exitCap: inputs.exitCapRate,
      lpMOIC: waterfallResult ? waterfallResult.lpMOIC.toFixed(2) : '',
      lpIRR: irrResult ? ((irrResult.levered_irr ?? irrResult.unlevered_irr ?? 0) * 100).toFixed(1) : '',
      gpMOIC: waterfallResult ? waterfallResult.gpMOIC.toFixed(2) : '',
      gpIRR: irrResult ? ((irrResult.levered_irr ?? irrResult.unlevered_irr ?? 0) * 100).toFixed(1) : '',
      emd: String(Math.round(offerPriceVal * 0.01)),
      ddDays: '30-45',
      closingDays: '30-45',
      t12NOI: inputs.t12NOI,
      year1NOI: String(Math.round(ourYears[0]?.noi ?? 0)),
      year2NOI: String(Math.round(ourYears[1]?.noi ?? 0)),
      year3NOI: String(Math.round(y3NOI)),
      year5NOI: String(Math.round(y5NOI)),
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
            Enter your offer price and see your actual IRR, equity required, and GP/LP waterfall.
          </p>
        </section>

        {/* ── Deal Banner: dropdown + identity + draft prompt ──────────── */}
        <div className="border-b border-dark-border bg-dark-surface">
          <div className="section-container max-w-4xl">

            {/* Row 1: Deal dropdown + New Underwriting */}
            <div className="flex items-center gap-3 py-3 border-b border-dark-border/50">
              <span className="text-[0.6rem] uppercase tracking-widest text-dark-muted flex-shrink-0">
                Deal
              </span>
              <select
                value={selectedDealId}
                onChange={e => handleSelectDeal(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border border-dark-border text-sm
                  text-dark-primary px-3 py-1.5 focus:outline-none focus:border-gold
                  transition-colors cursor-pointer"
              >
                <option value="">— Select a deal to underwrite —</option>
                {activeDeals.map(deal => (
                  <option key={deal.id} value={deal.id}>
                    {[
                      deal.facilityName,
                      [deal.city, deal.state].filter(Boolean).join(', '),
                      deal.stage ? `(${deal.stage})` : '',
                    ].filter(Boolean).join(' — ')}
                  </option>
                ))}
                <option value="__new__">── New Underwriting ──</option>
              </select>
              {activeDeals.length === 0 && (
                <span className="text-xs text-dark-muted flex-shrink-0">No active deals in pipeline</span>
              )}
            </div>

            {/* Row 2: Identity line — shows current loaded deal or blank state */}
            <div className="flex items-center justify-between py-2.5 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[0.6rem] uppercase tracking-widest flex-shrink-0 ${
                  (inputs.propertyName || inputs.address) ? 'text-gold' : 'text-dark-muted'
                }`}>
                  {(inputs.propertyName || inputs.address) ? 'Loaded' : 'Empty'}
                </span>
                <span className="text-xs text-dark-primary truncate">
                  {inputs.propertyName || inputs.address
                    ? [
                        inputs.propertyName,
                        [inputs.city, inputs.state].filter(Boolean).join(', '),
                        inputs.offerPrice ? `$${Number(inputs.offerPrice).toLocaleString()}` : '',
                      ].filter(Boolean).join(' — ')
                    : 'No deal loaded — select above or fill in manually'}
                </span>
              </div>
              <button
                onClick={() => handleSelectDeal('__new__')}
                className="flex-shrink-0 text-[0.6rem] uppercase tracking-widest border px-3 py-1
                  transition-colors border-dark-border text-dark-muted hover:border-gold hover:text-gold"
              >
                Clear
              </button>
            </div>

            {/* Row 3: Draft resume prompt — only shown when a draft exists and no deal selected */}
            {showDraftPrompt && draftData && (
              <div className="flex items-center justify-between gap-4 py-2.5 border-t border-dark-border/50
                bg-amber-50/80 px-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[0.6rem] uppercase tracking-widest text-amber-700 flex-shrink-0">
                    Unsaved Draft
                  </span>
                  <span className="text-xs text-amber-800 truncate">
                    {[
                      draftData.propertyName,
                      draftData.address,
                      [draftData.city, draftData.state].filter(Boolean).join(', '),
                    ].filter(Boolean).join(' — ') || 'Draft with no property name'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setInputs(prev => ({ ...prev, ...draftData }))
                      setShowDraftPrompt(false)
                      setDraftData(null)
                    }}
                    className="text-[0.6rem] uppercase tracking-widest border border-amber-600
                      text-amber-700 px-3 py-1 hover:bg-amber-100 transition-colors"
                  >
                    Resume Draft
                  </button>
                  <button
                    onClick={() => {
                      setShowDraftPrompt(false)
                      setDraftData(null)
                      setInputs(EMPTY)
                      try { localStorage.removeItem('yem_proforma_inputs') } catch { /* ignore */ }
                    }}
                    className="text-[0.6rem] uppercase tracking-widest border border-dark-border
                      text-dark-muted px-3 py-1 hover:border-gold hover:text-gold transition-colors"
                  >
                    Start Fresh
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        <section className="py-14">
          <div className="section-container max-w-4xl space-y-10">

            {/* Deal Type */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Deal Type" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['value-add', 'stabilized', 'distressed'] as DealType[]).map(dt => (
                  <button key={dt} onClick={() => set('dealType', dt)}
                    className={`p-4 border text-left transition-colors duration-150 ${inputs.dealType === dt ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}>
                    <div className={`text-sm font-semibold mb-1 ${inputs.dealType === dt ? 'text-gold' : 'text-[#1B2B5E]'}`}>{DEAL_TYPE_LABELS[dt]}</div>
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

            {/* Leverage Toggle */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Financing Structure" subtitle="Select how this deal will be capitalized" />
              <div className="space-y-6">
                <Toggle
                  label="Leverage"
                  value={leverageType}
                  onChange={v => setLeverageType(v as LeverageType)}
                  options={[
                    { value: 'all-cash', label: 'All Cash', desc: 'Unlevered — no debt' },
                    { value: 'levered', label: 'Levered', desc: 'Debt financing' },
                  ]}
                />
                {leverageType === 'levered' && (
                  <Toggle
                    label="Loan Type"
                    value={loanType}
                    onChange={v => setLoanType(v as LoanType)}
                    options={[
                      { value: 'bridge-to-perm', label: 'Bridge to Perm', desc: 'Value-add / lease-up' },
                      { value: 'permanent', label: 'Permanent Loan', desc: 'Stabilized asset' },
                    ]}
                  />
                )}
              </div>
            </div>

            {/* Bridge Loan Inputs */}
            {leverageType === 'levered' && loanType === 'bridge-to-perm' && (
              <div className="border border-dark-border p-7">
                <SectionHead title="Bridge Loan" subtitle="Short-term acquisition financing — IO with prepaid interest" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <Field label="Bridge LTV" value={inputs.bridgeLTV} onChange={v => set('bridgeLTV', v)} suffix="% of purchase price" step="1" />
                  <Field label="Bridge Rate" value={inputs.bridgeRate} onChange={v => set('bridgeRate', v)} suffix="% annual" step="0.25" />
                  <Field label="Bridge Term" value={inputs.bridgeTerm} onChange={v => set('bridgeTerm', v)} suffix="months" step="6" />
                  <Field label="Extension Options" value={inputs.bridgeExtensions} onChange={v => set('bridgeExtensions', v)} suffix="× 6-month options" step="1" note="e.g. 2 = up to 12 extra months" />
                  <Field label="Guaranteed IO Months" value={inputs.bridgeGuaranteedIOMonths} onChange={v => set('bridgeGuaranteedIOMonths', v)} suffix="months" step="1" note="Minimum IO commitment" />
                  <Field label="Prepaid Interest Months" value={inputs.bridgePrepaidInterestMonths} onChange={v => set('bridgePrepaidInterestMonths', v)} suffix="months" step="1" note="Funded by LP at closing as a closing cost" />
                </div>
                <SectionHead title={`Refinance Settings`} subtitle="Perm loan sized by DSCR test on the NOI for the year of the refi month — pays off bridge" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Refi Month" value={inputs.refiMonth} onChange={v => set('refiMonth', v)} suffix="mo" step="6" note={`Bridge runway: ${n(inputs.bridgeTerm,24)+n(inputs.bridgeExtensions,0)*6} mo. Refi can happen any month.`} />
                  <Field label="Refi Cap Rate (valuation)" value={inputs.refiCapRate} onChange={v => set('refiCapRate', v)} suffix="%" step="0.25" note="NOI for that year ÷ this = stabilized value" />
                  <Field label="Min DSCR" value={inputs.refiDSCR} onChange={v => set('refiDSCR', v)} suffix="x" step="0.05" note="1.30x standard" />
                  <Field label="Perm Loan Rate (IO)" value={inputs.refiLoanRate} onChange={v => set('refiLoanRate', v)} suffix="%" step="0.25" note="Max loan = refi month NOI ÷ DSCR ÷ rate" />
                  <Field label="LTV Cap" value={inputs.refiLTV} onChange={v => set('refiLTV', v)} suffix="% of stabilized value" step="1" note="Takes lower of LTV or DSCR" />
                  <div>
                    <label className="label-text">GP Refi Fee</label>
                    <div className="flex gap-2 mt-1">
                      {([['1', '1 Point'], ['0.75', '75 bps'], ['0.5', '50 bps'], ['0', 'None']] as const).map(([val, label]) => (
                        <button key={val} onClick={() => set('refiFeePct', val)}
                          className={`flex-1 p-2.5 border text-left transition-colors ${inputs.refiFeePct === val ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}>
                          <div className={`text-sm font-semibold ${inputs.refiFeePct === val ? 'text-gold' : 'text-[#1B2B5E]'}`}>{label}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-dark-muted mt-1">Paid to GP at refi close</p>
                  </div>
                </div>
              </div>
            )}

            {/* Permanent Loan Inputs */}
            {leverageType === 'levered' && loanType === 'permanent' && (
              <div className="border border-dark-border p-7">
                <SectionHead title="Permanent Loan" subtitle="Long-term financing on stabilized asset" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="LTV" value={inputs.permLTV} onChange={v => set('permLTV', v)} suffix="%" step="1" />
                  <Field label="Interest Rate" value={inputs.permRate} onChange={v => set('permRate', v)} suffix="%" step="0.25" />
                  <Field label="Amortization" value={inputs.permAmortYears} onChange={v => set('permAmortYears', v)} suffix="years" step="1" />
                  <Field label="IO Period" value={inputs.permIOMonths} onChange={v => set('permIOMonths', v)} suffix="months (optional)" step="6" />
                </div>
              </div>
            )}

            {/* Closing Costs */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Closing Costs & Reserves" subtitle="All funded by LP — shown as line items in equity required" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Closing Costs" value={inputs.closingCostsPct} onChange={v => set('closingCostsPct', v)} suffix="% of purchase" step="0.25" />
                <Field label="Broker Fee" value={inputs.brokerFeePct} onChange={v => set('brokerFeePct', v)} suffix="% of purchase" step="0.25" />
                <Field label="Acquisition Fee (GP)" value={inputs.acquisitionFeePct} onChange={v => set('acquisitionFeePct', v)} suffix="% of purchase" step="0.25" note="Paid to GP at closing" />
                <Field label="Initial Repairs" value={inputs.initialRepairs} onChange={v => set('initialRepairs', v)} suffix="$" placeholder="50000" />
                <Field label="Lease-Up Reserve" value={inputs.leaseUpReserve} onChange={v => set('leaseUpReserve', v)} suffix="$" placeholder="100000" />
                <Field label="Working Capital" value={inputs.workingCapital} onChange={v => set('workingCapital', v)} suffix="$" placeholder="50000" />
                <Field label="CapEx Reserve" value={inputs.capexReserve} onChange={v => set('capexReserve', v)} suffix="$" placeholder="0" />
              </div>
              {leverageType === 'levered' && loanType === 'bridge-to-perm' && (
                <div className="mt-5 pt-5 border-t border-dark-border/50">
                  <div className="text-sm uppercase tracking-widest text-dark-muted font-medium mb-3">Interest Reserve Funding</div>
                  <p className="text-sm text-dark-muted mb-4">Year 1 is always funded at closing. Years 2 and 3 are typically covered by operations as the property leases up.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm uppercase tracking-widest text-[#1B2B5E] font-medium mb-2">Year 2 Interest Reserve</div>
                      <div className="flex gap-2">
                        {(['operations', 'closing'] as const).map(src => (
                          <button key={src} onClick={() => setInputs(p => ({ ...p, interestReserveY2Source: src }))}
                            className={`flex-1 p-3 border text-left transition-colors ${inputs.interestReserveY2Source === src ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}>
                            <div className={`text-sm font-semibold ${inputs.interestReserveY2Source === src ? 'text-gold' : 'text-[#1B2B5E]'}`}>
                              {src === 'operations' ? 'From Operations' : 'Fund at Closing'}
                            </div>
                            <div className="text-sm text-dark-muted">{src === 'operations' ? 'Contingency only' : 'Added to LP equity'}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm uppercase tracking-widest text-[#1B2B5E] font-medium mb-2">Year 3 Interest Reserve</div>
                      <div className="flex gap-2">
                        {(['operations', 'closing'] as const).map(src => (
                          <button key={src} onClick={() => setInputs(p => ({ ...p, interestReserveY3Source: src }))}
                            className={`flex-1 p-3 border text-left transition-colors ${inputs.interestReserveY3Source === src ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}>
                            <div className={`text-sm font-semibold ${inputs.interestReserveY3Source === src ? 'text-gold' : 'text-[#1B2B5E]'}`}>
                              {src === 'operations' ? 'From Operations' : 'Fund at Closing'}
                            </div>
                            <div className="text-sm text-dark-muted">{src === 'operations' ? 'Contingency only' : 'Added to LP equity'}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GP/LP Waterfall Settings */}
            <div className="border border-dark-border p-7">
              <SectionHead title="GP / LP Structure" subtitle="LP funds 100% of equity — GP invests $0" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="LP Preferred Return" value={inputs.lpPreferredReturn} onChange={v => set('lpPreferredReturn', v)} suffix="% annual" step="0.5" note="LP gets this before split" />
                <Field label="LP Split (after pref)" value={inputs.lpSplit} onChange={v => set('lpSplit', v)} suffix="%" step="5" />
                <Field label="GP Split (after pref)" value={inputs.gpSplit} onChange={v => set('gpSplit', v)} suffix="%" step="5" />
              </div>
              <div className="mt-4 p-4 bg-dark-surface border border-dark-border/50 text-sm text-dark-muted">
                <strong className="text-[#1B2B5E]">Waterfall order:</strong> ① LP gets 100% of invested capital back → ② LP gets {inputs.lpPreferredReturn}% preferred return → ③ Remaining split {inputs.lpSplit}% LP / {inputs.gpSplit}% GP. GP also earns {inputs.acquisitionFeePct}% acquisition fee at closing{leverageType === 'levered' && loanType === 'bridge-to-perm' ? ` and ${inputs.refiFeePct}% refi fee at refinance` : ''}.
              </div>
            </div>

            {/* Historical Data */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Historical Data" subtitle="Auto-populated from OM extraction" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="label-text">T-12 NOI <span className="text-dark-muted text-xs">(from OM)</span></label>
                  <div className="input-field bg-dark-surface/50 text-[#1B2B5E] font-semibold">{inputs.t12NOI ? '$' + Number(inputs.t12NOI).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <label className="label-text">T-3 NOI <span className="text-dark-muted text-xs">(annualized, from OM)</span></label>
                  <div className="input-field bg-dark-surface/50 text-[#1B2B5E] font-semibold">{inputs.t3NOI ? '$' + Number(inputs.t3NOI).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <label className="label-text">Current Occupancy <span className="text-dark-muted text-xs">(from OM)</span></label>
                  <div className="input-field bg-dark-surface/50 text-[#1B2B5E] font-semibold">{inputs.t12Occupancy ? inputs.t12Occupancy + '%' : '—'}</div>
                </div>
              </div>
            </div>

            {/* Unit Economics */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Unit Economics & Value-Add Levers" subtitle="Occupancy uplift + rent-to-market = core value-add thesis" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Total Units" value={inputs.totalUnits} onChange={v => set('totalUnits', v)} />
                <Field label="Current Occupancy" value={inputs.currentOccupancy} onChange={v => set('currentOccupancy', v)} suffix="%" note="Where the property is today" />
                <Field label="Target Occupancy" value={inputs.targetOccupancy} onChange={v => set('targetOccupancy', v)} suffix="%" note="Stabilized target" />
                <Field label="Months to Stabilization" value={inputs.monthsToStabilization} onChange={v => set('monthsToStabilization', v)} suffix="mo" />
                <Field label="Current Avg Rent/Unit" value={inputs.currentAvgRent} onChange={v => set('currentAvgRent', v)} suffix="$/mo" note="What tenants pay today" />
                <Field label="Market Avg Rent/Unit" value={inputs.marketAvgRent} onChange={v => set('marketAvgRent', v)} suffix="$/mo" note="What the market supports" />
              </div>
              {inputs.currentAvgRent && inputs.marketAvgRent && (
                <div className="mt-4 p-4 bg-gold/5 border border-gold/30">
                  <div className="section-label-sm text-gold mb-2">Value-Add Rent Upside</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-dark-muted text-sm">Rent Gap / Unit</div>
                      <div className="font-semibold text-[#1B2B5E]">{fmt$(n(inputs.marketAvgRent) - n(inputs.currentAvgRent))}/mo</div>
                    </div>
                    <div>
                      <div className="text-dark-muted text-sm">Upside at Stabilization</div>
                      <div className="font-semibold text-[#1B2B5E]">
                        {inputs.totalUnits
                          ? fmt$((n(inputs.marketAvgRent) - n(inputs.currentAvgRent)) * n(inputs.totalUnits) * 12) + '/yr'
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-dark-muted text-sm">Rent Uplift</div>
                      <div className="font-semibold text-[#1B2B5E]">
                        {n(inputs.currentAvgRent) > 0
                          ? fmtPct((n(inputs.marketAvgRent) - n(inputs.currentAvgRent)) / n(inputs.currentAvgRent))
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Growth Assumptions */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Growth Assumptions" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Revenue Growth (post-stab)" value={inputs.revenueGrowthPostStab} onChange={v => set('revenueGrowthPostStab', v)} suffix="% / yr" step="0.5" />
                <Field label="Expense Growth" value={inputs.expenseGrowth} onChange={v => set('expenseGrowth', v)} suffix="% / yr" step="0.5" />
              </div>
            </div>

            {/* Exit & Offer Price */}
            <div className="border border-dark-border p-7">
              <SectionHead title="Exit & Offer Price" subtitle="Exit defaults to Year 5 NOI ÷ exit cap rate — enter offer price to see your IRR" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Exit Cap Rate" value={inputs.exitCapRate} onChange={v => { set('exitCapRate', v); set('exitSalePrice', ''); setExitDriver('caprate'); if (hasCalculated) setTimeout(() => handleCalculate(undefined, { exitCapRate: v, exitSalePrice: '' }), 50) }} suffix="%" step="0.25" />
                <Field label="Hold Period" value={inputs.exitMonth} onChange={v => { set('exitMonth', v); if (hasCalculated) setTimeout(() => handleCalculate(undefined, { exitMonth: v }), 50) }} suffix="mo" />
                <div className="md:col-span-2">
                  <label className="label-text">Your Offer Price <span className="text-gold text-sm">(enter to see your IRR)</span></label>
                  <input className="input-field border-gold/50" type="number" step="any" value={inputs.offerPrice}
                    onChange={e => set('offerPrice', e.target.value)} placeholder="e.g. 4250000" />
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <div className="pt-2">
              {calcError && <div className="mb-4 p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">{calcError}</div>}
              <div className="mb-6">
                <label className="label-text mb-2 block">Anchor NOI to</label>
                <div className="flex gap-2 flex-wrap">
                  {([['t12', 'T-12 NOI', 'Conservative'], ['y1', 'Year 1 NOI', 'Base case'], ['stabilized', 'Stabilized NOI', 'Aggressive'], ['manual', 'Manual NOI', 'Custom']] as const).map(([val, label, desc]) => (
                    <button key={val} onClick={() => { setMaxOfferAnchor(val); if (hasCalculated) handleCalculate(val); }}
                      className={`flex-1 p-3 border text-left transition-colors duration-150 min-w-[110px] ${maxOfferAnchor === val ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}`}>
                      <div className={`text-sm font-semibold mb-0.5 ${maxOfferAnchor === val ? 'text-gold' : 'text-[#1B2B5E]'}`}>{label}</div>
                      <div className="text-sm text-dark-muted">{desc}</div>
                    </button>
                  ))}
                </div>
                {maxOfferAnchor === 'manual' && (
                  <div className="mt-3 max-w-xs">
                    <Field label="Manual NOI ($)" value={inputs.manualNOI} onChange={v => set('manualNOI', v)} note="Type any NOI to anchor your analysis" />
                  </div>
                )}
              </div>
              <button onClick={() => handleCalculate()} disabled={calculating}
                className="btn-gold disabled:opacity-60 text-base px-10 py-4 w-full md:w-auto">
                {calculating ? 'Calculating...' : 'Build Proforma & Calculate'}
              </button>
              <button
                onClick={handleRunInstitutionalModel}
                disabled={excelRunning || !inputs.offerPrice}
                className="px-8 py-4 border border-gold text-gold text-sm uppercase tracking-widest hover:bg-gold/10 transition-colors disabled:opacity-40 w-full md:w-auto"
              >
                {excelRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />
                    Running Model...
                  </span>
                ) : 'Run Institutional Model'}
              </button>
            </div>

            {hasCalculated && ourYears.length > 0 && (
              <div className="space-y-8">

                {proformaResult?.broker_years && proformaResult.broker_years.length > 0 && (
                  <div className="border border-dark-border p-7">
                    <SectionHead title="Chart 1 — Broker OM (CBRE)" subtitle="Seller's projected numbers exactly as presented — no adjustments" />
                    <ProformaTable proformaResult={{ ...proformaResult, years: proformaResult.broker_years }} />
                  </div>
                )}

                <div className="border border-dark-border p-7">
                  <SectionHead title="Chart 2 — Our Underwrite" subtitle={`CBRE revenue haircutted ${revenueHaircut}% — grown at 4% / yr. Expenses grown at 2% / yr.`} />
                  {proformaResult && <ProformaTable proformaResult={proformaResult} />}
                </div>

                {hasSeller && proformaResult && (
                  <div className="border border-dark-border p-7">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <SectionHead title="Broker vs Investor Analysis" subtitle="OM projections vs your conservative underwrite" />
                      </div>
                      <div className="flex items-center gap-2 ml-6 mt-1">
                        <label className="text-sm uppercase tracking-widest text-dark-muted whitespace-nowrap">Revenue Haircut</label>
                        <input className="input-field text-sm w-16" type="number" step="1" min="0" max="30"
                          value={revenueHaircut} onChange={e => setRevenueHaircut(e.target.value)} />
                        <span className="text-dark-muted text-sm">%</span>
                      </div>
                    </div>
                    <BrokerInvestorTable proformaResult={proformaResult} sellerYears={sellerYears} revenueHaircut={n(revenueHaircut) / 100} capRates={capRates} />
                  </div>
                )}

                <div className="border border-dark-border p-7">
                  <SectionHead title="Offer Matrix" subtitle="Our NOI ÷ cap rate — adjust cap rates to match your market" />
                  <div className="flex gap-3 mb-4 flex-wrap">
                    {capRates.map((cr, i) => (
                      <div key={i} style={{ width: 100 }}>
                        <label className="label-text">Cap Rate {i + 1}</label>
                        <div className="flex items-center">
                          <input className="input-field text-sm" type="number" step="0.25" value={cr} onChange={e => setCapRate(i, e.target.value)} />
                          <span className="text-dark-muted text-sm ml-1">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-base">
                      <thead>
                        <tr className="border-b border-dark-border">
                          <th className="text-left text-sm uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4 w-28">NOI Year</th>
                          <th className="text-right text-base uppercase tracking-widest text-dark-muted font-normal pb-3 px-3">Our NOI</th>
                          {capRates.map((cr, i) => (
                            <th key={i} className="text-right text-base uppercase tracking-widest text-gold font-semibold pb-3 px-3">{cr}% Cap</th>
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
                            <td className="py-3 pr-4 text-sm uppercase tracking-widest text-dark-muted font-medium">{label as string}</td>
                            <td className="py-3 px-3 text-right font-semibold text-[#1B2B5E]">${Math.round(noi as number).toLocaleString()}</td>
                            {capRates.map((cr, i) => {
                              const cap = parseFloat(cr) / 100
                              const offer = cap > 0 ? Math.round((noi as number) / cap) : 0
                              return (
                                <td key={i} className="py-3 px-3 text-right">
                                  <span className="font-semibold text-[#1B2B5E]">${offer > 0 ? offer.toLocaleString() : '—'}</span>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="Exit Value" subtitle="Default exit = Year 5 NOI ÷ exit cap rate. Click to override." />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {capRates.map((cr, i) => {
                      const cap = parseFloat(cr) / 100
                      const y5NOI = ourYears[4]?.noi ?? 0
                      const exitVal = cap > 0 ? Math.round(y5NOI / cap) : 0
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            set('exitSalePrice', String(exitVal))
                            setExitDriver('override')
                            setTimeout(() => handleCalculate(), 50)
                          }}
                          disabled={!inputs.offerPrice || calculating}
                          className={`border p-4 text-left transition-colors duration-150 w-full
                            ${inputs.exitSalePrice === String(exitVal) ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/40'}
                            disabled:opacity-50 disabled:cursor-default`}
                        >
                          <div className="text-sm uppercase tracking-widest text-dark-muted mb-1">Exit at {cr}% Cap</div>
                          <div className="font-semibold text-[#1B2B5E] text-lg">${exitVal.toLocaleString()}</div>
                          <div className="text-sm text-dark-muted mt-1">Y5 NOI: ${(ourYears[4]?.noi ?? 0).toLocaleString()}</div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="max-w-sm">
                    <label className="label-text">Override Exit Sale Price <span className="text-gold text-sm">(optional)</span></label>
                    <div className="flex gap-2 items-center">
                      <input className="input-field border-gold/50 flex-1" type="number" step="any" value={inputs.exitSalePrice}
                        onChange={e => { set('exitSalePrice', e.target.value); setExitDriver(e.target.value ? 'override' : 'caprate') }} placeholder="Leave blank to use cap rate exit" />
                      <button onClick={() => handleCalculate()} disabled={calculating || !inputs.offerPrice}
                        className="btn-gold disabled:opacity-40 px-4 py-2 text-sm whitespace-nowrap">
                        Recalculate
                      </button>
                    </div>
                  </div>
                </div>

                {equityBreakdown && (
                  <EquityBreakdownBox
                    breakdown={equityBreakdown}
                    leverageType={leverageType}
                    loanType={loanType}
                    inputs={inputs}
                  />
                )}

                <div className="border border-dark-border p-7">
                  <SectionHead title="Your IRR" subtitle="Based on your offer price, exit cap rate, and financing structure" />
                  {irrResult ? (
                    <IRRBox result={irrResult} offerPrice={inputs.offerPrice} exitSalePrice={inputs.exitSalePrice} equityBreakdown={equityBreakdown ?? undefined} />
                  ) : (
                    <div className="p-6 border border-dark-border bg-dark-surface text-center">
                      <p className="text-dark-muted text-sm">Enter your offer price above, then calculate.</p>
                    </div>
                  )}
                </div>

                {waterfallResult && (
                  <WaterfallBox waterfall={waterfallResult} inputs={inputs} leverageType={leverageType} loanType={loanType} />
                )}

                {/* ── Institutional Model Outputs panel ──────────────────── */}
                {(excelOutputs || excelError || excelRunning) && (
                  <div className="border border-gold/40 p-7">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <SectionHead title="Institutional Model Outputs" subtitle="HyperFormula · Institutional_Self_Storage_Acquisition_Model_v3" />
                        {excelElapsed != null && (
                          <span className="text-xs text-dark-muted">Calculated in {excelElapsed}ms</span>
                        )}
                      </div>
                      <button
                        onClick={handleRunInstitutionalModel}
                        disabled={excelRunning}
                        className="text-xs text-gold border border-gold/40 px-3 py-1 hover:bg-gold/10 transition-colors disabled:opacity-40"
                      >
                        {excelRunning ? 'Recalculating...' : 'Recalculate'}
                      </button>
                    </div>

                    {excelError && (
                      <div className="border border-red-400/40 bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
                        {excelError}
                      </div>
                    )}

                    {excelOutputs && (() => {
                      const o = excelOutputs
                      const fmtIRR  = (v: unknown) => typeof v === 'number' ? (v * 100).toFixed(2) + '%' : '—'
                      const fmtMult = (v: unknown) => typeof v === 'number' ? v.toFixed(2) + 'x' : '—'
                      const fmtUSD  = (v: unknown) => typeof v === 'number' ? '$' + Math.round(v).toLocaleString() : '—'
                      const fmtRaw  = (v: unknown) => typeof v === 'number' ? v.toFixed(4) : String(v ?? '—')
                      return (
                        <div className="space-y-6">

                          {/* Returns */}
                          <div>
                            <div className="text-xs uppercase tracking-widest text-dark-muted mb-3">Returns</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {([
                                { label: 'Levered IRR',        val: fmtIRR(o.leveredIRR) },
                                { label: 'Equity Multiple',    val: fmtMult(o.equityMultiple) },
                                { label: 'Unlevered IRR',      val: fmtIRR(o.unleveredIRR) },
                                { label: 'Avg Cash-on-Cash',   val: fmtIRR(o.avgCashOnCash) },
                              ] as {label:string;val:string}[]).map(({ label, val }) => (
                                <div key={label} className="border border-dark-border bg-dark-surface p-4">
                                  <div className="text-xs text-dark-muted mb-1">{label}</div>
                                  <div className="text-xl font-light text-gold">{val}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Deal economics */}
                          <div>
                            <div className="text-xs uppercase tracking-widest text-dark-muted mb-3">Deal Economics</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {([
                                { label: 'Total Project Cost', val: fmtUSD(o.totalProjectCost) },
                                { label: 'Equity Required',    val: fmtUSD(o.equityRequired) },
                                { label: 'Exit Value',         val: fmtUSD(o.exitValue) },
                                { label: 'Year 1 NOI',         val: fmtUSD(o.year1NOI) },
                                { label: 'Year 5 NOI',         val: fmtUSD(o.year5NOI) },
                                { label: 'Year 1 DSCR',        val: typeof o.year1DSCR === 'number' ? o.year1DSCR.toFixed(2) : String(o.year1DSCR ?? '—') },
                              ] as {label:string;val:string}[]).map(({ label, val }) => (
                                <div key={label} className="border border-dark-border bg-dark-surface p-4">
                                  <div className="text-xs text-dark-muted mb-1">{label}</div>
                                  <div className="text-lg font-light text-dark-primary">{val}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Waterfall */}
                          <div>
                            <div className="text-xs uppercase tracking-widest text-dark-muted mb-3">GP / LP Waterfall</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {([
                                { label: 'LP Equity Multiple',      val: fmtMult(o.lpEquityMultiple) },
                                { label: 'GP Equity Multiple',      val: fmtMult(o.gpEquityMultiple) },
                                { label: 'LP Total Distributions',  val: fmtUSD(o.lpTotalDistributions) },
                                { label: 'GP Total Distributions',  val: fmtUSD(o.gpTotalDistributions) },
                              ] as {label:string;val:string}[]).map(({ label, val }) => (
                                <div key={label} className="border border-dark-border bg-dark-surface p-4">
                                  <div className="text-xs text-dark-muted mb-1">{label}</div>
                                  <div className="text-lg font-light text-dark-primary">{val}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Diagnostics */}
                          <div>
                            <div className="text-xs uppercase tracking-widest text-dark-muted mb-3">Diagnostics</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {([
                                { label: 'Going-In Cap',  val: fmtIRR(o.goingInCap) },
                                { label: 'Stabilized Cap', val: fmtIRR(o.stabilizedCap) },
                                { label: 'Price / Unit',  val: fmtUSD(o.pricePerUnit) },
                                { label: 'Yield on Cost', val: fmtIRR(o.yieldOnCost) },
                              ] as {label:string;val:string}[]).map(({ label, val }) => (
                                <div key={label} className="border border-dark-border bg-dark-surface p-4">
                                  <div className="text-xs text-dark-muted mb-1">{label}</div>
                                  <div className="text-lg font-light text-dark-primary">{val}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Comparison note */}
                          <p className="text-xs text-dark-muted border-t border-dark-border pt-3">
                            Institutional model outputs are calculated by HyperFormula running the full Excel workbook server-side.
                            Differences from the TypeScript model above reflect formula methodology differences between the two engines.
                            The Excel model is the investment committee reference.
                          </p>

                        </div>
                      )
                    })()}
                  </div>
                )}

                <div className="border border-dark-border p-7">
                  <SectionHead title="Next Steps" />
                  <div className="flex flex-wrap gap-4">
                    <button onClick={handleContinueToModel} className="btn-gold text-base px-8 py-3">Continue to Full Model →</button>
                    <button onClick={handleGenerateLOI} className="px-8 py-3 border border-[#1B2B5E] text-[#1B2B5E] text-sm uppercase tracking-widest hover:bg-[#1B2B5E] hover:text-white transition-colors">
                      Generate LOI →
                    </button>
                    <button onClick={handleSaveToPipeline} className="px-8 py-3 border border-gold text-gold text-sm uppercase tracking-widest hover:bg-gold/10 transition-colors">
                      {savedToPipeline ? '✓ Saved to Pipeline' : 'Save to Pipeline'}
                    </button>
                  </div>
                  <p className="text-dark-muted text-sm mt-3">
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
