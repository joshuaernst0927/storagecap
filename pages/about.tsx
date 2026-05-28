import Head from 'next/head'
import Link from 'next/link'

const NAVY = '#1B2B5E'

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5">
      <circle cx="9" cy="9" r="9" fill={NAVY} fillOpacity="0.12" />
      <path d="M5 9l3 3 5-5" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FocusIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="18" cy="18" r="7" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="18" cy="18" r="2.5" fill="white" />
      <line x1="18" y1="4" x2="18" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="28" x2="18" y2="32" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="18" x2="8" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="28" y1="18" x2="32" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ApproachIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 36 36" fill="none">
      <polyline points="4,28 12,18 20,22 32,8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="24,8 32,8 32,16" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="4" y1="32" x2="32" y2="32" stroke="white" strokeWidth="1.2" strokeOpacity="0.4" />
    </svg>
  )
}

function CommitmentIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 36 36" fill="none">
      <path d="M18 4L6 9v9c0 7 5.5 11.5 12 14 6.5-2.5 12-7 12-14V9L18 4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13 18l3.5 3.5L24 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GoalIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 36 36" fill="none">
      <path d="M18 4l3.5 8.5 9 .8-6.8 6.2 2.1 8.8L18 23.5l-7.8 4.8 2.1-8.8L5.5 13.3l9-.8z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

const pillars = [
  {
    icon: <FocusIcon />,
    title: 'Our Focus',
    body: 'Acquiring value-add and institutional-quality self-storage facilities with strong fundamentals and upside potential.',
  },
  {
    icon: <ApproachIcon />,
    title: 'Our Approach',
    body: 'Drive revenue growth and operational efficiency through active management, technology, and strategic initiatives.',
  },
  {
    icon: <CommitmentIcon />,
    title: 'Our Commitment',
    body: 'Conservative underwriting, downside protection, and transparent communication aligned with investor interests.',
  },
  {
    icon: <GoalIcon />,
    title: 'Our Goal',
    body: 'Deliver consistent cash flow and long-term value appreciation through a diversified portfolio of self-storage assets.',
  },
]

const strategy = [
  {
    label: 'Target Markets',
    body: 'Growth-oriented and supply-constrained markets with strong demographics, population growth, and limited new supply.',
  },
  {
    label: 'Target Assets',
    body: 'Stabilized and value-add self-storage facilities, including under-managed properties, deferred maintenance opportunities, and sites with expansion potential.',
  },
  {
    label: 'Value Creation',
    body: 'Revenue optimization, occupancy growth, operational efficiencies, technology implementation, capital improvements, and ancillary income generation.',
  },
  {
    label: 'Disciplined Underwriting',
    body: 'Conservative assumptions, thorough due diligence, and focus on downside protection and long-term cash flow.',
  },
]

const highlights = [
  'Recession-resilient asset class',
  'Low management intensity',
  'Strong historical performance',
  'Favorable supply/demand dynamics',
  'Multiple strategies: core, value-add, and expansion',
]

const stats = [
  { value: '$350M+', label: 'Total Deal Value Underwritten' },
  { value: '75+', label: 'Transactions Underwritten' },
  { value: '$150M+', label: 'Debt Financing Analyzed' },
  { value: '10+', label: 'Businesses Supported Through Acquisitions' },
  { value: '5+', label: 'Years Self-Storage Investment Focus' },
]

const valueAdd = [
  {
    title: 'Revenue Upside',
    items: ['Increase rents to market', 'Improve occupancy 70% → 90%+', 'Add income streams'],
  },
  {
    title: 'Operations',
    items: ['Professional management systems', 'Centralized leasing & marketing', 'Data-driven pricing'],
  },
  {
    title: 'Expansion',
    items: ['Build units on excess land', 'Reconfigure layout to maximize rentable SF'],
  },
  {
    title: 'Land Upside',
    items: ['Identify zoning flexibility', 'Exit via entitled land sale or MF/mixed-use', 'Asymmetric upside'],
  },
]

