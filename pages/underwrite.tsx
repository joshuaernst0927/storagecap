import Head from 'next/head'
import { useState, useEffect } from 'react'
import type { PipelineProperty } from '@/lib/pipelineData'
import { FileDropZone, type UploadFile } from '@/components/FileChips'
import AuthGate from '@/components/AuthGate'
import DealScoreBadge from '@/components/DealScoreBadge'

type UWInputs = {
  propertyName: string; address: string
  minTargetIRR: string; maxOfferPrice: string; gpEquityPct: string; lpEquityPct: string
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
  purchase_price: number; total_project_cost: number; equity_required: number
  year1_noi: number; year5_noi: number; levered_irr: number; equity_multiple: number
  avg_coc: number; exit_value: number; unlevered_irr: number; lp_equity_multiple: number
  moic: number; going_in_cap: number; stabilized_cap: number; price_per_unit: number; price_per_sf: number
}

const EMPTY: UWInputs = {
  propertyName: '', address: '',
  minTargetIRR: '15', maxOfferPrice: '', gpEquityPct: '10', lpEquityPct: '90',
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

function fromExtracted(data: Record<string, unknown>): { inputs: UWInputs; unitMix: UnitMixRow[] } {
  const p = (v: unknown, fallback = '') => v != null ? String(Math.round((v as number) * 10000) / 100) : fallback
  const n = (v: unknown, fallback = '') => v != null ? String(v) : fallback
  const inputs: UWInputs = {
    propertyName: String(data.propertyName ?? ''), address: String(data.address ?? ''),
    minTargetIRR: '15', maxOfferPrice: '', gpEquityPct: '10', lpEquityPct: '90',
    purchasePrice: n(data.purchasePrice), closingCostsPct: p(data.closingCostsPct, '3'),
    initialRepairs: n(data.initialRepairs, '0'), acquisitionFeePct: p(data.acquisitionFeePct, '2'),
    assetMgmtFeePct: p(data.assetMgmtFeePct, '1.5'), dispositionFeePct: p(data.dispositionFeePct, '1'),
    startOccupancy: p(data.startOccupancy), stabilizedOccupancy: p(data.stabilizedOccupancy, '90'),
    monthsToStabilization: n(data.monthsToStabilization, '18'), annualRentGrowth: p(data.annualRentGrowth, '5'),
    opexGrowth: p(data.opexGrowth, '2.5'), initialLTV: p(data.initialLTV, '65'),
    initialRate: p(data.initialRate, '7'), initialAmortYears: n(data.initialAmortYears, '30'),
    ioPeriodMonths: n(data.ioPeriodMonths, '24'), minDSCR: n(data.minDSCR, '1.25'),
    refiMonth: n(data.refiMonth, '24'), refiLTV: p(data.refiLTV, '65'),
    refiRate: p(data.refiRate, '6.5'), refiAmortYears: n(data.refiAmortYears, '30'),
    exitCapRate: p(data.exitCapRate), exitMonth: n(data.exitMonth, '60'),
    sellingCostsPct: p(data.sellingCostsPct, '2'), preferredReturn: p(data.preferredReturn, '8'),
    lpCatchUp: p(data.lpCatchUp, '80'), gpCatchUp: p(data.gpCatchUp, '20'),
    lpResidual: p(data.lpResidual, '80'), gpResidual: p(data.gpResidual, '20'),
  }
  const rawMix = (data.unitMix as Array<Record<string, unknown>>) ?? []
  const unitMix = DEFAULT_MIX.map(def => {
    const match = rawMix.find(r => String(r.type ?? '').toLowerCase().replace(/\s/g, '') === def.type.toLowerCase())
    if (!match) return def
    return { type: def.type, units: match.units != null ? String(match.units) : '', sqft: match.sqft != null ? String(match.sqft) : def.sqft, currentRent: match.currentRent != null ? String(match.currentRent) : '', marketRent: match.marketRent != null ? String(match.marketRent) : '' }
  })
  return { inputs, unitMix }
}

function buildPayload(inputs: UWInputs, unitMix: UnitMixRow[]) {
  const pct = (s: string) => s !== '' ? parseFloat(s) / 100 : null
  const num = (s: string) => s !== '' ? parseFloat(s) : null
  const int = (s: string) => s !== '' ? parseInt(s, 10) : null
  return {
    purchasePrice: num(inputs.purchasePrice), closingCostsPct: pct(inputs.closingCostsPct),
    initialRepairs: num(inputs.initialRepairs), acquisitionFeePct: pct(inputs.acquisitionFeePct),
    assetMgmtFeePct: pct(inputs.assetMgmtFeePct), dispositionFeePct: pct(inputs.dispositionFeePct),
    startOccupancy: pct(inputs.startOccupancy), stabilizedOccupancy: pct(inputs.stabilizedOccupancy),
    monthsToStabilization: int(inputs.monthsToStabilization), annualRentGrowth: pct(inputs.annualRentGrowth),
    opexGrowth: pct(inputs.opexGrowth), initialLTV: pct(inputs.initialLTV),
    initialRate: pct(inputs.initialRate), initialAmortYears: int(inputs.initialAmortYears),
    ioPeriodMonths: int(inputs.ioPeriodMonths), minDSCR: num(inputs.minDSCR),
    refiMonth: int(inputs.refiMonth), refiLTV: pct(inputs.refiLTV),
    refiRate: pct(inputs.refiRate), refiAmortYears: int(inputs.refiAmortYears),
    exitCapRate: pct(inputs.exitCapRate), exitMonth: int(inputs.exitMonth),
    sellingCostsPct: pct(inputs.sellingCostsPct), preferredReturn: pct(inputs.preferredReturn),
    lpCatchUp: pct(inputs.lpCatchUp), gpCatchUp: pct(inputs.gpCatchUp),
    lpResidual: pct(inputs.lpResidual), gpResidual: pct(inputs.gpResidual),
    unitMix: unitMix.filter(r => r.units || r.currentRent || r.marketRent).map(r => ({
      type: r.type.toLowerCase(),
      units: r.units ? parseInt(r.units, 10) : null,
      sqft: r.sqft ? parseFloat(r.sqft) : null,
      currentRent: r.currentRent ? parseFloat(r.currentRent) : null,
      marketRent: r.marketRent ? parseFloat(r.marketRent) : null,
    })),
  }
}

const fmt$ = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${n.toLocaleString()}`
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`
const fmtX = (n: number) => `${n.toFixed(2)}x`

function ResultCard({ label, value, highlight, pass, fail }: { label: string; value: string; highlight?: boolean; pass?: boolean; fail?: boolean }) {
  const border = fail ? 'border-red-400 bg-red-50' : pass ? 'border-green-500 bg-green-50' : highlight ? 'border-gold bg-gold/5' : 'border-dark-border'
  const color = fail ? 'text-red-600' : pass ? 'text-green-700' : highlight ? 'text-gold' : 'text-[#1a1a18]'
  return (
    <div className={`border p-5 ${border}`}>
      <div className="uppercase tracking-widest mb-2" style={{ fontSize: '0.8rem', color: '#6B6860' }}>{label}</div>
      <div className={`font-serif font-light ${color}`} style={{ fontSize: '1.6rem' }}>{value}</div>
    </div>
  )
}

function VerdictBanner({ results, minIRR }: { results: ModelResults; minIRR: number }) {
  const passes = results.levered_irr >= minIRR / 100
  const spread = ((results.levered_irr - minIRR / 100) * 100).toFixed(1)
  return (
    <div className={`p-6 border-2 mb-6 flex items-center justify-between ${passes ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'}`}>
      <div>
        <div className={`font-semibold ${passes ? 'text-green-700' : 'text-red-600'}`} style={{ fontSize: '1.15rem' }}>
          {passes ? '✅ Deal Passes' : '❌ Deal Fails'}
        </div>
        <div className="mt-1" style={{ fontSize: '0.95rem', color: '#6B6860' }}>
          {passes
            ? `IRR of ${fmtPct(results.levered_irr)} exceeds your ${minIRR}% minimum by ${spread}%`
            : `IRR of ${fmtPct(results.levered_irr)} is below your ${minIRR}% minimum by ${Math.abs(parseFloat(spread))}%`}
        </div>
      </div>
      <div className={`font-serif font-light ${passes ? 'text-green-700' : 'text-red-600'}`} style={{ fontSize: '2.5rem' }}>
        {fmtPct(results.levered_irr)}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'number', suffix, step, min }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; suffix?: string; step?: string; min?: string
}) {
  return (
    <div>
      <label className="label-text">{label}{suffix && <span className="ml-1" style={{ color: '#6B6860' }}>({suffix})</span>}</label>
      <input className="input-field" type={type} step={step ?? (type === 'number' ? 'any' : undefined)} min={min} value={value} onChange={e => onChange(e.target.value)} autoComplete="off" />
    </div>
  )
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="border-b border-dark-border pb-2 mb-5">
      <div className="font-sans uppercase tracking-widest font-semibold" style={{ fontSize: '0.85rem', color: '#D4A843', letterSpacing: '0.14em' }}>{title}</div>
    </div>
  )
}

