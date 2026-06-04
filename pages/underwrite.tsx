import Head from 'next/head'
import { useState, useEffect } from 'react'
import type { PipelineProperty } from '@/lib/pipelineData'
import { FileDropZone, type UploadFile } from '@/components/FileChips'
import AuthGate from '@/components/AuthGate'
import DealScoreBadge from '@/components/DealScoreBadge'

// ─── Types ────────────────────────────────────────────────────────────────────

type UWInputs = {
  propertyName: string; address: string
  purchasePrice: string; closingCostsPct: string; initialRepairs: string
  acquisitionFeePct: string; assetMgmtFeePct: string; dispositionFeePct: string
  startOccupancy: string; stabilizedOccupancy: string; monthsToStabilization: string
  annualRentGrowth: string; opexGrowth: string
  initialLTV: string; initialRate: string; initialAmortYears: string
  ioPeriodMonths: string; minDSCR: string
  refiMonth: string; refiLTV: string; refiRate: string; refiAmortYears: string
  exitCapRate: string; exitMonth: string; sellingCostsPct: string
  preferredReturn: string; lpCatchUp: string; gpCatchUp: string
  lpResidual: string; gpResidual: string
}

type UnitMixRow = { type: string; units: string; sqft: string; currentRent: string; marketRent: string }

