import Head from 'next/head'
import { useState, FormEvent } from 'react'

const STATES = ['AL','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

interface F { propertyName:string; address:string; city:string; state:string; zip:string; unitCount:string; occupancy:string; askingPrice:string; grossRevenue:string; noi:string; yearBuilt:string; landAcres:string; climatePercent:string; expansionLand:string; notes:string; sellerName:string; email:string; phone:string; role:string }
const init: F = { propertyName:'',address:'',city:'',state:'',zip:'',unitCount:'',occupancy:'',askingPrice:'',grossRevenue:'',noi:'',yearBuilt:'',landAcres:'',climatePercent:'',expansionLand:'no',notes:'',sellerName:'',email:'',phone:'',role:'' }

export default function SubmitDeal() {
  const [form, setForm] = useState<F>(init)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [refNum, setRefNum] = useState('')
  const [error, setError] = useState('')

  const set = (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/submit-deal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error('Submission failed')
      const d = await res.json()
      setRefNum(d.referenceNumber)
      setSubmitted(true)
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  if (submitted) return (
    <>
      <Head><title>Deal Submitted — YEM Acquisitions</title></Head>
      <section className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div className="gold-divider mx-auto mb-10" />
          <h1 className="display-heading mb-6">Thank you.</h1>
          <p className="leading-relaxed mb-4" style={{ fontSize: '1.05rem', color: '#6B6860' }}>
            Your submission has been received. Our team will review your property and respond within <span className="text-[#1a1a18]">5 business days</span>.
          </p>
          <p className="mb-10" style={{ fontSize: '0.95rem', color: '#6B6860' }}>
            Reference: <span className="text-gold font-mono tracking-wider">{refNum}</span>
          </p>
          <div className="gold-divider mx-auto" />
        </div>
      </section>
    </>
  )

  return (
    <>
      <Head>
        <title>Submit a Deal — YEM Acquisitions</title>
        <meta name="description" content="Submit your self-storage facility for a confidential, no-obligation acquisition review." />
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Submit a Deal</div>
        <h1 className="display-heading max-w-3xl mb-8" style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}>
          Confidential.<br /><em className="text-gold">No obligation.</em>
        </h1>
        <p className="leading-relaxed" style={{ fontSize: '1.15rem', color: '#6B6860', maxWidth: '520px' }}>
          We review every submission and respond within 5 business days.
          An NDA is signed before any detailed data exchange.
        </p>
      </section>

      <section className="py-20">
        <div className="section-container">
          <form onSubmit={handleSubmit} className="max-w-3xl" autoComplete="off">

            {/* Property */}
            <div className="mb-12">
              <div className="section-label">Property</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label-text">Facility Name *</label>
                  <input name="propertyName" value={form.propertyName} onChange={set} className="input-field" placeholder="Sunshine Self Storage — Mesa, AZ" required autoComplete="off" />
                </div>
                <div className="md:col-span-2">
                  <label className="label-text">Street Address</label>
                  <input name="address" value={form.address} onChange={set} className="input-field" placeholder="123 Industrial Blvd" autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">City *</label>
                  <input name="city" value={form.city} onChange={set} className="input-field" placeholder="Mesa" required autoComplete="off" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">State *</label>
                    <select name="state" value={form.state} onChange={set} className="input-field" required autoComplete="off">
                      <option value="">—</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-text">ZIP</label>
                    <input name="zip" value={form.zip} onChange={set} className="input-field" placeholder="85210" autoComplete="off" />
                  </div>
                </div>
              </div>
            </div>

            {/* Financials */}
            <div className="mb-12">
              <div className="section-label">Financials &amp; Details</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="label-text">Total Units *</label>
                  <input name="unitCount" value={form.unitCount} onChange={set} type="number" className="input-field" placeholder="380" required autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Occupancy % *</label>
                  <input name="occupancy" value={form.occupancy} onChange={set} type="number" min="0" max="100" className="input-field" placeholder="82" required autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Year Built</label>
                  <input name="yearBuilt" value={form.yearBuilt} onChange={set} type="number" className="input-field" placeholder="2001" autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Asking Price ($) *</label>
                  <input name="askingPrice" value={form.askingPrice} onChange={set} className="input-field" placeholder="4,200,000" required autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Gross Revenue ($)</label>
                  <input name="grossRevenue" value={form.grossRevenue} onChange={set} className="input-field" placeholder="490,000" autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Annual NOI ($)</label>
                  <input name="noi" value={form.noi} onChange={set} className="input-field" placeholder="320,000" autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Land (Acres)</label>
                  <input name="landAcres" value={form.landAcres} onChange={set} className="input-field" placeholder="3.5" autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Climate Control %</label>
                  <input name="climatePercent" value={form.climatePercent} onChange={set} type="number" min="0" max="100" className="input-field" placeholder="40" autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Expansion Land?</label>
                  <select name="expansionLand" value={form.expansionLand} onChange={set} className="input-field" autoComplete="off">
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="label-text">Notes / Additional Information</label>
                <textarea name="notes" value={form.notes} onChange={set} rows={5} className="input-field resize-none" placeholder="Unit mix, value-add opportunities, reason for selling, existing debt, deferred maintenance, anything we should know..." autoComplete="off" />
              </div>
            </div>

            {/* Contact */}
            <div className="mb-12">
              <div className="section-label">Your Information</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label-text">Full Name *</label>
                  <input name="sellerName" value={form.sellerName} onChange={set} className="input-field" placeholder="John Smith" required autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Email *</label>
                  <input name="email" value={form.email} onChange={set} type="email" className="input-field" placeholder="john@example.com" required autoComplete="off" />
                </div>
                <div>
                  <label className="label-text">Phone</label>
                  <input name="phone" value={form.phone} onChange={set} type="tel" className="input-field" placeholder="(555) 867-5309" autoComplete="off" />
                </div>
                <div className="md:col-span-2">
                  <label className="label-text">Your Role</label>
                  <select name="role" value={form.role} onChange={set} className="input-field" autoComplete="off">
                    <option value="">Select...</option>
                    <option value="owner">Property Owner</option>
                    <option value="broker">Broker / Agent</option>
                    <option value="partner">Ownership Partner</option>
                    <option value="attorney">Attorney / Estate Rep</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="border border-red-800 bg-red-900/10 text-red-400 px-4 py-3 mb-6" style={{ fontSize: '1rem' }}>{error}</div>
            )}

            <div className="flex items-start gap-8">
              <button type="submit" disabled={loading} className="btn-gold disabled:opacity-50 flex-shrink-0">
                {loading ? 'Submitting...' : 'Submit Confidentially'}
              </button>
              <p className="leading-relaxed mt-1" style={{ fontSize: '0.9rem', color: '#6B6860', maxWidth: '300px' }}>
                Your information is never shared without consent. We sign an NDA before any detailed data exchange. No broker required.
              </p>
            </div>

          </form>
        </div>
      </section>
    </>
  )
}
