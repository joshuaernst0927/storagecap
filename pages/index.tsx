import Head from 'next/head'
import Link from 'next/link'
import { mockProperties, scoreColor, scoreLabel } from '@/lib/pipelineData'

const stats = [
  { value: '8', label: 'Properties in Pipeline' },
  { value: '3', label: 'High Motivation Targets' },
  { value: '72', label: 'Avg Motivation Score' },
  { value: '6', label: 'Markets Tracked' },
]

const approach = [
  {
    num: '01',
    title: 'Systematic Sourcing',
    body: 'We screen county records, tax rolls, code enforcement databases, and court filings to surface motivated sellers before properties ever hit the market.',
  },
  {
    num: '02',
    title: 'Distress Intelligence',
    body: 'Tax delinquency, fire code violations, lis pendens, declining occupancy — our proprietary scoring model ranks every property by owner motivation.',
  },
  {
    num: '03',
    title: 'Direct Outreach',
    body: 'AI-generated, personalized letters reach owners at the right moment. We create relationships months before a sale becomes official.',
  },
]

const markets = [
  { state: 'TX', city: 'Dallas / Lubbock / San Antonio' },
  { state: 'GA', city: 'Atlanta / Macon / Savannah' },
  { state: 'SC', city: 'Columbia / Greenville / Charleston' },
  { state: 'MS', city: 'Jackson / Biloxi / Hattiesburg' },
  { state: 'TN', city: 'Nashville / Chattanooga / Memphis' },
  { state: 'AZ', city: 'Phoenix / Tucson / Mesa' },
  { state: 'AL', city: 'Huntsville / Birmingham / Montgomery' },
  { state: 'FL', city: 'Tampa / Jacksonville / Pensacola' },
]