const geoMarkets = [
  {
    region: 'Southeast Growth Markets',
    markets: ['Charlotte, NC', 'Raleigh, NC', 'Jacksonville, FL', 'Secondary Southeast corridors'],
  },
  {
    region: 'Midwest & Secondary Markets',
    markets: ['Columbus, OH', 'Cincinnati, OH', 'Madison, WI', 'Suburban Nashville, TN'],
  },
]

const experience = [
  {
    title: 'Commercial Real Estate Finance & Underwriting',
    body: 'Evaluated and underwrote $350M+ in commercial real estate transactions across multiple asset classes. Expertise in cash flow modeling, valuation, DSCR analysis, capital structuring, and investment risk assessment.',
  },
  {
    title: 'Operations & Infrastructure Leadership',
    body: 'Led operational initiatives and built infrastructure for a multi-entity acquisition platform. Oversaw vendor relationships, technology implementation, and system integrations.',
  },
  {
    title: 'Self-Storage Investment Experience',
    body: 'Developed institutional-grade underwriting models for self-storage acquisitions. Extensive market research across growth and supply-constrained U.S. markets.',
  },
]

const whyCards = [
  {
    title: 'Focused Strategy',
    body: 'Cash flow + value-add + land arbitrage combined in a single, disciplined platform.',
  },
  {
    title: 'Downside Protection',
    body: 'Multiple downside protections through income-producing, hard assets.',
  },
  {
    title: 'Scalable Platform',
    body: 'Designed to grow into a multi-asset portfolio and future fund, with investor-aligned performance structure.',
  },
]

