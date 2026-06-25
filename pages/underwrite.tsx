import Head from 'next/head'
import { useState, useEffect, useCallback } from 'react'
import type { PipelineProperty } from '@/lib/pipelineData'
import { FileDropZone, type UploadFile } from '@/components/FileChips'
import AuthGate from '@/components/AuthGate'
import DealScoreBadge from '@/components/DealScoreBadge'

// ─── Types ────────────────────────────────────────────────────────────────────

type DealType = 'value-add' | 'stabilized' | 'distressed'

type UWInputs = {
  propertyName: string; address: string
  dealType: DealType
  purchasePrice: string; closingCostsPct: string; initialRepairs: string
  acquisitionFeePct: string; assetMgmtFeePct: string; dispositionFeePct: string
  inPlaceNOI: string; stabilizedNOI: string
  startOccupancy: string; stabilizedOccupancy: string; monthsToStabilization: string
  annualRentGrowth: string; opexGrowth: string
  initialLTV: string; initialRate: string; initialAmortYears: string
  ioPeriodMonths: string; minDSCR: string
  refiMonth: string; refiLTV: string; refiRate: string; refiAmortYears: string
  exitCapRate: string; exitMonth: string; sellingCostsPct: string
  preferredReturn: string; lpCatchUp: string; gpCatchUp: string
  lpResidual: string; gpResidual: string
}

export type UnitMixRow = { type: string; units: string; sqft: string; currentRent: string; marketRent: string }

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

const EMPTY: UWInputs = {
  propertyName: '', address: '',
  dealType: 'value-add',
  purchasePrice: '', closingCostsPct: '3', initialRepairs: '0',
  acquisitionFeePct: '2', assetMgmtFeePct: '1.5', dispositionFeePct: '1',
  inPlaceNOI: '', stabilizedNOI: '',
  startOccupancy: '', stabilizedOccupancy: '90', monthsToStabilization: '18',
  annualRentGrowth: '5', opexGrowth: '2.5',
  initialLTV: '65', initialRate: '7.0', initialAmortYears: '30',
  ioPeriodMonths: '24', minDSCR: '1.25',
  refiMonth: '24', refiLTV: '65', refiRate: '6.5', refiAmortYears: '30',
  exitCapRate: '', exitMonth: '60', sellingCostsPct: '2',
  preferredReturn: '8', lpCatchUp: '80', gpCatchUp: '20', lpResidual: '80', gpResidual: '20',
}

const DEFAULT_MIX: UnitMixRow[] = [
  { type: '5x5',   units: '', sqft: '25',  currentRent: '', marketRent: '' },
  { type: '5x10',  units: '', sqft: '50',  currentRent: '', marketRent: '' },
  { type: '10x10', units: '', sqft: '100', currentRent: '', marketRent: '' },
  { type: '10x15', units: '', sqft: '150', currentRent: '', marketRent: '' },
  { type: '10x20', units: '', sqft: '200', currentRent: '', marketRent: '' },
  { type: 'Other', units: '', sqft: '',    currentRent: '', marketRent: '' },
]

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  'value-add': 'Value-Add',
  'stabilized': 'Stabilized',
  'distressed': 'Distressed',
}

