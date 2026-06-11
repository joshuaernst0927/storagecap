import Head from 'next/head'
import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/router'
import AuthGate from '@/components/AuthGate'

type LOIForm = {
  date: string; property_name: string; property_address: string; property_description: string
  asset_type: string; units: string; sf: string; year_built: string; occupancy: string
  broker1_name: string; broker2_name: string; brokerage: string; broker1_phone: string
  broker2_phone: string; buyer_broker: string; salutation: string
  offer_price: string; all_in_cost: string; bridge_loan: string; bridge_rate: string
  sofr: string; annual_ds: string; interest_reserve: string; capex_reserve: string
  gp_fee_total: string; gp_fee_income: string; gp_coinvest: string; lp_equity: string
  going_in_cap: string; yr3_cap: string; pf_cap: string
  lp_moic: string; lp_irr: string; gp_moic: string; gp_irr: string
  waterfall: string; emd: string; dd_days: string; closing_days: string
  offer_expiry: string; underwriting_narrative: string; rent_strategy: string
  breakeven_occ: string; exit_cap: string
}

const EMPTY: LOIForm = {
  date: new Date().toISOString().slice(0, 10),
  property_name: '', property_address: '', property_description: '',
  asset_type: 'Self-Storage', units: '', sf: '', year_built: '', occupancy: '',
  broker1_name: '', broker2_name: '', brokerage: '', broker1_phone: '',
  broker2_phone: '', buyer_broker: 'Buyer is unrepresented', salutation: '',
  offer_price: '', all_in_cost: '', bridge_loan: '', bridge_rate: '',
  sofr: '', annual_ds: '', interest_reserve: '', capex_reserve: '',
  gp_fee_total: '', gp_fee_income: '', gp_coinvest: '0', lp_equity: '',
  going_in_cap: '', yr3_cap: '', pf_cap: '',
  lp_moic: '', lp_irr: '', gp_moic: '', gp_irr: '',
  waterfall: '', emd: '', dd_days: '30-45', closing_days: '30-45',
  offer_expiry: '', underwriting_narrative: '', rent_strategy: '',
  breakeven_occ: '', exit_cap: '',
}