export default function About() {
  return (
    <>
      <Head>
        <title>About — YEM Acquisitions</title>
        <meta name="description" content="YEM Acquisitions — a disciplined self-storage investment and acquisition platform focused on value-add opportunities across growth markets." />
      </Head>

      {/* Hero */}
      <section className="page-hero border-b border-dark-border">
        <div className="section-label">About YEM Acquisitions</div>
        <h1 className="font-serif font-light text-[#1B2B5E] leading-[1.05] text-6xl md:text-8xl max-w-4xl mb-6">
          Self-Storage Investment<br />&amp; Acquisition Platform
        </h1>
        <p className="font-serif text-2xl font-light text-[#1B2B5E] mb-6 italic">
          Building Value. Unit By Unit.
        </p>
        <p className="text-dark-muted text-lg max-w-2xl leading-relaxed">
          We acquire and operate self-storage facilities in growth and supply-constrained markets across the United States. Through disciplined underwriting, operational excellence, and strategic improvements, we create stable cash flow and long-term value for our investors.
        </p>
      </section>

      {/* Four Pillars */}
      <section style={{ backgroundColor: NAVY }}>
        <div className="section-container py-20">
          <div className="section-label mb-2" style={{ color: '#d4a843' }}>What We Stand For</div>
          <h2 className="font-serif font-light text-white text-5xl mb-14 leading-[1.05]">
            The four pillars of<br /><em style={{ color: '#d4a843' }}>our platform.</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pillars.map((p) => (
              <div key={p.title} className="flex flex-col gap-6">
                <div style={{ opacity: 0.9 }}>{p.icon}</div>
                <div>
                  <div className="font-sans text-sm uppercase tracking-widest font-semibold mb-4" style={{ color: '#d4a843' }}>
                    {p.title}
                  </div>
                  <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
                    {p.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment Strategy */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Investment Strategy</div>
          <h2 className="display-heading text-5xl mb-14">
            How we<br /><em className="text-gold">invest.</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {strategy.map((s) => (
              <div key={s.label} className="border border-dark-border bg-white p-8">
                <div className="w-8 h-px mb-5" style={{ backgroundColor: NAVY }} />
                <div className="font-sans text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: NAVY }}>
                  {s.label}
                </div>
                <p className="text-dark-muted text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Investment Highlights + Criteria Table */}
      <section className="py-20 bg-dark-surface border-b border-dark-border">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

            {/* Highlights */}
            <div>
              <div className="section-label">Investment Highlights</div>
              <h2 className="display-heading text-4xl mb-10">Why self-storage.</h2>
              <ul className="space-y-4">
                {highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-[#1a1a18] text-sm leading-relaxed">{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Criteria Table */}
            <div>
              <div className="section-label">Typical Investment Criteria</div>
              <h2 className="display-heading text-4xl mb-10">What we target.</h2>
              <div className="border border-dark-border bg-white overflow-hidden">
                {[
                  { label: 'Deal Size', value: '$3M – $15M' },
                  { label: 'Location', value: 'Growth & supply-constrained markets' },
                  { label: 'Property Type', value: 'Self-storage facilities' },
                  { label: 'Strategy', value: 'Value-add, operational improvement, expansion potential' },
                  { label: 'Hold Period', value: '5+ years' },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-start justify-between gap-6 px-6 py-5 ${i < 4 ? 'border-b border-dark-border' : ''}`}>
                    <span className="text-sm uppercase tracking-widest text-dark-muted font-sans whitespace-nowrap font-medium">{row.label}</span>
                    <span className="text-base text-[#1a1a18] font-sans text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Experience Stats */}
      <section className="py-16 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label mb-10">Key Experience Highlights</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-serif font-bold mb-2" style={{ fontSize: '4rem', color: NAVY, lineHeight: '1' }}>{s.value}</div>
                <div className="text-dark-muted text-xs uppercase tracking-widest leading-snug mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder Quote */}
      <section className="py-20" style={{ backgroundColor: NAVY }}>
        <div className="section-container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-12 h-px mx-auto mb-10" style={{ backgroundColor: '#d4a843' }} />
            <blockquote className="font-serif text-2xl md:text-3xl font-light leading-relaxed italic mb-8 text-white">
              &ldquo;My experience in underwriting, operations, and building scalable infrastructure has prepared me to execute a disciplined investment strategy and deliver long-term value for investors.&rdquo;
            </blockquote>
            <div className="font-sans text-xs uppercase tracking-widest" style={{ color: '#d4a843' }}>
              Joshua Ernst — Founder, YEM Acquisitions
            </div>
            <div className="w-12 h-px mx-auto mt-10" style={{ backgroundColor: '#d4a843' }} />
          </div>
        </div>
      </section>

      {/* Target Returns + Investment Structure */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

            {/* Target Returns */}
            <div>
              <div className="section-label">Target Returns</div>
              <h2 className="display-heading text-4xl mb-10">What investors can expect.</h2>
              <div className="border border-dark-border bg-white overflow-hidden mb-4">
                {[
                  { label: 'IRR', value: '15% – 20%' },
                  { label: 'Equity Multiple', value: '2.0x+' },
                  { label: 'Cash Yield', value: '7% – 10%' },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-center justify-between px-6 py-5 ${i < 2 ? 'border-b border-dark-border' : ''}`}>
                    <span className="text-xs uppercase tracking-widest text-dark-muted font-sans">{row.label}</span>
                    <span className="font-serif text-2xl font-light text-gold">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-dark-muted text-xs leading-relaxed">
                Returns driven by NOI growth, cap rate expansion, and repositioning upside. Returns shown are targets, not guarantees. All real estate investments involve risk including loss of principal.
              </p>
            </div>

            {/* Investment Structure */}
            <div>
              <div className="section-label">Investment Structure</div>
              <h2 className="display-heading text-4xl mb-10">How we work together.</h2>
              <div className="space-y-3">
                {[
                  'LPs provide 100% of equity',
                  '8% preferred return to LP investors',
                  'Profit split: 80% LP / 20% GP',
                  'Deal-by-deal GP/LP structure',
                  'YEM Acquisitions manages all acquisitions, operations, and execution',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 border border-dark-border bg-white px-5 py-4">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: NAVY }} />
                    <span className="text-sm text-[#1a1a18] leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value-Add Levers */}
      <section className="py-20 bg-dark-surface border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Value Creation</div>
          <h2 className="display-heading text-5xl mb-14">
            How we create<br /><em className="text-gold">value.</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {valueAdd.map((col, i) => (
              <div key={col.title} className="border border-dark-border bg-white p-7">
                <div className="font-serif text-4xl font-light mb-4" style={{ color: NAVY, opacity: 0.25 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="font-sans text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: NAVY }}>
                  {col.title}
                </div>
                <ul className="space-y-2">
                  {col.items.map((item) => (
                    <li key={item} className="flex gap-2 text-xs text-dark-muted leading-relaxed">
                      <span className="text-gold flex-shrink-0">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Geographic Focus */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Geographic Focus</div>
          <h2 className="display-heading text-5xl mb-14">
            Markets we<br /><em className="text-gold">target.</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {geoMarkets.map((g) => (
              <div key={g.region} className="border border-dark-border bg-white p-8">
                <div className="w-6 h-px mb-5" style={{ backgroundColor: '#d4a843' }} />
                <div className="font-sans text-xs uppercase tracking-widest font-semibold mb-6" style={{ color: NAVY }}>
                  {g.region}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {g.markets.map((m) => (
                    <div key={m} className="flex items-center gap-2 text-sm text-[#1a1a18]">
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: NAVY }} />
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Professional Experience */}
      <section className="py-20 bg-dark-surface border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Professional Experience</div>
          <h2 className="display-heading text-5xl mb-14">
            Built on<br /><em className="text-gold">expertise.</em>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {experience.map((e) => (
              <div key={e.title} className="border border-dark-border bg-white p-8">
                <div className="gold-divider mb-6" />
                <h3 className="font-serif text-xl font-light text-[#1B2B5E] mb-4 leading-snug">{e.title}</h3>
                <p className="text-dark-muted text-sm leading-relaxed">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why YEM */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Why YEM Acquisitions</div>
          <h2 className="display-heading text-5xl mb-14">
            Our<br /><em className="text-gold">differentiators.</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {whyCards.map((c) => (
              <div key={c.title} className="border border-dark-border bg-white p-8">
                <div className="w-8 h-px mb-6" style={{ backgroundColor: NAVY }} />
                <h3 className="font-serif text-2xl font-light text-[#1B2B5E] mb-3">{c.title}</h3>
                <p className="text-dark-muted text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20" style={{ backgroundColor: NAVY }}>
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="font-sans text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: '#d4a843' }}>
                Get In Touch
              </div>
              <h2 className="font-serif font-light text-white text-5xl mb-6 leading-[1.05]">
                Let&apos;s talk<br /><em style={{ color: '#d4a843' }}>self-storage.</em>
              </h2>
              <p className="text-sm leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Whether you&apos;re a property owner, prospective investor, or potential partner — we&apos;re always interested in a conversation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="mailto:joshuaernst@gmail.com" className="btn-gold">Send an Email</a>
                <Link href="/invest" className="btn-gold-outline">Investor Inquiry</Link>
              </div>
            </div>

            <div className="space-y-5">
              {[
                { label: 'Email', value: 'joshuaernst@gmail.com', href: 'mailto:joshuaernst@gmail.com' },
                { label: 'Phone', value: '516.305.2484', href: 'tel:5163052484' },
                { label: 'Location', value: 'Woodmere, New York', href: null },
                { label: 'Website', value: 'yemacquisitions.com', href: null },
              ].map((c) => (
                <div key={c.label} className="flex items-start gap-5 border-b pb-5" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  <span className="text-xs uppercase tracking-widest font-sans w-20 flex-shrink-0 pt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {c.label}
                  </span>
                  {c.href ? (
                    <a href={c.href} className="text-sm transition-colors duration-200 hover:text-gold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {c.value}
                    </a>
                  ) : (
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{c.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
