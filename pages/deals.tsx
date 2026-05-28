import Head from 'next/head'
import { useState } from 'react'

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
}

const deals: Deal[] = [
  {
    id: 'd1',
    name: 'Eastfield Self Storage',
    address: '14820 SW 8th St',
    city: 'Miami',
    state: 'FL',
    zipCode: '33184',
    unitCount: 480,
    yearBuilt: 2002,
    askingPrice: 5200000,
    noi: 322400,
    capRate: 6.2,
    occupancy: 77,
    landAcres: 4.1,
    climatePercent: 0,
    pricePerUnit: 10833,
    highlights: [
      'Rents 38% below comparable properties in the Miami metro — clear path to immediate rate optimization',
      'Adjacent vacant parcel (1.2 acres) included in asking price — expansion to 180+ additional units',
      'Strong Cuban-American demographic demand driver; low supply pipeline within 3-mile radius',
      'Owner has operated since 2002 and is motivated by estate settlement — seller financing considered',
    ],
    status: 'available',
    addedDate: '2024-11-05',
  },
  {
    id: 'd2',
    name: 'Mockingbird Lane Storage',
    address: '5540 Mockingbird Ln',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75206',
    unitCount: 320,
    yearBuilt: 2006,
    askingPrice: 3650000,
    noi: 215350,
    capRate: 5.9,
    occupancy: 95,
    landAcres: 2.8,
    climatePercent: 55,
    pricePerUnit: 11406,
    highlights: [
      'Near-stabilized at 95% occupancy — strong existing cash flow with minimal operational lift required',
      '55% climate-controlled unit mix supports premium rate per square foot above market average',
      'Recent institutional-quality construction (2006) — minimal near-term capex requirements',
      'Located within one mile of three major apartment complexes generating consistent move-in/move-out demand',
    ],
    status: 'available',
    addedDate: '2024-11-01',
  },
  {
    id: 'd3',
    name: 'Piedmont Self Storage',
    address: '4400 Monroe Rd',
    city: 'Charlotte',
    state: 'NC',
    zipCode: '28205',
    unitCount: 265,
    yearBuilt: 2004,
    askingPrice: 2780000,
    noi: 177920,
    capRate: 6.4,
    occupancy: 84,
    landAcres: 2.3,
    climatePercent: 70,
    pricePerUnit: 10491,
    highlights: [
      '70% climate-controlled mix in one of the fastest-growing metros in the Southeast',
      'Estate settlement driving seller motivation — willing to consider structured close timeline',
      'Rates 22% below street rate for comparable Charlotte-area climate-controlled product',
      'Proximity to SouthPark and affluent South Charlotte neighborhoods — high-value tenant base',
    ],
    status: 'under-review',
    addedDate: '2024-10-22',
  },
  {
    id: 'd4',
    name: 'Harvest Moon Storage',
    address: '3700 Summer Ave',
    city: 'Memphis',
    state: 'TN',
    zipCode: '38122',
    unitCount: 390,
    yearBuilt: 1999,
    askingPrice: 3190000,
    noi: 216920,
    capRate: 6.8,
    occupancy: 80,
    landAcres: 3.4,
    climatePercent: 15,
    pricePerUnit: 8179,
    highlights: [
      'Third-generation family owner with 25+ years of operation — minimal digital marketing, significant upside',
      'Priced to reflect deferred maintenance — structural issues are cosmetic and quantified in due diligence',
      'Memphis submarket shows consistent 7%+ annual self-storage rent growth over last 4 years',
      'Price per unit at $8,179 represents a 24% discount to replacement cost for this vintage',
    ],
    status: 'available',
    addedDate: '2024-10-14',
  },
]

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
                        <span className={`tag border flex-shrink-0 ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
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
  )
}
