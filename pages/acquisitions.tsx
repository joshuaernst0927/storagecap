import Head from 'next/head'
import Link from 'next/link'

const criteria = [
  { label: 'Unit Count', value: '200 – 1,500 units' },
  { label: 'Occupancy', value: '65%+' },
  { label: 'Asking Price', value: '$1.5M – $15M' },
  { label: 'Markets', value: 'Sun Belt + SE' },
  { label: 'Year Built', value: 'Any vintage' },
  { label: 'Climate Control', value: 'Preferred' },
]

const signals = [
  { title: 'Tax Delinquency', desc: 'Owner has fallen behind on property taxes — a strong predictor of disposition intent.' },
  { title: 'Fire Code / Code Violations', desc: 'Unresolved city or fire marshal violations suggest deferred maintenance and disengaged ownership.' },
  { title: 'Lis Pendens', desc: 'Active legal filings against the property signal financial distress or partnership disputes.' },
  { title: 'Declining Occupancy', desc: 'A multi-year occupancy decline without corrective action signals operational fatigue.' },
  { title: 'Out-of-State Owner', desc: 'Absentee ownership correlates with reduced attention and readiness to sell.' },
  { title: 'Owner Age 65+', desc: 'Retirement-age owners have elevated estate planning and liquidity needs.' },
]

export default function Acquisitions() {
  return (
    <>
      <Head>
        <title>Acquisitions — YEM Acquisitions</title>
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Acquisitions</div>
        <h1 className="display-heading text-6xl md:text-8xl max-w-3xl mb-8">
          Off-market.<br />
          <em className="text-gold">Every time.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          We source exclusively through systematic distress intelligence — county records,
          tax rolls, code enforcement, and court filings. We don&apos;t wait for listings.
        </p>
      </section>

      <section className="py-24">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <div className="section-label">Acquisition Criteria</div>
              <h2 className="display-heading text-5xl mb-10">What we target</h2>
              <div className="grid grid-cols-2 gap-3">
                {criteria.map(c => (
                  <div key={c.label} className="border border-dark-border p-5 bg-dark-surface">
                    <div className="text-xs uppercase tracking-widest text-dark-muted mb-2">{c.label}</div>
                    <div className="font-serif text-xl font-light text-gold">{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="section-label">Why Sellers Choose Us</div>
              <h2 className="display-heading text-5xl mb-10">A direct buyer</h2>
              <div className="space-y-5">
                {[
                  ['No Brokers Required', 'You work directly with our principals. No commissions, no intermediaries.'],
                  ['5-Day LOI', 'We underwrite and respond within 5 business days of receiving complete data.'],
                  ['30–45 Day Close', 'Experienced legal and title teams move quickly to a certain close.'],
                  ['Full Confidentiality', 'NDA signed before any data exchange. Your tenants and staff never know.'],
                ].map(([t, d]) => (
                  <div key={t} className="flex gap-5 border-b border-dark-border pb-5">
                    <div className="w-1 bg-gold flex-shrink-0 mt-1" />
                    <div>
                      <div className="text-[#1a1a18] text-sm font-medium mb-1">{t}</div>
                      <div className="text-dark-muted text-sm leading-relaxed">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-dark-surface border-y border-dark-border">
        <div className="section-container">
          <div className="section-label">Distress Intelligence</div>
          <h2 className="display-heading text-5xl mb-16 max-w-2xl">How we find motivated sellers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {signals.map(s => (
              <div key={s.title} className="border border-dark-border p-6 bg-dark-bg">
                <div className="gold-divider mb-5" />
                <h3 className="font-serif text-xl font-light text-[#1B2B5E] mb-3">{s.title}</h3>
                <p className="text-dark-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/pipeline" className="btn-gold-outline">View Live Pipeline</Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="section-container">
          <div className="border border-gold/30 p-12 md:p-20 text-center">
            <div className="section-label">Own a facility?</div>
            <h2 className="display-heading text-5xl mb-6">Get a confidential review.</h2>
            <p className="text-dark-muted max-w-sm mx-auto mb-10 leading-relaxed">
              No broker required. No obligation. Response within 5 business days.
            </p>
            <Link href="/submit-deal" className="btn-gold">Submit Your Facility</Link>
          </div>
        </div>
      </section>
    </>
  )
}
