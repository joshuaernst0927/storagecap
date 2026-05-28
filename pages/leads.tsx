import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import AuthGate from '@/components/AuthGate'
import { Lead, LeadSource, LeadStatus, SOURCE_LABELS, STATUS_LABELS, getLeadTier, generateLeadId, scoreLead } from '@/lib/leadsData'
import { loadLeads, saveLeads, upsertLeads, updateLeadStatus, deleteLead } from '@/lib/leadsStore'

// ─── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const tier = getLeadTier(score)
  const colors = {
    HOT: 'bg-red-100 text-red-700 border border-red-200',
    WARM: 'bg-amber-100 text-amber-700 border border-amber-200',
    COLD: 'bg-gray-100 text-gray-500 border border-gray-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold font-mono ${colors[tier]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tier === 'HOT' ? 'bg-red-500' : tier === 'WARM' ? 'bg-amber-500' : 'bg-gray-400'}`} />
      {score} · {tier}
    </span>
  )
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LeadStatus }) {
  const colors: Record<LeadStatus, string> = {
    'new': 'bg-blue-50 text-blue-600 border border-blue-200',
    'contacted': 'bg-purple-50 text-purple-600 border border-purple-200',
    'qualified': 'bg-green-50 text-green-700 border border-green-200',
    'added-to-pipeline': 'bg-gold/10 text-[#B8900C] border border-gold/30',
    'dead': 'bg-gray-100 text-gray-400 border border-gray-200',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-sans uppercase tracking-wider ${colors[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Source chip ───────────────────────────────────────────────────────────────
function SourceChip({ source }: { source: LeadSource }) {
  return (
    <span className="inline-block bg-dark-surface border border-dark-border px-2 py-0.5 rounded text-xs text-dark-muted font-sans">
      {SOURCE_LABELS[source]}
    </span>
  )
}

// ─── Add Lead Modal ────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (lead: Lead) => void }) {
  const [form, setForm] = useState({
    facilityName: '', address: '', city: '', state: 'TX', zipCode: '',
    unitCount: '', askingPrice: '', ownerName: '', ownerEntity: '', sourceUrl: '', notes: '',
    taxDelinquency: false, fireCodeViolations: false, lisPendens: false,
    decliningOccupancy: false, outOfStateOwner: false, longTermOwner: false,
    ownerAge: '', yearsOwned: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const signals = {
      taxDelinquency: form.taxDelinquency,
      fireCodeViolations: form.fireCodeViolations,
      lisPendens: form.lisPendens,
      decliningOccupancy: form.decliningOccupancy,
      outOfStateOwner: form.outOfStateOwner,
      longTermOwner: form.longTermOwner,
      ownerAge: form.ownerAge ? parseInt(form.ownerAge) : undefined,
      yearsOwned: form.yearsOwned ? parseInt(form.yearsOwned) : undefined,
    }
    const lead: Lead = {
      id: generateLeadId(),
      facilityName: form.facilityName || undefined,
      address: form.address,
      city: form.city,
      state: form.state,
      zipCode: form.zipCode || undefined,
      unitCount: form.unitCount ? parseInt(form.unitCount) : undefined,
      askingPrice: form.askingPrice ? parseInt(form.askingPrice) : undefined,
      ownerName: form.ownerName || 'Unknown',
      ownerEntity: form.ownerEntity || undefined,
      source: 'manual',
      sourceUrl: form.sourceUrl || undefined,
      distressSignals: signals,
      score: scoreLead(signals),
      status: 'new',
      foundAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      notes: form.notes || undefined,
    }
    onAdd(lead)
  }

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-dark-border p-8 my-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="section-label">Add Lead</div>
            <p className="text-dark-muted text-xs mt-1">Manually enter a new acquisition lead.</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-[#1a1a18] text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">Facility Name</label>
              <input className="form-input" value={form.facilityName} onChange={e => set('facilityName', e.target.value)} placeholder="ABC Self Storage" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Address <span className="text-red-500">*</span></label>
              <input className="form-input" required value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
            </div>
            <div>
              <label className="form-label">City <span className="text-red-500">*</span></label>
              <input className="form-input" required value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="form-label">State</label>
              <select className="form-input" value={form.state} onChange={e => set('state', e.target.value)}>
                {['TX','GA','SC','TN','AZ','FL','AL','MS','NC','VA','LA'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Units</label>
              <input className="form-input" type="number" value={form.unitCount} onChange={e => set('unitCount', e.target.value)} placeholder="350" />
            </div>
            <div>
              <label className="form-label">Asking Price</label>
              <input className="form-input" type="number" value={form.askingPrice} onChange={e => set('askingPrice', e.target.value)} placeholder="2500000" />
            </div>
            <div>
              <label className="form-label">Owner Name <span className="text-red-500">*</span></label>
              <input className="form-input" required value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Owner Entity</label>
              <input className="form-input" value={form.ownerEntity} onChange={e => set('ownerEntity', e.target.value)} placeholder="LLC name" />
            </div>
            <div>
              <label className="form-label">Owner Age</label>
              <input className="form-input" type="number" value={form.ownerAge} onChange={e => set('ownerAge', e.target.value)} placeholder="67" />
            </div>
            <div>
              <label className="form-label">Years Owned</label>
              <input className="form-input" type="number" value={form.yearsOwned} onChange={e => set('yearsOwned', e.target.value)} placeholder="18" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Source URL</label>
              <input className="form-input" type="url" value={form.sourceUrl} onChange={e => set('sourceUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-dark-muted mb-3 font-semibold">Distress Signals</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['taxDelinquency', 'Tax Delinquency'],
                ['fireCodeViolations', 'Fire Code Violations'],
                ['lisPendens', 'Lis Pendens'],
                ['decliningOccupancy', 'Declining Occupancy'],
                ['outOfStateOwner', 'Out-of-State Owner'],
                ['longTermOwner', 'Long-Term Owner'],
              ] as [string, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-[#1a1a18]">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={e => set(key, e.target.checked)}
                    className="accent-gold w-3.5 h-3.5"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-gold flex-1">Add Lead</button>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Lead Detail Modal ─────────────────────────────────────────────────────────
function LeadDetailModal({ lead, onClose, onUpdate }: {
  lead: Lead
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Lead>) => void
}) {
  const [notes, setNotes] = useState(lead.notes || '')
  const [letter, setLetter] = useState(lead.outreachLetter || '')
  const [generatingLetter, setGeneratingLetter] = useState(false)
  const [letterError, setLetterError] = useState('')
  const [saving, setSaving] = useState(false)

  const generateLetter = async () => {
    setGeneratingLetter(true)
    setLetterError('')
    try {
      const res = await fetch('/api/generate-lead-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      })
      const data = await res.json()
      if (data.letter) {
        setLetter(data.letter)
      } else {
        setLetterError(data.error || 'Generation failed')
      }
    } catch {
      setLetterError('Network error')
    } finally {
      setGeneratingLetter(false)
    }
  }

  const saveChanges = () => {
    setSaving(true)
    onUpdate(lead.id, { notes, outreachLetter: letter })
    setTimeout(() => { setSaving(false) }, 600)
  }

  const formatDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const signals = Object.entries({
    'Tax Delinquency': lead.distressSignals.taxDelinquency,
    'Fire Code Violations': lead.distressSignals.fireCodeViolations,
    'Lis Pendens': lead.distressSignals.lisPendens,
    'Declining Occupancy': lead.distressSignals.decliningOccupancy,
    'Out-of-State Owner': lead.distressSignals.outOfStateOwner,
    'Long-Term Owner': lead.distressSignals.longTermOwner,
  }).filter(([, v]) => v).map(([k]) => k)

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white border border-dark-border my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-7 border-b border-dark-border">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ScoreBadge score={lead.score} />
              <StatusBadge status={lead.status} />
              <SourceChip source={lead.source} />
            </div>
            <h2 className="font-serif text-2xl font-light text-[#1B2B5E] mt-2">
              {lead.facilityName || lead.address}
            </h2>
            <p className="text-dark-muted text-sm mt-1">{lead.address} · {lead.city}, {lead.state}</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-[#1a1a18] text-lg mt-1">✕</button>
        </div>

        <div className="p-7 space-y-6">
          {/* Key details */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Owner', lead.ownerName],
              ['Units', lead.unitCount ? lead.unitCount.toLocaleString() : '—'],
              ['Asking Price', lead.askingPrice ? `$${lead.askingPrice.toLocaleString()}` : '—'],
              ['Found', formatDate(lead.foundAt)],
              ['Last Updated', formatDate(lead.lastUpdated)],
              ['Contacted', formatDate(lead.contactedAt)],
            ].map(([label, value]) => (
              <div key={label} className="bg-dark-surface border border-dark-border p-3">
                <div className="text-[0.65rem] uppercase tracking-widest text-dark-muted mb-1">{label}</div>
                <div className="text-sm font-medium text-[#1a1a18]">{value}</div>
              </div>
            ))}
          </div>

          {/* Distress signals */}
          {signals.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest text-dark-muted mb-2 font-semibold">Distress Signals</div>
              <div className="flex flex-wrap gap-2">
                {signals.map(s => (
                  <span key={s} className="tag-red text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Status change */}
          <div>
            <div className="text-xs uppercase tracking-widest text-dark-muted mb-2 font-semibold">Status</div>
            <div className="flex flex-wrap gap-2">
              {(['new', 'contacted', 'qualified', 'added-to-pipeline', 'dead'] as LeadStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => {
                    const updates: Partial<Lead> = { status: s }
                    if (s === 'contacted' && !lead.contactedAt) updates.contactedAt = new Date().toISOString()
                    onUpdate(lead.id, updates)
                  }}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider border transition-colors duration-150 ${
                    lead.status === s
                      ? 'bg-[#1B2B5E] text-white border-[#1B2B5E]'
                      : 'bg-white text-dark-muted border-dark-border hover:border-gold/50 hover:text-[#1a1a18]'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Source URL */}
          {lead.sourceUrl && (
            <div>
              <div className="text-xs uppercase tracking-widest text-dark-muted mb-1 font-semibold">Source</div>
              <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#1B2B5E] hover:text-gold text-sm underline break-all transition-colors">
                {lead.sourceUrl}
              </a>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs uppercase tracking-widest text-dark-muted mb-2 block font-semibold">Notes</label>
            <textarea
              className="form-input text-sm"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this lead..."
            />
          </div>

          {/* Outreach letter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-widest text-dark-muted font-semibold">Outreach Letter</label>
              <button
                onClick={generateLetter}
                disabled={generatingLetter}
                className="text-xs uppercase tracking-widest text-[#1B2B5E] hover:text-gold border border-dark-border hover:border-gold/50 px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingLetter ? 'Generating...' : letter ? 'Regenerate' : 'Generate Letter'}
              </button>
            </div>
            {letterError && <p className="text-red-500 text-xs mb-2">{letterError}</p>}
            <textarea
              className="form-input text-sm font-mono"
              rows={12}
              value={letter}
              onChange={e => setLetter(e.target.value)}
              placeholder="Click 'Generate Letter' to create an AI-personalized outreach letter."
            />
          </div>

          <div className="flex gap-3">
            <button onClick={saveChanges} disabled={saving} className="btn-gold">
              {saving ? 'Saved ✓' : 'Save Changes'}
            </button>
            <button onClick={onClose} className="btn-ghost">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Scan status bar ───────────────────────────────────────────────────────────
function ScanBar({ onScanDone }: { onScanDone: (leads: Lead[]) => void }) {
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<{ total: number; scannedAt: string } | null>(null)
  const [error, setError] = useState('')

  const runScan = async () => {
    setScanning(true)
    setError('')
    try {
      const res = await fetch('/api/run-leads?email=0', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setLastResult({ total: data.total, scannedAt: data.scannedAt })
        onScanDone(data.leads as Lead[])
      } else {
        setError(data.error || 'Scan failed')
      }
    } catch {
      setError('Network error — check connection')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="flex items-center gap-4 bg-dark-surface border border-dark-border px-5 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${scanning ? 'bg-gold animate-pulse' : lastResult ? 'bg-green-500' : 'bg-dark-border'}`} />
        <span className="text-dark-muted text-xs uppercase tracking-widest">
          {scanning ? 'Scanning sources...' : lastResult
            ? `Last scan: ${new Date(lastResult.scannedAt).toLocaleTimeString()} · ${lastResult.total} leads found`
            : 'No scan run yet'}
        </span>
      </div>
      {error && <span className="text-red-500 text-xs">{error}</span>}
      <button
        onClick={runScan}
        disabled={scanning}
        className="ml-auto btn-navy text-xs py-1.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {scanning ? 'Scanning...' : 'Run Scan Now'}
      </button>
    </div>
  )
}

// ─── Main Leads Page ───────────────────────────────────────────────────────────
function LeadsContent() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all')
  const [filterTier, setFilterTier] = useState<'all' | 'HOT' | 'WARM' | 'COLD'>('all')
  const [filterSource, setFilterSource] = useState<LeadSource | 'all'>('all')
  const [filterState, setFilterState] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openLead, setOpenLead] = useState<Lead | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [sortBy, setSortBy] = useState<'score' | 'foundAt' | 'city'>('score')

  useEffect(() => {
    setLeads(loadLeads())
  }, [])

  const refresh = useCallback(() => setLeads(loadLeads()), [])

  const handleScanDone = (incoming: Lead[]) => {
    upsertLeads(incoming)
    refresh()
  }

  const handleAdd = (lead: Lead) => {
    upsertLeads([lead])
    refresh()
    setShowAddModal(false)
  }

  const handleUpdate = (id: string, updates: Partial<Lead>) => {
    updateLeadStatus(id, updates)
    refresh()
    if (openLead?.id === id) setOpenLead(l => l ? { ...l, ...updates } : l)
  }

  const handleDelete = (id: string) => {
    deleteLead(id)
    setSelected(s => { const n = new Set(s); n.delete(id); return n })
    refresh()
    if (openLead?.id === id) setOpenLead(null)
  }

  const handleBulkStatus = (status: LeadStatus) => {
    selected.forEach(id => updateLeadStatus(id, { status }))
    setSelected(new Set())
    refresh()
  }

  const handleBulkDelete = () => {
    selected.forEach(id => deleteLead(id))
    setSelected(new Set())
    refresh()
  }

  // Filter + sort
  const filtered = leads
    .filter(l => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterTier !== 'all' && getLeadTier(l.score) !== filterTier) return false
      if (filterSource !== 'all' && l.source !== filterSource) return false
      if (filterState !== 'all' && l.state !== filterState) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !l.facilityName?.toLowerCase().includes(q) &&
          !l.address.toLowerCase().includes(q) &&
          !l.city.toLowerCase().includes(q) &&
          !l.ownerName.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'foundAt') return new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime()
      return a.city.localeCompare(b.city)
    })

  const allSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id))
  const toggleAll = () => {
    if (allSelected) {
      setSelected(s => { const n = new Set(s); filtered.forEach(l => n.delete(l.id)); return n })
    } else {
      setSelected(s => { const n = new Set(s); filtered.forEach(l => n.add(l.id)); return n })
    }
  }

  const hotCount = leads.filter(l => l.score >= 70 && l.status === 'new').length
  const warmCount = leads.filter(l => l.score >= 40 && l.score < 70 && l.status === 'new').length
  const totalNew = leads.filter(l => l.status === 'new').length
  const states = Array.from(new Set(leads.map(l => l.state))).sort()
  const sources = Array.from(new Set(leads.map(l => l.source))) as LeadSource[]

  return (
    <>
      {openLead && (
        <LeadDetailModal
          lead={openLead}
          onClose={() => setOpenLead(null)}
          onUpdate={handleUpdate}
        />
      )}
      {showAddModal && (
        <AddLeadModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} />
      )}

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-dark-border" style={{ backgroundColor: '#1B2B5E' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200)', opacity: 0.15 }}
        />
        <div className="relative z-10 page-hero">
          <div className="section-label" style={{ color: '#D4A843' }}>Lead Intelligence</div>
          <h1 className="font-serif font-light text-white leading-[1.05] max-w-3xl mb-6" style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)' }}>
            Motivated sellers.<br />
            <em style={{ color: '#D4A843' }}>Before anyone else.</em>
          </h1>
          <p className="text-lg max-w-xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Automated daily scans across 13 sources — court records, tax rolls, marketplace listings,
            and classified ads — surface distressed self-storage owners in your target markets.
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="section-container space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Leads', value: leads.length.toString() },
              { label: 'New This Session', value: totalNew.toString() },
              { label: 'HOT', value: hotCount.toString(), color: 'text-red-600' },
              { label: 'WARM', value: warmCount.toString(), color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="border border-dark-border bg-white p-4 text-center">
                <div className={`font-serif text-4xl font-light leading-none mb-1 ${color || 'text-[#1B2B5E]'}`}>{value}</div>
                <div className="text-xs uppercase tracking-widest text-dark-muted">{label}</div>
              </div>
            ))}
          </div>

          {/* Scan bar */}
          <ScanBar onScanDone={handleScanDone} />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input w-48 text-sm py-2"
            />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as LeadStatus | 'all')} className="form-input text-xs py-2 pr-8">
              <option value="all">All Statuses</option>
              {(['new', 'contacted', 'qualified', 'added-to-pipeline', 'dead'] as LeadStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select value={filterTier} onChange={e => setFilterTier(e.target.value as typeof filterTier)} className="form-input text-xs py-2 pr-8">
              <option value="all">All Tiers</option>
              <option value="HOT">HOT (70+)</option>
              <option value="WARM">WARM (40-69)</option>
              <option value="COLD">COLD (&lt;40)</option>
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value as LeadSource | 'all')} className="form-input text-xs py-2 pr-8">
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </select>
            <select value={filterState} onChange={e => setFilterState(e.target.value)} className="form-input text-xs py-2 pr-8">
              <option value="all">All States</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="form-input text-xs py-2 pr-8">
              <option value="score">Sort: Score</option>
              <option value="foundAt">Sort: Newest</option>
              <option value="city">Sort: City</option>
            </select>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowAddModal(true)} className="btn-navy text-xs py-2 px-4">+ Add Lead</button>
            </div>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-[#1B2B5E] text-white px-5 py-3 text-sm">
              <span className="text-xs uppercase tracking-widest opacity-70">{selected.size} selected</span>
              <div className="flex gap-2 ml-auto">
                {(['contacted', 'qualified', 'dead'] as LeadStatus[]).map(s => (
                  <button key={s} onClick={() => handleBulkStatus(s)}
                    className="text-xs uppercase tracking-widest border border-white/30 hover:bg-white/10 px-3 py-1.5 transition-colors">
                    Mark {STATUS_LABELS[s]}
                  </button>
                ))}
                <button onClick={handleBulkDelete}
                  className="text-xs uppercase tracking-widest border border-red-400/50 text-red-300 hover:bg-red-500/20 px-3 py-1.5 transition-colors">
                  Delete
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="text-xs opacity-50 hover:opacity-100 px-2 transition-opacity">✕</button>
              </div>
            </div>
          )}

          {/* Lead table */}
          <div className="border border-dark-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-surface border-b border-dark-border">
                  <th className="px-4 py-3 text-left w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-gold" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-dark-muted font-semibold">Facility / Address</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-dark-muted font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-dark-muted font-semibold">Market</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-dark-muted font-semibold">Source</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-dark-muted font-semibold">Score</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-dark-muted font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-widest text-dark-muted font-semibold">Found</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-dark-muted text-sm">
                      {leads.length === 0
                        ? 'No leads yet. Run a scan or add a lead manually.'
                        : 'No leads match the current filters.'}
                    </td>
                  </tr>
                ) : filtered.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className={`border-b border-dark-border hover:bg-dark-surface/60 cursor-pointer transition-colors ${
                      i % 2 === 0 ? 'bg-white' : 'bg-dark-bg'
                    } ${selected.has(lead.id) ? '!bg-gold/5' : ''}`}
                    onClick={() => setOpenLead(lead)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={e => {
                          setSelected(s => {
                            const n = new Set(s)
                            e.target.checked ? n.add(lead.id) : n.delete(lead.id)
                            return n
                          })
                        }}
                        className="accent-gold"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1a1a18] text-sm leading-snug">
                        {lead.facilityName || lead.address}
                      </div>
                      {lead.facilityName && (
                        <div className="text-dark-muted text-xs mt-0.5">{lead.address}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-dark-muted text-xs">{lead.ownerName}</td>
                    <td className="px-4 py-3 text-dark-muted text-xs whitespace-nowrap">{lead.city}, {lead.state}</td>
                    <td className="px-4 py-3"><SourceChip source={lead.source} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={lead.score} /></td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3 text-dark-muted text-xs whitespace-nowrap">
                      {new Date(lead.foundAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="text-dark-muted hover:text-red-500 transition-colors text-xs"
                        title="Delete lead"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="text-xs text-dark-muted text-right">
              Showing {filtered.length} of {leads.length} leads
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default function Leads() {
  return (
    <>
      <Head>
        <title>Leads — YEM Acquisitions</title>
        <meta name="description" content="Daily lead intelligence scanning for motivated self-storage sellers." />
      </Head>
      <AuthGate>
        <LeadsContent />
      </AuthGate>
    </>
  )
}
