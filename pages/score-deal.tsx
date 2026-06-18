import Head from 'next/head'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/router'
import AuthGate from '@/components/AuthGate'
import DealScoreBadge from '@/components/DealScoreBadge'
import { saveProperty, loadSavedProperties } from '@/lib/pipelineStore'
import type { PipelineProperty } from '@/lib/pipelineData'
import {
  DealType, DealScoreInputs, DEAL_TYPE_LABELS,
  UNIVERSAL_CRITERIA, SPECIFIC_CRITERIA, GROUP_LABELS,
  computeDealScore, blankInputs,
} from '@/lib/dealScore'

// ─── Criterion slider row ──────────────────────────────────────────────────────

function CriterionRow({
  criterion, value, onChange,
}: {
  criterion: (typeof UNIVERSAL_CRITERIA)[0]
  value: number
  onChange: (v: number) => void
}) {
  const pct = Math.round((value / criterion.max) * 100)
  const barColor =
    pct >= 70 ? 'bg-green-500' :
    pct >= 35 ? 'bg-amber-400' :
    'bg-gray-300'

  return (
    <div className="py-3 border-b border-dark-border last:border-b-0">
      <div className="flex items-start justify-between gap-4 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[#1a1a18] leading-snug">{criterion.label}</div>
          <div className="text-xs text-dark-muted mt-0.5 leading-relaxed">{criterion.hint}</div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[#1B2B5E] w-4 text-right">{value}</span>
          <span className="text-dark-muted text-xs">/ {criterion.max}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[0.6rem] text-dark-muted w-3 text-center">0</span>
        <div className="flex-1 relative">
          <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={criterion.max}
            step={1}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-[0.6rem] text-dark-muted w-4 text-center">{criterion.max}</span>
      </div>
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  groupKey, inputs, onChange,
}: {
  groupKey: string
  inputs: DealScoreInputs
  onChange: (key: string, v: number) => void
}) {
  const allCriteria = [...UNIVERSAL_CRITERIA, ...Object.values(SPECIFIC_CRITERIA).flat()]
  const criteria = allCriteria.filter(c => c.group === groupKey)
  const meta = GROUP_LABELS[groupKey]
  const earned = criteria.reduce((s, c) => s + (Number(inputs[c.key]) || 0), 0)

  return (
    <div className="border border-dark-border bg-white">
      <div className="flex items-center justify-between px-6 py-4 bg-dark-surface border-b border-dark-border">
        <div>
          <div className={`text-xs uppercase tracking-widest font-bold ${meta.color}`}>{meta.label}</div>
          <div className="text-[0.65rem] text-dark-muted mt-0.5">{meta.max} points available</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 bg-dark-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${earned / meta.max >= 0.7 ? 'bg-green-500' : earned / meta.max >= 0.35 ? 'bg-amber-400' : 'bg-gray-300'}`}
              style={{ width: `${Math.round((earned / meta.max) * 100)}%` }}
            />
          </div>
          <span className="font-mono text-sm font-bold text-[#1B2B5E]">{earned}<span className="text-dark-muted font-normal text-xs">/{meta.max}</span></span>
        </div>
      </div>
      <div className="px-6">
        {criteria.map(c => (
          <CriterionRow
            key={c.key}
            criterion={c}
            value={Number(inputs[c.key]) || 0}
            onChange={v => onChange(c.key, v)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Score display ────────────────────────────────────────────────────────────

function ScorePanel({
  score, dealType, onSave, saving, saveError, saved, isOverride,
}: {
  score: ReturnType<typeof computeDealScore>
  dealType: DealType
  onSave: () => void
  saving: boolean
  saveError: string
  saved: boolean
  isOverride?: boolean
}) {
  const { total, breakdown, tier } = score
  const tierBg   = tier === 'HOT' ? 'bg-green-600' : tier === 'WARM' ? 'bg-amber-500' : 'bg-gray-500'
  const tierText = tier === 'HOT' ? 'text-green-700' : tier === 'WARM' ? 'text-amber-700' : 'text-gray-600'
  const tierBorder = tier === 'HOT' ? 'border-green-200' : tier === 'WARM' ? 'border-amber-200' : 'border-gray-200'

  return (
    <div className="border border-dark-border bg-white sticky top-24">
      {/* Score header */}
      <div className={`${tier === 'HOT' ? 'bg-green-600' : tier === 'WARM' ? 'bg-amber-500' : 'bg-gray-500'} px-6 py-5 text-white`}>
        <div className="text-[0.65rem] uppercase tracking-widest opacity-75 mb-1">Deal Score</div>
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-6xl font-light leading-none">{total}</span>
          <div>
            <div className="text-xl font-bold uppercase tracking-wider">{tier}</div>
            <div className="text-xs opacity-75">{DEAL_TYPE_LABELS[dealType]}</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${total}%` }} />
        </div>
        <div className="flex justify-between text-[0.6rem] opacity-60 mt-1">
          <span>0</span><span>40</span><span>75</span><span>100</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="px-6 py-4 space-y-2 border-b border-dark-border">
        {[
          { label: 'Location & Market',    val: breakdown.locationMarket,   max: 20 },
          { label: 'Price vs Value',        val: breakdown.priceValue,       max: 20 },
          { label: 'Seller Motivation',     val: breakdown.sellerMotivation, max: 15 },
          { label: DEAL_TYPE_LABELS[dealType], val: breakdown.specific, max: 45 },
        ].map(({ label, val, max }) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-dark-muted truncate pr-2">{label}</span>
              <span className="font-mono font-bold text-[#1B2B5E] flex-shrink-0">{val}<span className="text-dark-muted font-normal">/{max}</span></span>
            </div>
            <div className="h-1 bg-dark-border rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${val / max >= 0.7 ? 'bg-green-500' : val / max >= 0.35 ? 'bg-amber-400' : 'bg-gray-300'}`}
                style={{ width: `${Math.round((val / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tier legend */}
      <div className={`mx-6 my-4 border rounded px-3 py-2 text-xs ${tierText} ${tierBorder} bg-white`}>
        {tier === 'HOT'  && 'Score ≥ 75 — Strong conviction. All criteria firing. Move to LOI.'}
        {tier === 'WARM' && 'Score 40–74 — Viable deal with selective upside. Continue diligence.'}
        {tier === 'PASS' && 'Score < 40 — Weak fundamentals across multiple categories. Pass.'}
      </div>

      {/* Save */}
      <div className="px-6 pb-6">
        {saveError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 mb-3">{saveError}</p>}
        {saved && <p className="text-xs text-green-700 bg-green-50 border border-green-200 p-2 mb-3">Saved to pipeline.</p>}
        <button
          onClick={onSave}
          disabled={saving || saved}
          className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : isOverride ? 'Update Score' : 'Save to Pipeline'}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ScoreDealContent() {
  const router = useRouter()
  const [dealType, setDealType] = useState<DealType>('value-add')
  const [inputs, setInputs] = useState<DealScoreInputs>(blankInputs('value-add'))
  const [dealInfo, setDealInfo] = useState({
    facilityName: '', address: '', city: '', state: '',
    unitCount: '', askingPrice: '', noi: '', occupancy: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [existingPropertyId, setExistingPropertyId] = useState<string | null>(null)

  // Pre-populate from ?id= query param (Override Score flow)
  useEffect(() => {
    if (!router.isReady) return
    const id = router.query.id as string | undefined
    if (!id) return
    const found = loadSavedProperties().find(p => p.id === id)
    if (!found) return

    setExistingPropertyId(id)
    setDealInfo({
      facilityName: found.facilityName ?? '',
      address: found.address ?? '',
      city: found.city ?? '',
      state: found.state ?? '',
      unitCount: found.unitCount ? String(found.unitCount) : '',
      askingPrice: found.askingPrice ? String(found.askingPrice) : '',
      noi: found.noi ? String(found.noi) : '',
      occupancy: found.occupancy ? String(found.occupancy) : '',
    })

    if (found.dealType) {
      const dt = found.dealType as DealType
      setDealType(dt)
      if (found.dealScoreInputs) {
        setInputs({ dealType: dt, ...found.dealScoreInputs } as DealScoreInputs)
      } else {
        setInputs(blankInputs(dt))
      }
    }
  }, [router.isReady])

  const setDealTypeAndReset = (t: DealType) => {
    setDealType(t)
    setInputs(blankInputs(t))
    setSaved(false)
  }

  const set = (key: string, v: number) =>
    setInputs(prev => ({ ...prev, [key]: v }))

  const setInfo = (k: keyof typeof dealInfo, v: string) =>
    setDealInfo(prev => ({ ...prev, [k]: v }))

  const score = useMemo(() => computeDealScore(inputs), [inputs])

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const scoreFields = {
        dealScore: score.total,
        dealType: dealType,
        dealScoreBreakdown: score.breakdown,
        dealScoreInputs: inputs as Record<string, string | number>,
        dealScoredAt: new Date().toISOString(),
      }

      // Override mode: update existing pipeline property in place
      if (existingPropertyId) {
        const existing = loadSavedProperties().find(p => p.id === existingPropertyId)
        if (existing) {
          const updated: PipelineProperty = { ...existing, ...scoreFields }
          saveProperty(updated)
          fetch('/api/pipeline-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([updated]),
          }).catch(() => {})
          setSaved(true)
          return
        }
      }

      // New property (standalone scoring flow)
      const property: PipelineProperty = {
        id: `scored-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        facilityName: dealInfo.facilityName || 'Scored Deal',
        address: dealInfo.address,
        city: dealInfo.city,
        state: dealInfo.state,
        zipCode: '',
        unitCount: dealInfo.unitCount ? parseInt(dealInfo.unitCount) : 0,
        unitMix: '',
        yearBuilt: 0,
        landAcres: 0,
        climatePercent: 0,
        estimatedValue: dealInfo.askingPrice ? parseFloat(dealInfo.askingPrice) : 0,
        askingPrice: dealInfo.askingPrice ? parseFloat(dealInfo.askingPrice) : undefined,
        noi: dealInfo.noi ? parseFloat(dealInfo.noi) : undefined,
        occupancy: dealInfo.occupancy ? parseFloat(dealInfo.occupancy) : 0,
        ownerName: '',
        ownerEntity: '',
        ownerEntityState: dealInfo.state,
        ownerMailingAddress: '',
        distressSignals: {
          taxDelinquency: false, fireCodeViolations: false,
          codeViolations: [], lisPendens: false,
          decliningOccupancy: false, deferredMaintenance: false,
          outOfStateOwner: false,
        },
        motivationScore: 0,
        stage: 'identified',
        currentStatus: 'outreach-sent',
        priority: 'medium',
        source: 'broker',
        addedDate: new Date().toISOString().split('T')[0],
        ...scoreFields,
      }

      saveProperty(property)
      fetch('/api/pipeline-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([property]),
      }).catch(() => {})

      setSaved(true)
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const universalGroups = ['location', 'price', 'motivation'] as const
  const specificGroups = {
    'value-add': ['value-add'],
    'stabilized': ['stabilized'],
    'distressed': ['distressed'],
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-dark-border" style={{ backgroundColor: '#1B2B5E' }}>
        <div className="relative z-10 page-hero">
          <div className="section-label" style={{ color: '#D4A843' }}>Deal Analysis</div>
          <h1 className="font-serif font-light text-white leading-[1.05] max-w-3xl mb-4" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}>
            100-Point<br />
            <em style={{ color: '#D4A843' }}>Deal Score.</em>
          </h1>
          <p className="text-lg max-w-xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Score any deal across Location, Price, Motivation, and deal-type upside.
            HOT ≥ 75 · WARM 40–74 · PASS &lt; 40
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left: form ──────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Deal Info */}
              <div className="border border-dark-border bg-white p-6">
                <div className="section-label mb-4">Deal Info</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="form-label">Property / Facility Name</label>
                    <input className="form-input" value={dealInfo.facilityName} onChange={e => setInfo('facilityName', e.target.value)} placeholder="ABC Self Storage" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={dealInfo.address} onChange={e => setInfo('address', e.target.value)} placeholder="123 Main St" />
                  </div>
                  <div>
                    <label className="form-label">City</label>
                    <input className="form-input" value={dealInfo.city} onChange={e => setInfo('city', e.target.value)} placeholder="Tampa" />
                  </div>
                  <div>
                    <label className="form-label">State</label>
                    <input className="form-input" value={dealInfo.state} onChange={e => setInfo('state', e.target.value)} placeholder="FL" maxLength={2} />
                  </div>
                  <div>
                    <label className="form-label">Unit Count</label>
                    <input className="form-input" type="number" value={dealInfo.unitCount} onChange={e => setInfo('unitCount', e.target.value)} placeholder="350" />
                  </div>
                  <div>
                    <label className="form-label">Asking Price ($)</label>
                    <input className="form-input" type="number" value={dealInfo.askingPrice} onChange={e => setInfo('askingPrice', e.target.value)} placeholder="4200000" />
                  </div>
                  <div>
                    <label className="form-label">NOI ($)</label>
                    <input className="form-input" type="number" value={dealInfo.noi} onChange={e => setInfo('noi', e.target.value)} placeholder="280000" />
                  </div>
                  <div>
                    <label className="form-label">Occupancy (%)</label>
                    <input className="form-input" type="number" value={dealInfo.occupancy} onChange={e => setInfo('occupancy', e.target.value)} placeholder="82" />
                  </div>
                </div>
              </div>

              {/* Deal Type */}
              <div className="border border-dark-border bg-white p-6">
                <div className="section-label mb-4">Deal Type</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['value-add', 'stabilized', 'distressed'] as DealType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setDealTypeAndReset(t)}
                      className={`border px-4 py-4 text-left transition-all duration-150 ${
                        dealType === t
                          ? 'border-[#1B2B5E] bg-[#1B2B5E] text-white'
                          : 'border-dark-border hover:border-[#1B2B5E]/50 bg-white'
                      }`}
                    >
                      <div className={`text-xs uppercase tracking-widest font-bold mb-1 ${dealType === t ? 'text-gold' : 'text-dark-muted'}`}>
                        {t === 'value-add' ? 'Type A' : t === 'stabilized' ? 'Type B' : 'Type C'}
                      </div>
                      <div className={`text-sm font-medium ${dealType === t ? 'text-white' : 'text-[#1a1a18]'}`}>
                        {DEAL_TYPE_LABELS[t]}
                      </div>
                      <div className={`text-xs mt-1 ${dealType === t ? 'text-white/70' : 'text-dark-muted'}`}>
                        {t === 'value-add'   && 'Rent gap · Occupancy upside · Expansion'}
                        {t === 'stabilized'  && 'Cap quality · Stability · Hold strategy'}
                        {t === 'distressed'  && 'Owner vs asset · Bones · Path to stab.'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Universal sections */}
              {universalGroups.map(g => (
                <SectionCard key={g} groupKey={g} inputs={inputs} onChange={set} />
              ))}

              {/* Deal-type specific section */}
              {specificGroups[dealType].map(g => (
                <SectionCard key={g} groupKey={g} inputs={inputs} onChange={set} />
              ))}

              {/* Mobile save button */}
              <div className="lg:hidden border border-dark-border bg-dark-surface p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs text-dark-muted uppercase tracking-widest">Deal Score</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-serif text-4xl font-light text-[#1B2B5E]">{score.total}</span>
                      <DealScoreBadge score={score.total} dealType={dealType} size="md" />
                    </div>
                  </div>
                </div>
                {saveError && <p className="text-xs text-red-600 mb-3">{saveError}</p>}
                {saved && <p className="text-xs text-green-700 mb-3">Saved to pipeline.</p>}
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className="btn-gold w-full disabled:opacity-50"
                >
                  {saving ? 'Saving...' : saved ? 'Saved ✓' : existingPropertyId ? 'Update Score' : 'Save to Pipeline'}
                </button>
              </div>

            </div>

            {/* ── Right: sticky score panel ──────────────────────────── */}
            <div className="hidden lg:block">
              <ScorePanel
                score={score}
                dealType={dealType}
                onSave={handleSave}
                saving={saving}
                saveError={saveError}
                saved={saved}
                isOverride={!!existingPropertyId}
              />
              {saved && (
                <button
                  onClick={() => router.push('/pipeline')}
                  className="btn-navy w-full mt-3 text-sm"
                >
                  View in Pipeline →
                </button>
              )}
            </div>

          </div>
        </div>
      </section>
    </>
  )
}

export default function ScoreDeal() {
  return (
    <>
      <Head>
        <title>Score Deal — YEM Acquisitions</title>
        <meta name="description" content="100-point deal scoring system for self-storage acquisitions." />
      </Head>
      <AuthGate>
        <ScoreDealContent />
      </AuthGate>
    </>
  )
}
