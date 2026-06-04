import Head from 'next/head'
import { useState, FormEvent } from 'react'

const steps = [
  { n: '01', title: 'Submit Request', body: 'Complete the form below. We review every submission personally.' },
  { n: '02', title: 'NDA & Verification', body: 'We confirm accredited investor status and execute a mutual NDA before sharing deal information.' },
  { n: '03', title: 'Deal Package', body: 'Approved investors receive our current deal package with full underwriting, financials, and market analysis.' },
]

export default function InvestorDealAccess() {
  const [form, setForm] = useState({
    name: '', email: '', accredited: '', capacityPerDeal: '',
    experience: '', markets: '', dealTypes: '', referral: '', ndaAgreed: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.ndaAgreed) { setError('You must agree to the NDA terms before requesting deal access.'); return }
    setError(''); setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setLoading(false); setSubmitted(true)
  }

  return (
    <>
      <Head>
        <title>Deal Access Request — YEM Acquisitions</title>
        <meta name="description" content="Request access to YEM Acquisitions' current deal package. Accredited investors only." />
      </Head>

      {/* Hero */}
      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Investor Portal</div>
        <h1 className="display-heading max-w-4xl mb-8" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}>
          Request deal <em className="text-gold">access.</em>
        </h1>
        <p className="leading-relaxed" style={{ fontSize: '1.15rem', color: '#6B6860', maxWidth: '520px' }}>
          Active deals are shared exclusively with verified accredited investors who have
          executed a non-disclosure agreement. Complete the form below to begin the process.
        </p>
      </section>

      {/* How it works */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Process</div>
          <h2 className="display-heading mb-12">How deal access works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map(s => (
              <div key={s.n} className="border border-dark-border bg-dark-surface p-8">
                <div className="font-serif font-light mb-4" style={{ fontSize: '3rem', color: 'rgba(212,168,67,0.4)' }}>{s.n}</div>
                <div className="gold-divider mb-5" />
                <h3 className="font-serif font-light text-[#1B2B5E] mb-3" style={{ fontSize: '1.3rem' }}>{s.title}</h3>
                <p className="leading-relaxed" style={{ fontSize: '1rem', color: '#6B6860' }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-20">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

            {/* Left */}
            <div>
              <div className="section-label">Request Form</div>
              <h2 className="display-heading mb-6">Tell us about yourself</h2>
              <p className="leading-relaxed mb-8" style={{ fontSize: '1.05rem', color: '#6B6860' }}>
                We review all requests within one business day. Deal packages are shared only
                with verified accredited investors. All information is strictly confidential.
              </p>
              <div className="border border-dark-border bg-dark-surface p-6 space-y-3">
                <div className="uppercase tracking-widest font-semibold mb-3" style={{ fontSize: '0.8rem', color: '#1B2B5E' }}>What&apos;s included in the deal package</div>
                {[
                  'Full acquisition summary with purchase price and basis',
                  'Pro forma financials and stabilized NOI projections',
                  'Market analysis and competitive supply study',
                  'Value-add thesis with capital requirements',
                  'Exit scenarios and return projections',
                  'Executed NDA required before delivery',
                ].map(item => (
                  <div key={item} className="flex gap-3">
                    <div className="w-0.5 bg-gold flex-shrink-0 mt-1.5" />
                    <p style={{ fontSize: '1rem', color: '#6B6860' }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right */}
            <div>
              {submitted ? (
                <div className="border border-dark-border bg-dark-surface p-12 text-center">
                  <div className="gold-divider mx-auto mb-8" />
                  <h3 className="font-serif font-light text-[#1B2B5E] mb-4" style={{ fontSize: '2rem' }}>Request received.</h3>
                  <p className="leading-relaxed" style={{ fontSize: '1rem', color: '#6B6860' }}>
                    Thank you — our team will review your information and send you our current deal package within 48 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-text">Full Name</label>
                      <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" required autoComplete="off" />
                    </div>
                    <div>
                      <label className="label-text">Email Address</label>
                      <input className="input-field" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" required autoComplete="off" />
                    </div>
                  </div>

                  <div>
                    <label className="label-text">Accredited Investor Status</label>
                    <select className="input-field" value={form.accredited} onChange={e => set('accredited', e.target.value)} required autoComplete="off">
                      <option value="">Select...</option>
                      <option value="individual">Yes — individual ($1M+ net worth or $200K+ income)</option>
                      <option value="entity">Yes — investing through a fund or entity</option>
                      <option value="no">Not accredited / unsure</option>
                    </select>
                  </div>

                  <div>
                    <label className="label-text">Investment Capacity Per Deal</label>
                    <select className="input-field" value={form.capacityPerDeal} onChange={e => set('capacityPerDeal', e.target.value)} required autoComplete="off">
                      <option value="">Select...</option>
                      <option value="100-250k">$100K – $250K</option>
                      <option value="250-500k">$250K – $500K</option>
                      <option value="500k-1m">$500K – $1M</option>
                      <option value="1m-5m">$1M – $5M</option>
                      <option value="5m+">$5M+</option>
                    </select>
                  </div>

                  <div>
                    <label className="label-text">Prior Real Estate Investment Experience</label>
                    <select className="input-field" value={form.experience} onChange={e => set('experience', e.target.value)} autoComplete="off">
                      <option value="">Select...</option>
                      <option value="none">No prior real estate experience</option>
                      <option value="residential">Residential only (SFR, multifamily)</option>
                      <option value="commercial">Commercial real estate (office, retail, industrial)</option>
                      <option value="self-storage">Self-storage specifically</option>
                      <option value="fund">LP in real estate funds or syndications</option>
                    </select>
                  </div>

                  <div>
                    <label className="label-text">Markets or Geographies of Interest</label>
                    <input className="input-field" value={form.markets} onChange={e => set('markets', e.target.value)} placeholder="e.g. Sun Belt, Texas, Southeast — or open to any" autoComplete="off" />
                  </div>

                  <div>
                    <label className="label-text">Deal Types of Interest</label>
                    <input className="input-field" value={form.dealTypes} onChange={e => set('dealTypes', e.target.value)} placeholder="e.g. value-add, stabilized, development, distressed" autoComplete="off" />
                  </div>

                  <div>
                    <label className="label-text">How did you hear about YEM Acquisitions?</label>
                    <select className="input-field" value={form.referral} onChange={e => set('referral', e.target.value)} autoComplete="off">
                      <option value="">Select...</option>
                      <option value="referral">Personal referral</option>
                      <option value="social">Social media (LinkedIn, X, etc.)</option>
                      <option value="podcast">Podcast or interview</option>
                      <option value="search">Web search</option>
                      <option value="event">Conference or industry event</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* NDA */}
                  <div className="border border-dark-border bg-dark-surface p-5 space-y-3">
                    <div className="uppercase tracking-widest font-semibold" style={{ fontSize: '0.8rem', color: '#1B2B5E' }}>Non-Disclosure Agreement</div>
                    <p className="leading-relaxed" style={{ fontSize: '0.9rem', color: '#6B6860' }}>
                      By requesting deal access, you agree to keep all deal-specific information — including
                      property addresses, purchase prices, financial projections, and seller details —
                      strictly confidential. You agree not to disclose, reproduce, or share any materials
                      provided by YEM Acquisitions without prior written consent. This obligation survives
                      termination of any investment relationship.
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 flex-shrink-0 accent-[#C9A84C]"
                        checked={form.ndaAgreed}
                        onChange={e => set('ndaAgreed', e.target.checked)}
                      />
                      <span className="leading-relaxed" style={{ fontSize: '0.95rem', color: '#1a1a18' }}>
                        I have read and agree to the non-disclosure terms above. I understand that deal
                        materials are confidential and for my review only.
                      </span>
                    </label>
                  </div>

                  {error && <p className="text-red-600" style={{ fontSize: '0.95rem' }}>{error}</p>}

                  <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-50">
                    {loading ? 'Submitting...' : 'Request Deal Access'}
                  </button>

                  <p className="text-center" style={{ fontSize: '0.875rem', color: '#6B6860' }}>
                    Accredited investors only. Deal materials are confidential and subject to NDA.
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
