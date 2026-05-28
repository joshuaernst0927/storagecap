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
    body: 'Our 175-point distress model ranks every property by owner motivation — tax delinquency, fire code violations, occupancy trends, ownership patterns.',
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
  { state: 'TX', city: 'Dallas · Lubbock · San Antonio' },
  { state: 'GA', city: 'Atlanta · Macon · Savannah' },
  { state: 'SC', city: 'Columbia · Greenville · Charleston' },
  { state: 'TN', city: 'Nashville · Chattanooga · Memphis' },
  { state: 'AZ', city: 'Phoenix · Tucson · Mesa' },
  { state: 'FL', city: 'Tampa · Jacksonville · Pensacola' },
  { state: 'AL', city: 'Huntsville · Birmingham · Montgomery' },
  { state: 'MS', city: 'Jackson · Biloxi · Hattiesburg' },
]

export default function Home() {
  return (
    <>
      <Head>
        <title>YEM Acquisitions — Self-Storage Investment & Acquisition Platform</title>
        <meta name="description" content="We acquire and operate self-storage facilities in growth and supply-constrained markets across the United States. Disciplined underwriting, operational excellence, long-term value." />
      </Head>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col justify-center overflow-hidden"
        style={{ backgroundColor: '#1B2B5E', minHeight: '90vh' }}
      >
        {/* Background image overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=1600)',
            opacity: 0.18,
          }}
        />

        <div className="relative z-10 mx-auto w-full px-6 lg:px-12 py-24" style={{ maxWidth: '1100px' }}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-px bg-gold" />
            <span className="font-sans text-xs uppercase tracking-[0.14em] font-semibold text-gold">
              Sun Belt · Self-Storage · Off-Market
            </span>
          </div>

          <h1
            className="font-serif font-light text-white leading-[1.0] mb-5"
            style={{ fontSize: 'clamp(3.5rem, 7vw, 6rem)' }}
          >
            Self-Storage Investment<br />&amp; Acquisition Platform
          </h1>

          <p className="font-serif text-2xl font-light italic mb-6" style={{ color: '#D4A843' }}>
            Building Value. Unit By Unit.
          </p>

          <p className="text-lg leading-relaxed max-w-2xl mb-12" style={{ color: 'rgba(255,255,255,0.72)' }}>
            We acquire and operate self-storage facilities in growth and supply-constrained markets
            across the United States. Through disciplined underwriting, operational excellence,
            and strategic improvements, we create stable cash flow and long-term value for our investors.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/pipeline" className="btn-gold">
              View Acquisition Pipeline
            </Link>
            <Link href="/submit-deal" className="btn-white-outline">
              Submit Your Facility
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="border-b border-dark-border bg-white py-12">
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="font-serif font-light mb-1"
                  style={{ fontSize: '3.5rem', lineHeight: '1', color: '#1B2B5E' }}
                >
                  {s.value}
                </div>
                <div className="text-dark-muted text-xs uppercase tracking-widest font-sans mt-2">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About Strip ──────────────────────────────────────── */}
      <section className="py-20 border-b border-dark-border">
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="section-label">About YEM Acquisitions</div>
              <h2
                className="font-serif font-light text-[#1B2B5E] leading-[1.05] mb-6"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
              >
                Off-market sourcing.<br />
                <em className="text-gold">Systematically.</em>
              </h2>
              <p className="text-dark-muted leading-relaxed mb-8" style={{ fontSize: '1.05rem' }}>
                The best self-storage deals never list publicly. They come from owners facing
                life transitions — retirement, health issues, financial distress, partnership
                disputes — who haven&apos;t decided to sell yet. We find them first, before
                any broker or competitor knows they exist.
              </p>
              <div className="flex gap-4">
                <Link href="/about" className="btn-navy">About Us</Link>
                <Link href="/acquisitions" className="btn-ghost">Our Criteria</Link>
              </div>
            </div>
            <div className="overflow-hidden rounded" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800"
                alt="Self-storage facility"
                className="w-full h-72 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Process ──────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#1B2B5E' }}>
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="section-label mb-2" style={{ color: '#D4A843' }}>Our Process</div>
          <h2
            className="font-serif font-light text-white leading-[1.05] mb-14"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
          >
            From First Contact to<br />
            <em style={{ color: '#D4A843' }}>Closed Transaction</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {process.map((p) => (
              <div key={p.num} className="flex flex-col gap-4">
                <div className="font-serif font-light" style={{ fontSize: '3rem', color: 'rgba(212,168,67,0.35)', lineHeight: '1' }}>
                  {p.num}
                </div>
                <div className="w-8 h-px" style={{ backgroundColor: '#D4A843' }} />
                <div className="font-sans text-sm uppercase tracking-widest font-semibold" style={{ color: '#D4A843' }}>
                  {p.title}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Markets ──────────────────────────────────────────── */}
      <section className="py-20 border-b border-dark-border" style={{ backgroundColor: '#F4F6F9' }}>
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="section-label">Target Markets</div>
          <h2
            className="display-heading mb-12"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
          >
            Sun Belt coverage
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {markets.map((m) => (
              <div
                key={m.state}
                className="bg-white border border-dark-border p-5 hover:border-gold/50 transition-all duration-200 rounded"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              >
                <div className="font-serif font-light mb-2" style={{ fontSize: '2rem', color: '#1B2B5E' }}>{m.state}</div>
                <div className="text-dark-muted leading-relaxed" style={{ fontSize: '0.8rem' }}>{m.city}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Distress Intelligence ────────────────────────────── */}
      <section className="py-20 border-b border-dark-border">
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="section-label">Distress Intelligence</div>
          <h2
            className="display-heading mb-4"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
          >
            We score every property<br />
            <em className="text-gold">before we reach out.</em>
          </h2>
          <p className="text-dark-muted leading-relaxed mb-12" style={{ maxWidth: '600px', fontSize: '1.05rem' }}>
            Our motivation scoring model surfaces the highest-probability acquisitions — owners
            facing tax delinquency, code violations, declining occupancy, and personal life transitions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { signal: 'Tax Delinquency', points: '+25 pts', desc: 'Strongest distress indicator — owner unable or unwilling to pay property taxes', color: 'tag-red' },
              { signal: 'Fire Code Violations', points: '+15 pts', desc: 'Unresolved violations signal deferred maintenance and disengaged ownership', color: 'tag-red' },
              { signal: 'Lis Pendens', points: '+20 pts', desc: 'Active litigation against the property signals financial distress or ownership dispute', color: 'tag-amber' },
              { signal: 'Declining Occupancy', points: '+10 pts', desc: 'Falling occupancy over 12 months without intervention signals operational neglect', color: 'tag-amber' },
              { signal: 'Out-of-State Owner', points: '+10 pts', desc: 'Absentee ownership correlates with reduced operational attention and exit readiness', color: 'tag-muted' },
              { signal: 'Owner Age 65+', points: '+10 pts', desc: 'Retirement-age owners show elevated disposition intent and estate planning needs', color: 'tag-muted' },
            ].map((s) => (
              <div
                key={s.signal}
                className="border border-dark-border bg-white p-6 rounded hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={s.color.includes('red') ? 'tag-red' : s.color.includes('amber') ? 'tag-amber' : 'tag-muted'}>
                    {s.signal}
                  </span>
                  <span className="font-mono text-xs font-bold" style={{ color: '#D4A843' }}>{s.points}</span>
                </div>
                <p className="text-dark-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <Link href="/pipeline" className="btn-navy">
            Open Acquisition Pipeline
          </Link>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: '#2D6A4F' }}>
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="font-sans text-xs uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Get Access
          </div>
          <h2
            className="font-serif font-light text-white leading-[1.05] mb-6"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', maxWidth: '700px' }}
          >
            Access Off-Market Self-Storage Deals<br />
            <em style={{ color: '#D4A843' }}>Before They Reach Any List</em>
          </h2>
          <p className="leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.68)', maxWidth: '560px', fontSize: '1.05rem' }}>
            We share our active deal pipeline exclusively with verified accredited investors.
            No brokers. No auction. Direct access to off-market acquisitions at every stage.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/investor-deal-access" className="btn-gold">
              Request Deal Access
            </Link>
            <Link href="/invest" className="btn-white-outline">
              Investor Relations
            </Link>
          </div>
        </div>
      </section>

      {/* ── Dual CTA ─────────────────────────────────────────── */}
      <section className="py-20 border-t border-dark-border" style={{ backgroundColor: '#F4F6F9' }}>
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              className="bg-white border border-dark-border p-8 rounded hover:shadow-lg transition-all duration-300"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            >
              <div className="gold-divider mb-6" />
              <h3 className="font-serif font-light text-[#1B2B5E] mb-3" style={{ fontSize: '1.8rem' }}>
                Selling your facility?
              </h3>
              <p className="text-dark-muted leading-relaxed mb-7" style={{ fontSize: '1rem' }}>
                Get a confidential, no-obligation review. We move in 5 days and close in 30–45.
                No brokers. No listing. Direct and private.
              </p>
              <Link href="/submit-deal" className="btn-gold">Submit a Deal</Link>
            </div>
            <div
              className="bg-white border border-dark-border p-8 rounded hover:shadow-lg transition-all duration-300"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            >
              <div className="gold-divider mb-6" />
              <h3 className="font-serif font-light text-[#1B2B5E] mb-3" style={{ fontSize: '1.8rem' }}>
                Investing in storage?
              </h3>
              <p className="text-dark-muted leading-relaxed mb-7" style={{ fontSize: '1rem' }}>
                Co-invest alongside YEM Acquisitions on curated off-market acquisitions.
                Accredited investors only. 15–20% target IRR.
              </p>
              <Link href="/invest" className="btn-navy">Investor Inquiry</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
