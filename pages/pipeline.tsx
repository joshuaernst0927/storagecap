import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import {
  PipelineProperty,
  ScoreBreakdown,
  ScoreHistoryEntry,
  DealStatus,
  STAGES,
  scoreColor,
  vaScoreColor,
  stageBadgeColor,
  tier,
  tierColor,
  statusLabel,
  statusColor,
} from '@/lib/pipelineData'
import { scoreProperty } from '@/lib/scorer'
import { loadSavedProperties, saveProperty } from '@/lib/pipelineStore'

// ─── Scoring helpers ─────────────────────────────────────────────────────────

function getTrend(history: ScoreHistoryEntry[]): 'up' | 'down' | 'flat' | 'none' {
  if (history.length < 2) return 'none'
  const delta = history[history.length - 1].score - history[history.length - 2].score
  if (delta > 3) return 'up'
  if (delta < -3) return 'down'
  return 'flat'
}

function formatLastScored(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Sparkline({ history }: { history: ScoreHistoryEntry[] }) {
  const pts = history.slice(-6)
  if (pts.length < 2) return null
  const scores = pts.map(h => h.score)
  const lo = Math.min(...scores), hi = Math.max(...scores)
  const range = Math.max(hi - lo, 5)
  const W = 44, H = 14
  const d = scores.map((s, i) => {
    const x = ((i / (scores.length - 1)) * W).toFixed(1)
    const y = (H - ((s - lo) / range) * (H - 2) - 1).toFixed(1)
    return `${x},${y}`
  }).join(' ')
  const rising = scores[scores.length - 1] >= scores[0]
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={d} fill="none" stroke={rising ? '#34D399' : '#F87171'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function rescoreProperty(p: PipelineProperty): PipelineProperty {
  if (p.stage === 'closed' || p.stage === 'dead') return p
  const result = scoreProperty(p)
  const now = new Date().toISOString()
  const entry: ScoreHistoryEntry = { score: result.total, date: now }
  return {
    ...p,
    motivationScore: result.total,
    scoreBreakdown: result.breakdown,
    scoreExplanation: result.explanation,
    lastScored: now,
    scoreHistory: [...(p.scoreHistory ?? []).slice(-19), entry],
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MotivationBadge({
  score,
  breakdown,
  lastScored,
  scoreHistory = [],
  isFinal = false,
  onRescore,
}: {
  score: number
  breakdown?: ScoreBreakdown
  lastScored?: string
  scoreHistory?: ScoreHistoryEntry[]
  isFinal?: boolean
  onRescore?: () => void
}) {
  const t = tier(score)
  const va = breakdown?.valueAdd ?? 0
  const trend = getTrend(scoreHistory)
  const bars: [string, number, number, string][] = [
    ['Mot',  breakdown?.motivation   ?? 0, 70, '#F87171'],
    ['Own',  breakdown?.ownerProfile ?? 0, 25, '#FBBF24'],
    ['Deal', breakdown?.dealQuality  ?? 0, 15, '#60A5FA'],
    ['VA',   va,                            20, '#34D399'],
  ]
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div className={`border-2 font-mono font-bold w-12 h-12 flex flex-col items-center justify-center flex-shrink-0 leading-none ${isFinal ? 'text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]' : scoreColor(score)}`}>
          <span className="text-xl leading-none">{score}</span>
          <span className="text-[0.5rem] tracking-wide uppercase mt-0.5 font-sans opacity-60">/130</span>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {isFinal
              ? <span className="border text-[0.65rem] uppercase tracking-widest px-1.5 py-0.5 font-bold text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]">Final</span>
              : <span className={`border text-[0.65rem] uppercase tracking-widest px-1.5 py-0.5 font-bold ${tierColor(t)}`}>{t}</span>
            }
            {trend !== 'none' && (
              <span className={`text-sm leading-none ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-400' : 'text-dark-muted'}`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              </span>
            )}
          </div>
          <span className={`border text-[0.65rem] uppercase tracking-widest px-1.5 py-0.5 font-bold ${vaScoreColor(va)}`}>VA {va}</span>
        </div>
        {!isFinal && onRescore && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRescore() }}
            title="Re-score now"
            className="text-dark-muted hover:text-gold transition-colors text-base leading-none flex-shrink-0 mt-1"
          >
            ↻
          </button>
        )}
      </div>

      {breakdown && (
        <div className="space-y-0.5 w-28">
          {bars.map(([label, val, max, color]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-[0.5rem] uppercase text-dark-muted w-5 flex-shrink-0 font-mono">{label}</span>
              <div className="flex-1 h-1 bg-dark-border">
                <div style={{ width: `${Math.max(0, (val / max) * 100)}%`, backgroundColor: color, height: '100%' }} />
              </div>
              <span className="text-[0.5rem] font-mono text-dark-muted w-4 text-right">{val}</span>
            </div>
          ))}
          {(breakdown.negatives !== 0 || breakdown.override !== 0) && (
            <div className="flex items-center gap-1 pt-0.5">
              <span className="text-[0.5rem] uppercase text-dark-muted w-5 flex-shrink-0 font-mono">adj</span>
              <span className="flex-1 text-right space-x-1">
                {breakdown.negatives !== 0 && <span className="text-[0.5rem] font-mono text-red-500">{breakdown.negatives}</span>}
                {breakdown.override > 0 && <span className="text-[0.5rem] font-mono text-emerald-600">+{breakdown.override}</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {scoreHistory.length >= 3 && <Sparkline history={scoreHistory} />}

      {lastScored && (
        <div className="text-[0.5rem] text-dark-muted uppercase tracking-widest">
          {isFinal ? 'Final' : 'Scored'} {formatLastScored(lastScored)}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: DealStatus }) {
  return (
    <span className={`border text-[0.8rem] uppercase tracking-widest px-2 py-1 font-sans font-bold ${statusColor(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function DistressTagRow({ signals }: { signals: PipelineProperty['distressSignals'] }) {
  const tags: { label: string; cls: string }[] = []
  if (signals.taxDelinquency) tags.push({ label: `Tax $${((signals.taxDelinquencyAmount ?? 0) / 1000).toFixed(0)}K`, cls: 'tag-red' })
  if (signals.fireCodeViolations) tags.push({ label: `Fire Code ×${signals.fireCodeCount}`, cls: 'tag-red' })
  if (signals.lisPendens) tags.push({ label: `Lis Pendens $${((signals.lisPendensAmount ?? 0) / 1000).toFixed(0)}K`, cls: 'tag-amber' })
  if (signals.codeViolations.length > 0) tags.push({ label: `Code Viol. ×${signals.codeViolations.length}`, cls: 'tag-amber' })
  if (signals.decliningOccupancy) tags.push({ label: `Occ ${signals.occupancyTrend}% YoY`, cls: 'tag-amber' })
  if (signals.deferredMaintenance) tags.push({ label: 'Deferred Maint.', cls: 'tag-muted' })
  if (signals.outOfStateOwner) tags.push({ label: 'OOS Owner', cls: 'tag-muted' })
  if (signals.ownerAge && signals.ownerAge >= 65) tags.push({ label: `Owner ${signals.ownerAge}yo`, cls: 'tag-muted' })
  if (signals.yearsOwned && signals.yearsOwned >= 20) tags.push({ label: `${signals.yearsOwned}yr Owner`, cls: 'tag-muted' })

  if (tags.length === 0) return <span className="text-dark-muted text-xs">—</span>

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t, i) => (
        <span key={i} className={`tag ${t.cls}`}>{t.label}</span>
      ))}
    </div>
  )
}

function StageBadge({ stage }: { stage: PipelineProperty['stage'] }) {
  const label = STAGES.find(s => s.key === stage)?.label ?? stage
  return (
    <span className={`border text-[0.8rem] uppercase tracking-widest px-2 py-1 font-sans font-bold ${stageBadgeColor(stage)}`}>
      {label}
    </span>
  )
}

// ─── Expanded Row ─────────────────────────────────────────────────────────────

function ExpandedRow({
  property,
  letter,
  letterLoading,
  onGenerateLetter,
  onStageChange,
  onNotesChange,
}: {
  property: PipelineProperty
  letter: string
  letterLoading: boolean
  onGenerateLetter: () => void
  onStageChange: (stage: PipelineProperty['stage']) => void
  onNotesChange: (notes: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const copyLetter = () => {
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const signals = property.distressSignals

  return (
    <tr className="fade-in">
      <td colSpan={8} className="bg-dark-surface/40 border-b border-dark-border px-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-dark-border">

          {/* ── Column 1: Owner Trace ── */}
          <div className="p-6">
            <div className="section-label-sm mb-4">Owner LLC Trace</div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-dark-muted text-xs block mb-0.5 uppercase tracking-widest">Owner Name</span>
                <span className="text-[#1a1a18]">{property.ownerName}</span>
              </div>
              <div>
                <span className="text-dark-muted text-xs block mb-0.5 uppercase tracking-widest">Entity</span>
                <span className="text-[#1a1a18]">{property.ownerEntity}</span>
                <span className="text-dark-muted text-xs ml-2">({property.ownerEntityState})</span>
              </div>
              {property.ownerEntityFormed && (
                <div>
                  <span className="text-dark-muted text-xs block mb-0.5 uppercase tracking-widest">Entity Formed</span>
                  <span className="text-[#1a1a18]">{property.ownerEntityFormed}</span>
                </div>
              )}
              {property.registeredAgent && (
                <div>
                  <span className="text-dark-muted text-xs block mb-0.5 uppercase tracking-widest">Registered Agent</span>
                  <span className="text-[#1a1a18]">{property.registeredAgent}</span>
                </div>
              )}
              <div>
                <span className="text-dark-muted text-xs block mb-0.5 uppercase tracking-widest">Mailing Address</span>
                <span className="text-[#1a1a18]">{property.ownerMailingAddress}</span>
                {property.distressSignals.outOfStateOwner && (
                  <span className="tag tag-amber ml-2">Out of State</span>
                )}
              </div>
              {property.ownerPhone && (
                <div>
                  <span className="text-dark-muted text-xs block mb-0.5 uppercase tracking-widest">Phone</span>
                  <span className="text-[#1a1a18] font-mono">{property.ownerPhone}</span>
                </div>
              )}
              {property.ownerEmail && (
                <div>
                  <span className="text-dark-muted text-xs block mb-0.5 uppercase tracking-widest">Email</span>
                  <span className="text-gold text-xs">{property.ownerEmail}</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-5 border-t border-dark-border">
              <span className="text-dark-muted text-xs block mb-2 uppercase tracking-widest">Stage</span>
              <select
                value={property.stage}
                onChange={(e) => onStageChange(e.target.value as PipelineProperty['stage'])}
                className="input-field-sm"
              >
                {STAGES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <span className="text-dark-muted text-xs block mb-2 uppercase tracking-widest">Notes</span>
              <textarea
                defaultValue={property.notes ?? ''}
                onBlur={(e) => onNotesChange(e.target.value)}
                rows={3}
                className="input-field-sm resize-none text-xs"
                placeholder="Internal notes..."
              />
            </div>
          </div>

          {/* ── Column 2: Distress Signals ── */}
          <div className="p-6">
            <div className="section-label-sm mb-4">Distress Signal Detail</div>

            <div className="space-y-4">
              {signals.taxDelinquency && (
                <div className="border border-red-400/20 bg-red-400/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="tag tag-red">Tax Delinquency</span>
                    <span className="text-red-400 font-mono text-sm font-bold">
                      ${signals.taxDelinquencyAmount?.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-dark-muted text-xs">
                    Delinquent for <strong className="text-[#1a1a18]">{signals.taxDelinquencyYears} {signals.taxDelinquencyYears === 1 ? 'year' : 'years'}</strong>.
                    {(signals.taxDelinquencyYears ?? 0) >= 3 && (
                      <span className="text-red-400"> Tax deed action possible within 6–12 months.</span>
                    )}
                  </p>
                </div>
              )}

              {signals.fireCodeViolations && signals.fireCodeDetails && signals.fireCodeDetails.length > 0 && (
                <div className="border border-red-400/20 bg-red-400/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="tag tag-red">Fire Code Violations</span>
                    <span className="text-red-400 font-mono text-sm font-bold">×{signals.fireCodeCount}</span>
                  </div>
                  <ul className="text-dark-muted text-xs space-y-1">
                    {signals.fireCodeDetails.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-red-400 flex-shrink-0">·</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {signals.lisPendens && (
                <div className="border border-amber-400/20 bg-amber-400/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="tag tag-amber">Lis Pendens</span>
                    <span className="text-amber-400 font-mono text-sm font-bold">
                      ${signals.lisPendensAmount?.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-dark-muted text-xs">Active litigation against the property. May indicate contractor dispute, lender action, or partnership dissolution.</p>
                </div>
              )}

              {signals.codeViolations.length > 0 && (
                <div className="border border-amber-400/20 bg-amber-400/5 p-4">
                  <div className="mb-2">
                    <span className="tag tag-amber">Code Violations</span>
                  </div>
                  <ul className="text-dark-muted text-xs space-y-1">
                    {signals.codeViolations.map((v, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-400 flex-shrink-0">·</span>
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {signals.decliningOccupancy && (
                <div className="border border-amber-400/20 bg-amber-400/5 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="tag tag-amber">Declining Occupancy</span>
                    <span className="text-amber-400 font-mono text-sm font-bold">{signals.occupancyTrend}% YoY</span>
                  </div>
                  <p className="text-dark-muted text-xs">Occupancy trend over last 12 months. Current: {property.occupancy}%.</p>
                </div>
              )}

              {signals.deferredMaintenance && signals.maintenanceIssues && (
                <div className="border border-dark-border p-4">
                  <div className="mb-2">
                    <span className="tag tag-muted">Deferred Maintenance</span>
                  </div>
                  <ul className="text-dark-muted text-xs space-y-1">
                    {signals.maintenanceIssues.map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-dark-muted/60 flex-shrink-0">·</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(signals.ownerAge || signals.yearsOwned) && (
                <div className="border border-dark-border p-4">
                  <div className="mb-2">
                    <span className="tag tag-muted">Owner Profile</span>
                  </div>
                  <div className="text-xs text-dark-muted space-y-1">
                    {signals.ownerAge && <div>Estimated age: <span className="text-[#1a1a18]">{signals.ownerAge} years old</span></div>}
                    {signals.yearsOwned && <div>Years owned: <span className="text-[#1a1a18]">{signals.yearsOwned} years</span></div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Column 3: Outreach Letter ── */}
          <div className="p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="section-label-sm">Outreach Letter</div>
              {letter && (
                <button
                  onClick={copyLetter}
                  className="text-xs text-dark-muted hover:text-[#1a1a18] transition-colors uppercase tracking-widest font-sans"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              )}
            </div>

            {!letter && !letterLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-8 border border-dark-border border-dashed">
                <p className="text-dark-muted text-xs text-center mb-5 leading-relaxed max-w-xs">
                  Generate a personalized outreach letter based on this property&apos;s distress signals and owner profile.
                </p>
                <button onClick={onGenerateLetter} className="btn-gold-sm">
                  Generate Letter
                </button>
              </div>
            )}

            {letterLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-8 border border-dark-border">
                <div className="w-6 h-6 border border-gold border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-dark-muted text-xs">Generating personalized letter...</p>
              </div>
            )}

            {letter && !letterLoading && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 bg-dark-bg border border-dark-border p-5 text-xs text-dark-muted leading-relaxed whitespace-pre-wrap font-sans overflow-y-auto max-h-80">
                  {letter}
                </div>
                <button
                  onClick={onGenerateLetter}
                  className="mt-3 btn-ghost text-center w-full"
                >
                  Regenerate
                </button>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-dark-border">
              <div className="text-xs text-dark-muted space-y-1">
                <div className="flex justify-between">
                  <span className="uppercase tracking-widest">Est. Value</span>
                  <span className="text-[#1a1a18]">${(property.estimatedValue / 1000000).toFixed(1)}M</span>
                </div>
                {property.noi && (
                  <div className="flex justify-between">
                    <span className="uppercase tracking-widest">NOI</span>
                    <span className="text-[#1a1a18]">${property.noi.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="uppercase tracking-widest">Occupancy</span>
                  <span className="text-[#1a1a18]">{property.occupancy}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="uppercase tracking-widest">Units</span>
                  <span className="text-[#1a1a18]">{property.unitCount} ({property.yearBuilt})</span>
                </div>
                <div className="flex justify-between">
                  <span className="uppercase tracking-widest">Implied Cap</span>
                  <span className="text-[#1a1a18]">
                    {property.noi ? `${((property.noi / property.estimatedValue) * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Add Property Modal ───────────────────────────────────────────────────────

interface NewPropForm {
  facilityName: string; city: string; state: string; address: string; zipCode: string;
  unitCount: string; yearBuilt: string; occupancy: string; estimatedValue: string; noi: string;
  ownerName: string; ownerEntity: string; ownerEntityState: string; ownerMailingAddress: string;
  ownerPhone: string;
  taxDelinquency: boolean; taxDelinquencyAmount: string; taxDelinquencyYears: string;
  fireCodeViolations: boolean; fireCodeCount: string;
  lisPendens: boolean; lisPendensAmount: string;
  decliningOccupancy: boolean; occupancyTrend: string;
  deferredMaintenance: boolean; outOfStateOwner: boolean;
  ownerAge: string; yearsOwned: string;
  stage: PipelineProperty['stage']; priority: PipelineProperty['priority'];
  source: PipelineProperty['source']; notes: string;
}

const emptyForm: NewPropForm = {
  facilityName: '', city: '', state: '', address: '', zipCode: '',
  unitCount: '', yearBuilt: '', occupancy: '', estimatedValue: '', noi: '',
  ownerName: '', ownerEntity: '', ownerEntityState: '', ownerMailingAddress: '', ownerPhone: '',
  taxDelinquency: false, taxDelinquencyAmount: '', taxDelinquencyYears: '',
  fireCodeViolations: false, fireCodeCount: '',
  lisPendens: false, lisPendensAmount: '',
  decliningOccupancy: false, occupancyTrend: '',
  deferredMaintenance: false, outOfStateOwner: false,
  ownerAge: '', yearsOwned: '',
  stage: 'identified', priority: 'medium', source: 'county-records', notes: '',
}

function formToPartialProperty(f: NewPropForm): PipelineProperty {
  return {
    id: 'preview',
    facilityName: f.facilityName || '',
    address: f.address,
    city: f.city,
    state: f.state,
    zipCode: f.zipCode,
    unitCount: parseInt(f.unitCount) || 0,
    unitMix: '',
    yearBuilt: parseInt(f.yearBuilt) || 2000,
    landAcres: 0,
    climatePercent: 0,
    estimatedValue: parseInt(f.estimatedValue.replace(/[^0-9]/g, '')) || 0,
    noi: parseInt(f.noi.replace(/[^0-9]/g, '')) || undefined,
    occupancy: parseInt(f.occupancy) || 0,
    ownerName: f.ownerName,
    ownerEntity: f.ownerEntity,
    ownerEntityState: f.ownerEntityState,
    ownerMailingAddress: f.ownerMailingAddress,
    ownerPhone: f.ownerPhone,
    distressSignals: {
      taxDelinquency: f.taxDelinquency,
      taxDelinquencyAmount: parseInt(f.taxDelinquencyAmount.replace(/[^0-9]/g, '')) || 0,
      taxDelinquencyYears: parseInt(f.taxDelinquencyYears) || 0,
      fireCodeViolations: f.fireCodeViolations,
      fireCodeCount: parseInt(f.fireCodeCount) || 0,
      fireCodeDetails: [],
      codeViolations: [],
      lisPendens: f.lisPendens,
      lisPendensAmount: parseInt(f.lisPendensAmount.replace(/[^0-9]/g, '')) || 0,
      decliningOccupancy: f.decliningOccupancy,
      occupancyTrend: parseInt(f.occupancyTrend) || 0,
      deferredMaintenance: f.deferredMaintenance,
      outOfStateOwner: f.outOfStateOwner,
      ownerAge: parseInt(f.ownerAge) || undefined,
      yearsOwned: parseInt(f.yearsOwned) || undefined,
    },
    motivationScore: 0,
    stage: f.stage,
    currentStatus: 'outreach-sent',
    priority: f.priority,
    source: f.source,
    addedDate: new Date().toISOString().split('T')[0],
    notes: f.notes,
  }
}

function AddPropertyModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: PipelineProperty) => void }) {
  const [form, setForm] = useState<NewPropForm>(emptyForm)
  const setF = (field: keyof NewPropForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = () => {
    if (!form.facilityName || !form.city || !form.state) return
    const base = formToPartialProperty(form)
    const result = scoreProperty(base)
    const now = new Date().toISOString()
    const property: PipelineProperty = {
      ...base,
      id: `new-${Date.now()}`,
      motivationScore: result.total,
      scoreBreakdown: result.breakdown,
      scoreExplanation: result.explanation,
      lastScored: now,
      scoreHistory: [{ score: result.total, date: now }],
    }
    onAdd(property)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl bg-dark-bg border-l border-dark-border overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-dark-bg border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="section-label-sm mb-0">Add Property</div>
            <h2 className="font-serif text-2xl font-light text-[#1B2B5E] mt-1">New Pipeline Entry</h2>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-[#1a1a18] transition-colors text-lg">✕</button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="section-label-sm mb-3">Property</div>
            <div className="space-y-3">
              <div><label className="label-text">Facility Name *</label>
                <input className="input-field-sm" value={form.facilityName} onChange={e => setF('facilityName', e.target.value)} placeholder="Sunshine Self Storage" /></div>
              <div><label className="label-text">Address</label>
                <input className="input-field-sm" value={form.address} onChange={e => setF('address', e.target.value)} placeholder="123 Main St" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1"><label className="label-text">City *</label>
                  <input className="input-field-sm" value={form.city} onChange={e => setF('city', e.target.value)} placeholder="Atlanta" /></div>
                <div><label className="label-text">State *</label>
                  <input className="input-field-sm" value={form.state} onChange={e => setF('state', e.target.value)} placeholder="GA" /></div>
                <div><label className="label-text">ZIP</label>
                  <input className="input-field-sm" value={form.zipCode} onChange={e => setF('zipCode', e.target.value)} placeholder="30301" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label-text">Units</label>
                  <input className="input-field-sm" type="number" value={form.unitCount} onChange={e => setF('unitCount', e.target.value)} placeholder="350" /></div>
                <div><label className="label-text">Built</label>
                  <input className="input-field-sm" type="number" value={form.yearBuilt} onChange={e => setF('yearBuilt', e.target.value)} placeholder="2002" /></div>
                <div><label className="label-text">Occ %</label>
                  <input className="input-field-sm" type="number" value={form.occupancy} onChange={e => setF('occupancy', e.target.value)} placeholder="80" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-text">Est. Value ($)</label>
                  <input className="input-field-sm" value={form.estimatedValue} onChange={e => setF('estimatedValue', e.target.value)} placeholder="3,500,000" /></div>
                <div><label className="label-text">Annual NOI ($)</label>
                  <input className="input-field-sm" value={form.noi} onChange={e => setF('noi', e.target.value)} placeholder="240,000" /></div>
              </div>
            </div>
          </div>

          <div>
            <div className="section-label-sm mb-3">Owner</div>
            <div className="space-y-3">
              <div><label className="label-text">Owner Name</label>
                <input className="input-field-sm" value={form.ownerName} onChange={e => setF('ownerName', e.target.value)} placeholder="John Smith" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="label-text">Entity Name</label>
                  <input className="input-field-sm" value={form.ownerEntity} onChange={e => setF('ownerEntity', e.target.value)} placeholder="Smith Storage LLC" /></div>
                <div><label className="label-text">State</label>
                  <input className="input-field-sm" value={form.ownerEntityState} onChange={e => setF('ownerEntityState', e.target.value)} placeholder="GA" /></div>
              </div>
              <div><label className="label-text">Mailing Address</label>
                <input className="input-field-sm" value={form.ownerMailingAddress} onChange={e => setF('ownerMailingAddress', e.target.value)} placeholder="123 Home St, City, ST 00000" /></div>
              <div><label className="label-text">Phone</label>
                <input className="input-field-sm" value={form.ownerPhone} onChange={e => setF('ownerPhone', e.target.value)} placeholder="(555) 000-0000" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-text">Owner Age</label>
                  <input className="input-field-sm" type="number" value={form.ownerAge} onChange={e => setF('ownerAge', e.target.value)} placeholder="68" /></div>
                <div><label className="label-text">Years Owned</label>
                  <input className="input-field-sm" type="number" value={form.yearsOwned} onChange={e => setF('yearsOwned', e.target.value)} placeholder="15" /></div>
              </div>
            </div>
          </div>

          <div>
            <div className="section-label-sm mb-3">Distress Signals</div>
            <div className="space-y-3">
              {[
                { key: 'taxDelinquency', label: 'Tax Delinquency' },
                { key: 'fireCodeViolations', label: 'Fire Code Violations' },
                { key: 'lisPendens', label: 'Lis Pendens' },
                { key: 'decliningOccupancy', label: 'Declining Occupancy' },
                { key: 'deferredMaintenance', label: 'Deferred Maintenance' },
                { key: 'outOfStateOwner', label: 'Out-of-State Owner' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={key}
                    checked={form[key as keyof NewPropForm] as boolean}
                    onChange={e => setF(key as keyof NewPropForm, e.target.checked)}
                    className="w-3.5 h-3.5 accent-gold"
                  />
                  <label htmlFor={key} className="text-xs text-dark-muted uppercase tracking-widest cursor-pointer hover:text-[#1a1a18] transition-colors">{label}</label>
                </div>
              ))}

              {form.taxDelinquency && (
                <div className="grid grid-cols-2 gap-2 mt-2 pl-5">
                  <div><label className="label-text">Amount ($)</label>
                    <input className="input-field-sm" value={form.taxDelinquencyAmount} onChange={e => setF('taxDelinquencyAmount', e.target.value)} placeholder="25,000" /></div>
                  <div><label className="label-text">Years</label>
                    <input className="input-field-sm" type="number" value={form.taxDelinquencyYears} onChange={e => setF('taxDelinquencyYears', e.target.value)} placeholder="2" /></div>
                </div>
              )}
            </div>

            {(() => {
              const preview = scoreProperty(formToPartialProperty(form))
              return (
                <div className="mt-4 border border-dark-border p-4 bg-dark-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-dark-muted text-xs uppercase tracking-widest">Calculated Score</span>
                    <span className={`font-mono text-lg font-bold border px-3 py-1 ${scoreColor(preview.total)}`}>
                      {preview.total} / 130
                    </span>
                  </div>
                  <div className="space-y-1">
                    {([
                      ['Motivation', preview.breakdown.motivation, 70],
                      ['Owner Profile', preview.breakdown.ownerProfile, 25],
                      ['Deal Quality', preview.breakdown.dealQuality, 15],
                      ['Value-Add', preview.breakdown.valueAdd, 20],
                    ] as [string, number, number][]).map(([label, val, max]) => (
                      <div key={label} className="flex items-center gap-2 text-xs text-dark-muted">
                        <span className="w-24 flex-shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-dark-border">
                          <div className="h-full bg-gold" style={{ width: `${(val / max) * 100}%` }} />
                        </div>
                        <span className="font-mono w-8 text-right">{val}/{max}</span>
                      </div>
                    ))}
                    {(preview.breakdown.negatives !== 0 || preview.breakdown.override !== 0) && (
                      <div className="flex items-center gap-2 text-xs text-dark-muted pt-1 border-t border-dark-border">
                        <span className="w-24 flex-shrink-0">Adjustments</span>
                        <span className="flex-1 font-mono text-xs">
                          {preview.breakdown.negatives !== 0 && <span className="text-red-500">{preview.breakdown.negatives}</span>}
                          {preview.breakdown.override > 0 && <span className="text-emerald-600 ml-2">+{preview.breakdown.override} override</span>}
                        </span>
                      </div>
                    )}
                  </div>
                  {preview.explanation && (
                    <p className="text-dark-muted text-xs italic leading-relaxed border-t border-dark-border pt-3">{preview.explanation}</p>
                  )}
                </div>
              )
            })()}
          </div>

          <div>
            <div className="section-label-sm mb-3">Pipeline</div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label-text">Stage</label>
                <select className="input-field-sm" value={form.stage} onChange={e => setF('stage', e.target.value)}>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select></div>
              <div><label className="label-text">Priority</label>
                <select className="input-field-sm" value={form.priority} onChange={e => setF('priority', e.target.value)}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select></div>
              <div><label className="label-text">Source</label>
                <select className="input-field-sm" value={form.source} onChange={e => setF('source', e.target.value)}>
                  <option value="county-records">County Records</option>
                  <option value="drive-by">Drive-By</option>
                  <option value="data-scrape">Data Scrape</option>
                  <option value="broker">Broker</option>
                  <option value="inbound">Inbound</option>
                </select></div>
            </div>
            <div className="mt-3">
              <label className="label-text">Notes</label>
              <textarea className="input-field-sm resize-none" rows={3} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Research notes, observations..." />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} className="btn-gold flex-1">Add to Pipeline</button>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Pipeline Page ───────────────────────────────────────────────────────

export default function Pipeline() {
  const [properties, setProperties] = useState<PipelineProperty[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [letters, setLetters] = useState<Record<string, { loading: boolean; text: string }>>({})
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'stage'>('score')
  const [showAdd, setShowAdd] = useState(false)
  const [sourcesLoaded, setSourcesLoaded] = useState(0)

  const mergeProperties = (incoming: PipelineProperty[]) => {
    if (incoming.length === 0) return
    setProperties(prev => {
      const existingIds = new Set(prev.map(p => p.id))
      const newOnes = incoming.filter(p => !existingIds.has(p.id))
      return newOnes.length ? [...newOnes, ...prev] : prev
    })
    setLetters(prev => {
      const additions: Record<string, { loading: boolean; text: string }> = {}
      incoming.forEach(p => {
        if (p.outreachLetter && !prev[p.id]) {
          additions[p.id] = { loading: false, text: p.outreachLetter }
        }
      })
      return Object.keys(additions).length ? { ...prev, ...additions } : prev
    })
  }

  // Load from localStorage
  useEffect(() => {
    mergeProperties(loadSavedProperties())
    setSourcesLoaded(n => n + 1)
  }, [])

  // Load from public/data/deals.json (written directly by Python pipeline)
  useEffect(() => {
    fetch('/data/deals.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: PipelineProperty[]) => mergeProperties(data))
      .catch(() => {})
      .finally(() => setSourcesLoaded(n => n + 1))
  }, [])

  // Load from pipeline-ingest API (deals added via Upload Deal or manual push)
  useEffect(() => {
    fetch('/api/pipeline-ingest')
      .then(r => r.ok ? r.json() : [])
      .then((data: PipelineProperty[]) => mergeProperties(data))
      .catch(() => {})
      .finally(() => setSourcesLoaded(n => n + 1))
  }, [])

  // Auto-rescore all active deals once all 3 sources have loaded
  useEffect(() => {
    if (sourcesLoaded < 3) return
    setProperties(prev => prev.map(p => {
      const scored = rescoreProperty(p)
      if (scored !== p) saveProperty(scored)
      return scored
    }))
  }, [sourcesLoaded])

  // Continuous re-scoring: every 5 minutes rescore all active deals
  const rescoreAllRef = useRef<() => void>(() => {})
  rescoreAllRef.current = () => {
    setProperties(prev => prev.map(p => {
      const scored = rescoreProperty(p)
      if (scored !== p) saveProperty(scored)
      return scored
    }))
  }
  useEffect(() => {
    const interval = setInterval(() => rescoreAllRef.current(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const rescore = (id: string) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const scored = rescoreProperty(p)
      saveProperty(scored)
      return scored
    }))
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  const generateLetter = async (property: PipelineProperty) => {
    setLetters(prev => ({ ...prev, [property.id]: { loading: true, text: '' } }))
    try {
      const res = await fetch('/api/generate-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property),
      })
      const data = await res.json()
      setLetters(prev => ({ ...prev, [property.id]: { loading: false, text: data.letter || data.error || 'Error generating letter.' } }))
    } catch {
      setLetters(prev => ({ ...prev, [property.id]: { loading: false, text: 'Failed to generate letter. Check your ANTHROPIC_API_KEY.' } }))
    }
  }

  const updateStage = (id: string, stage: PipelineProperty['stage']) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const updated = { ...p, stage }
      if (stage !== 'closed' && stage !== 'dead') {
        const scored = rescoreProperty(updated)
        saveProperty(scored)
        return scored
      }
      saveProperty(updated)
      return updated
    }))
  }

  const updateNotes = (id: string, notes: string) => {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, notes } : p))
  }

  const addProperty = (p: PipelineProperty) => {
    saveProperty(p)
    setProperties(prev => [p, ...prev])
  }

  const filtered = properties
    .filter(p => stageFilter === 'all' || p.stage === stageFilter)
    .sort((a, b) => {
      if (sortBy === 'score') return b.motivationScore - a.motivationScore
      if (sortBy === 'name') return a.facilityName.localeCompare(b.facilityName)
      if (sortBy === 'stage') return a.stage.localeCompare(b.stage)
      return 0
    })

  const totalScore = Math.round(properties.reduce((sum, p) => sum + p.motivationScore, 0) / (properties.length || 1))
  const highMot = properties.filter(p => p.motivationScore >= 85).length
  const activeConvos = properties.filter(p => ['conversation', 'loi', 'dd'].includes(p.stage)).length
  const inOutreach = properties.filter(p => p.stage === 'outreach').length

  return (
    <>
      <Head>
        <title>Acquisition Pipeline — YEM Acquisitions</title>
      </Head>

      {showAdd && <AddPropertyModal onClose={() => setShowAdd(false)} onAdd={addProperty} />}

      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="section-label">Internal Platform</div>
            <h1 className="display-heading text-5xl">Acquisition Pipeline</h1>
            <p className="text-dark-muted text-sm mt-2">
              {properties.length} properties · {highMot} high motivation · {activeConvos} active conversations
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-gold self-start md:self-auto">
            + Add Property
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Pipeline', value: properties.length, sub: 'properties tracked' },
            { label: 'High Motivation', value: highMot, sub: 'score ≥ 85' },
            { label: 'Active Outreach', value: inOutreach, sub: 'letters sent' },
            { label: 'In Conversation', value: activeConvos, sub: 'loi / dd / convo' },
          ].map(s => (
            <div key={s.label} className="border border-dark-border bg-dark-surface p-4">
              <div className="font-serif text-4xl font-light text-gold mb-0.5">{s.value}</div>
              <div className="text-[#1a1a18] text-xs uppercase tracking-widest font-sans">{s.label}</div>
              <div className="text-dark-muted text-xs mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {[{ key: 'all', label: 'All' }, ...STAGES].map(s => (
              <button
                key={s.key}
                onClick={() => setStageFilter(s.key)}
                className={`text-xs uppercase tracking-widest font-sans px-3 py-1.5 border transition-colors duration-150
                  ${stageFilter === s.key ? 'border-gold text-gold' : 'border-dark-border text-dark-muted hover:border-gold/40 hover:text-[#1a1a18]'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-dark-muted text-xs uppercase tracking-widest">Sort:</span>
            {(['score', 'name', 'stage'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-xs uppercase tracking-widest font-sans px-3 py-1.5 border transition-colors duration-150
                  ${sortBy === s ? 'border-gold text-gold' : 'border-dark-border text-dark-muted hover:text-[#1a1a18]'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="border border-dark-border overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-dark-surface/80">
              <tr>
                <th className="pipeline-th pl-4 w-8" />
                <th className="pipeline-th">Property</th>
                <th className="pipeline-th">Units / Built</th>
                <th className="pipeline-th">Score</th>
                <th className="pipeline-th">Distress Signals</th>
                <th className="pipeline-th">Owner Entity</th>
                <th className="pipeline-th">Est. Value</th>
                <th className="pipeline-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((property) => {
                const isExpanded = expandedId === property.id
                const lState = letters[property.id] ?? { loading: false, text: '' }

                return [
                  <tr
                    key={`row-${property.id}`}
                    className={`pipeline-row ${isExpanded ? 'bg-dark-surface/60' : ''}`}
                    onClick={() => toggleExpand(property.id)}
                  >
                    <td className="pipeline-td pl-4 pr-2 w-8">
                      <span className={`text-dark-muted text-xs transition-transform duration-200 inline-block ${isExpanded ? 'rotate-90' : ''}`}>
                        ›
                      </span>
                    </td>
                    <td className="pipeline-td max-w-[260px]">
                      <div className="text-[#1a1a18] text-sm font-medium">{property.facilityName}</div>
                      <div className="text-dark-muted text-xs mt-0.5">{property.address}</div>
                      <div className="text-dark-muted text-xs">{property.city}, {property.state} {property.zipCode}</div>
                      {property.scoreExplanation && (
                        <div className="text-dark-muted text-[0.68rem] mt-1.5 leading-relaxed italic">{property.scoreExplanation}</div>
                      )}
                    </td>
                    <td className="pipeline-td">
                      <div className="text-[#1a1a18] text-sm">{property.unitCount.toLocaleString()}</div>
                      <div className="text-dark-muted text-xs">{property.yearBuilt}</div>
                    </td>
                    <td className="pipeline-td">
                      <MotivationBadge
                        score={property.motivationScore}
                        breakdown={property.scoreBreakdown}
                        lastScored={property.lastScored}
                        scoreHistory={property.scoreHistory}
                        isFinal={property.stage === 'closed' || property.stage === 'dead'}
                        onRescore={() => rescore(property.id)}
                      />
                    </td>
                    <td className="pipeline-td max-w-[220px]">
                      <DistressTagRow signals={property.distressSignals} />
                    </td>
                    <td className="pipeline-td">
                      <div className="text-[#1a1a18] text-xs">{property.ownerEntity}</div>
                      <div className="text-dark-muted text-xs mt-0.5">({property.ownerEntityState})</div>
                    </td>
                    <td className="pipeline-td">
                      <div className="text-[#1a1a18] text-sm">${(property.estimatedValue / 1000000).toFixed(1)}M</div>
                      {property.noi && (
                        <div className="text-dark-muted text-xs">${(property.noi / 1000).toFixed(0)}K NOI</div>
                      )}
                    </td>
                    <td className="pipeline-td pr-6">
                      <StatusBadge status={property.currentStatus} />
                    </td>
                  </tr>,

                  isExpanded && (
                    <ExpandedRow
                      key={`exp-${property.id}`}
                      property={property}
                      letter={lState.text}
                      letterLoading={lState.loading}
                      onGenerateLetter={() => generateLetter(property)}
                      onStageChange={(stage) => updateStage(property.id, stage)}
                      onNotesChange={(notes) => updateNotes(property.id, notes)}
                    />
                  ),
                ]
              })}
            </tbody>
          </table>

          {filtered.length === 0 && properties.length === 0 && (
            <div className="py-24 text-center text-dark-muted">
              <p className="font-serif text-2xl font-light mb-3">No deals yet.</p>
              <p className="text-sm mb-6">Run the pipeline or upload a deal to get started.</p>
              <a href="/upload-deal" className="btn-gold-sm">Upload a Deal</a>
            </div>
          )}
          {filtered.length === 0 && properties.length > 0 && (
            <div className="py-20 text-center text-dark-muted">
              <p className="font-serif text-2xl font-light mb-2">No properties match this filter.</p>
              <button onClick={() => setStageFilter('all')} className="text-gold text-xs uppercase tracking-widest mt-2">
                Clear filter
              </button>
            </div>
          )}
        </div>

        <p className="text-dark-muted text-xs mt-4">
          {filtered.length} of {properties.length} properties shown · Avg motivation score: {totalScore}
        </p>
      </div>
    </>
  )
}
