import Head from 'next/head'
import { useState, FormEvent } from 'react'

const thesis = [
  { title: 'Structural Demand', body: 'Americans rent storage during life transitions — moves, death, divorce, downsizing — that are immune to economic cycles. Self-storage has posted positive same-store revenue growth in every recession since 1990.' },
  { title: 'Operational Leverage', body: 'Unmanned facilities, near-zero tenant improvement costs, and incremental margins of 80%+ make self-storage one of the most efficient commercial real estate operating models.' },
  { title: 'Fragmented Ownership', body: 'Over 70% of U.S. self-storage is still owned by private operators — the highest rate of any institutional-quality asset class. The acquisition opportunity is durable.' },
  { title: 'Off-Market Edge', body: 'Our systematic sourcing through distress intelligence surfaces opportunities that never reach auction or broker. We compete against fewer buyers and buy at better basis.' },
]

const metrics = [
  { label: 'Target IRR', value: '16–22%' },
  { label: 'Equity Multiple', value: '1.8–2.6×' },
  { label: 'Preferred Return', value: '8% pref.' },
  { label: 'Hold Period', value: '3–7 years' },
  { label: 'Min Investment', value: '$250,000' },
  { label: 'Structure', value: 'LP / Co-GP' },
]

export default function Invest() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', accredited: '', capacity: '', timeline: '', notes: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <>
      <Head>
        <title>Investor Relations — YEM Acquisitions</title>
        <meta name="description" content="Co-invest alongside YEM Acquisitions in off-market self-storage acquisitions. Accredited investors only." />
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Investor Relations</div>
        <h1 className="display-heading text-6xl md:text-8xl max-w-4xl mb-8">
          Own what<br />institutions<br />
          <em className="text-gold">buy quietly.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          YEM Acquisitions offers accredited investors direct co-investment access to
          off-market self-storage acquisitions underwritten to institutional standards.
        </p>
      </section>

      {/* Thesis */}
      <section className="py-24">
        <div className="section-container">
          <div className="section-label">Investment Thesis</div>
          <h2 className="display-heading text-5xl mb-16 max-w-2xl">Why self-storage. Why now.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {thesis.map(t => (
              <div key={t.title} className="border border-dark-border bg-dark-surface p-8">
                <div className="gold-divider mb-5" />
                <h3 className="font-serif text-2xl font-light text-[#1B2B5E] mb-3">{t.title}</h3>
                <p className="text-dark-muted text-sm leading-relaxed">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Returns */}
      <section className="py-24 bg-dark-surface border-y border-dark-border">
        <div className="section-container">
          <div className="section-label">Return Profile</div>
          <h2 className="display-heading text-5xl mb-16">Target metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {metrics.map(m => (
              <div key={m.label} className="border border-dark-border p-5 bg-dark-bg">
                <div className="text-xs uppercase tracking-widest text-dark-muted mb-2">{m.label}</div>
                <div className="font-serif text-2xl font-light text-gold leading-tight">{m.value}</div>
              </div>
            ))}
          </div>
          <p className="text-dark-muted text-xs max-w-lg leading-relaxed">
            Returns shown are targets, not guarantees. Past performance is not indicative of future results. All real estate investments involve risk including loss of principal. Offered only to accredited investors as defined under SEC Regulation D.
          </p>
        </div>
      </section>

      {/* Inquiry */}
      <section className="py-24">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <div className="section-label">Get Started</div>
              <h2 className="display-heading text-5xl mb-6">Investor inquiry</h2>
              <p className="text-dark-muted leading-relaxed mb-8">
                We review all inquiries and schedule introductory calls within 3 business days.
                All conversations are strictly confidential.
              </p>
              <div className="space-y-4 text-sm text-dark-muted">
                {[
                  'Access to deal-level underwriting and financial models',
                  'Deal-by-deal co-investment or programmatic capital relationships',
                  'Direct line to principals — no investor relations department',
                  'Quarterly reporting and transparent portfolio updates',
                ].map(item => (
                  <div key={item} className="flex gap-3">
                    <div className="w-0.5 bg-gold flex-shrink-0 mt-1" />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {submitted ? (
                <div className="border border-dark-border bg-dark-surface p-12 text-center">
                  <div className="gold-divider mx-auto mb-8" />
                  <h3 className="font-serif text-3xl font-light text-[#1B2B5E] mb-4">Inquiry received.</h3>
                  <p className="text-dark-muted text-sm leading-relaxed">
                    Our investor relations team will be in touch within 3 business days.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div><label className="label-text">Full Name</label>
                    <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label-text">Email</label>
                      <input className="input-field" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" required /></div>
                    <div><label className="label-text">Phone</label>
                      <input className="input-field" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" /></div>
                  </div>
                  <div><label className="label-text">Accredited Investor Status</label>
                    <select className="input-field" value={form.accredited} onChange={e => set('accredited', e.target.value)} required>
                      <option value="">Select...</option>
                      <option value="individual">Yes — individual ($1M+ net worth or $200K+ income)</option>
                      <option value="entity">Yes — investing through an entity</option>
                      <option value="no">Not accredited / unsure</option>
                    </select></div>
                  <div><label className="label-text">Investment Capacity</label>
                    <select className="input-field" value={form.capacity} onChange={e => set('capacity', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="250-500k">$250K – $500K</option>
                      <option value="500k-1m">$500K – $1M</option>
                      <option value="1m-5m">$1M – $5M</option>
                      <option value="5m+">$5M+</option>
                    </select></div>
                  <div><label className="label-text">Investment Timeline</label>
                    <select className="input-field" value={form.timeline} onChange={e => set('timeline', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="now">Ready to invest now</option>
                      <option value="q1">3–6 months</option>
                      <option value="q2">6–12 months</option>
                      <option value="exploring">Exploring / no timeline</option>
                    </select></div>
                  <div><label className="label-text">Anything else?</label>
                    <textarea className="input-field resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Prior real estate experience, questions, investment preferences..." /></div>
                  <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-50">
                    {loading ? 'Sending...' : 'Submit Inquiry'}
                  </button>
                  <p className="text-dark-muted text-xs text-center">
                    By submitting you confirm you are an accredited investor or are exploring that status.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
