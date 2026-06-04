import Head from 'next/head'
import Link from 'next/link'

const stats = [
  { value: '$350M+', label: 'Underwritten' },
  { value: '75+', label: 'Transactions' },
  { value: '5+', label: 'Years Storage Focus' },
  { value: '15–20%', label: 'Target IRR' },
]

const process = [
  {
    num: '01',
    title: 'Source',
    body: 'We screen county records, tax rolls, code enforcement databases, and court filings to surface motivated sellers before properties ever reach the market.',
  },
  {
    num: '02',
    title: 'Score',
    body: 'Our 100-point distress model ranks every property by owner motivation — tax delinquency, fire code violations, occupancy trends, ownership patterns.',
  },
  {
    num: '03',
    title: 'Contact',
    body: 'AI-personalized outreach letters reach owners at the right moment. We build relationships months before any sale becomes official.',
  },
  {
    num: '04',
    title: 'Underwrite',
    body: 'Institutional-grade financial modeling, market analysis, and deal structuring — every acquisition is underwritten to the same exacting standard.',
  },
  {
    num: '05',
    title: 'Close',
    body: 'We move in 5 days and close in 30–45. Direct principal-to-owner transactions with no broker middlemen and no auction pressure.',
  },
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
        <meta name="description" content="We acquire and operate self-storage facilities in growth and supply-constrained markets across the United States. Disciplined underwriting, operational excellence, long-term value." />
      </Head>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#1a1a1a', minHeight: '92vh' }} className="relative flex flex-col justify-center">
        <div className="relative z-10 mx-auto w-full px-6 lg:px-12 py-24" style={{ maxWidth: '1100px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-px" style={{ backgroundColor: '#c9a84c' }} />
                <span className="font-sans text-xs uppercase tracking-[0.18em]" style={{ color: '#c9a84c' }}>
                  Self-Storage · Private Acquisition Firm
                </span>
              </div>
              <h1
                className="font-serif font-medium leading-[1.05] mb-6"
                style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', color: '#f5f0e8' }}
              >
                Self-Storage.<br />
                Off-Market.<br />
                <em style={{ color: '#c9a84c' }}>Systematically.</em>
              </h1>
              <p className="leading-relaxed mb-10" style={{ color: '#b0aa9f', fontSize: '1rem', maxWidth: '480px' }}>
                YEM Acquisitions targets motivated sellers before they reach the market — using
                institutional underwriting, proprietary distress scoring, and direct
                principal-to-owner execution.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/pipeline" className="btn-gold">View Acquisition Pipeline</Link>
                <Link href="/submit-deal" style={{
                  display: 'inline-block',
                  border: '1px solid #c9a84c',
                  color: '#c9a84c',
                  padding: '12px 28px',
                  fontSize: '0.8rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-jost)',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}>
                  Submit Your Facility
                </Link>
              </div>
            </div>

            {/* Right — Stats Panel */}
            <div style={{
              background: '#242424',
              border: '1px solid #3a3a3a',
              padding: '2rem',
            }}>
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  style={{
                    padding: '1.25rem 0',
                    borderBottom: i < stats.length - 1 ? '1px solid #3a3a3a' : 'none',
                  }}
                >
                  <div className="font-serif" style={{ fontSize: '3rem', color: '#c9a84c', lineHeight: '1', fontWeight: 500 }}>
                    {s.value}
                  </div>
                  <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.7rem', color: '#888880', marginTop: '0.25rem' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Process ──────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #3a3a3a', borderBottom: '1px solid #3a3a3a' }}>
        <div className="mx-auto px-6 lg:px-12 py-20" style={{ maxWidth: '1100px' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-px" style={{ backgroundColor: '#c9a84c' }} />
            <span className="font-sans text-xs uppercase tracking-[0.18em]" style={{ color: '#c9a84c' }}>Our Process</span>
          </div>
          <h2 className="font-serif font-medium mb-14" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f5f0e8', lineHeight: '1.1' }}>
            From first contact to <em style={{ color: '#c9a84c' }}>closed transaction.</em>
          </h2>

          {/* 5-col grid with dividers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: '#3a3a3a' }}>
            {process.map((p) => (
              <div key={p.num} style={{ background: '#1a1a1a', padding: '1.75rem 1.5rem' }}>
                <div className="font-serif" style={{ fontSize: '3.5rem', color: '#3a3a3a', lineHeight: '1', marginBottom: '1rem', fontWeight: 400 }}>
                  {p.num}
                </div>
                <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.7rem', color: '#c9a84c', fontWeight: 500, marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
                  {p.title}
                </div>
                <p style={{ fontSize: '0.82rem', color: '#888880', lineHeight: '1.65' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Distress Scoring ─────────────────────────────────── */}
      <section style={{ backgroundColor: '#242424', borderBottom: '1px solid #3a3a3a' }}>
        <div className="mx-auto px-6 lg:px-12 py-20" style={{ maxWidth: '1100px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-px" style={{ backgroundColor: '#c9a84c' }} />
                <span className="font-sans text-xs uppercase tracking-[0.18em]" style={{ color: '#c9a84c' }}>Distress Intelligence</span>
              </div>
              <h2 className="font-serif font-medium mb-4" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: '#f5f0e8', lineHeight: '1.1' }}>
                We score every property <em style={{ color: '#c9a84c' }}>before we reach out.</em>
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#888880', lineHeight: '1.75', marginBottom: '2rem' }}>
                Our 100-point motivation model surfaces the highest-probability acquisitions —
                owners facing the conditions that drive off-market decisions.
              </p>
              {/* Score bar */}
              <div>
                <div className="flex justify-between font-sans uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: '#888880', marginBottom: '0.5rem' }}>
                  <span>Low Intent</span><span>High Intent</span>
                </div>
                <div style={{ height: '3px', background: '#3a3a3a' }}>
                  <div style={{ height: '3px', width: '72%', background: '#c9a84c' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888880', marginTop: '0.5rem' }}>Avg Pipeline Score: 72 / 100</div>
              </div>
              <div className="mt-8">
                <Link href="/pipeline" className="btn-gold">Open Acquisition Pipeline</Link>
              </div>
            </div>

            {/* Right — score factors */}
            <div>
              {scoreFactors.map((f, i) => (
                <div
                  key={f.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '1rem 0',
                    borderBottom: i < scoreFactors.length - 1 ? '1px solid #3a3a3a' : 'none',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#f5f0e8', marginBottom: '0.2rem' }}>{f.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888880' }}>{f.desc}</div>
                  </div>
                  <div className="font-serif" style={{ fontSize: '1.3rem', color: '#c9a84c', whiteSpace: 'nowrap', fontWeight: 500 }}>{f.pts}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Markets ──────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#1a1a1a', borderBottom: '1px solid #3a3a3a' }}>
        <div className="mx-auto px-6 lg:px-12 py-20" style={{ maxWidth: '1100px' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-px" style={{ backgroundColor: '#c9a84c' }} />
            <span className="font-sans text-xs uppercase tracking-[0.18em]" style={{ color: '#c9a84c' }}>Target Markets</span>
          </div>
          <h2 className="font-serif font-medium mb-12" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f5f0e8', lineHeight: '1.1' }}>
            Sun Belt <em style={{ color: '#c9a84c' }}>coverage.</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#3a3a3a' }}>
            {markets.map((m) => (
              <div key={m.state} style={{ background: '#1a1a1a', padding: '1.5rem' }}>
                <div className="font-serif" style={{ fontSize: '2.5rem', color: '#c9a84c', lineHeight: '1', marginBottom: '0.5rem', fontWeight: 500 }}>
                  {m.state}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#888880', lineHeight: '1.7' }}>{m.cities}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dual CTA ─────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#1a1a1a' }}>
        <div className="mx-auto px-6 lg:px-12 py-20" style={{ maxWidth: '1100px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#3a3a3a' }}>

            <div style={{ background: '#1a1a1a', padding: '2.5rem', border: '1px solid #3a3a3a' }}>
              <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.7rem', color: '#888880', marginBottom: '1rem', letterSpacing: '0.15em' }}>For Sellers</div>
              <h3 className="font-serif font-medium mb-3" style={{ fontSize: '1.8rem', color: '#f5f0e8' }}>Selling your facility?</h3>
              <p style={{ fontSize: '0.88rem', color: '#888880', lineHeight: '1.75', marginBottom: '2rem' }}>
                Get a confidential, no-obligation review. We move in 5 days and close in 30–45.
                No brokers. No listing. Direct and private.
              </p>
              <Link href="/submit-deal" className="btn-gold">Submit a Deal</Link>
            </div>

            <div style={{ background: '#1a1a1a', padding: '2.5rem', border: '1px solid #3a3a3a', borderLeft: 'none' }}>
              <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.7rem', color: '#888880', marginBottom: '1rem', letterSpacing: '0.15em' }}>For Investors</div>
              <h3 className="font-serif font-medium mb-3" style={{ fontSize: '1.8rem', color: '#f5f0e8' }}>Investing in storage?</h3>
              <p style={{ fontSize: '0.88rem', color: '#888880', lineHeight: '1.75', marginBottom: '2rem' }}>
                Co-invest alongside YEM Acquisitions on curated off-market acquisitions.
                Accredited investors only. 15–20% target IRR.
              </p>
              <Link href="/invest" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#c9a84c',
                fontFamily: 'var(--font-jost)',
                textDecoration: 'none',
              }}>
                Investor Inquiry →
              </Link>
            </div>

          </div>
        </div>
      </section>
    </>
  )
}