type ModelResults = {
  purchase_price: number
  total_project_cost: number
  equity_required: number
  year1_noi: number
  year5_noi: number
  levered_irr: number
  equity_multiple: number
  avg_coc: number
  exit_value: number
  unlevered_irr: number
  lp_equity_multiple: number
  moic: number
  going_in_cap: number
  stabilized_cap: number
  price_per_unit: number
  price_per_sf: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const EMPTY: UWInputs = {
  propertyName: '', address: '',
  purchasePrice: '', closingCostsPct: '3', initialRepairs: '0',
  acquisitionFeePct: '2', assetMgmtFeePct: '1.5', dispositionFeePct: '1',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fromExtracted(data: Record<string, unknown>): { inputs: UWInputs; unitMix: UnitMixRow[] } {
  const p = (v: unknown, fallback = '') =>
    v != null ? String(Math.round((v as number) * 10000) / 100) : fallback
  const n = (v: unknown, fallback = '') => v != null ? String(v) : fallback

  const inputs: UWInputs = {
    propertyName: String(data.propertyName ?? ''),
    address: String(data.address ?? ''),
    purchasePrice:         n(data.purchasePrice),
    closingCostsPct:       p(data.closingCostsPct, '3'),
    initialRepairs:        n(data.initialRepairs, '0'),
    acquisitionFeePct:     p(data.acquisitionFeePct, '2'),
    assetMgmtFeePct:       p(data.assetMgmtFeePct, '1.5'),
    dispositionFeePct:     p(data.dispositionFeePct, '1'),
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
  const unitMix = DEFAULT_MIX.map(def => {
    const match = rawMix.find(r => String(r.type ?? '').toLowerCase().replace(/\s/g, '') === def.type.toLowerCase())
    if (!match) return def
    return {
      type: def.type,
      units: match.units != null ? String(match.units) : '',
      sqft: match.sqft != null ? String(match.sqft) : def.sqft,
      currentRent: match.currentRent != null ? String(match.currentRent) : '',
      marketRent: match.marketRent != null ? String(match.marketRent) : '',
    }
  })

  return { inputs, unitMix }
}

function buildPayload(inputs: UWInputs, unitMix: UnitMixRow[]) {
  const pct = (s: string) => s !== '' ? parseFloat(s) / 100 : null
  const num = (s: string) => s !== '' ? parseFloat(s) : null
  const int = (s: string) => s !== '' ? parseInt(s, 10) : null

  return {
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
    preferredReturn:        pct(inputs.preferredReturn),
    lpCatchUp:              pct(inputs.lpCatchUp),
    gpCatchUp:              pct(inputs.gpCatchUp),
    lpResidual:             pct(inputs.lpResidual),
    gpResidual:             pct(inputs.gpResidual),
    unitMix: unitMix
      .filter(r => r.units || r.currentRent || r.marketRent)
      .map(r => ({
        type: r.type.toLowerCase(),
        units:       r.units       ? parseInt(r.units, 10)     : null,
        sqft:        r.sqft        ? parseFloat(r.sqft)        : null,
        currentRent: r.currentRent ? parseFloat(r.currentRent) : null,
        marketRent:  r.marketRent  ? parseFloat(r.marketRent)  : null,
      })),
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const fmt$ = (n: number) => n >= 1_000_000
  ? `$${(n / 1_000_000).toFixed(2)}M`
  : `$${n.toLocaleString()}`

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`
const fmtX = (n: number) => `${n.toFixed(2)}x`

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border p-5 ${highlight ? 'border-gold bg-gold/5' : 'border-dark-border'}`}>
      <div className="text-xs uppercase tracking-widest text-dark-muted mb-1">{label}</div>
      <div className={`font-serif text-2xl font-light ${highlight ? 'text-gold' : 'text-[#1a1a18]'}`}>{value}</div>
    </div>
  )
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
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [results, setResults] = useState<ModelResults | null>(null)
  const [inputs, setInputs] = useState<UWInputs>(EMPTY)
  const [unitMix, setUnitMix] = useState<UnitMixRow[]>(DEFAULT_MIX)

  const set = (k: keyof UWInputs, v: string) => setInputs(p => ({ ...p, [k]: v }))
  const setMix = (i: number, k: keyof UnitMixRow, v: string) =>
    setUnitMix(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  useEffect(() => {
    fetch('/api/pipeline-ingest')
      .then(r => r.ok ? r.json() : [])
      .then((d: PipelineProperty[]) => setPipelineDeals(d))
      .catch(() => {})
  }, [])

  // ── Source handlers ──────────────────────────────────────────────────────

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
    setUnitMix(DEFAULT_MIX)
    setResults(null)
    setStep('form')
  }

  function handleManual() {
    setInputs(EMPTY)
    setUnitMix(DEFAULT_MIX)
    setResults(null)
    setStep('form')
  }

  async function handleExtract() {
    if (files.length === 0) return
    setExtracting(true)
    setExtractError('')
    try {
      const filePayloads = await Promise.all(
        files.map(async ({ file, mime }) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
          return { fileName: file.name, mimeType: mime, data: base64 }
        })
      )
      const res = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract', files: filePayloads }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      const { inputs: newInputs, unitMix: newMix } = fromExtracted(data)
      setInputs(newInputs)
      setUnitMix(newMix)
      setResults(null)
      setStep('form')
    } catch (err) {
      setExtractError(String(err))
    } finally {
      setExtracting(false)
    }
  }

  // ── Run Model ────────────────────────────────────────────────────────────

  async function handleRun() {
    setRunning(true)
    setRunError('')
    setResults(null)
    try {
      const payload = buildPayload(inputs, unitMix)
      const res = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', inputs: payload }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`)
      }
      const data: ModelResults = await res.json()
      setResults(data)
      // Scroll to results
      setTimeout(() => {
        document.getElementById('uw-results')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      setRunError(String(err))
    } finally {
      setRunning(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AuthGate>
    <>
      <Head>
        <title>Underwrite — YEM Acquisitions</title>
        <meta name="description" content="Populate the acquisition model from a deal document or pipeline property." />
      </Head>

      {/* Hero */}
      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Underwrite</div>
        <h1 className="display-heading text-5xl md:text-7xl max-w-3xl mb-6">
          Load a deal.<br />
          <em className="text-gold">Run the model.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Upload a rent roll, T12, or OM. Claude extracts every input.
          Review, edit, and run the model — IRR, MOIC, NOI, and exit value back in seconds.
        </p>
      </section>

      <section className="py-14">
        <div className="section-container max-w-4xl">

          {/* ── Step 1: Source ── */}
          {step === 'source' && (
            <>
              <div className="flex gap-2 mb-8 border-b border-dark-border pb-4">
                {(['upload', 'pipeline', 'manual'] as Source[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={`px-5 py-2 text-xs uppercase tracking-widest border transition-colors duration-150
                      ${source === s
                        ? 'border-gold text-gold bg-gold/5'
                        : 'border-dark-border text-dark-muted hover:border-gold/40'}`}
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
                      {extracting
                        ? `Extracting ${files.length} file${files.length !== 1 ? 's' : ''} with Claude...`
                        : 'Extract & Populate'}
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

          {/* ── Step 2: Form ── */}
          {step === 'form' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="section-label-sm mb-0.5">Underwriting Inputs</div>
                  <p className="text-dark-muted text-sm">Review and adjust — then run the model.</p>
                </div>
                <button onClick={() => { setStep('source'); setResults(null) }} className="text-dark-muted text-xs uppercase tracking-widest hover:text-[#1a1a18]">
                  ← Change source
                </button>
              </div>

              <div className="space-y-10">

                {/* Property */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Property" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Property Name" value={inputs.propertyName} onChange={v => set('propertyName', v)} type="text" />
                    <Field label="Address" value={inputs.address} onChange={v => set('address', v)} type="text" />
                  </div>
                </div>

                {/* Acquisition */}
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

                {/* Operations */}
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

                {/* Debt */}
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

                {/* Exit */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Exit Assumptions" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Exit Cap Rate" value={inputs.exitCapRate} onChange={v => set('exitCapRate', v)} suffix="%" step="0.1" />
                    <Field label="Exit Month" value={inputs.exitMonth} onChange={v => set('exitMonth', v)} suffix="mo" />
                    <Field label="Selling Costs" value={inputs.sellingCostsPct} onChange={v => set('sellingCostsPct', v)} suffix="%" step="0.1" />
                  </div>
                </div>

                {/* GP/LP */}
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

                {/* Unit Mix */}
                <div className="border border-dark-border p-7">
                  <SectionHead title="Unit Mix" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-border">
                          {['Unit Type', '# Units', 'Avg SF', 'Current Rent/Mo', 'Market Rent/Mo'].map(h => (
                            <th key={h} className="text-left text-xs uppercase tracking-widest text-dark-muted font-normal pb-3 pr-4">{h}</th>
                          ))}
                          <th className="pb-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {unitMix.map((row, i) => (
                          <tr key={i} className="border-b border-dark-border/50 last:border-0">
                            <td className="py-2 pr-4 w-24">
                              <input
                                className="input-field py-1.5 text-sm font-mono"
                                type="text"
                                value={row.type}
                                onChange={e => setMix(i, 'type', e.target.value)}
                              />
                            </td>
                            {(['units', 'sqft', 'currentRent', 'marketRent'] as (keyof UnitMixRow)[]).map(k => (
                              <td key={k} className="py-2 pr-4">
                                <input
                                  className="input-field py-1.5 text-sm"
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={row[k]}
                                  onChange={e => setMix(i, k, e.target.value)}
                                  placeholder="—"
                                />
                              </td>
                            ))}
                            <td className="py-2">
                              <button
                                onClick={() => setUnitMix(prev => prev.filter((_, idx) => idx !== i))}
                                className="text-dark-muted hover:text-red-500 text-xs px-2"
                              >✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => setUnitMix(prev => [...prev, { type: '', units: '', sqft: '', currentRent: '', marketRent: '' }])}
                    className="mt-3 text-xs uppercase tracking-widest text-dark-muted border border-dark-border px-4 py-2 hover:border-gold/40 hover:text-gold transition-colors"
                  >
                    + Add Row
                  </button>
                </div>

              </div>

              {/* Run button */}
              <div className="mt-10 pt-8 border-t border-dark-border">
                {runError && (
                  <div className="mb-5 p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">{runError}</div>
                )}
                <div className="flex items-center gap-5">
                  <button onClick={handleRun} disabled={running} className="btn-gold disabled:opacity-60 text-base px-8 py-3">
                    {running ? 'Running model...' : 'Run Model'}
                  </button>
                  <p className="text-dark-muted text-xs leading-relaxed max-w-xs">
                    Results appear below instantly. Adjust any input and run again.
                  </p>
                </div>
              </div>

              {/* ── Results Dashboard ── */}
              {results && (
                <div id="uw-results" className="mt-14 pt-10 border-t-2 border-gold/30">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <div className="section-label-sm text-gold mb-1">Model Output</div>
                      <h2 className="font-serif text-3xl font-light text-[#1a1a18]">
                        {inputs.propertyName || 'Underwriting Results'}
                      </h2>
                      {inputs.address && <p className="text-dark-muted text-sm mt-1">{inputs.address}</p>}
                    </div>
                    <button
                      onClick={handleRun}
                      disabled={running}
                      className="text-xs uppercase tracking-widest border border-dark-border px-4 py-2 hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-50"
                    >
                      ↺ Re-run
                    </button>
                  </div>

                  {/* Primary metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <ResultCard label="Levered IRR" value={fmtPct(results.levered_irr)} highlight />
                    <ResultCard label="Equity Multiple" value={fmtX(results.equity_multiple)} highlight />
                    <ResultCard label="LP Multiple" value={fmtX(results.lp_equity_multiple)} highlight />
                    <ResultCard label="Avg Cash-on-Cash" value={fmtPct(results.avg_coc)} highlight />
                  </div>

                  {/* NOI row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <ResultCard label="Year 1 NOI" value={fmt$(results.year1_noi)} />
                    <ResultCard label="Year 5 NOI" value={fmt$(results.year5_noi)} />
                    <ResultCard label="Exit Value" value={fmt$(results.exit_value)} />
                    <ResultCard label="Total Project Cost" value={fmt$(results.total_project_cost)} />
                  </div>

                  {/* Diagnostics row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <ResultCard label="Going-In Cap" value={fmtPct(results.going_in_cap)} />
                    <ResultCard label="Stabilized Cap" value={fmtPct(results.stabilized_cap)} />
                    <ResultCard label="Price / Unit" value={fmt$(results.price_per_unit)} />
                    <ResultCard label="Price / SF" value={`$${results.price_per_sf}`} />
                  </div>

                  {/* Actions */}
                  <div className="mt-8 flex gap-3 flex-wrap">
                    <a
                      href={`/generate-loi?price=${inputs.purchasePrice}&irr=${(results.levered_irr * 100).toFixed(1)}&moic=${results.moic}&exitCap=${inputs.exitCapRate}&property=${encodeURIComponent(inputs.propertyName)}&address=${encodeURIComponent(inputs.address)}`}
                      className="btn-gold text-sm px-6 py-2.5"
                    >
                      → Generate LOI
                    </a>
                    <button
                      onClick={() => window.print()}
                      className="text-xs uppercase tracking-widest border border-dark-border px-5 py-2.5 hover:border-gold/40 hover:text-gold transition-colors"
                    ><button
  onClick={async () => {
    const payload = buildPayload(inputs, unitMix)
    const res = await fetch('/api/underwrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'download', inputs: payload }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inputs.propertyName || 'YEM'}_UW.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    }
  }}
  className="btn-gold text-sm px-6 py-2.5"
>
  ↓ Download Excel
</button>
                      Print / Save PDF
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
    </AuthGate>
  )
}
