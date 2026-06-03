import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import AuthGate from '@/components/AuthGate'
import DealScoreBadge from '@/components/DealScoreBadge'
import type { DealType } from '@/lib/dealScore'

interface Deal {
  id: string
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  unitCount: number
  yearBuilt: number
  askingPrice: number
  noi: number
  capRate: number
  occupancy: number
  landAcres: number
  climatePercent: number
  highlights: string[]
  status: 'available' | 'under-review' | 'pending'
  addedDate: string
  pricePerUnit: number
  dealScore?: number
  dealType?: DealType
}

const deals: Deal[] = []

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'text-green-600 border-green-600/40' },
  'under-review': { label: 'Under Review', cls: 'text-amber-400 border-amber-400/40' },
  pending: { label: 'Pending', cls: 'text-dark-muted border-dark-border' },
}

function RequestModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '', notes: '' })
  const [submitted, setSubmitted] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await new Promise(r => setTimeout(r, 600))
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-dark-bg border border-dark-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-dark-border px-7 py-5 flex items-center justify-between">
          <div>
            <div className="section-label-sm mb-0.5">Request Deal Details</div>
            <h3 className="font-serif text-2xl font-light text-[#1B2B5E]">{deal.name}</h3>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-[#1a1a18] transition-colors">✕</button>
        </div>

        <div className="p-7">
          {submitted ? (
            <div className="text-center py-8">
              <div className="gold-divider mx-auto mb-6" />
              <p className="font-serif text-2xl font-light text-[#1B2B5E] mb-3">Request received.</p>
              <p className="text-dark-muted text-sm leading-relaxed">
                We&apos;ll send a full deal package to your email within one business day.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="label-text">Full Name</label>
                <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text">Email *</label>
                  <input className="input-field" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" required /></div>
                <div><label className="label-text">Phone</label>
                  <input className="input-field" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" /></div>
              </div>
              <div><label className="label-text">Your Role</label>
                <select className="input-field" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="buyer">Private Buyer</option>
                  <option value="investor">Investor / LP</option>
                  <option value="broker">Broker / Advisor</option>
                  <option value="other">Other</option>
                </select></div>
              <div><label className="label-text">Message (optional)</label>
                <textarea className="input-field resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Specific questions, timeline, financing status..." /></div>
              <button type="submit" className="btn-gold w-full">Request Full Package</button>
              <p className="text-dark-muted text-xs text-center">
                Submission of an NDA may be required before receiving financial statements.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Deals() {
  const [requesting, setRequesting] = useState<Deal | null>(null)

  return (
    <AuthGate>
    <>
      <Head>
        <title>Available Deals — YEM Acquisitions</title>
        <meta name="description" content="Off-market self-storage facilities available for acquisition. Direct from YEM Acquisitions." />
      </Head>

      {requesting && <RequestModal deal={requesting} onClose={() => setRequesting(null)} />}

      {/* Hero */}
      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Available Deals</div>
        <h1 className="display-heading text-6xl md:text-8xl max-w-3xl mb-8">
          Off-market.<br />
          <em className="text-gold">Direct access.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Self-storage facilities sourced through YEM&apos;s distress intelligence pipeline.
          No broker. No auction. Request a deal package for full financials and due diligence materials.
        </p>
      </section>

      {/* Deals Grid */}
      <section className="py-20">
        <div className="section-container">
          {deals.length === 0 ? (
            <div className="py-24 text-center text-dark-muted border border-dark-border bg-dark-surface">
              <p className="font-serif text-3xl font-light mb-3 text-[#1B2B5E]">No deals yet.</p>
              <p className="text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Run the pipeline or upload a deal to get started.
              </p>
              <Link href="/upload-deal" className="btn-gold">Upload a Deal</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {deals.map((deal, i) => {
                const statusInfo = STATUS_LABELS[deal.status]
                return (
                  <div key={deal.id} className="border border-dark-border bg-dark-surface hover:border-gold/30 transition-colors duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3">

                      {/* Photo placeholder */}
                      <div className="bg-dark-bg border-b lg:border-b-0 lg:border-r border-dark-border flex flex-col items-center justify-center p-10 min-h-[220px] lg:min-h-0">
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
                          <div className="w-12 h-12 border border-dark-border flex items-center justify-center text-dark-muted">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          </div>
                          <p className="text-dark-muted text-xs uppercase tracking-widest">Photo Available<br />Upon Request</p>
                          <div className="mt-2 font-serif text-4xl font-light text-dark-border/60 leading-none">{String(i + 1).padStart(2, '0')}</div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-8 lg:p-10 col-span-2">
                        <div className="flex items-start justify-between gap-4 mb-5">
                          <div>
                            <h2 className="font-serif text-3xl font-light text-[#1B2B5E] mb-1">{deal.name}</h2>
                            <p className="text-dark-muted text-sm">{deal.address}, {deal.city}, {deal.state} {deal.zipCode}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <span className={`tag border ${statusInfo.cls}`}>{statusInfo.label}</span>
                            {deal.dealScore != null && <DealScoreBadge score={deal.dealScore} dealType={deal.dealType} size="sm" />}
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-7">
                          {[
                            { label: 'Asking', value: `$${(deal.askingPrice / 1000000).toFixed(1)}M` },
                            { label: 'NOI', value: `$${Math.round(deal.noi / 1000)}K` },
                            { label: 'Cap Rate', value: `${deal.capRate}%` },
                            { label: 'Units', value: deal.unitCount.toLocaleString() },
                            { label: 'Occupancy', value: `${deal.occupancy}%` },
                            { label: 'Built', value: deal.yearBuilt.toString() },
                          ].map(m => (
                            <div key={m.label} className="border border-dark-border bg-dark-bg p-3 text-center">
                              <div className="text-xs uppercase tracking-widest text-dark-muted mb-1">{m.label}</div>
                              <div className="font-serif text-xl font-light text-gold">{m.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Additional details */}
                        <div className="flex gap-4 mb-6 flex-wrap">
                          <span className="tag tag-muted">{deal.unitCount} units · ${deal.pricePerUnit.toLocaleString()}/unit</span>
                          {deal.climatePercent > 0 && <span className="tag tag-muted">{deal.climatePercent}% climate controlled</span>}
                          <span className="tag tag-muted">{deal.landAcres} acres</span>
                        </div>

                        {/* Highlights */}
                        <div className="mb-8">
                          <div className="section-label-sm mb-3">Deal Highlights</div>
                          <ul className="space-y-2">
                            {deal.highlights.map((h, j) => (
                              <li key={j} className="flex gap-3 text-sm text-dark-muted leading-relaxed">
                                <span className="text-gold flex-shrink-0 mt-0.5">·</span>
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => setRequesting(deal)}
                            disabled={deal.status === 'pending'}
                            className="btn-gold disabled:opacity-50"
                          >
                            Request Deal Package
                          </button>
                          <span className="text-dark-muted text-xs">
                            Added {deal.addedDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-12 bg-dark-surface border-t border-dark-border">
        <div className="section-container">
          <p className="text-dark-muted text-xs leading-relaxed max-w-3xl">
            All properties shown are sourced through YEM Acquisitions&apos; proprietary off-market sourcing network.
            Financial information is provided for indicative purposes only and is subject to change. Full due diligence packages,
            including trailing 12-month financials, rent rolls, and inspection reports, are available upon NDA execution.
            YEM Acquisitions is acting as principal, not broker, in these transactions.
          </p>
        </div>
      </section>
    </>
    </AuthGate>
  )
}
