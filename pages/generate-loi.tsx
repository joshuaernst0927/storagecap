import Head from 'next/head'
import { useState, FormEvent } from 'react'
import AuthGate from '@/components/AuthGate'

// ─── Types ────────────────────────────────────────────────────────────────────

type LOIForm = {
  date: string
  property_name: string
  property_address: string
  property_description: string
  asset_type: string
  units: string
  sf: string
  year_built: string
  occupancy: string
  broker1_name: string
  broker2_name: string
  brokerage: string
  broker1_phone: string
  broker2_phone: string
  buyer_broker: string
  salutation: string
  offer_price: string
  all_in_cost: string
  bridge_loan: string
  bridge_rate: string
  sofr: string
  annual_ds: string
  interest_reserve: string
  capex_reserve: string
  gp_fee_total: string
  gp_fee_income: string
  gp_coinvest: string
  lp_equity: string
  going_in_cap: string
  yr3_cap: string
  pf_cap: string
  lp_moic: string
  lp_irr: string
  gp_moic: string
  gp_irr: string
  waterfall: string
  emd: string
  dd_days: string
  closing_days: string
  offer_expiry: string
  underwriting_narrative: string
  rent_strategy: string
  breakeven_occ: string
  exit_cap: string
}

const EMPTY: LOIForm = {
  date: new Date().toISOString().slice(0, 10),
  property_name: '', property_address: '', property_description: '',
  asset_type: 'Self-Storage', units: '', sf: '', year_built: '', occupancy: '',
  broker1_name: '', broker2_name: '', brokerage: '', broker1_phone: '',
  broker2_phone: '', buyer_broker: '', salutation: '',
  offer_price: '', all_in_cost: '', bridge_loan: '', bridge_rate: '',
  sofr: '', annual_ds: '', interest_reserve: '', capex_reserve: '',
  gp_fee_total: '', gp_fee_income: '', gp_coinvest: '', lp_equity: '',
  going_in_cap: '', yr3_cap: '', pf_cap: '',
  lp_moic: '', lp_irr: '', gp_moic: '', gp_irr: '',
  waterfall: '', emd: '', dd_days: '15', closing_days: '30',
  offer_expiry: '', underwriting_narrative: '', rent_strategy: '',
  breakeven_occ: '', exit_cap: '',
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label, name, form, onChange,
  type = 'text', placeholder = '', prefix, suffix, span,
}: {
  label: string
  name: keyof LOIForm
  form: LOIForm
  onChange: (name: keyof LOIForm, value: string) => void
  type?: 'text' | 'number' | 'date' | 'tel'
  placeholder?: string
  prefix?: string
  suffix?: string
  span?: 'full' | 'half'
}) {
  return (
    <div className={span === 'full' ? 'col-span-full' : span === 'half' ? 'col-span-2' : ''}>
      <label className="form-label">{label}</label>
      {prefix || suffix ? (
        <div className="flex items-stretch">
          {prefix && (
            <span className="flex items-center px-3 bg-dark-surface border border-r-0 border-dark-border text-dark-muted text-sm font-mono">
              {prefix}
            </span>
          )}
          <input
            type={type}
            className="form-input flex-1 min-w-0"
            style={{ borderRadius: 0 }}
            value={form[name]}
            onChange={e => onChange(name, e.target.value)}
            placeholder={placeholder}
          />
          {suffix && (
            <span className="flex items-center px-3 bg-dark-surface border border-l-0 border-dark-border text-dark-muted text-sm">
              {suffix}
            </span>
          )}
        </div>
      ) : (
        <input
          type={type}
          className="form-input"
          value={form[name]}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  )
}

function TextareaField({
  label, name, form, onChange, rows = 4, placeholder = '',
}: {
  label: string
  name: keyof LOIForm
  form: LOIForm
  onChange: (name: keyof LOIForm, value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <div className="col-span-full">
      <label className="form-label">{label}</label>
      <textarea
        className="form-input font-sans text-sm"
        rows={rows}
        value={form[name]}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="col-span-full pb-1 border-b border-dark-border mb-1">
      <div className="section-label">{label}</div>
      {sub && <p className="text-dark-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function LOIContent() {
  const [form, setForm] = useState<LOIForm>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (name: keyof LOIForm, value: string) =>
    setForm(f => ({ ...f, [name]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/generate-loi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        signal: AbortSignal.timeout(65000),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `LOI-${(form.property_name || 'property').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-dark-border" style={{ backgroundColor: '#1B2B5E' }}>
        <div className="relative z-10 page-hero">
          <div className="section-label" style={{ color: '#D4A843' }}>Deal Execution</div>
          <h1 className="font-serif font-light text-white leading-[1.05] max-w-3xl mb-4" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}>
            Generate Letter<br />
            <em style={{ color: '#D4A843' }}>of Intent.</em>
          </h1>
          <p className="text-lg max-w-xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Fill in the deal parameters below to generate a professional, ready-to-send LOI PDF.
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="section-container">
          <form onSubmit={handleSubmit} className="space-y-10">

            {/* ── Property Details ─────────────────────────────────────── */}
            <div className="border border-dark-border bg-white p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Property Details" />
                <Field label="LOI Date" name="date" form={form} onChange={set} type="date" />
                <Field label="Property Name" name="property_name" form={form} onChange={set} placeholder="ABC Self Storage" />
                <Field label="Asset Type" name="asset_type" form={form} onChange={set} placeholder="Self-Storage" />
                <Field label="Year Built" name="year_built" form={form} onChange={set} type="number" placeholder="1998" />
                <Field label="Property Address" name="property_address" form={form} onChange={set} placeholder="123 Main St, Tampa, FL 33601" span="full" />
                <TextareaField label="Property Description" name="property_description" form={form} onChange={set} rows={3} placeholder="Brief description of the property..." />
                <Field label="Total Units" name="units" form={form} onChange={set} type="number" placeholder="350" />
                <Field label="Total SF" name="sf" form={form} onChange={set} type="number" placeholder="42000" />
                <Field label="Current Occupancy" name="occupancy" form={form} onChange={set} placeholder="82%" />
              </div>
            </div>

            {/* ── Broker Information ───────────────────────────────────── */}
            <div className="border border-dark-border bg-white p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Broker Information" />
                <Field label="Broker 1 Name" name="broker1_name" form={form} onChange={set} placeholder="John Smith" />
                <Field label="Broker 2 Name" name="broker2_name" form={form} onChange={set} placeholder="Jane Doe" />
                <Field label="Brokerage" name="brokerage" form={form} onChange={set} placeholder="Marcus &amp; Millichap" />
                <Field label="Salutation" name="salutation" form={form} onChange={set} placeholder="Dear John and Jane," />
                <Field label="Broker 1 Phone" name="broker1_phone" form={form} onChange={set} type="tel" placeholder="555-123-4567" />
                <Field label="Broker 2 Phone" name="broker2_phone" form={form} onChange={set} type="tel" placeholder="555-234-5678" />
                <Field label="Buyer Broker" name="buyer_broker" form={form} onChange={set} placeholder="YEM Acquisitions" span="half" />
              </div>
            </div>

            {/* ── Deal Economics ───────────────────────────────────────── */}
            <div className="border border-dark-border bg-white p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Deal Economics" sub="All dollar figures in USD" />
                <Field label="Offer Price" name="offer_price" form={form} onChange={set} prefix="$" placeholder="4,200,000" />
                <Field label="All-In Cost" name="all_in_cost" form={form} onChange={set} prefix="$" placeholder="4,500,000" />
                <Field label="Bridge Loan" name="bridge_loan" form={form} onChange={set} prefix="$" placeholder="2,730,000" />
                <Field label="Bridge Rate" name="bridge_rate" form={form} onChange={set} suffix="%" placeholder="8.50" />
                <Field label="SOFR" name="sofr" form={form} onChange={set} suffix="%" placeholder="5.33" />
                <Field label="Annual Debt Service" name="annual_ds" form={form} onChange={set} prefix="$" placeholder="232,000" />
                <Field label="Interest Reserve" name="interest_reserve" form={form} onChange={set} prefix="$" placeholder="175,000" />
                <Field label="CapEx Reserve" name="capex_reserve" form={form} onChange={set} prefix="$" placeholder="50,000" />
              </div>
            </div>

            {/* ── GP / LP Structure ────────────────────────────────────── */}
            <div className="border border-dark-border bg-white p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="GP / LP Structure" />
                <Field label="GP Fee (Total)" name="gp_fee_total" form={form} onChange={set} prefix="$" placeholder="84,000" />
                <Field label="GP Fee (% of Income)" name="gp_fee_income" form={form} onChange={set} suffix="%" placeholder="3.0" />
                <Field label="GP Co-Invest" name="gp_coinvest" form={form} onChange={set} suffix="%" placeholder="10" />
                <Field label="LP Equity" name="lp_equity" form={form} onChange={set} prefix="$" placeholder="1,545,000" />
                <TextareaField label="Waterfall Structure" name="waterfall" form={form} onChange={set} rows={3} placeholder="e.g. 8% pref → 80/20 to LP → 70/30 above 15% IRR" />
              </div>
            </div>

            {/* ── Returns ─────────────────────────────────────────────── */}
            <div className="border border-dark-border bg-white p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Projected Returns" />
                <Field label="Going-In Cap Rate" name="going_in_cap" form={form} onChange={set} suffix="%" placeholder="6.2" />
                <Field label="Year 3 Cap Rate" name="yr3_cap" form={form} onChange={set} suffix="%" placeholder="7.1" />
                <Field label="Pro Forma Cap Rate" name="pf_cap" form={form} onChange={set} suffix="%" placeholder="8.4" />
                <Field label="Exit Cap Rate" name="exit_cap" form={form} onChange={set} suffix="%" placeholder="6.5" />
                <Field label="LP MoIC" name="lp_moic" form={form} onChange={set} suffix="x" placeholder="1.85" />
                <Field label="LP IRR" name="lp_irr" form={form} onChange={set} suffix="%" placeholder="14.2" />
                <Field label="GP MoIC" name="gp_moic" form={form} onChange={set} suffix="x" placeholder="2.30" />
                <Field label="GP IRR" name="gp_irr" form={form} onChange={set} suffix="%" placeholder="19.8" />
              </div>
            </div>

            {/* ── Deal Terms ───────────────────────────────────────────── */}
            <div className="border border-dark-border bg-white p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <SectionHeader label="Deal Terms" />
                <Field label="Earnest Money Deposit" name="emd" form={form} onChange={set} prefix="$" placeholder="50,000" />
                <Field label="Due Diligence (Days)" name="dd_days" form={form} onChange={set} type="number" placeholder="15" />
                <Field label="Closing (Days)" name="closing_days" form={form} onChange={set} type="number" placeholder="30" />
                <Field label="Offer Expiry" name="offer_expiry" form={form} onChange={set} type="date" />
              </div>
            </div>

            {/* ── Underwriting Narrative ───────────────────────────────── */}
            <div className="border border-dark-border bg-white p-8">
              <div className="grid grid-cols-1 gap-y-5">
                <SectionHeader label="Underwriting Narrative" sub="These fields populate the LOI narrative sections." />
                <TextareaField label="Underwriting Narrative" name="underwriting_narrative" form={form} onChange={set} rows={6} placeholder="Describe the investment thesis, market dynamics, and rationale for this offer..." />
                <TextareaField label="Rent Strategy" name="rent_strategy" form={form} onChange={set} rows={4} placeholder="Describe the planned rent adjustment strategy post-close..." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  <Field label="Breakeven Occupancy" name="breakeven_occ" form={form} onChange={set} suffix="%" placeholder="62" />
                </div>
              </div>
            </div>

            {/* ── Submit ───────────────────────────────────────────────── */}
            <div className="border border-dark-border bg-dark-surface px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-dark-muted font-semibold">Ready to Generate</div>
                <p className="text-dark-muted text-xs mt-1">PDF will download automatically when complete. Generation takes 10–20 seconds.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 max-w-sm text-right">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2">
                    LOI generated and downloaded successfully.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gold px-8 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-current" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                      Generating LOI...
                    </>
                  ) : (
                    'Generate LOI PDF'
                  )}
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
