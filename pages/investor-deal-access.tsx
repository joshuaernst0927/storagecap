import Head from 'next/head'
import { useState, FormEvent } from 'react'

const steps = [
  { n: '01', title: 'Submit Request', body: 'Complete the form below. We review every submission personally.' },
  { n: '02', title: 'NDA & Verification', body: 'We confirm accredited investor status and execute a mutual NDA before sharing deal information.' },
  { n: '03', title: 'Deal Package', body: 'Approved investors receive our current deal package with full underwriting, financials, and market analysis.' },
]

export default function InvestorDealAccess() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    accredited: '',
    capacityPerDeal: '',
    experience: '',
    markets: '',
    dealTypes: '',
    referral: '',
    ndaAgreed: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.ndaAgreed) {
      setError('You must agree to the NDA terms before requesting deal access.')
      return
    }
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <>
      <Head>
        <title>Deal Access Request — YEM Acquisitions</title>
        <meta name="description" content="Request access to YEM Acquisitions' current deal package. Accredited investors only." />
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Investor Portal</div>
        <h1 className="display-heading text-6xl md:text-8xl max-w-4xl mb-8">
          Request deal<br />
          <em className="text-gold">access.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Active deals are shared exclusively with verified accredited investors who have
          executed a non-disclosure agreement. Complete the form below to begin the process.
        </p>
      </section>

      {/* How it works */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Process</div>
          <h2 className="display-heading text-4xl mb-12">How deal access works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map(s => (
              <div key={s.n} className="border border-dark-border bg-dark-surface p-8">
                <div className="font-serif text-4xl text-gold/40 font-light mb-4">{s.n}</div>
                <div className="gold-divider mb-5" />
                <h3 className="font-serif text-xl font-light text-[#1B2B5E] mb-3">{s.title}</h3>
                <p className="text-dark-muted text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-24">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <div className="section-label">Request Form</div>
              <h2 className="display-heading text-5xl mb-6">Tell us about yourself</h2>
              <p className="text-dark-muted leading-relaxed mb-8">
                We review all requests within one business day. Deal packages are shared only
                with verified accredited investors. All information is strictly confidential.
              </p>
              <div className="space-y-4 text-sm text-dark-muted border border-dark-border bg-dark-surface p-6">
                <div className="text-xs uppercase tracking-widest text-[#1B2B5E] font-semibold mb-3">What's included in the deal package</div>
                {[
                  'Full acquisition summary with purchase price and basis',
                  'Pro forma financials and stabilized NOI projections',
                  'Market analysis and competitive supply study',
                  'Value-add thesis with capital requirements',
                  'Exit scenarios and return projections',
                  'Executed NDA required before delivery',
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
                  <h3 className="font-serif text-3xl font-light text-[#1B2B5E] mb-4">Request received.</h3>
                  <p className="text-dark-muted text-sm leading-relaxed">
                    Thank you — our team will review your information and send you our current deal package within 48 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label-text">Full Name</label>
                      <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" required /></div>
                    <div><label className="label-text">Email Address</label>
                      <input className="input-field" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" required /></div>
                  </div>

                  <div><label className="label-text">Accredited Investor Status</label>
                    <select className="input-field" value={form.accredited} onChange={e => set('accredited', e.target.value)} required>
                      <option value="">Select...</option>
                      <option value="individual">Yes — individual ($1M+ net worth or $200K+ income)</option>
                      <option value="entity">Yes — investing through a fund or entity</option>
                      <option value="no">Not accredited / unsure</option>
                    </select></div>

                  <div><label className="label-text">Investment Capacity Per Deal</label>
                    <select className="input-field" value={form.capacityPerDeal} onChange={e => set('capacityPerDeal', e.target.value)} required>
                      <option value="">Select...</option>
                      <option value="100-250k">$100K – $250K</option>
                      <option value="250-500k">$250K – $500K</option>
                      <option value="500k-1m">$500K – $1M</option>
                      <option value="1m-5m">$1M – $5M</option>
                      <option value="5m+">$5M+</option>
                    </select></div>

                  <div><label className="label-text">Prior Real Estate Investment Experience</label>
                    <select className="input-field" value={form.experience} onChange={e => set('experience', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="none">No prior real estate experience</option>
                      <option value="residential">Residential only (SFR, multifamily)</option>
                      <option value="commercial">Commercial real estate (office, retail, industrial)</option>
                      <option value="self-storage">Self-storage specifically</option>
                      <option value="fund">LP in real estate funds or syndications</option>
                    </select></div>

                  <div><label className="label-text">Markets or Geographies of Interest</label>
                    <input className="input-field" value={form.markets} onChange={e => set('markets', e.target.value)} placeholder="e.g. Sun Belt, Texas, Southeast — or open to any" /></div>

                  <div><label className="label-text">Deal Types of Interest</label>
                    <input className="input-field" value={form.dealTypes} onChange={e => set('dealTypes', e.target.value)} placeholder="e.g. value-add, stabilized, development, distressed" /></div>

                  <div><label className="label-text">How did you hear about YEM Acquisitions?</label>
                    <select className="input-field" value={form.referral} onChange={e => set('referral', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="referral">Personal referral</option>
                      <option value="social">Social media (LinkedIn, X, etc.)</option>
                      <option value="podcast">Podcast or interview</option>
                      <option value="search">Web search</option>
                      <option value="event">Conference or industry event</option>
                      <option value="other">Other</option>
                    </select></div>

                  {/* NDA agreement */}
                  <div className="border border-dark-border bg-dark-surface p-5 space-y-3">
                    <div className="text-xs uppercase tracking-widest text-[#1B2B5E] font-semibold">Non-Disclosure Agreement</div>
                    <p className="text-dark-muted text-xs leading-relaxed">
                      By requesting deal access, you agree to keep all deal-specific information — including
                      property addresses, purchase prices, financial projections, and seller details —
                      strictly confidential. You agree not to disclose, reproduce, or share any materials
                      provided by YEM Acquisitions without prior written consent. This obligation survives
                      termination of any investment relationship.
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 flex-shrink-0 accent-[#C9A84C]"
                        checked={form.ndaAgreed}
                        onChange={e => set('ndaAgreed', e.target.checked)}
                      />
                      <span className="text-xs text-[#1a1a18] leading-relaxed">
                        I have read and agree to the non-disclosure terms above. I understand that deal
                        materials are confidential and for my review only.
                      </span>
                    </label>
                  </div>

                  {error && (
                    <p className="text-red-600 text-xs">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-gold w-full disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Request Deal Access'}
                  </button>

                  <p className="text-dark-muted text-xs text-center">
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
