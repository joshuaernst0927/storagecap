import Head from 'next/head'
import Link from 'next/link'

const stats = [
  { value: '$350M+', label: 'Underwritten' },
  { value: '75+', label: 'Transactions' },
  { value: '5+', label: 'Years Storage Focus' },
  { value: '15–20%', label: 'Target IRR' },
]

const process = [
  { num: '01', title: 'Source', body: 'We screen county records, tax rolls, code enforcement databases, and court filings to surface motivated sellers before properties ever reach the market.' },
  { num: '02', title: 'Score', body: 'Our 100-point distress model ranks every property by owner motivation — tax delinquency, fire code violations, occupancy trends, ownership patterns.' },
  { num: '03', title: 'Contact', body: 'AI-personalized outreach letters reach owners at the right moment. We build relationships months before any sale becomes official.' },
  { num: '04', title: 'Underwrite', body: 'Institutional-grade financial modeling, market analysis, and deal structuring — every acquisition is underwritten to the same exacting standard.' },
  { num: '05', title: 'Close', body: 'We move in 5 days and close in 30–45. Direct principal-to-owner transactions with no broker middlemen and no auction pressure.' },
]

const markets = [
  { state: 'TX', cities: 'Dallas · Lubbock · San Antonio' },
  { state: 'GA', cities: 'Atlanta · Macon · Savannah' },
  { state: 'SC', cities: 'Columbia · Greenville · Charleston' },
  { state: 'TN', cities: 'Nashville · Chattanooga · Memphis' },
  { state: 'AZ', cities: 'Phoenix · Tucson · Mesa' },
  { state: 'FL', cities: 'Tampa · Jacksonville · Pensacola' },
  { state: 'AL', cities: 'Huntsville · Birmingham · Montgomery' },
  { state: 'MS', cities: 'Jackson · Biloxi · Hattiesburg' },
]

const scoreFactors = [
  { name: 'Tax Delinquency', pts: '+25 pts', desc: 'Strongest distress indicator — owner unable or unwilling to pay property taxes' },
  { name: 'Lis Pendens', pts: '+20 pts', desc: 'Active litigation against the property signals financial distress or ownership dispute' },
  { name: 'Fire Code Violations', pts: '+15 pts', desc: 'Unresolved violations signal deferred maintenance and disengaged ownership' },
  { name: 'Declining Occupancy', pts: '+10 pts', desc: 'Falling occupancy over 12 months without intervention signals operational neglect' },
  { name: 'Out-of-State Owner', pts: '+10 pts', desc: 'Absentee ownership correlates with reduced operational attention and exit readiness' },
  { name: 'Owner Age 65+', pts: '+10 pts', desc: 'Retirement-age owners show elevated disposition intent and estate planning needs' },
]