export default function Home() {
  const topDeals = mockProperties
    .filter(p => p.motivationScore >= 65)
    .sort((a, b) => b.motivationScore - a.motivationScore)
    .slice(0, 3)

  return (
    <>
      <Head>
        <title>YEM Acquisitions — Private Self-Storage Acquisitions</title>
        <meta name="description" content="Systematic off-market self-storage acquisitions across the Sun Belt. Distress intelligence. Direct outreach. Institutional execution." />
      </Head>

      {/* Hero */}
      <section className="relative min-h-[88vh] flex flex-col justify-center px-6 lg:px-12 overflow-hidden border-b border-dark-border">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="w-6 h-px bg-gold" />
              <span className="section-label mb-0">Sun Belt · Self-Storage · Off-Market</span>
            </div>

            <h1 className="font-serif font-light text-[#1B2B5E] leading-[1.0] mb-8"
                style={{ fontSize: 'clamp(3.5rem, 7vw, 6.5rem)' }}>
              We find<br />
              <em className="text-gold">motivated sellers</em><br />
              before anyone else.
            </h1>

            <p className="text-dark-muted text-lg leading-relaxed max-w-lg mb-12">
              Systematic off-market acquisition of self-storage facilities. We source
              through distress intelligence, score owners by motivation, and close
              with institutional-grade professionalism.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/pipeline" className="btn-gold">
                View Acquisition Pipeline
              </Link>
              <Link href="/submit-deal" className="btn-gold-outline">
                Submit Your Facility
              </Link>
            </div>
          </div>

          {/* Live pipeline preview */}
          <div className="hidden lg:block">
            <div className="border border-dark-border bg-dark-surface/60">
              <div className="flex items-center justify-between px-5 py-3 border-b border-dark-border">
                <span className="text-xs uppercase tracking-widest text-dark-muted font-sans">Live Pipeline</span>
                <span className="flex items-center gap-2 text-xs text-green-600 font-sans">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Active
                </span>
              </div>
              <div className="divide-y divide-dark-border">
                {topDeals.map((deal) => (
                  <div key={deal.id} className="px-5 py-4 flex items-start gap-4">
                    <div className={`border text-xs font-mono font-bold w-10 h-10 flex items-center justify-center flex-shrink-0 ${scoreColor(deal.motivationScore)}`}>
                      {deal.motivationScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#1a1a18] text-sm font-medium truncate">{deal.facilityName}</div>
                      <div className="text-dark-muted text-xs mt-0.5">{deal.city}, {deal.state} · {deal.unitCount} units</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {deal.distressSignals.taxDelinquency && (
                          <span className="tag-red">Tax Delinquent</span>
                        )}
                        {deal.distressSignals.fireCodeViolations && (
                          <span className="tag-red">Fire Code</span>
                        )}
                        {deal.distressSignals.lisPendens && (
                          <span className="tag-amber">Lis Pendens</span>
                        )}
                        {deal.distressSignals.outOfStateOwner && (
                          <span className="tag-muted">OOS Owner</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs font-sans uppercase tracking-widest font-bold ${scoreColor(deal.motivationScore).split(' ')[0]}`}>
                        {scoreLabel(deal.motivationScore)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-dark-border">
                <Link href="/pipeline" className="text-gold text-xs uppercase tracking-widest font-sans hover:text-gold/80 transition-colors">
                  View full pipeline →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-dark-border bg-dark-surface py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-serif font-light text-gold mb-1" style={{ fontSize: '3.5rem', lineHeight: '1' }}>{s.value}</div>
                <div className="text-dark-muted text-xs uppercase tracking-widest font-sans mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="section-label">Our Approach</div>
              <h2 className="display-heading text-5xl md:text-6xl mb-8">
                Off-market sourcing.<br />
                <em className="text-gold">Systematically.</em>
              </h2>
              <p className="text-dark-muted leading-relaxed mb-10">
                The best self-storage deals never list publicly. They come from owners
                facing life transitions — retirement, health issues, financial distress,
                partnership disputes — who haven&apos;t decided to sell yet.
                We find them first.
              </p>
              <Link href="/acquisitions" className="btn-gold-outline">
                Acquisition Criteria
              </Link>
            </div>
            <div className="flex flex-col gap-6">
              {approach.map((a) => (
                <div key={a.num} className="flex gap-6">
                  <div className="font-serif text-5xl font-light text-dark-border leading-none flex-shrink-0 w-12">{a.num}</div>
                  <div className="border-l border-dark-border pl-6">
                    <h3 className="font-serif text-xl font-light text-[#1B2B5E] mb-2">{a.title}</h3>
                    <p className="text-dark-muted text-sm leading-relaxed">{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="py-28 bg-dark-surface border-y border-dark-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="section-label">Target Markets</div>
          <h2 className="display-heading text-5xl mb-16">Sun Belt coverage</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {markets.map((m) => (
              <div key={m.state} className="border border-dark-border bg-dark-bg p-5 hover:border-gold/30 transition-colors duration-200">
                <div className="font-serif text-3xl font-light text-gold mb-2">{m.state}</div>
                <div className="text-dark-muted text-xs leading-relaxed">{m.city}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Distress Intelligence Preview */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="section-label">Distress Intelligence</div>
          <h2 className="display-heading text-5xl mb-6 max-w-2xl">
            We score every property<br />
            <em className="text-gold">before we reach out.</em>
          </h2>
          <p className="text-dark-muted max-w-xl leading-relaxed mb-14">
            Our motivation scoring model weighs tax delinquency, code enforcement history,
            owner age, years of ownership, occupancy trends, and out-of-state ownership
            patterns to surface the highest-probability acquisitions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { signal: 'Tax Delinquency', points: '+25 pts', desc: 'Owner unable or unwilling to pay property taxes — strongest distress indicator', color: 'tag-red' },
              { signal: 'Fire Code Violations', points: '+15 pts', desc: 'Unresolved violations suggest deferred maintenance and disengaged ownership', color: 'tag-red' },
              { signal: 'Lis Pendens', points: '+20 pts', desc: 'Litigation against the property signals financial distress or ownership disputes', color: 'tag-amber' },
              { signal: 'Declining Occupancy', points: '+10 pts', desc: 'Falling occupancy over 12 months without improvement suggests operational neglect', color: 'tag-amber' },
              { signal: 'Out-of-State Owner', points: '+10 pts', desc: 'Absentee ownership correlates with reduced operational attention', color: 'tag-muted' },
              { signal: 'Owner Age 65+', points: '+10 pts', desc: 'Retirement-age owners have higher disposition intent and estate planning needs', color: 'tag-muted' },
            ].map((s) => (
              <div key={s.signal} className="border border-dark-border p-5 bg-dark-surface">
                <div className="flex items-center justify-between mb-3">
                  <span className={`tag ${s.color.includes('red') ? 'tag-red' : s.color.includes('amber') ? 'tag-amber' : 'tag-muted'}`}>
                    {s.signal}
                  </span>
                  <span className="font-mono text-xs text-gold font-bold">{s.points}</span>
                </div>
                <p className="text-dark-muted text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <Link href="/pipeline" className="btn-gold">
            Open Acquisition Pipeline
          </Link>
        </div>
      </section>

      {/* Dual CTA */}
      <section className="py-28 bg-dark-surface border-t border-dark-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-dark-border p-10 bg-dark-bg hover:border-gold/30 transition-colors duration-300">
              <div className="gold-divider mb-6" />
              <h3 className="font-serif text-4xl font-light text-[#1B2B5E] mb-4">
                Selling your facility?
              </h3>
              <p className="text-dark-muted text-sm leading-relaxed mb-8">
                Get a confidential, no-obligation review. We move in 5 days and close in 30–45.
              </p>
              <Link href="/submit-deal" className="btn-gold">Submit a Deal</Link>
            </div>
            <div className="border border-dark-border p-10 bg-dark-bg hover:border-gold/30 transition-colors duration-300">
              <div className="gold-divider mb-6" />
              <h3 className="font-serif text-4xl font-light text-[#1B2B5E] mb-4">
                Investing in storage?
              </h3>
              <p className="text-dark-muted text-sm leading-relaxed mb-8">
                Co-invest alongside YEM Acquisitions on curated off-market acquisitions. Accredited investors only.
              </p>
              <Link href="/invest" className="btn-gold-outline">Investor Relations</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
