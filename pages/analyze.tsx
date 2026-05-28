import Head from 'next/head'
import Link from 'next/link'
import { useState, FormEvent } from 'react'
import { saveProperty } from '@/lib/pipelineStore'
import type { PipelineProperty, DistressSignals } from '@/lib/pipelineData'

interface Form {
  propertyName: string; city: string; state: string; unitCount: string
  unitMix: string; occupancy: string; askingPrice: string; noi: string
  yearBuilt: string; notes: string
}

const initial: Form = { propertyName: '', city: '', state: '', unitCount: '', unitMix: '', occupancy: '', askingPrice: '', noi: '', yearBuilt: '', notes: '' }

export default function Analyze() {
  const [form, setForm] = useState<Form>(initial)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedId, setSavedId] = useState('')

  const set = (k: keyof Form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setAnalysis(''); setError(''); setSaved(false); setSavedId('')
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      const d = await res.json()
      setAnalysis(d.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToPipeline = async () => {
    setSaving(true)
    const occ = parseInt(form.occupancy) || 0
    const year = parseInt(form.yearBuilt) || 0
    const notesLower = form.notes.toLowerCase()
    const deferredMaintenance = notesLower.includes('deferred') || notesLower.includes('maintenance') || notesLower.includes('repair')
    const decliningOccupancy = occ < 75

    const distressSignals: DistressSignals = {
      taxDelinquency: false,
      codeViolations: [],
      lisPendens: false,
      fireCodeViolations: false,
      decliningOccupancy,
      occupancyTrend: decliningOccupancy ? occ - 85 : 0,
      deferredMaintenance,
      maintenanceIssues: deferredMaintenance ? ['Noted in analyzer input'] : undefined,
      outOfStateOwner: false,
    }

    let score = 0
    if (decliningOccupancy) score += 15
    if (deferredMaintenance) score += 10
    if (year > 0 && year < 1990) score += 10
    score = Math.min(score, 100)

    const askingNum = parseInt(form.askingPrice.replace(/[^0-9]/g, '')) || 0
    const noiNum = parseInt(form.noi.replace(/[^0-9]/g, '')) || 0

    const property: PipelineProperty = {
      id: `analyze-${Date.now()}`,
      facilityName: form.propertyName || `${form.city} Self Storage`,
      address: '',
      city: form.city,
      state: form.state,
      zipCode: '',
      unitCount: parseInt(form.unitCount) || 0,
      unitMix: form.unitMix,
      yearBuilt: year || 2000,
      landAcres: 0,
      climatePercent: 0,
      estimatedValue: askingNum,
      askingPrice: askingNum || undefined,
      noi: noiNum || undefined,
      occupancy: occ,
      ownerName: 'Unknown',
      ownerEntity: 'Unknown',
      ownerEntityState: form.state,
      ownerMailingAddress: `${form.city}, ${form.state}`,
      distressSignals,
      motivationScore: score,
      stage: 'identified',
      currentStatus: 'outreach-sent',
      priority: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
      source: 'data-scrape',
      addedDate: new Date().toISOString().split('T')[0],
      notes: form.notes || undefined,
    }

    try {
      const res = await fetch('/api/generate-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property),
      })
      const data = await res.json()
      if (data.letter) property.outreachLetter = data.letter
    } catch {}

    saveProperty(property)
    setSavedId(property.id)
    setSaved(true)
    setSaving(false)
  }

  const sections = analysis
    ? analysis.split(/\n(?=\*\*[^*]+\*\*)/).filter(Boolean)
    : []

  return (
    <>
      <Head>
        <title>AI Property Analyzer — YEM Acquisitions</title>
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">AI Analyzer</div>
        <h1 className="display-heading text-6xl md:text-8xl max-w-3xl mb-8">
          Instant acquisition<br />
          <em className="text-gold">intelligence.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Enter property details for an institutional-grade acquisition analysis —
          cap rate context, value-add potential, market assessment, and recommendation.
        </p>
      </section>

      <section className="py-24">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="section-label">Property Details</div>
              <div><label className="label-text">Nickname / Reference</label>
                <input className="input-field" value={form.propertyName} onChange={e => set('propertyName', e.target.value)} placeholder="Main Street Storage — Tucson" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text">City *</label>
                  <input className="input-field" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Tucson" required /></div>
                <div><label className="label-text">State *</label>
                  <input className="input-field" value={form.state} onChange={e => set('state', e.target.value)} placeholder="AZ" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text">Total Units *</label>
                  <input className="input-field" type="number" value={form.unitCount} onChange={e => set('unitCount', e.target.value)} placeholder="350" required /></div>
                <div><label className="label-text">Occupancy (%) *</label>
                  <input className="input-field" type="number" min="0" max="100" value={form.occupancy} onChange={e => set('occupancy', e.target.value)} placeholder="82" required /></div>
              </div>
              <div><label className="label-text">Unit Mix</label>
                <input className="input-field" value={form.unitMix} onChange={e => set('unitMix', e.target.value)} placeholder="80× 5×10, 120× 10×10, 100× 10×20..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text">Asking Price ($) *</label>
                  <input className="input-field" value={form.askingPrice} onChange={e => set('askingPrice', e.target.value)} placeholder="3,800,000" required /></div>
                <div><label className="label-text">Annual NOI ($) *</label>
                  <input className="input-field" value={form.noi} onChange={e => set('noi', e.target.value)} placeholder="260,000" required /></div>
              </div>
              <div><label className="label-text">Year Built</label>
                <input className="input-field" type="number" value={form.yearBuilt} onChange={e => set('yearBuilt', e.target.value)} placeholder="2003" /></div>
              <div><label className="label-text">Additional Context</label>
                <textarea className="input-field resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Climate control %, expansion land, deferred maintenance, market notes..." /></div>
              {error && <div className="border border-red-800 bg-red-900/10 text-red-400 text-sm px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-50">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border border-[#1a1a18] border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </span>
                ) : 'Generate Analysis'}
              </button>
              <p className="text-dark-muted text-xs leading-relaxed">AI analysis is informational only. Results should be independently verified. Not investment advice.</p>
            </form>

            <div>
              {!analysis && !loading && (
                <div className="border border-dark-border bg-dark-surface p-16 text-center">
                  <div className="gold-divider mx-auto mb-6" />
                  <p className="font-serif text-2xl font-light text-dark-muted">Analysis appears here</p>
                  <p className="text-dark-muted text-xs mt-3">Fill in property details and generate</p>
                </div>
              )}
              {loading && (
                <div className="border border-dark-border bg-dark-surface p-16 text-center">
                  <div className="w-8 h-8 border border-gold border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                  <p className="font-serif text-xl font-light text-dark-muted">Analyzing property...</p>
                  <p className="text-dark-muted text-xs mt-2">Evaluating cap rates, market conditions, value-add potential</p>
                </div>
              )}
              {analysis && (
                <div className="space-y-5 fade-in">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="section-label mb-0">AI Analysis</div>
                    <div className="h-px flex-1 bg-dark-border" />
                  </div>
                  <div className="border border-dark-border bg-dark-surface">
                    {sections.length > 1 ? sections.map((section, i) => {
                      const lines = section.trim().split('\n')
                      const heading = lines[0].replace(/\*\*/g, '')
                      const body = lines.slice(1).join('\n').trim()
                      return (
                        <div key={i} className={`p-6 ${i > 0 ? 'border-t border-dark-border' : ''}`}>
                          <h3 className="font-serif text-xl font-light text-gold mb-3">{heading}</h3>
                          <p className="text-dark-muted text-sm leading-relaxed whitespace-pre-wrap">{body}</p>
                        </div>
                      )
                    }) : (
                      <div className="p-6">
                        <p className="text-dark-muted text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
                      </div>
                    )}
                  </div>
                  {saved ? (
                    <div className="border border-green-700/40 bg-green-700/5 p-4 flex items-center justify-between">
                      <div>
                        <span className="text-green-700 font-medium text-sm">Saved to pipeline.</span>
                        <span className="text-dark-muted text-xs ml-2">Analysis, score, and outreach letter included.</span>
                      </div>
                      <Link href="/pipeline" className="text-gold text-xs uppercase tracking-widest hover:text-gold/80 transition-colors">
                        View in Pipeline →
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={handleSaveToPipeline}
                      disabled={saving}
                      className="btn-gold w-full disabled:opacity-50"
                    >
                      {saving ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-3 h-3 border border-[#1a1a18] border-t-transparent rounded-full animate-spin" />
                          Saving to Pipeline...
                        </span>
                      ) : 'Save to Pipeline'}
                    </button>
                  )}
                  <div className="border border-gold/30 p-4 text-xs text-dark-muted leading-relaxed">
                    <span className="text-gold font-medium">Want a formal review?</span> Submit through our acquisition intake and receive a signed NDA and full team evaluation within 5 business days.
                    <br /><br />
                    <a href="/submit-deal" className="text-gold underline hover:text-gold/80">Submit Your Facility →</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