export default function Home() {
  return (
    <>
      <Head>
        <title>YEM Acquisitions — Self-Storage Investment & Acquisition Platform</title>
        <meta name="description" content="We acquire and operate self-storage facilities in growth and supply-constrained markets across the United States." />
      </Head>

      {/* ── Hero ── */}
      <section style={{ backgroundColor: '#1B2B5E', minHeight: '88vh' }} className="relative flex flex-col justify-center">
        <div className="relative z-10 mx-auto w-full px-6 lg:px-12 py-16" style={{ maxWidth: '1100px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-px" style={{ backgroundColor: '#D4A843' }} />
                <span className="font-sans uppercase" style={{ fontSize: '0.8rem', letterSpacing: '0.18em', color: '#D4A843' }}>
                  Self-Storage · Private Acquisition Firm
                </span>
              </div>
              <h1 className="font-serif font-medium leading-[1.05] mb-5" style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', color: '#FFFFFF' }}>
                Self-Storage.<br />Off-Market.<br /><em style={{ color: '#D4A843' }}>Systematically.</em>
              </h1>
              <p className="leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.15rem', maxWidth: '480px' }}>
                YEM Acquisitions targets motivated sellers before they reach the market — using institutional underwriting, proprietary distress scoring, and direct principal-to-owner execution.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/pipeline" className="btn-gold">View Acquisition Pipeline</Link>
                <Link href="/submit-deal" className="btn-white-outline">Submit Your Facility</Link>
              </div>
            </div>

            {/* Stats panel */}
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', padding: '1.75rem' }}>
              {stats.map((s, i) => (
                <div key={s.label} style={{ padding: '1rem 0', borderBottom: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
                  <div className="font-serif" style={{ fontSize: '2.8rem', color: '#D4A843', lineHeight: '1', fontWeight: 500 }}>{s.value}</div>
                  <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Process ── */}
      <section style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0DDD4' }}>
        <div className="mx-auto px-6 lg:px-12 py-14" style={{ maxWidth: '1100px' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-px" style={{ backgroundColor: '#D4A843' }} />
            <span className="font-sans uppercase" style={{ fontSize: '0.8rem', letterSpacing: '0.18em', color: '#D4A843' }}>Our Process</span>
          </div>
          <h2 className="font-serif font-light mb-10" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#1B2B5E', lineHeight: '1.1' }}>
            From first contact to <em style={{ color: '#D4A843' }}>closed transaction.</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: '#E0DDD4' }}>
            {process.map((p) => (
              <div key={p.num} style={{ background: '#FFFFFF', padding: '1.5rem 1.25rem' }}>
                <div className="font-serif" style={{ fontSize: '3rem', color: '#E0DDD4', lineHeight: '1', marginBottom: '0.75rem', fontWeight: 400 }}>{p.num}</div>
                <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.8rem', color: '#D4A843', fontWeight: 500, marginBottom: '0.5rem' }}>{p.title}</div>
                <p style={{ fontSize: '1.05rem', color: '#6B6860', lineHeight: '1.65' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Distress Scoring ── */}
      <section style={{ backgroundColor: '#F4F6F9', borderBottom: '1px solid #E0DDD4' }}>
        <div className="mx-auto px-6 lg:px-12 py-14" style={{ maxWidth: '1100px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-px" style={{ backgroundColor: '#D4A843' }} />
                <span className="font-sans uppercase" style={{ fontSize: '0.8rem', letterSpacing: '0.18em', color: '#D4A843' }}>Distress Intelligence</span>
              </div>
              <h2 className="font-serif font-light mb-4" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: '#1B2B5E', lineHeight: '1.1' }}>
                We score every property <em style={{ color: '#D4A843' }}>before we reach out.</em>
              </h2>
              <p style={{ fontSize: '1.05rem', color: '#6B6860', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                Our 100-point motivation model surfaces the highest-probability acquisitions — owners facing the conditions that drive off-market decisions.
              </p>
              <div style={{ marginBottom: '1.75rem' }}>
                <div className="flex justify-between font-sans uppercase" style={{ fontSize: '0.8rem', letterSpacing: '0.1em', color: '#6B6860', marginBottom: '0.5rem' }}>
                  <span>Low Intent</span><span>High Intent</span>
                </div>
                <div style={{ height: '4px', background: '#E0DDD4' }}>
                  <div style={{ height: '4px', width: '72%', background: '#D4A843' }} />
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6B6860', marginTop: '0.4rem' }}>Avg Pipeline Score: 72 / 100</div>
              </div>
              <Link href="/pipeline" className="btn-navy">Open Acquisition Pipeline</Link>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E0DDD4', padding: '0 1.5rem' }}>
              {scoreFactors.map((f, i) => (
                <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 0', borderBottom: i < scoreFactors.length - 1 ? '1px solid #E0DDD4' : 'none', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '1rem', color: '#1A1A18', marginBottom: '0.2rem', fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: '1rem', color: '#6B6860' }}>{f.desc}</div>
                  </div>
                  <div className="font-serif" style={{ fontSize: '1.2rem', color: '#D4A843', whiteSpace: 'nowrap', fontWeight: 500 }}>{f.pts}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Markets ── */}
      <section style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0DDD4' }}>
        <div className="mx-auto px-6 lg:px-12 py-14" style={{ maxWidth: '1100px' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-px" style={{ backgroundColor: '#D4A843' }} />
            <span className="font-sans uppercase" style={{ fontSize: '0.8rem', letterSpacing: '0.18em', color: '#D4A843' }}>Target Markets</span>
          </div>
          <h2 className="font-serif font-light mb-10" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#1B2B5E', lineHeight: '1.1' }}>
            Sun Belt <em style={{ color: '#D4A843' }}>coverage.</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#E0DDD4' }}>
            {markets.map((m) => (
              <div key={m.state} style={{ background: '#FFFFFF', padding: '1.25rem' }}>
                <div className="font-serif" style={{ fontSize: '2.2rem', color: '#1B2B5E', lineHeight: '1', marginBottom: '0.4rem', fontWeight: 500 }}>{m.state}</div>
                <div style={{ fontSize: '1.05rem', color: '#6B6860', lineHeight: '1.65' }}>{m.cities}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dual CTA ── */}
      <section style={{ backgroundColor: '#1B2B5E' }}>
        <div className="mx-auto px-6 lg:px-12 py-14" style={{ maxWidth: '1100px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.15)' }}>
            <div style={{ background: '#1B2B5E', padding: '2rem', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.75rem' }}>For Sellers</div>
              <h3 className="font-serif font-light mb-3" style={{ fontSize: '1.7rem', color: '#FFFFFF' }}>Selling your facility?</h3>
              <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                Get a confidential, no-obligation review. We move in 5 days and close in 30–45. No brokers. No listing. Direct and private.
              </p>
              <Link href="/submit-deal" className="btn-gold">Submit a Deal</Link>
            </div>
            <div style={{ background: '#1B2B5E', padding: '2rem', border: '1px solid rgba(255,255,255,0.12)', borderLeft: 'none' }}>
              <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.75rem' }}>For Investors</div>
              <h3 className="font-serif font-light mb-3" style={{ fontSize: '1.7rem', color: '#FFFFFF' }}>Investing in storage?</h3>
              <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                Co-invest alongside YEM Acquisitions on curated off-market acquisitions. Accredited investors only. 15–20% target IRR.
              </p>
              <Link href="/invest" className="btn-white-outline">Investor Inquiry</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