const DEAL_TYPE_DESCRIPTIONS: Record<DealType, string> = {
  'value-add': 'Below-market occupancy or rents with clear upside path',
  'stabilized': 'Performing asset — max offer based on T12 NOI at target cap rate',
  'distressed': 'Significant operational or physical issues — heavy discount applied',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fromExtracted(data: Record<string, unknown>): { inputs: UWInputs; unitMixPayload: UnitMixRow[] } {
  const p = (v: unknown, fallback = '') =>
    v != null ? String(Math.round((v as number) * 10000) / 100) : fallback
  const n = (v: unknown, fallback = '') => v != null ? String(v) : fallback

  const inputs: UWInputs = {
    propertyName: String(data.propertyName ?? ''),
    address: String(data.address ?? ''),
    dealType: (data.dealType as DealType) ?? 'value-add',
    purchasePrice:         n(data.purchasePrice),
    closingCostsPct:       p(data.closingCostsPct, '3'),
    initialRepairs:        n(data.initialRepairs, '0'),
    acquisitionFeePct:     p(data.acquisitionFeePct, '2'),
    assetMgmtFeePct:       p(data.assetMgmtFeePct, '1.5'),
    dispositionFeePct:     p(data.dispositionFeePct, '1'),
    inPlaceNOI:            n(data.inPlaceNOI),
    stabilizedNOI:         n(data.stabilizedNOI),
    startOccupancy:        p(data.startOccupancy),
    stabilizedOccupancy:   p(data.stabilizedOccupancy, '90'),
    monthsToStabilization: n(data.monthsToStabilization, '18'),
    annualRentGrowth:      p(data.annualRentGrowth, '5'),
    opexGrowth:            p(data.opexGrowth, '2.5'),
    initialLTV:            p(data.initialLTV, '65'),
    initialRate:           p(data.initialRate, '7'),
    initialAmortYears:     n(data.initialAmortYears, '30'),
    ioPeriodMonths:        n(data.ioPeriodMonths, '24'),
    minDSCR:               n(data.minDSCR, '1.25'),
    refiMonth:             n(data.refiMonth, '24'),
    refiLTV:               p(data.refiLTV, '65'),
    refiRate:              p(data.refiRate, '6.5'),
    refiAmortYears:        n(data.refiAmortYears, '30'),
    exitCapRate:           p(data.exitCapRate),
    exitMonth:             n(data.exitMonth, '60'),
    sellingCostsPct:       p(data.sellingCostsPct, '2'),
    preferredReturn:       p(data.preferredReturn, '8'),
    lpCatchUp:             p(data.lpCatchUp, '80'),
    gpCatchUp:             p(data.gpCatchUp, '20'),
    lpResidual:            p(data.lpResidual, '80'),
    gpResidual:            p(data.gpResidual, '20'),
  }

   const rawMix = (data.unitMix as Array<Record<string, unknown>>) ?? []

  // Bucket key -> destination DEFAULT_MIX row, using the SAME substring-matching
  // rule run-excel.ts's unitTypeRow() already applies, so bucketing is consistent
  // on both sides of the pipeline. Tested standalone against realistic Tulsa OM
  // data: 14 category-qualified rows / 521 units -> 521 units preserved, ~97% GPR
  // reconciliation against actual OM figures (vs. 0% under the prior exact-match logic).
  const UNIT_MIX_BUCKET_KEYS: Record<string, string> = {
    '5x5': '5x5', '5x10': '5x10', '10x10': '10x10', '10x15': '10x15', '10x20': '10x20',
    'parking': 'Other', 'outdoor': 'Other',
  }

  function bucketKeyFor(type: string): string {
    const t = type.toLowerCase().replace(/\s/g, '')
    for (const [key, bucket] of Object.entries(UNIT_MIX_BUCKET_KEYS)) {
      if (t.includes(key) || key.includes(t)) return bucket
    }
    return 'Other'
  }

  type Acc = {
    units: number
    sqftSum: number
    sqftUnits: number
    rentSum: number
    rentUnits: number
    marketSum: number
    marketUnits: number
  }

  const buckets: Record<string, Acc> = {}

  for (const row of rawMix) {
    const bucket = bucketKeyFor(String(row.type ?? ''))
    const units = Number(row.units) || 0

    if (!buckets[bucket]) {
      buckets[bucket] = {
        units: 0,
        sqftSum: 0,
        sqftUnits: 0,
        rentSum: 0,
        rentUnits: 0,
        marketSum: 0,
        marketUnits: 0,
      }
    }

    const b = buckets[bucket]

    b.units += units

    if (row.sqft != null) {
      b.sqftSum += Number(row.sqft) * units
      b.sqftUnits += units
    }

    if (row.currentRent != null) {
      b.rentSum += Number(row.currentRent) * units
      b.rentUnits += units
    }

    if (row.marketRent != null) {
      b.marketSum += Number(row.marketRent) * units
      b.marketUnits += units
    }
  }

  const unitMixPayload = DEFAULT_MIX.map(def => {
    const b = buckets[def.type]

    if (!b || b.units === 0) return def

    return {
      type: def.type,
      units: String(b.units),
      sqft: b.sqftUnits > 0 ? String(Math.round(b.sqftSum / b.sqftUnits)) : def.sqft,
      currentRent: b.rentUnits > 0 ? String(Math.round((b.rentSum / b.rentUnits) * 100) / 100) : '',
      marketRent: b.marketUnits > 0 ? String(Math.round((b.marketSum / b.marketUnits) * 100) / 100) : '',
    }
  })

  return { inputs, unitMixPayload }
}

function buildPayload(inputs: UWInputs, unitMixPayload: UnitMixRow[]) {
  const pct = (s: string) => s !== '' ? parseFloat(s) / 100 : null
  const num = (s: string) => s !== '' ? parseFloat(s) : null
  const int = (s: string) => s !== '' ? parseInt(s, 10) : null

  return {
    propertyName: inputs.propertyName || null,
    address: inputs.address || null,
    purchasePrice:          num(inputs.purchasePrice),
    closingCostsPct:        pct(inputs.closingCostsPct),
    initialRepairs:         num(inputs.initialRepairs),
    acquisitionFeePct:      pct(inputs.acquisitionFeePct),
    assetMgmtFeePct:        pct(inputs.assetMgmtFeePct),
    dispositionFeePct:      pct(inputs.dispositionFeePct),
    startOccupancy:         pct(inputs.startOccupancy),
    stabilizedOccupancy:    pct(inputs.stabilizedOccupancy),
    monthsToStabilization:  int(inputs.monthsToStabilization),
    annualRentGrowth:       pct(inputs.annualRentGrowth),
    opexGrowth:             pct(inputs.opexGrowth),
    initialLTV:             pct(inputs.initialLTV),
    initialRate:            pct(inputs.initialRate),
    initialAmortYears:      int(inputs.initialAmortYears),
    ioPeriodMonths:         int(inputs.ioPeriodMonths),
    minDSCR:                num(inputs.minDSCR),
    refiMonth:              int(inputs.refiMonth),
    refiLTV:                pct(inputs.refiLTV),
    refiRate:               pct(inputs.refiRate),
    refiAmortYears:         int(inputs.refiAmortYears),
    exitCapRate:            pct(inputs.exitCapRate),
    exitMonth:              int(inputs.exitMonth),
    sellingCostsPct:        pct(inputs.sellingCostsPct),
    lpReturnOfCapital:      1,
    preferredReturn:        pct(inputs.preferredReturn),
    lpCatchUp:              pct(inputs.lpCatchUp),
    gpCatchUp:              pct(inputs.gpCatchUp),
    lpResidual:             pct(inputs.lpResidual),
    gpResidual:             pct(inputs.gpResidual),
    unitMix: unitMixPayload
      .filter(r => r.units || r.currentRent || r.marketRent)
      .map(r => ({
        type: r.type.toLowerCase(),
        units:       r.units       ? parseInt(r.units, 10)   : null,
        sqft:        r.sqft        ? parseFloat(r.sqft)      : null,
        currentRent: r.currentRent ? parseFloat(r.currentRent) : null,
        marketRent:  r.marketRent  ? parseFloat(r.marketRent)  : null,
      })),
  }
}

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US')
}
function fmtPct(n: number) {
  return (n * 100).toFixed(2) + '%'
}