function Card({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div className={`border p-7 ${gold ? 'border-gold/40 bg-gold/5 border-2' : 'border-dark-border'}`}>
      {children}
    </div>
  )
}

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
  const setMix = (i: number, k: keyof UnitMixRow, v: string) => setUnitMix(prev => prev.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  useEffect(() => {
    fetch('/api/pipeline-ingest').then(r => r.ok ? r.json() : []).then((d: PipelineProperty[]) => setPipelineDeals(d)).catch(() => {})
  }, [])

  function handleLoadDeal() {
    const deal = pipelineDeals.find(d => d.id === selectedDealId)
    if (!deal) return
    const occ = deal.occupancy > 1 ? deal.occupancy / 100 : deal.occupancy
    const askPrice = deal.askingPrice ?? deal.estimatedValue ?? 0
    const exitCap = (deal.noi && askPrice) ? deal.noi / askPrice : null
    setInputs({ ...EMPTY, propertyName: deal.facilityName, address: `${deal.address}, ${deal.city}, ${deal.state}`, purchasePrice: askPrice ? String(askPrice) : '', startOccupancy: String(Math.round(occ * 100 * 100) / 100), exitCapRate: exitCap ? String(Math.round(exitCap * 10000) / 100) : '' })
    setUnitMix(DEFAULT_MIX); setResults(null); setStep('form')
  }

  function handleManual() { setInputs(EMPTY); setUnitMix(DEFAULT_MIX); setResults(null); setStep('form') }

  async function handleExtract() {
    if (files.length === 0) return
    setExtracting(true); setExtractError('')
    try {
      const filePayloads = await Promise.all(files.map(async ({ file, mime }) => {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject; reader.readAsDataURL(file)
        })
        return { fileName: file.name, mimeType: mime, data: base64 }
      }))
      const res = await fetch('/api/underwrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'extract', files: filePayloads }) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`) }
      const data = await res.json()
      const { inputs: newInputs, unitMix: newMix } = fromExtracted(data)
      setInputs(newInputs); setUnitMix(newMix); setResults(null); setStep('form')
    } catch (err) { setExtractError(String(err)) }
    finally { setExtracting(false) }
  }

  async function handleRun() {
    setRunning(true); setRunError(''); setResults(null)
    try {
      const payload = buildPayload(inputs, unitMix)
      const res = await fetch('/api/underwrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run', inputs: payload }) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? err.error ?? `HTTP ${res.status}`) }
      const data: ModelResults = await res.json()
      setResults(data)
      setTimeout(() => { document.getElementById('uw-results')?.scrollIntoView({ behavior: 'smooth' }) }, 100)
    } catch (err) { setRunError(String(err)) }
    finally { setRunning(false) }
  }

  async function handleDownload() {
    try {
      const payload = buildPayload(inputs, unitMix)
      const res = await fetch('/api/underwrite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'download', inputs: payload }) })
      if (res.ok) {
        const blob = await res.blob(); const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${inputs.propertyName || 'YEM'}_UW.xlsx`
        a.click(); URL.revokeObjectURL(url)
      }
    } catch (err) { console.error('download error', err) }
  }

  const totalEquity = results ? results.equity_required : 0
  const gpPct = parseFloat(inputs.gpEquityPct) / 100 || 0
  const lpPct = parseFloat(inputs.lpEquityPct) / 100 || 0
  const gpEquity = totalEquity * gpPct
  const lpEquity = totalEquity * lpPct
  const minIRR = parseFloat(inputs.minTargetIRR) || 15

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
        <h1 className="display-heading max-w-3xl mb-6" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}>
          Load a deal.<br /><em className="text-gold">Run the model.</em>
        </h1>
        <p className="leading-relaxed" style={{ fontSize: '1.15rem', color: '#6B6860', maxWidth: '520px' }}>
          Upload a rent roll, T12, or OM. Claude extracts every input.
          Review, edit, and run the model — IRR, MOIC, NOI, and exit value back in seconds.
        </p>
      </section>

      <section className="py-14">
        <div className="section-container max-w-4xl">

          {step === 'source' && (
            <>
              <div className="flex gap-2 mb-8 border-b border-dark-border pb-4">
                {(['upload', 'pipeline', 'manual'] as Source[]).map(s => (
                  <button key={s} onClick={() => setSource(s)}
                    className={`px-5 py-2.5 uppercase tracking-widest border transition-colors duration-150 ${source === s ? 'border-gold text-gold bg-gold/5' : 'border-dark-border text-dark-muted hover:border-gold/40'}`}
                    style={{ fontSize: '0.8rem' }}>
                    {s === 'upload' ? 'Upload Document' : s === 'pipeline' ? 'From Pipeline' : 'Enter Manually'}
                  </button>
                ))}
              </div>

              {source === 'upload' && (
                <div>
                  <FileDropZone files={files} onChange={setFiles} disabled={extracting} />
                  {extractError && <div className="mt-4 mb-2 p-4 border border-red-400/40 bg-red-50 text-red-700" style={{ fontSize: '1rem' }}>{extractError}</div>}
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
                    <div className="p-8 border border-dark-border bg-dark-surface text-center">
                      <p className="font-serif font-light text-[#1B2B5E] mb-2" style={{ fontSize: '1.4rem' }}>No pipeline deals found.</p>
                      <p style={{ fontSize: '1rem', color: '#6B6860' }}>Run the pipeline scraper or add a deal via Upload Deal.</p>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="label-text">Select Deal</label>
                        <select className="input-field" value={selectedDealId} onChange={e => setSelectedDealId(e.target.value)}>
                          <option value="">— Choose a deal —</option>
                          {pipelineDeals.map(d => (
                            <option key={d.id} value={d.id}>{d.facilityName} · {d.city}, {d.state}{d.dealScore != null ? ` · Score ${d.dealScore}` : ''}</option>
                          ))}
                        </select>
                        {selectedDealId && (() => { const d = pipelineDeals.find(x => x.id === selectedDealId); return d?.dealScore != null ? <div className="mt-1.5"><DealScoreBadge score={d.dealScore} dealType={d.dealType} size="sm" /></div> : null })()}
                      </div>
                      <button onClick={handleLoadDeal} disabled={!selectedDealId} className="btn-gold disabled:opacity-60 mb-0.5">Load Deal</button>
                    </div>
                  )}
                </div>
              )}

              {source === 'manual' && (
                <div className="p-8 border border-dark-border bg-dark-surface text-center">
                  <p className="font-serif font-light text-[#1B2B5E] mb-2" style={{ fontSize: '1.4rem' }}>Enter inputs manually</p>
                  <p className="mb-6" style={{ fontSize: '1rem', color: '#6B6860' }}>All fields pre-loaded with typical defaults. Adjust as needed.</p>
                  <button onClick={handleManual} className="btn-gold">Open Form</button>
                </div>
              )}
            </>
          )}

          {step === 'form' && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="font-sans uppercase tracking-widest font-semibold mb-1" style={{ fontSize: '0.85rem', color: '#D4A843' }}>Underwriting Inputs</div>
                  <p style={{ fontSize: '1rem', color: '#6B6860' }}>Review and adjust — then run the model.</p>
                </div>
                <button onClick={() => { setStep('source'); setResults(null) }} className="uppercase tracking-widest hover:text-[#1a1a18] transition-colors" style={{ fontSize: '0.8rem', color: '#6B6860' }}>
                  ← Change source
                </button>
              </div>

              <div className="space-y-6">

                <Card>
                  <SectionHead title="Property" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Property Name" value={inputs.propertyName} onChange={v => set('propertyName', v)} type="text" />
                    <Field label="Address" value={inputs.address} onChange={v => set('address', v)} type="text" />
                  </div>
                </Card>

                <Card gold>
                  <SectionHead title="Deal Criteria" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Min Target IRR" value={inputs.minTargetIRR} onChange={v => set('minTargetIRR', v)} suffix="%" step="0.5" />
                    <Field label="Max Offer Price" value={inputs.maxOfferPrice} onChange={v => set('maxOfferPrice', v)} suffix="$" />
                    <Field label="GP Equity" value={inputs.gpEquityPct} onChange={v => set('gpEquityPct', v)} suffix="%" step="1" />
                    <Field label="LP Equity" value={inputs.lpEquityPct} onChange={v => set('lpEquityPct', v)} suffix="%" step="1" />
                  </div>
                  <p className="mt-3" style={{ fontSize: '0.9rem', color: '#6B6860' }}>These criteria flag Go / No-Go in results. Max Offer Price is for reference only.</p>
                </Card>

                <Card>
                  <SectionHead title="Acquisition & Fees" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Purchase Price" value={inputs.purchasePrice} onChange={v => set('purchasePrice', v)} suffix="$" />
                    <Field label="Initial Repairs / CapEx" value={inputs.initialRepairs} onChange={v => set('initialRepairs', v)} suffix="$" />
                    <Field label="Closing Costs" value={inputs.closingCostsPct} onChange={v => set('closingCostsPct', v)} suffix="%" step="0.1" />
                    <Field label="Acquisition Fee" value={inputs.acquisitionFeePct} onChange={v => set('acquisitionFeePct', v)} suffix="%" step="0.1" />
                    <Field label="Asset Mgmt Fee" value={inputs.assetMgmtFeePct} onChange={v => set('assetMgmtFeePct', v)} suffix="% of EGI" step="0.1" />
                    <Field label="Disposition Fee" value={inputs.dispositionFeePct} onChange={v => set('dispositionFeePct', v)} suffix="%" step="0.1" />
                  </div>
                </Card>

                <Card>
                  <SectionHead title="Operations" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Starting Occupancy" value={inputs.startOccupancy} onChange={v => set('startOccupancy', v)} suffix="%" step="0.1" />
                    <Field label="Stabilized Occupancy" value={inputs.stabilizedOccupancy} onChange={v => set('stabilizedOccupancy', v)} suffix="%" step="0.1" />
                    <Field label="Months to Stabilization" value={inputs.monthsToStabilization} onChange={v => set('monthsToStabilization', v)} min="0" />
                    <Field label="Annual Rent Growth" value={inputs.annualRentGrowth} onChange={v => set('annualRentGrowth', v)} suffix="%" step="0.1" />
                    <Field label="OpEx Growth" value={inputs.opexGrowth} onChange={v => set('opexGrowth', v)} suffix="%" step="0.1" />
                  </div>
                </Card>

                <Card>
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
                </Card>

                <Card>
                  <SectionHead title="Exit Assumptions" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Exit Cap Rate" value={inputs.exitCapRate} onChange={v => set('exitCapRate', v)} suffix="%" step="0.1" />
                    <Field label="Exit Month" value={inputs.exitMonth} onChange={v => set('exitMonth', v)} suffix="mo" />
                    <Field label="Selling Costs" value={inputs.sellingCostsPct} onChange={v => set('sellingCostsPct', v)} suffix="%" step="0.1" />
                  </div>
                </Card>

                <Card>
                  <SectionHead title="GP / LP Waterfall" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Preferred Return" value={inputs.preferredReturn} onChange={v => set('preferredReturn', v)} suffix="%" step="0.5" />
                    <Field label="LP Catch-Up Split" value={inputs.lpCatchUp} onChange={v => set('lpCatchUp', v)} suffix="%" />
                    <Field label="GP Catch-Up Split" value={inputs.gpCatchUp} onChange={v => set('gpCatchUp', v)} suffix="%" />
                    <Field label="LP Residual Split" value={inputs.lpResidual} onChange={v => set('lpResidual', v)} suffix="%" />
                    <Field label="GP Residual Split" value={inputs.gpResidual} onChange={v => set('gpResidual', v)} suffix="%" />
                  </div>
                </Card>

                <Card>
                  <SectionHead title="Unit Mix" />
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-dark-border">
                          {['Unit Type', '# Units', 'Avg SF', 'Current Rent/Mo', 'Market Rent/Mo'].map(h => (
                            <th key={h} className="text-left uppercase tracking-widest font-normal pb-3 pr-4" style={{ fontSize: '0.8rem', color: '#6B6860' }}>{h}</th>
                          ))}
                          <th className="pb-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {unitMix.map((row, i) => (
                          <tr key={i} className="border-b border-dark-border/50 last:border-0">
                            <td className="py-2 pr-4 w-24">
                              <input className="input-field py-2 font-mono" style={{ fontSize: '1rem' }} type="text" value={row.type} onChange={e => setMix(i, 'type', e.target.value)} />
                            </td>
                            {(['units', 'sqft', 'currentRent', 'marketRent'] as (keyof UnitMixRow)[]).map(k => (
                              <td key={k} className="py-2 pr-4">
                                <input className="input-field py-2" style={{ fontSize: '1rem' }} type="number" step="any" min="0" value={row[k]} onChange={e => setMix(i, k, e.target.value)} placeholder="—" />
                              </td>
                            ))}
                            <td className="py-2">
                              <button onClick={() => setUnitMix(prev => prev.filter((_, idx) => idx !== i))} className="text-dark-muted hover:text-red-500 px-2" style={{ fontSize: '1rem' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => setUnitMix(prev => [...prev, { type: '', units: '', sqft: '', currentRent: '', marketRent: '' }])}
                    className="mt-3 uppercase tracking-widest border border-dark-border px-4 py-2 hover:border-gold/40 hover:text-gold transition-colors"
                    style={{ fontSize: '0.85rem', color: '#6B6860' }}>
                    + Add Row
                  </button>
                </Card>

              </div>

              {/* Run button */}
              <div className="mt-10 pt-8 border-t border-dark-border">
                {runError && <div className="mb-5 p-4 border border-red-400/40 bg-red-50 text-red-700" style={{ fontSize: '1rem' }}>{runError}</div>}
                <div className="flex items-center gap-5">
                  <button onClick={handleRun} disabled={running} className="btn-gold disabled:opacity-60 px-8 py-3" style={{ fontSize: '1rem' }}>
                    {running ? 'Running model...' : 'Run Model'}
                  </button>
                  <p className="leading-relaxed max-w-xs" style={{ fontSize: '0.9rem', color: '#6B6860' }}>
                    Results appear below instantly. Adjust any input and run again.
                  </p>
                </div>
              </div>

              {/* Results */}
              {results && (
                <div id="uw-results" className="mt-14 pt-10 border-t-2 border-gold/30">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="font-sans uppercase tracking-widest font-semibold mb-1" style={{ fontSize: '0.85rem', color: '#D4A843' }}>Model Output</div>
                      <h2 className="font-serif font-light text-[#1a1a18]" style={{ fontSize: '2rem' }}>{inputs.propertyName || 'Underwriting Results'}</h2>
                      {inputs.address && <p className="mt-1" style={{ fontSize: '1rem', color: '#6B6860' }}>{inputs.address}</p>}
                    </div>
                    <button onClick={handleRun} disabled={running} className="uppercase tracking-widest border border-dark-border px-4 py-2 hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-50" style={{ fontSize: '0.85rem' }}>↺ Re-run</button>
                  </div>

                  <VerdictBanner results={results} minIRR={minIRR} />

                  {totalEquity > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="border border-dark-border p-5">
                        <div className="uppercase tracking-widest mb-2" style={{ fontSize: '0.8rem', color: '#6B6860' }}>GP Equity ({inputs.gpEquityPct}%)</div>
                        <div className="font-serif font-light text-[#1a1a18]" style={{ fontSize: '1.6rem' }}>{fmt$(gpEquity)}</div>
                      </div>
                      <div className="border border-dark-border p-5">
                        <div className="uppercase tracking-widest mb-2" style={{ fontSize: '0.8rem', color: '#6B6860' }}>LP Equity ({inputs.lpEquityPct}%)</div>
                        <div className="font-serif font-light text-[#1a1a18]" style={{ fontSize: '1.6rem' }}>{fmt$(lpEquity)}</div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <ResultCard label="Levered IRR" value={fmtPct(results.levered_irr)} pass={results.levered_irr >= minIRR / 100} fail={results.levered_irr < minIRR / 100} />
                    <ResultCard label="Equity Multiple" value={fmtX(results.equity_multiple)} highlight />
                    <ResultCard label="LP Multiple" value={fmtX(results.lp_equity_multiple)} highlight />
                    <ResultCard label="Avg Cash-on-Cash" value={fmtPct(results.avg_coc)} highlight />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <ResultCard label="Year 1 NOI" value={fmt$(results.year1_noi)} />
                    <ResultCard label="Year 5 NOI" value={fmt$(results.year5_noi)} />
                    <ResultCard label="Exit Value" value={fmt$(results.exit_value)} />
                    <ResultCard label="Total Project Cost" value={fmt$(results.total_project_cost)} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <ResultCard label="Going-In Cap" value={fmtPct(results.going_in_cap)} />
                    <ResultCard label="Stabilized Cap" value={fmtPct(results.stabilized_cap)} />
                    <ResultCard label="Price / Unit" value={fmt$(results.price_per_unit)} />
                    <ResultCard label="Price / SF" value={`$${results.price_per_sf}`} />
                  </div>

                  {inputs.maxOfferPrice && (
                    <div className={`p-4 border mt-3 ${parseFloat(inputs.purchasePrice) <= parseFloat(inputs.maxOfferPrice) ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700'}`} style={{ fontSize: '1rem' }}>
                      {parseFloat(inputs.purchasePrice) <= parseFloat(inputs.maxOfferPrice)
                        ? `✅ Purchase price of ${fmt$(parseFloat(inputs.purchasePrice))} is within your max offer of ${fmt$(parseFloat(inputs.maxOfferPrice))}`
                        : `❌ Purchase price of ${fmt$(parseFloat(inputs.purchasePrice))} exceeds your max offer of ${fmt$(parseFloat(inputs.maxOfferPrice))}`}
                    </div>
                  )}

                  <div className="mt-8 flex gap-3 flex-wrap">
                    <a href={`/generate-loi?price=${inputs.purchasePrice}&irr=${(results.levered_irr * 100).toFixed(1)}&moic=${results.moic}&exitCap=${inputs.exitCapRate}&property=${encodeURIComponent(inputs.propertyName)}&address=${encodeURIComponent(inputs.address)}`} className="btn-gold px-6 py-2.5" style={{ fontSize: '1rem' }}>
                      → Generate LOI
                    </a>
                    <button onClick={handleDownload} className="btn-gold px-6 py-2.5" style={{ fontSize: '1rem' }}>↓ Download Excel</button>
                    <button onClick={() => window.print()} className="uppercase tracking-widest border border-dark-border px-5 py-2.5 hover:border-gold/40 hover:text-gold transition-colors" style={{ fontSize: '0.85rem' }}>Print / Save PDF</button>
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
