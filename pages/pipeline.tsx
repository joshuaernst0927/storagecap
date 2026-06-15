import Head from 'next/head'
import { useState, useEffect, FormEvent } from 'react'
import {
  PipelineProperty,
  PortfolioEntry,
  NoteEntry,
  NextStep,
  ActivityEvent,
  ActivityEventType,
  DealStatus,
  STAGES,
  stageBadgeColor,
  statusLabel,
  statusColor,
} from '@/lib/pipelineData'
import { loadSavedProperties, saveProperty, migrateLocalStorageToGitHub } from '@/lib/pipelineStore'
import AuthGate from '@/components/AuthGate'
import DealScoreBadge from '@/components/DealScoreBadge'


// ─── Notes / Activity helpers ─────────────────────────────────────────────────

function mkId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtDateShort(yyyymmdd: string): string {
  return new Date(yyyymmdd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dueDate: string): boolean {
  return dueDate < new Date().toISOString().slice(0, 10)
}

function mkActivityEvent(type: ActivityEventType, description: string): ActivityEvent {
  return { id: mkId(), type, description, createdAt: new Date().toISOString() }
}

// ─── Offer / Optimal pricing helpers ─────────────────────────────────────────

const TARGET_CAP = 0.07

function calcOptimalOffer(p: PipelineProperty): {
  low: number; high: number; stabilizedNOI: number; discount: number
} | null {
  const rawNOI =
    p.projectedStabilizedNOI ??
    (p.noi && p.noiUpsidePct ? Math.round(p.noi * (1 + p.noiUpsidePct / 100)) : null) ??
    p.noi ?? null
  if (!rawNOI || rawNOI <= 0) return null
  const optimalHigh = Math.round(rawNOI / TARGET_CAP)
  const occ = p.occupancy > 1 ? p.occupancy : p.occupancy * 100
  let discount = 0.10
  if (occ < 80) discount += 0.05
  if (p.distressSignals.deferredMaintenance) discount += 0.05
  if (p.valueAddPotential) discount += 0.03
  discount = Math.min(0.25, discount)
  return { low: Math.round(optimalHigh * (1 - discount)), high: optimalHigh, stabilizedNOI: Math.round(rawNOI), discount }
}

function fmtM(n: number): string {
  return `$${(n / 1_000_000).toFixed(2)}M`
}

function InlinePriceCell({ value, onSave }: { value?: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(value ? String(value) : '')
    setEditing(true)
  }
  const commit = () => {
    const n = parseInt(draft.replace(/[^0-9]/g, ''), 10)
    if (n > 0) onSave(n)
    setEditing(false)
  }

  if (editing) return (
    <input
      autoFocus
      className="w-24 font-mono text-xs border border-gold bg-dark-bg text-[#1a1a18] px-1 py-0.5 outline-none"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      onBlur={commit}
      onClick={e => e.stopPropagation()}
    />
  )
  return (
    <button type="button" onClick={startEdit} title="Click to edit"
      className="text-xs font-mono text-[#1a1a18] text-left hover:text-gold transition-colors group">
      {value ? fmtM(value) : <span className="text-dark-muted">—</span>}
      <span className="opacity-0 group-hover:opacity-60 text-[0.55rem] text-gold ml-1 align-middle">✎</span>
    </button>
  )
}

function OptimalOfferCell({ property }: { property: PipelineProperty }) {
  const opt = calcOptimalOffer(property)
  if (!opt) return <span className="text-dark-muted text-xs">—</span>

  const offer = property.offerPrice
  let statusEl: React.ReactNode = null
  if (offer) {
    if (offer >= opt.low && offer <= opt.high) {
      statusEl = <span className="text-[0.6rem] uppercase tracking-widest text-emerald-600 font-semibold">✓ In range</span>
    } else if (offer > opt.high) {
      statusEl = <span className="text-[0.6rem] uppercase tracking-widest text-red-500 font-semibold">↑ Above</span>
    } else {
      statusEl = <span className="text-[0.6rem] uppercase tracking-widest text-blue-500 font-semibold">↓ Room up</span>
    }
  }

  const tooltip = [
    'Optimal Offer Calculation',
    `Stabilized NOI: $${opt.stabilizedNOI.toLocaleString()}`,
    `Target Cap Rate: ${(TARGET_CAP * 100).toFixed(1)}%`,
    `Gross Value (NOI ÷ Cap): ${fmtM(opt.high)}`,
    `CapEx + Lease-up Discount: ${(opt.discount * 100).toFixed(0)}%`,
    `Range: ${fmtM(opt.low)} – ${fmtM(opt.high)}`,
  ].join('\n')

  return (
    <div className="space-y-0.5" title={tooltip}>
      <div className="cursor-help">
        <span className="font-mono text-xs text-[#1a1a18]">{fmtM(opt.low)}</span>
        <span className="text-dark-muted text-xs mx-0.5">–</span>
        <span className="font-mono text-xs text-[#1a1a18]">{fmtM(opt.high)}</span>
      </div>
      <div className="text-[0.6rem] text-dark-muted uppercase tracking-widest">@{(TARGET_CAP * 100).toFixed(0)}% cap</div>
      {statusEl}
    </div>
  )
}

function SpreadCell({ askingPrice, optHigh }: { askingPrice?: number; optHigh: number | null }) {
  if (!askingPrice || !optHigh) return <span className="text-dark-muted text-xs">—</span>
  const spread = askingPrice - optHigh
  const spreadPct = ((spread / askingPrice) * 100).toFixed(1)
  const positive = spread > 0
  return (
    <div className="space-y-0.5">
      <div className={`font-mono text-xs font-semibold ${positive ? 'text-red-500' : 'text-emerald-600'}`}>
        {positive ? '+' : ''}{fmtM(spread)}
      </div>
      <div className={`text-[0.6rem] uppercase tracking-widest ${positive ? 'text-red-400' : 'text-emerald-500'}`}>
        {positive ? `${spreadPct}% above opt` : `${Math.abs(Number(spreadPct))}% below opt`}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────


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

// ─── Notes / Next Steps / Activity panels ────────────────────────────────────

function NotesPanel({
  noteLog,
  onAddNote,
}: {
  noteLog: NoteEntry[]
  onAddNote: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const submit = () => {
    const t = draft.trim()
    if (!t) return
    onAddNote(t)
    setDraft('')
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="flex-1 input-field-sm text-xs"
          placeholder="Add a note… (Enter to save)"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        <button onClick={submit} className="btn-gold-sm px-4 flex-shrink-0">+</button>
      </div>
      <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
        {[...noteLog].reverse().map(n => (
          <div key={n.id} className="border-l-2 border-dark-border pl-3">
            <div className="text-[0.6rem] text-dark-muted uppercase tracking-widest mb-0.5">
              {fmtDateTime(n.createdAt)}
            </div>
            <div className="text-xs text-[#1a1a18] leading-relaxed">{n.text}</div>
          </div>
        ))}
        {noteLog.length === 0 && (
          <p className="text-dark-muted text-xs text-center py-6">No notes yet. Add one above.</p>
        )}
      </div>
    </div>
  )
}

function NextStepsPanel({
  steps,
  onAddStep,
  onToggleStep,
  onUpdateStepDue,
}: {
  steps: NextStep[]
  onAddStep: (text: string, dueDate?: string) => void
  onToggleStep: (id: string) => void
  onUpdateStepDue: (id: string, dueDate: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [draftDue, setDraftDue] = useState('')

  const submit = () => {
    const t = draft.trim()
    if (!t) return
    onAddStep(t, draftDue || undefined)
    setDraft('')
    setDraftDue('')
  }

  const pending = [...steps.filter(s => !s.completedAt)].sort((a, b) =>
    (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1
  )
  const done = steps.filter(s => !!s.completedAt)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 input-field-sm text-xs"
          placeholder="Add next step… (Enter to save)"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        <input
          type="date"
          className="input-field-sm text-xs w-32 flex-shrink-0"
          value={draftDue}
          onChange={e => setDraftDue(e.target.value)}
        />
        <button onClick={submit} className="btn-gold-sm px-4 flex-shrink-0">+</button>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {pending.map(step => {
          const overdue = step.dueDate ? isOverdue(step.dueDate) : false
          return (
            <div key={step.id} className="flex items-center gap-2 group">
              <button
                type="button"
                onClick={() => onToggleStep(step.id)}
                className="w-4 h-4 flex-shrink-0 border border-dark-border hover:border-gold transition-colors"
              />
              <span className="flex-1 text-xs text-[#1a1a18] min-w-0 truncate">{step.text}</span>
              {step.dueDate && (
                <span className={`text-[0.6rem] uppercase tracking-widest flex-shrink-0 ${overdue ? 'text-red-500 font-semibold' : 'text-dark-muted'}`}>
                  {overdue ? '⚠ ' : ''}{fmtDateShort(step.dueDate)}
                </span>
              )}
              <input
                type="date"
                title="Set due date"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[0.6rem] border border-dark-border bg-dark-bg text-dark-muted px-1 w-28 flex-shrink-0"
                value={step.dueDate ?? ''}
                onChange={e => onUpdateStepDue(step.id, e.target.value)}
              />
            </div>
          )
        })}

        {done.length > 0 && (
          <div className="mt-3 pt-3 border-t border-dark-border space-y-1.5">
            {done.map(step => (
              <div key={step.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleStep(step.id)}
                  className="w-4 h-4 flex-shrink-0 border border-emerald-400 bg-emerald-50 flex items-center justify-center text-emerald-600 text-[0.5rem] font-bold"
                >✓</button>
                <span className="flex-1 text-xs text-dark-muted line-through min-w-0 truncate">{step.text}</span>
                {step.completedAt && (
                  <span className="text-[0.6rem] text-dark-muted flex-shrink-0">{fmtDateShort(step.completedAt.slice(0, 10))}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {steps.length === 0 && (
          <p className="text-dark-muted text-xs text-center py-6">No next steps yet. Add one above.</p>
        )}
      </div>
    </div>
  )
}

const ACTIVITY_ICON: Record<ActivityEventType, string> = {
  deal_added: '★', stage_changed: '→', status_changed: '⟳',
  score_changed: '△', letter_sent: '✉', note_added: '✎', step_completed: '✓',
}
const ACTIVITY_COLOR: Record<ActivityEventType, string> = {
  deal_added: 'text-gold border-gold/60',
  stage_changed: 'text-blue-600 border-blue-400/60',
  status_changed: 'text-purple-600 border-purple-400/60',
  score_changed: 'text-amber-600 border-amber-400/60',
  letter_sent: 'text-emerald-600 border-emerald-400/60',
  note_added: 'text-[#5A5A55] border-[#E0DDD4]',
  step_completed: 'text-emerald-600 border-emerald-400/60',
}

function ActivityPanel({ property }: { property: PipelineProperty }) {
  const events: ActivityEvent[] = [
    ...(property.activityLog ?? []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (events.length === 0) {
    return <p className="text-dark-muted text-xs text-center py-6">No activity logged yet.</p>
  }

  return (
    <div className="space-y-0 max-h-64 overflow-y-auto pr-1">
      {events.map((ev, i) => (
        <div key={ev.id} className="flex gap-3 relative">
          {i < events.length - 1 && (
            <div className="absolute left-3 top-7 bottom-0 w-px bg-dark-border" />
          )}
          <div className={`w-6 h-6 flex-shrink-0 border flex items-center justify-center text-[0.55rem] font-bold bg-dark-bg relative z-10 mt-0.5 ${ACTIVITY_COLOR[ev.type]}`}>
            {ACTIVITY_ICON[ev.type]}
          </div>
          <div className="flex-1 pb-4 min-w-0">
            <div className="text-[0.6rem] text-dark-muted uppercase tracking-widest">{fmtDateTime(ev.createdAt)}</div>
            <div className="text-xs text-[#1a1a18] mt-0.5 leading-relaxed">{ev.description}</div>
          </div>
        </div>
      ))}
    </div>
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
  onAddNote,
  onAddStep,
  onToggleStep,
  onUpdateStepDue,
}: {
  property: PipelineProperty
  letter: string
  letterLoading: boolean
  onGenerateLetter: () => void
  onStageChange: (stage: PipelineProperty['stage']) => void
  onNotesChange: (notes: string) => void
  onAddNote: (text: string) => void
  onAddStep: (text: string, dueDate?: string) => void
  onToggleStep: (stepId: string) => void
  onUpdateStepDue: (stepId: string, dueDate: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'notes' | 'steps' | 'activity'>('notes')

  const copyLetter = () => {
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const signals = property.distressSignals

  return (
    <tr className="fade-in">
      <td colSpan={12} className="bg-dark-surface/40 border-b border-dark-border px-0">

        {/* ── Notes / Next Steps / Activity ── */}
        <div className="border-b border-dark-border">
          <div className="flex border-b border-dark-border">
            {([
              { key: 'notes', label: 'Notes', count: (property.noteLog ?? []).length },
              { key: 'steps', label: 'Next Steps', count: (property.nextSteps ?? []).filter(s => !s.completedAt).length },
              { key: 'activity', label: 'Activity', count: (property.activityLog ?? []).length },
            ] as const).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2.5 text-xs uppercase tracking-widest font-sans border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-gold text-gold'
                    : 'border-transparent text-dark-muted hover:text-[#1a1a18]'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 text-[0.55rem] font-mono opacity-60">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className="p-5">
            {activeTab === 'notes' && (
              <NotesPanel
                noteLog={property.noteLog ?? []}
                onAddNote={onAddNote}
              />
            )}
            {activeTab === 'steps' && (
              <NextStepsPanel
                steps={property.nextSteps ?? []}
                onAddStep={onAddStep}
                onToggleStep={onToggleStep}
                onUpdateStepDue={onUpdateStepDue}
              />
            )}
            {activeTab === 'activity' && (
              <ActivityPanel property={property} />
            )}
          </div>
        </div>

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

            {(property.askingPrice || property.offerPrice || property.daysOnMarket || property.dealStructure) && (
              <div className="mt-5 pt-5 border-t border-dark-border">
                <div className="section-label-sm mb-3">Offer &amp; Deal</div>
                <div className="space-y-2 text-xs">
                  {property.askingPrice && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Ask</span>
                      <span className="text-[#1a1a18]">${(property.askingPrice / 1000000).toFixed(2)}M</span>
                    </div>
                  )}
                  {property.offerPrice && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Our Offer</span>
                      <span className="text-[#1a1a18] font-semibold">
                        ${(property.offerPrice / 1000000).toFixed(2)}M
                        {property.askingPrice && (
                          <span className="text-emerald-600 ml-1 font-normal">
                            (−{(((property.askingPrice - property.offerPrice) / property.askingPrice) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {property.daysOnMarket != null && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Days on Market</span>
                      <span className={property.daysOnMarket >= 90 ? 'text-amber-600 font-semibold' : 'text-[#1a1a18]'}>{property.daysOnMarket}d</span>
                    </div>
                  )}
                  {property.offerStatus && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Offer Status</span>
                      <span className={`capitalize font-semibold ${property.offerStatus === 'accepted' ? 'text-emerald-600' : property.offerStatus === 'countered' ? 'text-amber-600' : property.offerStatus === 'rejected' ? 'text-red-500' : 'text-[#1a1a18]'}`}>{property.offerStatus}</span>
                    </div>
                  )}
                  {property.dealStructure && property.dealStructure !== 'standard' && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Structure</span>
                      <span className="text-violet-600 capitalize font-semibold">{property.dealStructure.replace('-', ' ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(property.noiUpsidePct || property.rentIncreasePotentialPct || property.occupancyUpsidePct || property.projectedStabilizedNOI) && (
              <div className="mt-5 pt-5 border-t border-dark-border">
                <div className="section-label-sm mb-3">Business Plan</div>
                <div className="space-y-2 text-xs">
                  {property.noi && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Current NOI</span>
                      <span className="text-[#1a1a18]">${property.noi.toLocaleString()}</span>
                    </div>
                  )}
                  {property.projectedYear1NOI && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Yr 1 NOI</span>
                      <span className="text-sky-600">${property.projectedYear1NOI.toLocaleString()}</span>
                    </div>
                  )}
                  {property.projectedStabilizedNOI && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Stabilized NOI</span>
                      <span className="text-emerald-600 font-semibold">${property.projectedStabilizedNOI.toLocaleString()}</span>
                    </div>
                  )}
                  {property.noiUpsidePct != null && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">NOI Upside</span>
                      <span className="text-sky-600 font-semibold">{property.noiUpsidePct}%</span>
                    </div>
                  )}
                  {property.rentIncreasePotentialPct != null && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Rent Increase</span>
                      <span className="text-sky-600">{property.rentIncreasePotentialPct}%</span>
                    </div>
                  )}
                  {property.occupancyUpsidePct != null && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Occ Upside</span>
                      <span className="text-sky-600">{property.occupancyUpsidePct}%</span>
                    </div>
                  )}
                  {property.climateConversionPossible && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Climate Conv.</span>
                      <span className="text-emerald-600 font-semibold">Possible</span>
                    </div>
                  )}
                  {property.exitStrategy && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Exit Strategy</span>
                      <span className="text-[#1a1a18] capitalize">{property.exitStrategy === 'refi' ? 'Refi & Hold' : property.exitStrategy}</span>
                    </div>
                  )}
                  {property.projectedExitCapRate != null && (
                    <div className="flex justify-between">
                      <span className="text-dark-muted uppercase tracking-widest">Exit Cap Rate</span>
                      <span className="text-[#1a1a18]">{property.projectedExitCapRate.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

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
  // Offer & deal structure
  askingPrice: string; offerPrice: string; daysOnMarket: string;
  offerStatus: PipelineProperty['offerStatus'] | '';
  dealStructure: PipelineProperty['dealStructure'] | '';
  // Business plan upside
  projectedYear1NOI: string; projectedStabilizedNOI: string; noiUpsidePct: string;
  rentIncreasePotentialPct: string; occupancyUpsidePct: string;
  climateConversionPossible: boolean;
  exitStrategy: PipelineProperty['exitStrategy'] | '';
  projectedExitCapRate: string;
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
  askingPrice: '', offerPrice: '', daysOnMarket: '', offerStatus: '', dealStructure: '',
  projectedYear1NOI: '', projectedStabilizedNOI: '', noiUpsidePct: '',
  rentIncreasePotentialPct: '', occupancyUpsidePct: '', climateConversionPossible: false,
  exitStrategy: '', projectedExitCapRate: '',
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
    askingPrice: parseInt(f.askingPrice.replace(/[^0-9]/g, '')) || undefined,
    offerPrice: parseInt(f.offerPrice.replace(/[^0-9]/g, '')) || undefined,
    daysOnMarket: parseInt(f.daysOnMarket) || undefined,
    offerStatus: (f.offerStatus || undefined) as PipelineProperty['offerStatus'],
    dealStructure: (f.dealStructure || undefined) as PipelineProperty['dealStructure'],
    projectedYear1NOI: parseInt(f.projectedYear1NOI.replace(/[^0-9]/g, '')) || undefined,
    projectedStabilizedNOI: parseInt(f.projectedStabilizedNOI.replace(/[^0-9]/g, '')) || undefined,
    noiUpsidePct: parseFloat(f.noiUpsidePct) || undefined,
    rentIncreasePotentialPct: parseFloat(f.rentIncreasePotentialPct) || undefined,
    occupancyUpsidePct: parseFloat(f.occupancyUpsidePct) || undefined,
    climateConversionPossible: f.climateConversionPossible || undefined,
    exitStrategy: (f.exitStrategy || undefined) as PipelineProperty['exitStrategy'],
    projectedExitCapRate: parseFloat(f.projectedExitCapRate) || undefined,
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
    const property: PipelineProperty = {
      ...base,
      id: `new-${Date.now()}`,
      motivationScore: 0,
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

          </div>

          {/* ── Offer & Deal Structure ── */}
          <div>
            <div className="section-label-sm mb-3">Offer &amp; Deal Structure</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-text">Ask Price ($)</label>
                  <input className="input-field-sm" value={form.askingPrice} onChange={e => setF('askingPrice', e.target.value)} placeholder="6,000,000" /></div>
                <div><label className="label-text">Your Offer ($)</label>
                  <input className="input-field-sm" value={form.offerPrice} onChange={e => setF('offerPrice', e.target.value)} placeholder="5,000,000" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-text">Days on Market</label>
                  <input className="input-field-sm" type="number" value={form.daysOnMarket} onChange={e => setF('daysOnMarket', e.target.value)} placeholder="120" /></div>
                <div><label className="label-text">Offer Status</label>
                  <select className="input-field-sm" value={form.offerStatus} onChange={e => setF('offerStatus', e.target.value)}>
                    <option value="">— None —</option>
                    <option value="pending">Pending</option>
                    <option value="countered">Countered</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select></div>
              </div>
              <div><label className="label-text">Deal Structure</label>
                <select className="input-field-sm" value={form.dealStructure} onChange={e => setF('dealStructure', e.target.value)}>
                  <option value="">— Standard —</option>
                  <option value="seller-carry">Seller Carry</option>
                  <option value="leaseback">Leaseback</option>
                  <option value="installment">Installment Sale</option>
                  <option value="all-cash">All Cash</option>
                </select></div>
            </div>
          </div>

          {/* ── Business Plan Upside ── */}
          <div>
            <div className="section-label-sm mb-3">Business Plan Upside</div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label-text">Current NOI ($)</label>
                  <input className="input-field-sm" value={form.noi} onChange={e => setF('noi', e.target.value)} placeholder="240,000" /></div>
                <div><label className="label-text">Yr 1 NOI ($)</label>
                  <input className="input-field-sm" value={form.projectedYear1NOI} onChange={e => setF('projectedYear1NOI', e.target.value)} placeholder="290,000" /></div>
                <div><label className="label-text">Stabilized NOI ($)</label>
                  <input className="input-field-sm" value={form.projectedStabilizedNOI} onChange={e => setF('projectedStabilizedNOI', e.target.value)} placeholder="380,000" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label-text">NOI Upside %</label>
                  <input className="input-field-sm" type="number" value={form.noiUpsidePct} onChange={e => setF('noiUpsidePct', e.target.value)} placeholder="35" /></div>
                <div><label className="label-text">Rent Increase %</label>
                  <input className="input-field-sm" type="number" value={form.rentIncreasePotentialPct} onChange={e => setF('rentIncreasePotentialPct', e.target.value)} placeholder="15" /></div>
                <div><label className="label-text">Occ Upside %</label>
                  <input className="input-field-sm" type="number" value={form.occupancyUpsidePct} onChange={e => setF('occupancyUpsidePct', e.target.value)} placeholder="20" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-text">Exit Strategy</label>
                  <select className="input-field-sm" value={form.exitStrategy} onChange={e => setF('exitStrategy', e.target.value)}>
                    <option value="">— None —</option>
                    <option value="sell">Sell</option>
                    <option value="refi">Refinance &amp; Hold</option>
                    <option value="hold">Long-Term Hold</option>
                  </select></div>
                <div><label className="label-text">Exit Cap Rate</label>
                  <input className="input-field-sm" type="number" step="0.1" value={form.projectedExitCapRate} onChange={e => setF('projectedExitCapRate', e.target.value)} placeholder="5.5" /></div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="climateConversionPossible"
                  checked={form.climateConversionPossible}
                  onChange={e => setF('climateConversionPossible', e.target.checked)}
                  className="w-3.5 h-3.5 accent-gold"
                />
                <label htmlFor="climateConversionPossible" className="text-xs text-dark-muted uppercase tracking-widest cursor-pointer hover:text-[#1a1a18] transition-colors">
                  Climate Control Conversion Possible
                </label>
              </div>
            </div>
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

// ─── Close Deal Modal ─────────────────────────────────────────────────────────

interface CloseFormState {
  finalPurchasePrice: string
  closeDate: string
  initialEquity: string
  debtAmount: string
  lenderName: string
}

function CloseModal({ property, onClose, onConfirm }: {
  property: PipelineProperty
  onClose: () => void
  onConfirm: (entry: PortfolioEntry) => void
}) {
  const [form, setForm] = useState<CloseFormState>({
    finalPurchasePrice: String(property.offerPrice ?? property.askingPrice ?? ''),
    closeDate: new Date().toISOString().slice(0, 10),
    initialEquity: '',
    debtAmount: '',
    lenderName: '',
  })
  const set = (k: keyof CloseFormState, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onConfirm({
      finalPurchasePrice: parseFloat(form.finalPurchasePrice) || 0,
      closeDate: form.closeDate,
      initialEquity: parseFloat(form.initialEquity) || 0,
      debtAmount: parseFloat(form.debtAmount) || 0,
      lenderName: form.lenderName,
      acquiredAt: new Date().toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-dark-bg border border-dark-border" onClick={e => e.stopPropagation()}>
        <div className="border-b border-dark-border px-7 py-5 flex items-center justify-between">
          <div>
            <div className="section-label-sm mb-0.5">Mark as Closed</div>
            <h3 className="font-serif text-2xl font-light text-[#1B2B5E]">{property.facilityName}</h3>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-[#1a1a18] transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          <p className="text-dark-muted text-sm leading-relaxed">
            This deal will move to your portfolio. Enter final acquisition details to complete the close.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Final Purchase Price</label>
              <input className="input-field" type="number" value={form.finalPurchasePrice} onChange={e => set('finalPurchasePrice', e.target.value)} placeholder="5000000" required />
            </div>
            <div>
              <label className="label-text">Close Date</label>
              <input className="input-field" type="date" value={form.closeDate} onChange={e => set('closeDate', e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Initial Equity Invested</label>
              <input className="input-field" type="number" value={form.initialEquity} onChange={e => set('initialEquity', e.target.value)} placeholder="1500000" required />
            </div>
            <div>
              <label className="label-text">Debt / Loan Amount</label>
              <input className="input-field" type="number" value={form.debtAmount} onChange={e => set('debtAmount', e.target.value)} placeholder="3500000" />
            </div>
          </div>
          <div>
            <label className="label-text">Lender Name</label>
            <input className="input-field" value={form.lenderName} onChange={e => set('lenderName', e.target.value)} placeholder="First National Bank" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-dark-border text-dark-muted text-xs uppercase tracking-widest hover:border-gold/40 transition-colors">
              Cancel
            </button>
            <button type="submit" className="btn-gold flex-1">
              Close Deal → Portfolio
            </button>
          </div>
        </form>
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
  const [pendingClose, setPendingClose] = useState<string | null>(null)

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

  // Load from GitHub-backed pipeline.json (durable store) and run migration
  useEffect(() => {
    fetch('/data/pipeline.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: PipelineProperty[]) => {
        mergeProperties(data)
        // Migrate any localStorage deals missing from GitHub (one-time, silent)
        const githubIds = new Set<string>(data.map((p: PipelineProperty) => p.id))
        migrateLocalStorageToGitHub(githubIds).catch(() => {})
      })
      .catch(() => {})
      .finally(() => setSourcesLoaded(n => n + 1))
  }, [])


  const addNote = (id: string, text: string) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const entry: NoteEntry = { id: mkId(), text, createdAt: new Date().toISOString() }
      const event = mkActivityEvent('note_added', `Note: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`)
      const updated = {
        ...p,
        noteLog: [...(p.noteLog ?? []), entry],
        activityLog: [...(p.activityLog ?? []), event],
      }
      saveProperty(updated)
      return updated
    }))
  }

  const addNextStep = (id: string, text: string, dueDate?: string) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const step: NextStep = { id: mkId(), text, dueDate }
      const updated = { ...p, nextSteps: [...(p.nextSteps ?? []), step] }
      saveProperty(updated)
      return updated
    }))
  }

  const toggleNextStep = (propertyId: string, stepId: string) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== propertyId) return p
      const now = new Date().toISOString()
      const steps = (p.nextSteps ?? []).map(s => {
        if (s.id !== stepId) return s
        return s.completedAt ? { ...s, completedAt: undefined } : { ...s, completedAt: now }
      })
      const toggled = steps.find(s => s.id === stepId)
      let updated: PipelineProperty = { ...p, nextSteps: steps }
      if (toggled?.completedAt) {
        const event = mkActivityEvent('step_completed', `Step completed: "${toggled.text}"`)
        updated = { ...updated, activityLog: [...(p.activityLog ?? []), event] }
      }
      saveProperty(updated)
      return updated
    }))
  }

  const updateStepDue = (propertyId: string, stepId: string, dueDate: string) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== propertyId) return p
      const steps = (p.nextSteps ?? []).map(s => s.id === stepId ? { ...s, dueDate } : s)
      const updated = { ...p, nextSteps: steps }
      saveProperty(updated)
      return updated
    }))
  }

  const updateProperty = (id: string, updates: Partial<PipelineProperty>) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const updated = { ...p, ...updates }
      saveProperty(updated)
      return updated
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
      if (data.letter) {
        setProperties(prev => prev.map(p => {
          if (p.id !== property.id) return p
          const event = mkActivityEvent('letter_sent', 'Outreach letter generated')
          const updated = { ...p, activityLog: [...(p.activityLog ?? []), event] }
          saveProperty(updated)
          return updated
        }))
      }
    } catch {
      setLetters(prev => ({ ...prev, [property.id]: { loading: false, text: 'Failed to generate letter. Check your ANTHROPIC_API_KEY.' } }))
    }
  }

  const updateStage = (id: string, stage: PipelineProperty['stage']) => {
    if (stage === 'closed') {
      setPendingClose(id)
      return
    }
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const stageLabel = STAGES.find(s => s.key === stage)?.label ?? stage
      const event = mkActivityEvent('stage_changed', `Stage → ${stageLabel}`)
      const updated = { ...p, stage, activityLog: [...(p.activityLog ?? []), event] }
      saveProperty(updated)
      return updated
    }))
  }

  const confirmClose = (id: string, entry: PortfolioEntry) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const event = mkActivityEvent('stage_changed', 'Stage → Closed · Moved to portfolio')
      const updated: PipelineProperty = {
        ...p,
        stage: 'closed',
        portfolioEntry: entry,
        activityLog: [...(p.activityLog ?? []), event],
      }
      saveProperty(updated)
      return updated
    }))
    setPendingClose(null)
  }

  const updateNotes = (id: string, notes: string) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== id) return p
      const updated = { ...p, notes }
      saveProperty(updated)
      return updated
    }))
  }

  const addProperty = (p: PipelineProperty) => {
    const event = mkActivityEvent('deal_added', `Deal added to pipeline`)
    const withActivity = { ...p, activityLog: [event] }
    saveProperty(withActivity)
    setProperties(prev => [withActivity, ...prev])
  }

  const activeProperties = properties.filter(p => p.stage !== 'closed')
  const closedProperties = properties.filter(p => p.stage === 'closed')

  const filtered = activeProperties
    .filter(p => stageFilter === 'all' || p.stage === stageFilter)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.dealScore ?? -1) - (a.dealScore ?? -1)
      if (sortBy === 'name') return a.facilityName.localeCompare(b.facilityName)
      if (sortBy === 'stage') return a.stage.localeCompare(b.stage)
      return 0
    })

  const highScoring = properties.filter(p => p.dealScore != null && p.dealScore >= 75).length
  const activeConvos = properties.filter(p => ['conversation', 'loi', 'dd'].includes(p.stage)).length
  const inOutreach = properties.filter(p => p.stage === 'outreach').length

  // Offer summary bar — computed across all active (non-closed/dead) deals
  const activeDeals = properties.filter(p => p.stage !== 'closed' && p.stage !== 'dead')
  const totalAsk = activeDeals.reduce((s, p) => s + (p.askingPrice ?? 0), 0)
  const totalOptMid = activeDeals.reduce((s, p) => {
    const opt = calcOptimalOffer(p)
    return s + (opt ? (opt.low + opt.high) / 2 : 0)
  }, 0)
  const spreadPcts = activeDeals
    .filter(p => p.askingPrice)
    .map(p => { const opt = calcOptimalOffer(p); return opt ? ((p.askingPrice! - opt.high) / p.askingPrice!) * 100 : null })
    .filter((v): v is number => v !== null)
  const avgSpreadPct = spreadPcts.length ? spreadPcts.reduce((a, b) => a + b) / spreadPcts.length : 0
  const dealsInRange = activeDeals.filter(p => {
    const opt = calcOptimalOffer(p)
    return opt && p.offerPrice && p.offerPrice >= opt.low && p.offerPrice <= opt.high
  }).length

  const pendingCloseProperty = pendingClose ? properties.find(p => p.id === pendingClose) ?? null : null

  return (
    <AuthGate>
      <>
      <Head>
        <title>Acquisition Pipeline — YEM Acquisitions</title>
      </Head>

      {showAdd && <AddPropertyModal onClose={() => setShowAdd(false)} onAdd={addProperty} />}
      {pendingCloseProperty && (
        <CloseModal
          property={pendingCloseProperty}
          onClose={() => setPendingClose(null)}
          onConfirm={(entry) => confirmClose(pendingClose!, entry)}
        />
      )}

      {/* Pipeline header bar */}
      <div className="relative overflow-hidden" style={{ backgroundColor: '#1B2B5E' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200)', opacity: 0.15 }}
        />
        <div className="relative z-10 mx-auto px-6 lg:px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ maxWidth: '1440px' }}>
          <div>
            <div className="font-sans text-xs uppercase tracking-[0.14em] font-semibold mb-1" style={{ color: '#D4A843' }}>Internal Platform</div>
            <h1 className="font-serif font-light text-white" style={{ fontSize: '2.2rem', lineHeight: '1.1' }}>Acquisition Pipeline</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {properties.length} properties · {highScoring} scored HOT · {activeConvos} active conversations
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-gold self-start md:self-auto">
            + Add Property
          </button>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8">

        {/* Stats */}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Pipeline', value: properties.length, sub: 'properties tracked' },
            { label: 'Scored HOT', value: highScoring, sub: 'deal score ≥ 75' },
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

        {/* Offer Summary Bar */}
        {(totalAsk > 0 || totalOptMid > 0) && (
          <div className="border border-dark-border bg-dark-surface/60 p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Ask', value: fmtM(totalAsk), color: '' },
              { label: 'Total Optimal (Mid)', value: fmtM(totalOptMid), color: 'text-emerald-600' },
              {
                label: 'Avg Ask Spread',
                value: spreadPcts.length ? `${avgSpreadPct > 0 ? '+' : ''}${avgSpreadPct.toFixed(1)}%` : '—',
                color: avgSpreadPct > 5 ? 'text-red-500' : avgSpreadPct < -5 ? 'text-emerald-600' : 'text-amber-600',
              },
              { label: 'Offers in Range', value: String(dealsInRange), color: dealsInRange > 0 ? 'text-emerald-600' : '' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-dark-muted text-xs uppercase tracking-widest mb-1">{label}</div>
                <div className={`font-mono text-sm font-semibold ${color || 'text-[#1a1a18]'}`}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-1.5">
            {[{ key: 'all', label: 'All' }, ...STAGES.filter(s => s.key !== 'closed')].map(s => (
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
          <table className="w-full min-w-[1300px]">
            <thead className="bg-dark-surface/80">
              <tr>
                <th className="pipeline-th pl-4 w-8" />
                <th className="pipeline-th">Property</th>
                <th className="pipeline-th">Units / Built</th>
                <th className="pipeline-th">Score</th>
                <th className="pipeline-th">Distress Signals</th>
                <th className="pipeline-th">Owner Entity</th>
                <th className="pipeline-th">Est. Value</th>
                <th className="pipeline-th">Ask Price</th>
                <th className="pipeline-th">Our Offer</th>
                <th className="pipeline-th">Optimal Offer</th>
                <th className="pipeline-th">Spread</th>
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
                      <div className="flex items-start gap-1.5">
                        <div className="text-[#1a1a18] text-sm font-medium leading-snug">{property.facilityName}</div>
                        {(() => {
                          const overdue = (property.nextSteps ?? []).filter(s => !s.completedAt && s.dueDate && isOverdue(s.dueDate)).length
                          return overdue > 0 ? (
                            <span className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[0.5rem] font-bold rounded-full px-0.5">
                              {overdue}
                            </span>
                          ) : null
                        })()}
                      </div>
                      <div className="text-dark-muted text-xs mt-0.5">{property.address}</div>
                      <div className="text-dark-muted text-xs">{property.city}, {property.state} {property.zipCode}</div>
                      {(() => {
                        const pending = (property.nextSteps ?? []).filter(s => !s.completedAt)
                          .sort((a, b) => (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1)
                        const next = pending[0]
                        if (!next) return null
                        const overdue = next.dueDate ? isOverdue(next.dueDate) : false
                        return (
                          <div className={`flex items-center gap-1 mt-1 text-[0.6rem] uppercase tracking-widest ${overdue ? 'text-red-500 font-semibold' : 'text-amber-600'}`}>
                            <span>{overdue ? '⚠' : '→'}</span>
                            <span className="truncate">{next.text}</span>
                            {next.dueDate && <span className="flex-shrink-0 opacity-80">· {fmtDateShort(next.dueDate)}</span>}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="pipeline-td">
                      <div className="text-[#1a1a18] text-sm">{property.unitCount.toLocaleString()}</div>
                      <div className="text-dark-muted text-xs">{property.yearBuilt}</div>
                    </td>
                    <td className="pipeline-td">
                      {property.dealScore != null ? (
                        <DealScoreBadge score={property.dealScore} dealType={property.dealType} />
                      ) : (
                        <span className="text-dark-muted text-xs">—</span>
                      )}
                      <a
                        href={`/score-deal?id=${property.id}`}
                        onClick={e => e.stopPropagation()}
                        className="block mt-1.5 text-[0.6rem] uppercase tracking-widest text-dark-muted hover:text-gold transition-colors"
                      >
                        {property.dealScore != null ? 'Override Score →' : 'Score Deal →'}
                      </a>
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
                    <td className="pipeline-td" onClick={e => e.stopPropagation()}>
                      <InlinePriceCell
                        value={property.askingPrice}
                        onSave={n => updateProperty(property.id, { askingPrice: n })}
                      />
                    </td>
                    <td className="pipeline-td" onClick={e => e.stopPropagation()}>
                      <InlinePriceCell
                        value={property.offerPrice}
                        onSave={n => updateProperty(property.id, { offerPrice: n })}
                      />
                    </td>
                    <td className="pipeline-td min-w-[150px]">
                      <OptimalOfferCell property={property} />
                    </td>
                    <td className="pipeline-td">
                      <SpreadCell
                        askingPrice={property.askingPrice}
                        optHigh={calcOptimalOffer(property)?.high ?? null}
                      />
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
                      onAddNote={(text) => addNote(property.id, text)}
                      onAddStep={(text, due) => addNextStep(property.id, text, due)}
                      onToggleStep={(stepId) => toggleNextStep(property.id, stepId)}
                      onUpdateStepDue={(stepId, due) => updateStepDue(property.id, stepId, due)}
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
          {filtered.length} of {activeProperties.length} active properties shown
        </p>

        {/* Closed Deals Section */}
        {closedProperties.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="section-label">Closed Deals</div>
              <span className="text-dark-muted text-xs">({closedProperties.length} {closedProperties.length === 1 ? 'property' : 'properties'} — moved to portfolio)</span>
            </div>
            <div className="border border-dark-border overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-dark-surface/80">
                  <tr>
                    <th className="pipeline-th">Property</th>
                    <th className="pipeline-th">Units</th>
                    <th className="pipeline-th">Final Price</th>
                    <th className="pipeline-th">Close Date</th>
                    <th className="pipeline-th">Equity In</th>
                    <th className="pipeline-th">Lender</th>
                    <th className="pipeline-th">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {closedProperties.map(p => {
                    const pe = p.portfolioEntry
                    return (
                      <tr key={p.id} className="pipeline-row opacity-70">
                        <td className="pipeline-td">
                          <div className="text-sm font-medium text-[#1a1a18]">{p.facilityName}</div>
                          <div className="text-dark-muted text-xs">{p.city}, {p.state}</div>
                        </td>
                        <td className="pipeline-td text-sm">{p.unitCount}</td>
                        <td className="pipeline-td font-mono text-sm">
                          {pe ? `$${(pe.finalPurchasePrice / 1000000).toFixed(2)}M` : '—'}
                        </td>
                        <td className="pipeline-td text-sm">
                          {pe?.closeDate ?? '—'}
                        </td>
                        <td className="pipeline-td font-mono text-sm">
                          {pe ? `$${(pe.initialEquity / 1000).toFixed(0)}K` : '—'}
                        </td>
                        <td className="pipeline-td text-sm text-dark-muted">
                          {pe?.lenderName || '—'}
                        </td>
                        <td className="pipeline-td">
                          {p.dealScore != null
                            ? <DealScoreBadge score={p.dealScore} dealType={p.dealType} />
                            : <span className="text-dark-muted text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </>
    </AuthGate>
  )
}