function Field({ label, value, onChange, type = 'text', placeholder = '', prefix, suffix, span }: {
  label: string; value: string; onChange: (v: string) => void
  type?: 'text' | 'number' | 'date' | 'tel'
  placeholder?: string; prefix?: string; suffix?: string
  span?: 'full' | 'half'
}) {
  return (
    <div className={span === 'full' ? 'col-span-full' : span === 'half' ? 'col-span-2' : ''}>
      <label className="label-text">{label}</label>
      {prefix || suffix ? (
        <div className="flex items-stretch">
          {prefix && <span className="flex items-center px-3 bg-dark-surface border border-r-0 border-dark-border text-dark-muted" style={{ fontSize: '1rem' }}>{prefix}</span>}
          <input type={type} className="input-field flex-1 min-w-0" style={{ borderRadius: 0 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
          {suffix && <span className="flex items-center px-3 bg-dark-surface border border-l-0 border-dark-border text-dark-muted" style={{ fontSize: '1rem' }}>{suffix}</span>}
        </div>
      ) : (
        <input type={type} className="input-field" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      )}
    </div>
  )
}

function TextareaField({ label, value, onChange, rows = 4, placeholder = '', loading = false }: {
  label: string; value: string; onChange: (v: string) => void
  rows?: number; placeholder?: string; loading?: boolean
}) {
  return (
    <div>
      <label className="label-text flex items-center gap-2">
        {label}
        {loading && <span className="text-gold text-xs animate-pulse">Generating...</span>}
      </label>
      <textarea className="input-field resize-none" rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
    </div>
  )
}

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="col-span-full pb-2 border-b border-dark-border mb-2">
      <div className="section-label">{label}</div>
      {sub && <p style={{ fontSize: '0.9rem', color: '#6B6860', marginTop: '4px' }}>{sub}</p>}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-dark-border bg-white p-8">{children}</div>
}

function LOIContent() {
  const router = useRouter()
  const [form, setForm] = useState<LOIForm>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [generatingNarrative, setGeneratingNarrative] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (name: keyof LOIForm, value: string) => setForm(f => ({ ...f, [name]: value }))
  const [persistReady, setPersistReady] = useState(false)

  // If we arrived WITHOUT fresh proforma data in the URL (e.g. a refresh),
  // restore the last form state from the browser instead of showing blanks.
  useEffect(() => {
    if (!router.isReady) return
    if (!router.query.data) {
      try {
        const saved = localStorage.getItem('yem_loi_form')
        if (saved) setForm(prev => ({ ...prev, ...JSON.parse(saved) }))
      } catch { /* ignore */ }
    }
    setPersistReady(true)
  }, [router.isReady, router.query.data])

  // Persist the form on every change (debounced) so edits survive refreshes.
  useEffect(() => {
    if (!persistReady) return
    const t = setTimeout(() => {
      try { localStorage.setItem('yem_loi_form', JSON.stringify(form)) } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(t)
  }, [form, persistReady])

  useEffect(() => {
    if (!router.query.data) return
    try {
      const data = JSON.parse(decodeURIComponent(router.query.data as string))

      // Build full address string
      const fullAddress = [data.address, data.city, data.state].filter(Boolean).join(', ')

      // Build property description
      const description = [
        data.totalUnits || data.units ? `${data.totalUnits || data.units}-unit self-storage facility` : '',
        data.totalSF || data.sf ? `totaling ${Number(data.totalSF || data.sf).toLocaleString()} SF` : '',
        data.yearBuilt ? `built in ${data.yearBuilt}` : '',
        data.city && data.state ? `located in ${data.city}, ${data.state}` : '',
        data.msaName ? `within the ${data.msaName} MSA` : '',
      ].filter(Boolean).join(', ')

      setForm(prev => ({
        ...prev,
        property_name: data.propertyName || prev.property_name,
        property_address: fullAddress || data.address || prev.property_address,
        property_description: description || prev.property_description,
        asset_type: 'Self-Storage',
        units: data.units || data.totalUnits || prev.units,
        sf: data.sf || data.totalSF || prev.sf,
        year_built: data.yearBuilt || prev.year_built,
        occupancy: data.occupancy || prev.occupancy,
        broker1_name: data.broker1Name || prev.broker1_name,
        broker2_name: data.broker2Name || prev.broker2_name,
        brokerage: data.brokerageName || prev.brokerage,
        broker1_phone: data.brokerPhone1 || prev.broker1_phone,
        broker2_phone: data.brokerPhone2 || prev.broker2_phone,
        salutation: data.salutation || prev.salutation,
        offer_price: data.offerPrice || prev.offer_price,
        all_in_cost: data.allInCost || prev.all_in_cost,
        bridge_loan: data.bridgeLoan || prev.bridge_loan,
        bridge_rate: data.bridgeRate || prev.bridge_rate,
        annual_ds: data.annualDS || prev.annual_ds,
        interest_reserve: data.interestReserve || prev.interest_reserve,
        capex_reserve: data.capexReserve || prev.capex_reserve,
        gp_fee_total: data.gpFeeTotal || prev.gp_fee_total,
        gp_fee_income: data.gpFeePct || prev.gp_fee_income,
        lp_equity: data.lpEquity || prev.lp_equity,
        waterfall: data.waterfall || prev.waterfall,
        going_in_cap: data.goingInCap || prev.going_in_cap,
        yr3_cap: data.yr3Cap || prev.yr3_cap,
        pf_cap: data.pfCap || prev.pf_cap,
        exit_cap: data.exitCap || prev.exit_cap,
        lp_moic: data.lpMOIC || prev.lp_moic,
        lp_irr: data.lpIRR || prev.lp_irr,
        gp_moic: data.gpMOIC || prev.gp_moic,
        emd: data.emd || prev.emd,
      }))

      // Always attempt narrative generation with whatever data we have
      generateNarratives(data)
    } catch { /* ignore */ }

    // Strip the consumed snapshot from the URL. Otherwise a refresh or an old
    // tab re-applies outdated values (e.g. a previous offer price) forever.
    router.replace('/generate-loi', undefined, { shallow: true })
  }, [router.query.data])

  async function generateNarratives(data: Record<string, string>) {
    setGeneratingNarrative(true)
    try {
      const prompt = `You are writing a professional real estate Letter of Intent for a self-storage acquisition. Generate two sections based on these deal metrics:

Property: ${data.propertyName} at ${data.address}
Market: ${data.city || ''}, ${data.state || ''} ${data.msaName ? `(${data.msaName} MSA)` : ''}
Deal Type: ${data.dealType || 'value-add'}
Units: ${data.units || data.totalUnits}
SF: ${data.sf || data.totalSF}
Current Occupancy: ${data.occupancy}
Target Occupancy: 92%
Current Avg Rent: $${data.currentAvgRent}/unit/mo
Market Avg Rent: $${data.marketAvgRent}/unit/mo
Months to Stabilization: ${data.monthsToStabilization}
T-12 NOI: $${Number(data.t12NOI).toLocaleString()}
Year 1 NOI: $${Number(data.year1NOI).toLocaleString()}
Year 3 NOI: $${Number(data.year3NOI).toLocaleString()}
Year 5 NOI: $${Number(data.year5NOI).toLocaleString()}
Offer Price: $${Number(data.offerPrice).toLocaleString()}
Going-In Cap: ${data.goingInCap}%

Return ONLY a JSON object with exactly two fields, no markdown:
{
  "underwriting_narrative": "3-4 sentence paragraph describing the investment thesis, market dynamics, value-add levers (occupancy uplift + rent to market), and NOI growth trajectory",
  "rent_strategy": "2-3 sentence paragraph describing the post-close rent optimization plan including timeline, rate adjustment approach, and occupancy targets"
}`

      const res = await fetch('/api/generate-loi-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (res.ok) {
        const aiData = await res.json()
        setForm(f => ({
          ...f,
          underwriting_narrative: aiData.underwriting_narrative || f.underwriting_narrative,
          rent_strategy: aiData.rent_strategy || f.rent_strategy,
        }))
      }
    } catch { /* ignore */ }
    finally { setGeneratingNarrative(false) }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(''); setSuccess(false)
    try {
      const res = await fetch('/api/generate-loi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form), signal: AbortSignal.timeout(65000),
      })
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `Server error ${res.status}`) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `LOI-${(form.property_name || 'property').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url); setSuccess(true)
    } catch (err) { setError(String(err)) }
    finally { setSubmitting(false) }
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-dark-border" style={{ backgroundColor: '#1B2B5E' }}>
        <div className="relative z-10 page-hero">
          <div className="section-label" style={{ color: '#D4A843' }}>Deal Execution</div>
          <h1 className="font-serif font-light text-white leading-[1.05] max-w-3xl mb-4" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}>
            Generate Letter<br /><em style={{ color: '#D4A843' }}>of Intent.</em>
          </h1>
          <p className="leading-relaxed" style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', maxWidth: '520px' }}>
            All fields auto-populated from your proforma. Review, adjust, and generate.
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="section-container">
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

            {/* Property Details */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Property Details" />
                <Field label="LOI Date" value={form.date} onChange={v => set('date', v)} type="date" />
                <Field label="Property Name" value={form.property_name} onChange={v => set('property_name', v)} placeholder="ABC Self Storage" />
                <Field label="Asset Type" value={form.asset_type} onChange={v => set('asset_type', v)} placeholder="Self-Storage" />
                <Field label="Year Built" value={form.year_built} onChange={v => set('year_built', v)} type="number" placeholder="1998" />
                <Field label="Property Address" value={form.property_address} onChange={v => set('property_address', v)} placeholder="123 Main St, Tampa, FL 33601" span="full" />
                <div className="col-span-full">
                  <TextareaField label="Property Description" value={form.property_description} onChange={v => set('property_description', v)} rows={3} placeholder="Brief description of the property..." />
                </div>
                <Field label="Total Units" value={form.units} onChange={v => set('units', v)} type="number" placeholder="350" />
                <Field label="Total SF" value={form.sf} onChange={v => set('sf', v)} type="number" placeholder="42000" />
                <Field label="Current Occupancy" value={form.occupancy} onChange={v => set('occupancy', v)} placeholder="82%" />
              </div>
            </Card>

            {/* Broker Information */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Broker Information" sub="Auto-populated from uploaded OM" />
                <Field label="Broker 1 Name" value={form.broker1_name} onChange={v => set('broker1_name', v)} placeholder="Nick Walker" />
                <Field label="Broker 2 Name" value={form.broker2_name} onChange={v => set('broker2_name', v)} placeholder="Adam Alexander" />
                <Field label="Brokerage" value={form.brokerage} onChange={v => set('brokerage', v)} placeholder="CBRE" />
                <Field label="Salutation" value={form.salutation} onChange={v => set('salutation', v)} placeholder="Dear Nick and Adam," />
                <Field label="Broker 1 Phone" value={form.broker1_phone} onChange={v => set('broker1_phone', v)} type="tel" placeholder="213-613-3223" />
                <Field label="Broker 2 Phone" value={form.broker2_phone} onChange={v => set('broker2_phone', v)} type="tel" placeholder="213-613-3224" />
                <Field label="Buyer Representation" value={form.buyer_broker} onChange={v => set('buyer_broker', v)} placeholder="Buyer is unrepresented" span="half" />
              </div>
            </Card>

            {/* Deal Economics */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Deal Economics" sub="Auto-populated from proforma" />
                <Field label="Offer Price" value={form.offer_price} onChange={v => set('offer_price', v)} prefix="$" placeholder="4,500,000" />
                <Field label="All-In Cost" value={form.all_in_cost} onChange={v => set('all_in_cost', v)} prefix="$" placeholder="4,800,000" />
                <Field label="Bridge Loan" value={form.bridge_loan} onChange={v => set('bridge_loan', v)} prefix="$" placeholder="2,925,000" />
                <Field label="Bridge Rate" value={form.bridge_rate} onChange={v => set('bridge_rate', v)} suffix="%" placeholder="8.00" />
                <Field label="SOFR" value={form.sofr} onChange={v => set('sofr', v)} suffix="%" placeholder="5.33" />
                <Field label="Annual Debt Service" value={form.annual_ds} onChange={v => set('annual_ds', v)} prefix="$" placeholder="234,000" />
                <Field label="Interest Reserve" value={form.interest_reserve} onChange={v => set('interest_reserve', v)} prefix="$" placeholder="234,000" />
                <Field label="CapEx Reserve" value={form.capex_reserve} onChange={v => set('capex_reserve', v)} prefix="$" placeholder="50,000" />
              </div>
            </Card>

            {/* GP / LP Structure */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="GP / LP Structure" sub="Auto-populated from proforma waterfall" />
                <Field label="GP Fee (Total $)" value={form.gp_fee_total} onChange={v => set('gp_fee_total', v)} prefix="$" placeholder="90,000" />
                <Field label="GP Fee (% of purchase)" value={form.gp_fee_income} onChange={v => set('gp_fee_income', v)} suffix="%" placeholder="2.0" />
                <Field label="GP Co-Invest" value={form.gp_coinvest} onChange={v => set('gp_coinvest', v)} suffix="%" placeholder="0" />
                <Field label="LP Equity" value={form.lp_equity} onChange={v => set('lp_equity', v)} prefix="$" placeholder="1,800,000" />
                <div className="col-span-full">
                  <TextareaField label="Waterfall Structure" value={form.waterfall} onChange={v => set('waterfall', v)} rows={2} placeholder="8% preferred return to LP, then 85/15 split (LP/GP)" />
                </div>
              </div>
            </Card>

            {/* Projected Returns */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Projected Returns" sub="Auto-populated from proforma IRR engine" />
                <Field label="Going-In Cap Rate" value={form.going_in_cap} onChange={v => set('going_in_cap', v)} suffix="%" placeholder="4.9" />
                <Field label="Year 3 Cap Rate" value={form.yr3_cap} onChange={v => set('yr3_cap', v)} suffix="%" placeholder="8.0" />
                <Field label="Pro Forma Cap Rate" value={form.pf_cap} onChange={v => set('pf_cap', v)} suffix="%" placeholder="9.2" />
                <Field label="Exit Cap Rate" value={form.exit_cap} onChange={v => set('exit_cap', v)} suffix="%" placeholder="7.25" />
                <Field label="LP MoIC" value={form.lp_moic} onChange={v => set('lp_moic', v)} suffix="x" placeholder="1.85" />
                <Field label="LP IRR" value={form.lp_irr} onChange={v => set('lp_irr', v)} suffix="%" placeholder="14.2" />
                <Field label="GP MoIC" value={form.gp_moic} onChange={v => set('gp_moic', v)} suffix="x" placeholder="2.30" />
                <Field label="GP IRR" value={form.gp_irr} onChange={v => set('gp_irr', v)} suffix="%" placeholder="19.8" />
              </div>
            </Card>

            {/* Deal Terms */}
            <Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Deal Terms" />
                <Field label="Earnest Money Deposit" value={form.emd} onChange={v => set('emd', v)} prefix="$" placeholder="45,000" />
                <Field label="Due Diligence (Days)" value={form.dd_days} onChange={v => set('dd_days', v)} placeholder="30-45" />
                <Field label="Closing (Days)" value={form.closing_days} onChange={v => set('closing_days', v)} placeholder="30-45" />
                <Field label="Offer Expiry" value={form.offer_expiry} onChange={v => set('offer_expiry', v)} type="date" />
              </div>
            </Card>

            {/* Underwriting Narrative */}
            <Card>
              <div className="pb-2 border-b border-dark-border mb-6 flex items-start justify-between">
                <div>
                  <div className="section-label">Underwriting Narrative</div>
                  <p style={{ fontSize: '0.9rem', color: '#6B6860', marginTop: '4px' }}>
                    Auto-generated from deal data. Edit as needed before generating PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const data = JSON.parse(decodeURIComponent(router.query.data as string))
                      generateNarratives(data)
                    } catch { /* ignore */ }
                  }}
                  disabled={generatingNarrative}
                  className="text-sm uppercase tracking-widest text-gold border border-gold/50 px-4 py-2 hover:bg-gold/10 transition-colors disabled:opacity-50 ml-4 flex-shrink-0"
                >
                  {generatingNarrative ? 'Generating...' : 'Regenerate'}
                </button>
              </div>
              <div className="space-y-5">
                <TextareaField
                  label="Underwriting Narrative"
                  value={form.underwriting_narrative}
                  onChange={v => set('underwriting_narrative', v)}
                  rows={6}
                  loading={generatingNarrative}
                  placeholder="Auto-generating from deal data..."
                />
                <TextareaField
                  label="Rent Strategy"
                  value={form.rent_strategy}
                  onChange={v => set('rent_strategy', v)}
                  rows={4}
                  loading={generatingNarrative}
                  placeholder="Auto-generating from deal data..."
                />
                <div style={{ maxWidth: '280px' }}>
                  <label className="label-text">Breakeven Occupancy</label>
                  <div className="flex items-stretch">
                    <input type="number" className="input-field flex-1 min-w-0" style={{ borderRadius: 0 }} value={form.breakeven_occ} onChange={e => set('breakeven_occ', e.target.value)} placeholder="62" autoComplete="off" />
                    <span className="flex items-center px-3 bg-dark-surface border border-l-0 border-dark-border text-dark-muted" style={{ fontSize: '1rem' }}>%</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Submit */}
            <div className="border border-dark-border bg-dark-surface px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-sans uppercase tracking-widest font-semibold" style={{ fontSize: '0.85rem', color: '#1B2B5E' }}>Ready to Generate</div>
                <p style={{ fontSize: '0.9rem', color: '#6B6860', marginTop: '4px' }}>PDF will download automatically. Generation takes 10–20 seconds.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {error && <p className="text-red-600 bg-red-50 border border-red-200 px-3 py-2 max-w-sm text-right" style={{ fontSize: '0.9rem' }}>{error}</p>}
                {success && <p className="text-green-700 bg-green-50 border border-green-200 px-3 py-2" style={{ fontSize: '0.9rem' }}>LOI generated and downloaded successfully.</p>}
                <button type="submit" disabled={submitting} className="btn-gold px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {submitting ? (
                    <><svg className="animate-spin w-4 h-4 text-current" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>Generating LOI...</>
                  ) : 'Generate LOI PDF'}
                </button>
              </div>
            </div>

          </form>
        </div>
      </section>
    </>
  )
}

export default function GenerateLOI() {
  return (
    <>
      <Head>
        <title>Generate LOI — YEM Acquisitions</title>
        <meta name="description" content="Generate a Letter of Intent PDF for self-storage acquisitions." />
      </Head>
      <AuthGate>
        <LOIContent />
      </AuthGate>
    </>
  )
}