// ─── Small UI Helpers ─────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'number', suffix, step, min }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; suffix?: string; step?: string; min?: string
}) {
  return (
    <div>
      <label className="label-text">{label}{suffix && <span className="text-dark-muted ml-1">({suffix})</span>}</label>
      <input
        className="input-field"
        type={type}
        step={step ?? (type === 'number' ? 'any' : undefined)}
        min={min}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="border-b border-dark-border pb-2 mb-5">
      <div className="section-label-sm">{title}</div>
    </div>
  )
}

// ─── Max Offer Box ────────────────────────────────────────────────────────────

function MaxOfferBox({ result, loading }: { result: MaxOfferResult | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="border border-gold/40 bg-gold/5 p-5 flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        <span className="text-dark-muted text-sm">Calculating max offer…</span>
      </div>
    )
  }
  if (!result) return null

  return (
    <div className="border border-gold bg-gold/5 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold font-medium mb-1">Max Offer — {DEAL_TYPE_LABELS[result.deal_type as DealType]}</div>
          <div className="font-serif text-4xl font-light text-[#1B2B5E]">{fmt$(result.max_offer)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-dark-muted uppercase tracking-widest mb-1">Target IRR</div>
          <div className="text-xl font-semibold text-[#1B2B5E]">{fmtPct(result.target_irr)}</div>
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
          <div className="text-xs text-dark-muted uppercase tracking-widest mb-0.5">In-Place NOI</div>
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

type Source = 'pipeline' | 'upload' | 'manual'

export default function Underwrite() {
  const [source, setSource] = useState<Source>('upload')
  const [pipelineDeals, setPipelineDeals] = useState<PipelineProperty[]>([])
  const [selectedDealId, setSelectedDealId] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [step, setStep] = useState<'source' | 'form'>('source')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [building, setBuilding] = useState(false)
  const [buildError, setBuildError] = useState('')
  const [inputs, setInputs] = useState<UWInputs>(EMPTY)
  const [unitMixPayload, setUnitMixPayload] = useState<UnitMixRow[]>(DEFAULT_MIX)
  const [maxOfferResult, setMaxOfferResult] = useState<MaxOfferResult | null>(null)
  const [maxOfferLoading, setMaxOfferLoading] = useState(false)
  const [maxOfferTimer, setMaxOfferTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const set = (k: keyof UWInputs, v: string) => setInputs(p => ({ ...p, [k]: v }))
    const setMix = (i: number, k: keyof UnitMixRow, v: string) =>
      setUnitMixPayload(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  useEffect(() => {
    fetch('/api/pipeline-ingest')
      .then(r => r.ok ? r.json() : [])
      .then((d: PipelineProperty[]) => setPipelineDeals(d))
      .catch(() => {})
  }, [])

  const fetchMaxOffer = useCallback(async (inp: UWInputs) => {
    const inPlaceNOI = parseFloat(inp.inPlaceNOI)
    if (!inPlaceNOI || inPlaceNOI <= 0) { setMaxOfferResult(null); return }
    setMaxOfferLoading(true)
    try {
      const body = {
        target_irr: 0.15,
        deal_type: inp.dealType,
        in_place_noi: inPlaceNOI,
        stabilized_noi: parseFloat(inp.stabilizedNOI) || null,
        start_occupancy: inp.startOccupancy ? parseFloat(inp.startOccupancy) / 100 : 0.75,
        stabilized_occupancy: inp.stabilizedOccupancy ? parseFloat(inp.stabilizedOccupancy) / 100 : 0.90,
        exit_cap_rate: inp.exitCapRate ? parseFloat(inp.exitCapRate) / 100 : 0.0725,
        exit_month: inp.exitMonth ? parseInt(inp.exitMonth) : 60,
        months_to_stabilization: inp.monthsToStabilization ? parseInt(inp.monthsToStabilization) : 18,
        rent_growth: inp.annualRentGrowth ? parseFloat(inp.annualRentGrowth) / 100 : 0.05,
        opex_growth: inp.opexGrowth ? parseFloat(inp.opexGrowth) / 100 : 0.025,
        closing_costs_pct: inp.closingCostsPct ? parseFloat(inp.closingCostsPct) / 100 : 0.03,
        acquisition_fee_pct: inp.acquisitionFeePct ? parseFloat(inp.acquisitionFeePct) / 100 : 0.02,
        initial_repairs: inp.initialRepairs ? parseFloat(inp.initialRepairs) : 0,
        selling_costs_pct: 0.02,
      }
      const res = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'max-offer', ...body }),
      })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setMaxOfferResult(data)
    } catch {
      setMaxOfferResult(null)
    } finally {
      setMaxOfferLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step !== 'form') return
    if (maxOfferTimer) clearTimeout(maxOfferTimer)
    const t = setTimeout(() => fetchMaxOffer(inputs), 800)
    setMaxOfferTimer(t)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.inPlaceNOI, inputs.stabilizedNOI, inputs.dealType, inputs.exitCapRate,
      inputs.startOccupancy, inputs.stabilizedOccupancy, inputs.monthsToStabilization,
      inputs.annualRentGrowth, inputs.opexGrowth, step])

  function handleLoadDeal() {
    const deal = pipelineDeals.find(d => d.id === selectedDealId)
    if (!deal) return
    const occ = deal.occupancy > 1 ? deal.occupancy / 100 : deal.occupancy
    const askPrice = deal.askingPrice ?? deal.estimatedValue ?? 0
    const exitCap = (deal.noi && askPrice) ? deal.noi / askPrice : null
    setInputs({
      ...EMPTY,
      propertyName: deal.facilityName,
      address: `${deal.address}, ${deal.city}, ${deal.state}`,
      purchasePrice: askPrice ? String(askPrice) : '',
      startOccupancy: String(Math.round(occ * 100 * 100) / 100),
      exitCapRate: exitCap ? String(Math.round(exitCap * 10000) / 100) : '',
    })
    setUnitMixPayload(DEFAULT_MIX)
    setMaxOfferResult(null)
    setStep('form')
  }

  function handleManual() {
    setInputs(EMPTY)
    setUnitMixPayload(DEFAULT_MIX)
    setMaxOfferResult(null)
    setStep('form')
  }

  async function handleExtract() {
    if (files.length === 0) return
    setExtracting(true)
    setExtractError('')
    try {
      const filePayloads = await Promise.all(files.map(async ({ file }) => {
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
        body: JSON.stringify({ files: filePayloads }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()

      const proformaData = {
        propertyName:          data.propertyName          ?? '',
        unitMix:               Array.isArray(data.unitMix) ? data.unitMix : [],
        address:               data.address               ?? '',
        dealType:              data.dealType              ?? 'value-add',
        totalUnits:            data.totalUnits            != null ? String(data.totalUnits) : '',
        currentOccupancy:      data.currentOccupancy      != null ? String(data.currentOccupancy) : '',
        targetOccupancy:       data.projectedStabilizedOccupancy != null ? String(data.projectedStabilizedOccupancy) : '92',
        monthsToStabilization: data.monthsToStabilization != null ? String(data.monthsToStabilization) : '18',
        currentAvgRent:        data.currentAvgRentPerUnit != null ? String(data.currentAvgRentPerUnit) : '',
        marketAvgRent:         data.marketAvgRentPerUnit  != null ? String(data.marketAvgRentPerUnit)  : '',
        monthsToMarketRent:    '24',
        t12NOI:                data.t12NOI   != null ? String(data.t12NOI)   : '',
        t3NOI:                 data.t3NOI    != null ? String(data.t3NOI)    : '',
        t12Occupancy:          data.currentOccupancy != null ? String(data.currentOccupancy) : '',
        exitCapRate:           data.exitCapRate != null ? String(parseFloat(String(data.exitCapRate)) * 100) : '7.25',
        exitMonth:             data.exitMonth  != null ? String(data.exitMonth)  : '60',
        targetIRR:             '15',
        sellerY1: {
          revenue:  data.sellerY1Revenue  != null ? String(data.sellerY1Revenue)  : '',
          expenses: data.sellerY1Expenses != null ? String(data.sellerY1Expenses) : '',
          noi:      data.sellerY1NOI      != null ? String(data.sellerY1NOI)      : '',
        },
        sellerY2: {
          revenue:  data.sellerY2Revenue  != null ? String(data.sellerY2Revenue)  : '',
          expenses: data.sellerY2Expenses != null ? String(data.sellerY2Expenses) : '',
          noi:      data.sellerY2NOI      != null ? String(data.sellerY2NOI)      : '',
        },
       sellerY3: {
          revenue:  data.sellerY3Revenue  != null ? String(data.sellerY3Revenue)  : '',
          expenses: data.sellerY3Expenses != null ? String(data.sellerY3Expenses) : '',
          noi:      data.sellerY3NOI      != null ? String(data.sellerY3NOI)      : '',
        },
        sellerY4: {
          revenue:  data.sellerY4Revenue  != null ? String(data.sellerY4Revenue)  : '',
          expenses: '',
          noi:      data.sellerY4NOI      != null ? String(data.sellerY4NOI)      : '',
        },
        sellerY5: {
          revenue:  data.sellerY5Revenue  != null ? String(data.sellerY5Revenue)  : '',
          expenses: '',
          noi:      data.sellerY5NOI      != null ? String(data.sellerY5NOI)      : '',
        },
        t12Revenue:            data.t12Revenue            != null ? String(data.t12Revenue)            : '',
        t12TotalExpenses:      data.t12Expenses           != null ? String(data.t12Expenses)           : '',
        t12Payroll:            data.t12Payroll            != null ? String(data.t12Payroll)            : '',
        t12ManagementFees:     data.t12ManagementFees     != null ? String(data.t12ManagementFees)     : '',
        t12Marketing:          data.t12Marketing          != null ? String(data.t12Marketing)          : '',
        t12Utilities:          data.t12Utilities          != null ? String(data.t12Utilities)          : '',
        t12OfficeEmployee:     data.t12OfficeEmployee     != null ? String(data.t12OfficeEmployee)     : '',
        t12Administrative:     data.t12Administrative     != null ? String(data.t12Administrative)     : '',
        t12RepairsMaintenance: data.t12RepairsMaintenance != null ? String(data.t12RepairsMaintenance) : '',
        t12Tax:                data.t12Tax                != null ? String(data.t12Tax)                : '',
        t12Insurance:          data.t12Insurance          != null ? String(data.t12Insurance)          : '',
        t12OtherExpenses:      data.t12OtherExpenses      != null ? String(data.t12OtherExpenses)      : '',
      }

      window.location.href = `/proforma?data=${encodeURIComponent(JSON.stringify(proformaData))}`

    } catch (err) {
      setExtractError(String(err))
    } finally {
      setExtracting(false)
    }
  }

  async function handleBuild() {
    setBuilding(true)
    setBuildError('')
    try {
      const payload = buildPayload(inputs, unitMixPayload)
      const res = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build', inputs: payload, propertyAddress: inputs.address || inputs.propertyName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const name = (inputs.address || inputs.propertyName || 'underwrite').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
      a.href = url
      a.download = `${name}_UW.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setBuildError(String(err))
    } finally {
      setBuilding(false)
    }
  }

  return (
    <AuthGate>
    <>
      <Head>
        <title>Underwrite — YEM Acquisitions</title>
        <meta name="description" content="Populate the acquisition model from a deal document or pipeline property." />
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Underwrite</div>
        <h1 className="display-heading text-5xl md:text-7xl max-w-3xl mb-6">
          Load a deal.<br />
          <em className="text-gold">Build the model.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Select a pipeline deal or upload a rent roll / T12 / OM. Claude extracts the inputs,
          you review and edit, then download a pre-populated acquisition model.
        </p>
      </section>

      <section className="py-14">
        <div className="section-container max-w-4xl">

          {step === 'source' && (
            <>
              <div className="flex gap-2 mb-8 border-b border-dark-border pb-4">
                {(['upload', 'pipeline', 'manual'] as Source[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`px-5 py-2 text-xs uppercase tracking-widest border transition-colors duration-150
                      ${source === s ? 'border-gold text-gold bg-gold/5' : 'border-dark-border text-dark-muted hover:border-gold/40'}`}
                  >
                    {s === 'upload' ? 'Upload Document' : s === 'pipeline' ? 'From Pipeline' : 'Enter Manually'}
                  </button>
                ))}
              </div>

              {source === 'upload' && (
                <div>
                  <FileDropZone files={files} onChange={setFiles} disabled={extracting} />
                  {extractError && (
                    <div className="mt-4 mb-2 p-3 border border-red-400/40 bg-red-50 text-red-700 text-sm">{extractError}</div>
                  )}
                  <div className="mt-5">
                    <button onClick={handleExtract} disabled={files.length === 0 || extracting} className="btn-gold disabled:opacity-60">
                      {extracting ? `Extracting ${files.length} file${files.length !== 1 ? 's' : ''} with Claude...` : 'Extract & Populate'}
                    </button>
                  </div>
                </div>
              )}

              {source === 'pipeline' && (
                <div>
                  {pipelineDeals.length === 0 ? (
                    <div className="p-8 border border-dark-border bg-dark-surface text-center text-dark-muted">
                      <p className="font-serif text-xl font-light mb-2">No pipeline deals found.</p>
                      <p className="text-sm">Run the pipeline scraper or add a deal via Upload Deal.</p>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="label-text">Select Deal</label>
                        <select className="input-field" value={selectedDealId} onChange={e => setSelectedDealId(e.target.value)}>
                          <option value="">— Choose a deal —</option>
                          {pipelineDeals.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.facilityName} · {d.city}, {d.state}{d.dealScore != null ? ` · Score ${d.dealScore}` : ''}
                            </option>
                          ))}
                        </select>
                        {selectedDealId && (() => {
                          const d = pipelineDeals.find(x => x.id === selectedDealId)
                          return d?.dealScore != null ? (
                            <div className="mt-1.5">
                              <DealScoreBadge score={d.dealScore} dealType={d.dealType} size="sm" />
                            </div>
                          ) : null
                        })()}
                      </div>
                      <button onClick={handleLoadDeal} disabled={!selectedDealId} className="btn-gold disabled:opacity-60 mb-0.5">
                        Load Deal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {source === 'manual' && (
                <div className="p-8 border border-dark-border bg-dark-surface text-center">
                  <p className="font-serif text-xl font-light text-[#1B2B5E] mb-2">Enter inputs manually</p>
                  <p className="text-dark-muted text-sm mb-6">All fields pre-loaded with typical defaults. Adjust as needed.</p>
                  <button onClick={handleManual} className="btn-gold">Open Form</button>
                </div>
              )}
            </>
          )}

          {step === 'form' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="section-label-sm mb-0.5">Underwriting Inputs</div>
                  <p className="text-dark-muted text-sm">Review and adjust before building the model.</p>
                </div>
                <button onClick={() => { setStep('source'); setMaxOfferResult(null) }} className="text-dark-muted text-xs uppercase tracking-widest hover:text-[#1a1a18]">
                  ← Change source
                </button>
              </div>

              <div className="space-y-10">

                <div className="border border-dark-border p-7">
                  <SectionHead title="Deal Type" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
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
                        <div className="text-xs text-dark-muted leading-snug">{DEAL_TYPE_DESCRIPTIONS[dt]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="Property" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Property Name" value={inputs.propertyName} onChange={v => set('propertyName', v)} type="text" />
                    <Field label="Address" value={inputs.address} onChange={v => set('address', v)} type="text" />
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="NOI & Max Offer" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Field label="In-Place NOI (T12)" value={inputs.inPlaceNOI} onChange={v => set('inPlaceNOI', v)} suffix="$" />
                    <Field
                      label={inputs.dealType === 'stabilized' ? 'Projected NOI (Year 2)' : 'Stabilized NOI (at full occupancy)'}
                      value={inputs.stabilizedNOI} onChange={v => set('stabilizedNOI', v)} suffix="$"
                    />
                  </div>
                  <MaxOfferBox result={maxOfferResult} loading={maxOfferLoading} />
                  {!maxOfferResult && !maxOfferLoading && (
                    <p className="text-dark-muted text-xs mt-2">Enter In-Place NOI above to calculate max offer automatically.</p>
                  )}
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="Acquisition & Fees" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Purchase Price" value={inputs.purchasePrice} onChange={v => set('purchasePrice', v)} suffix="$" />
                    <Field label="Initial Repairs / CapEx" value={inputs.initialRepairs} onChange={v => set('initialRepairs', v)} suffix="$" />
                    <Field label="Closing Costs" value={inputs.closingCostsPct} onChange={v => set('closingCostsPct', v)} suffix="%" step="0.1" />
                    <Field label="Acquisition Fee" value={inputs.acquisitionFeePct} onChange={v => set('acquisitionFeePct', v)} suffix="%" step="0.1" />
                    <Field label="Asset Mgmt Fee" value={inputs.assetMgmtFeePct} onChange={v => set('assetMgmtFeePct', v)} suffix="% of EGI" step="0.1" />
                    <Field label="Disposition Fee" value={inputs.dispositionFeePct} onChange={v => set('dispositionFeePct', v)} suffix="%" step="0.1" />
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="Operations" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Starting Occupancy" value={inputs.startOccupancy} onChange={v => set('startOccupancy', v)} suffix="%" step="0.1" />
                    <Field label="Stabilized Occupancy" value={inputs.stabilizedOccupancy} onChange={v => set('stabilizedOccupancy', v)} suffix="%" step="0.1" />
                    <Field label="Months to Stabilization" value={inputs.monthsToStabilization} onChange={v => set('monthsToStabilization', v)} min="0" />
                    <Field label="Annual Rent Growth" value={inputs.annualRentGrowth} onChange={v => set('annualRentGrowth', v)} suffix="%" step="0.1" />
                    <Field label="OpEx Growth" value={inputs.opexGrowth} onChange={v => set('opexGrowth', v)} suffix="%" step="0.1" />
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="Debt & Refinancing" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Initial LTV" value={inputs.initialLTV} onChange={v => set('initialLTV', v)} suffix="%" step="0.5" />
                    <Field label="Interest Rate" value={inputs.initialRate} onChange={v => set('initialRate', v)} suffix="%" step="0.05" />
                    <Field label="Amortization" value={inputs.initialAmortYears} onChange={v => set('initialAmortYears', v)} suffix="yrs" />
                    <Field label="IO Period" value={inputs.ioPeriodMonths} onChange={v => set('ioPeriodMonths', v)} suffix="mo" />
                    <Field label="Min DSCR" value={inputs.minDSCR} onChange={v => set('minDSCR', v)} step="0.05" />
                    <Field label="Refi Month" value={inputs.refiMonth} onChange={v => set('refiMonth', v)} suffix="mo" />
                    <Field label="Refi LTV" value={inputs.refiLTV} onChange={v => set('refiLTV', v)} suffix="%" step="0.5" />
                    <Field label="Refi Rate" value={inputs.refiRate} onChange={v => set('refiRate', v)} suffix="%" step="0.05" />
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="Exit Assumptions" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Exit Cap Rate" value={inputs.exitCapRate} onChange={v => set('exitCapRate', v)} suffix="%" step="0.1" />
                    <Field label="Exit Month" value={inputs.exitMonth} onChange={v => set('exitMonth', v)} suffix="mo" />
                    <Field label="Selling Costs" value={inputs.sellingCostsPct} onChange={v => set('sellingCostsPct', v)} suffix="%" step="0.1" />
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="GP / LP Waterfall" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Preferred Return" value={inputs.preferredReturn} onChange={v => set('preferredReturn', v)} suffix="%" step="0.5" />
                    <Field label="LP Catch-Up Split" value={inputs.lpCatchUp} onChange={v => set('lpCatchUp', v)} suffix="%" />
                    <Field label="GP Catch-Up Split" value={inputs.gpCatchUp} onChange={v => set('gpCatchUp', v)} suffix="%" />
                    <Field label="LP Residual Split" value={inputs.lpResidual} onChange={v => set('lpResidual', v)} suffix="%" />
                    <Field label="GP Residual Split" value={inputs.gpResidual} onChange={v => set('gpResidual', v)} suffix="%" />
                  </div>
                </div>

                <div className="border border-dark-border p-7">
                  <SectionHead title="Unit Mix" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-border">
                          {['Unit Type', '# Units', 'Avg SF', 'Current Rent/Mo', 'Market Rent/Mo'].map(h => (
                            <th key={h} className="text-left text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {unitMixPayload.map((row, i) => (
                          <tr key={row.type} className="border-b border-dark-border/50 last:border-0">
                            <td className="py-2 pr-4 font-mono text-sm text-dark-muted w-20">{row.type}</td>
                            {(['units', 'sqft', 'currentRent', 'marketRent'] as (keyof UnitMixRow)[]).map(k => (
                              <td key={k} className="py-2 pr-4">
                                <input
                                  className="input-field py-1.5 text-sm"
                                  type="number" step="any" min="0"
                                  value={row[k]}
                                  onChange={e => setMix(i, k, e.target.value)}
                                  placeholder={k === 'sqft' ? row.sqft || '—' : '—'}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-dark-muted text-xs mt-3">Leave rows blank to keep template defaults.</p>
                </div>

              </div>

              <div className="mt-10 pt-8 border-t border-dark-border">
                {buildError && (
                  <div className="mb-5 p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">{buildError}</div>
                )}
                <div className="flex items-center gap-5">
                  <button onClick={handleBuild} disabled={building} className="btn-gold disabled:opacity-60 text-base px-8 py-3">
                    {building ? 'Building model...' : 'Build Model & Download'}
                  </button>
                  <p className="text-dark-muted text-xs leading-relaxed max-w-xs">
                    Downloads a pre-populated Excel acquisition model. Formulas remain live — open in Excel to recalculate.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
    </AuthGate>
  )
}
