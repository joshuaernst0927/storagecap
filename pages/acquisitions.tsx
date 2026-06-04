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

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-dark-border" style={{ backgroundColor: '#1B2B5E' }}>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200)', opacity: 0.18 }} />
        <div className="relative z-10 page-hero">
          <div className="section-label" style={{ color: '#D4A843' }}>Acquisitions</div>
          <h1 className="font-serif font-light text-white leading-[1.05] max-w-3xl mb-6" style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)' }}>
            Off-market.<br /><em style={{ color: '#D4A843' }}>Every time.</em>
          </h1>
          <p className="max-w-xl leading-relaxed" style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.7)' }}>
            We source exclusively through systematic distress intelligence — county records,
            tax rolls, code enforcement, and court filings. We don&apos;t wait for listings.
          </p>
        </div>
      </section>

      {/* Criteria + Why Us */}
      <section className="py-20">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

            <div>
              <div className="section-label">Acquisition Criteria</div>
              <h2 className="display-heading mb-10">What we target</h2>
              <div className="grid grid-cols-2 gap-3">
                {criteria.map(c => (
                  <div key={c.label} className="border border-dark-border p-5 bg-dark-surface">
                    <div className="uppercase tracking-widest font-sans mb-2" style={{ fontSize: '0.8rem', color: '#6B6860' }}>{c.label}</div>
                    <div className="font-serif text-gold" style={{ fontSize: '1.4rem', fontWeight: 300 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="section-label">Why Sellers Choose Us</div>
              <h2 className="display-heading mb-10">A direct buyer</h2>
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
                      <div className="font-medium mb-1" style={{ fontSize: '1rem', color: '#1a1a18' }}>{t}</div>
                      <div className="leading-relaxed" style={{ fontSize: '1rem', color: '#6B6860' }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Distress Signals */}
      <section className="py-20 bg-dark-surface border-y border-dark-border">
        <div className="section-container">
          <div className="section-label">Distress Intelligence</div>
          <h2 className="display-heading mb-14 max-w-2xl">How we find motivated sellers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {signals.map(s => (
              <div key={s.title} className="border border-dark-border p-6 bg-white">
                <div className="gold-divider mb-5" />
                <h3 className="font-serif font-light text-[#1B2B5E] mb-3" style={{ fontSize: '1.3rem' }}>{s.title}</h3>
                <p className="leading-relaxed" style={{ fontSize: '1rem', color: '#6B6860' }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/pipeline" className="btn-gold-outline">View Live Pipeline</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="section-container">
          <div className="border p-12 md:p-20 text-center" style={{ borderColor: 'rgba(212,168,67,0.3)' }}>
            <div className="section-label">Own a facility?</div>
            <h2 className="display-heading mb-6">Get a confidential review.</h2>
            <p className="mx-auto mb-10 leading-relaxed" style={{ fontSize: '1.05rem', color: '#6B6860', maxWidth: '420px' }}>
              No broker required. No obligation. Response within 5 business days.
            </p>
            <Link href="/submit-deal" className="btn-gold">Submit Your Facility</Link>
          </div>
        </div>
      </section>
    </>
  )
}
