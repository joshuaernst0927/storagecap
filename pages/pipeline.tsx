import Head from 'next/head'
import { useState, useEffect } from 'react'
import {
  mockProperties,
  PipelineProperty,
  DealStatus,
  STAGES,
  scoreColor,
  scoreLabel,
  stageBadgeColor,
  tier,
  tierColor,
  statusLabel,
  statusColor,
} from '@/lib/pipelineData'
import { loadSavedProperties } from '@/lib/pipelineStore'

// ─── Sub-components ──────────────────────────────────────────────────────────

function MotivationBadge({ score }: { score: number }) {
  const t = tier(score)
  return (
    <div className="flex flex-col items-start gap-2">
      <div className={`border-2 font-mono font-bold w-14 h-14 flex flex-col items-center justify-center flex-shrink-0 leading-none ${scoreColor(score)}`}>
        <span className="text-2xl">{score}</span>
        <span className="text-[0.65rem] tracking-wide uppercase mt-0.5 font-sans">{scoreLabel(score)}</span>
      </div>
      <span className={`border text-[0.75rem] uppercase tracking-widest px-2.5 py-1 font-sans font-bold ${tierColor(t)}`}>
        {t}
      </span>
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

function calcScore(f: NewPropForm): number {
  let s = 0
  if (f.taxDelinquency) { s += 25; if (parseInt(f.taxDelinquencyYears) >= 3) s += 10 }
  if (f.fireCodeViolations) s += 15
  if (f.lisPendens) s += 20
  if (f.decliningOccupancy) s += 10
  if (f.deferredMaintenance) s += 5
  if (f.outOfStateOwner) s += 5
  if (parseInt(f.ownerAge) >= 65) s += 10
  if (parseInt(f.yearsOwned) >= 20) s += 10
  return Math.min(s, 100)
}

function AddPropertyModal({ onClose, onAdd }: { onClose: () => void; onAdd: (p: PipelineProperty) => void }) {
  const [form, setForm] = useState<NewPropForm>(emptyForm)
  const setF = (field: keyof NewPropForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = () => {
    if (!form.facilityName || !form.city || !form.state) return
    const score = calcScore(form)
    const property: PipelineProperty = {
      id: `new-${Date.now()}`,
      facilityName: form.facilityName,
      address: form.address,
      city: form.city,
      state: form.state,
      zipCode: form.zipCode,
      unitCount: parseInt(form.unitCount) || 0,
      unitMix: '',
      yearBuilt: parseInt(form.yearBuilt) || 2000,
      landAcres: 0,
      climatePercent: 0,
      estimatedValue: parseInt(form.estimatedValue.replace(/[^0-9]/g, '')) || 0,
      noi: parseInt(form.noi.replace(/[^0-9]/g, '')) || undefined,
      occupancy: parseInt(form.occupancy) || 0,
      ownerName: form.ownerName,
      ownerEntity: form.ownerEntity,
      ownerEntityState: form.ownerEntityState,
      ownerMailingAddress: form.ownerMailingAddress,
      ownerPhone: form.ownerPhone,
      distressSignals: {
        taxDelinquency: form.taxDelinquency,
        taxDelinquencyAmount: parseInt(form.taxDelinquencyAmount.replace(/[^0-9]/g, '')) || 0,
        taxDelinquencyYears: parseInt(form.taxDelinquencyYears) || 0,
        fireCodeViolations: form.fireCodeViolations,
        fireCodeCount: parseInt(form.fireCodeCount) || 0,
        fireCodeDetails: [],
        codeViolations: [],
        lisPendens: form.lisPendens,
        lisPendensAmount: parseInt(form.lisPendensAmount.replace(/[^0-9]/g, '')) || 0,
        decliningOccupancy: form.decliningOccupancy,
        occupancyTrend: parseInt(form.occupancyTrend) || 0,
        deferredMaintenance: form.deferredMaintenance,
        outOfStateOwner: form.outOfStateOwner,
        ownerAge: parseInt(form.ownerAge) || undefined,
        yearsOwned: parseInt(form.yearsOwned) || undefined,
      },
      motivationScore: score,
      stage: form.stage,
      currentStatus: 'outreach-sent',
      priority: form.priority,
      source: form.source,
      addedDate: new Date().toISOString().split('T')[0],
      notes: form.notes,
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

            <div className="mt-4 border border-dark-border p-4 bg-dark-surface">
              <div className="flex items-center justify-between">
                <span className="text-dark-muted text-xs uppercase tracking-widest">Calculated Motivation Score</span>
                <span className={`font-mono text-lg font-bold border px-3 py-1 ${scoreColor(calcScore(form))}`}>
                  {calcScore(form)}
                </span>
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

// ─── Main Pipeline Page ───────────────────────────────────────────────────────

export default function Pipeline() {
  const [properties, setProperties] = useState<PipelineProperty[]>(mockProperties)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [letters, setLetters] = useState<Record<string, { loading: boolean; text: string }>>(() => {
    const init: Record<string, { loading: boolean; text: string }> = {}
    mockProperties.forEach(p => {
      if (p.outreachLetter) init[p.id] = { loading: false, text: p.outreachLetter }
    })
    return init
  })
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'stage'>('score')
  const [showAdd, setShowAdd] = useState(false)

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
  }, [])

  // Load from Python pipeline ingest API
  useEffect(() => {
    fetch('/api/pipeline-ingest')
      .then(r => r.ok ? r.json() : [])
      .then((data: PipelineProperty[]) => mergeProperties(data))
      .catch(() => {})
  }, [])

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
    setProperties(prev => prev.map(p => p.id === id ? { ...p, stage } : p))
  }

  const updateNotes = (id: string, notes: string) => {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, notes } : p))
  }

  const addProperty = (p: PipelineProperty) => {
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

  const totalScore = Math.round(properties.reduce((sum, p) => sum + p.motivationScore, 0) / properties.length)
  const highMot = properties.filter(p => p.motivationScore >= 75).length
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
            { label: 'High Motivation', value: highMot, sub: 'score ≥ 75' },
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
                    <td className="pipeline-td">
                      <div className="text-[#1a1a18] text-sm font-medium">{property.facilityName}</div>
                      <div className="text-dark-muted text-xs mt-0.5">{property.address}</div>
                      <div className="text-dark-muted text-xs">{property.city}, {property.state} {property.zipCode}</div>
                    </td>
                    <td className="pipeline-td">
                      <div className="text-[#1a1a18] text-sm">{property.unitCount.toLocaleString()}</div>
                      <div className="text-dark-muted text-xs">{property.yearBuilt}</div>
                    </td>
                    <td className="pipeline-td">
                      <MotivationBadge score={property.motivationScore} />
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

          {filtered.length === 0 && (
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
