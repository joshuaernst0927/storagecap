import Head from 'next/head'
import Link from 'next/link'

const NAVY = '#1B2B5E'

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" className="flex-shrink-0 mt-0.5">
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
  { icon: <FocusIcon />, title: 'Our Focus', body: 'Acquiring value-add and institutional-quality self-storage facilities with strong fundamentals and upside potential.' },
  { icon: <ApproachIcon />, title: 'Our Approach', body: 'Drive revenue growth and operational efficiency through active management, technology, and strategic initiatives.' },
  { icon: <CommitmentIcon />, title: 'Our Commitment', body: 'Conservative underwriting, downside protection, and transparent communication aligned with investor interests.' },
  { icon: <GoalIcon />, title: 'Our Goal', body: 'Deliver consistent cash flow and long-term value appreciation through a diversified portfolio of self-storage assets.' },
]

const strategy = [
  { label: 'Target Markets', body: 'Growth-oriented and supply-constrained markets with strong demographics, population growth, and limited new supply.' },
  { label: 'Target Assets', body: 'Stabilized and value-add self-storage facilities, including under-managed properties, deferred maintenance opportunities, and sites with expansion potential.' },
  { label: 'Value Creation', body: 'Revenue optimization, occupancy growth, operational efficiencies, technology implementation, capital improvements, and ancillary income generation.' },
  { label: 'Disciplined Underwriting', body: 'Conservative assumptions, thorough due diligence, and focus on downside protection and long-term cash flow.' },
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
  { value: '10+', label: 'Businesses Supported' },
  { value: '5+', label: 'Years Self-Storage Focus' },
]

const valueAdd = [
  { title: 'Revenue Upside', items: ['Increase rents to market', 'Improve occupancy 70% → 90%+', 'Add income streams'] },
  { title: 'Operations', items: ['Professional management systems', 'Centralized leasing & marketing', 'Data-driven pricing'] },
  { title: 'Expansion', items: ['Build units on excess land', 'Reconfigure layout to maximize rentable SF'] },
  { title: 'Land Upside', items: ['Identify zoning flexibility', 'Exit via entitled land sale or MF/mixed-use', 'Asymmetric upside'] },
]

const geoMarkets = [
  { region: 'Southeast Growth Markets', markets: ['Charlotte, NC', 'Raleigh, NC', 'Jacksonville, FL', 'Secondary Southeast corridors'] },
  { region: 'Midwest & Secondary Markets', markets: ['Columbus, OH', 'Cincinnati, OH', 'Madison, WI', 'Suburban Nashville, TN'] },
]

const experience = [
  { title: 'Commercial Real Estate Finance & Underwriting', body: 'Evaluated and underwrote $350M+ in commercial real estate transactions across multiple asset classes. Expertise in cash flow modeling, valuation, DSCR analysis, capital structuring, and investment risk assessment.' },
  { title: 'Operations & Infrastructure Leadership', body: 'Led operational initiatives and built infrastructure for a multi-entity acquisition platform. Oversaw vendor relationships, technology implementation, and system integrations.' },
  { title: 'Self-Storage Investment Experience', body: 'Developed institutional-grade underwriting models for self-storage acquisitions. Extensive market research across growth and supply-constrained U.S. markets.' },
]

const whyCards = [
  { title: 'Focused Strategy', body: 'Cash flow + value-add + land arbitrage combined in a single, disciplined platform.' },
  { title: 'Downside Protection', body: 'Multiple downside protections through income-producing, hard assets.' },
  { title: 'Scalable Platform', body: 'Designed to grow into a multi-asset portfolio and future fund, with investor-aligned performance structure.' },
]

export default function About() {
  return (
    <>
      <Head>
        <title>About — YEM Acquisitions</title>
        <meta name="description" content="YEM Acquisitions — a disciplined self-storage investment and acquisition platform focused on value-add opportunities across growth markets." />
      </Head>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-dark-border" style={{ backgroundColor: '#1B2B5E' }}>
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=1200)', opacity: 0.15 }} />
        <div className="relative z-10 page-hero">
          <div className="section-label" style={{ color: '#D4A843' }}>About YEM Acquisitions</div>
          <h1 className="font-serif font-light text-white leading-[1.05] max-w-4xl mb-5" style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)' }}>
            Self-Storage Investment<br />&amp; Acquisition Platform
          </h1>
          <p className="font-serif text-3xl font-light italic mb-5" style={{ color: '#D4A843' }}>Building Value. Unit By Unit.</p>
          <p className="text-xl max-w-2xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            We acquire and operate self-storage facilities in growth and supply-constrained markets across the United States. Through disciplined underwriting, operational excellence, and strategic improvements, we create stable cash flow and long-term value for our investors.
          </p>
        </div>
      </section>

      {/* Four Pillars */}
      <section style={{ backgroundColor: NAVY }}>
        <div className="section-container py-20">
          <div className="section-label mb-2" style={{ color: '#d4a843' }}>What We Stand For</div>
          <h2 className="font-serif font-light text-white leading-[1.05] mb-14" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)' }}>
            The four pillars of<br /><em style={{ color: '#d4a843' }}>our platform.</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pillars.map((p) => (
              <div key={p.title} className="flex flex-col gap-6">
                <div style={{ opacity: 0.9 }}>{p.icon}</div>
                <div>
                  <div className="font-sans uppercase tracking-widest font-semibold mb-3" style={{ fontSize: '0.85rem', color: '#d4a843' }}>{p.title}</div>
                  <p className="leading-relaxed" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.78)' }}>{p.body}</p>
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
          <h2 className="display-heading mb-14">How we <em className="text-gold">invest.</em></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {strategy.map((s) => (
              <div key={s.label} className="border border-dark-border bg-white p-8">
                <div className="w-8 h-px mb-5" style={{ backgroundColor: NAVY }} />
                <div className="font-sans uppercase tracking-widest font-semibold mb-3" style={{ fontSize: '0.85rem', color: NAVY }}>{s.label}</div>
                <p style={{ fontSize: '1rem', color: '#6B6860', lineHeight: '1.75' }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights + Criteria */}
      <section className="py-20 bg-dark-surface border-b border-dark-border">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <div className="section-label">Investment Highlights</div>
              <h2 className="display-heading mb-10">Why self-storage.</h2>
              <ul className="space-y-4">
                {highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3">
                    <CheckIcon />
                    <span style={{ fontSize: '1rem', color: '#1a1a18', lineHeight: '1.7' }}>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="section-label">Typical Investment Criteria</div>
              <h2 className="display-heading mb-10">What we target.</h2>
              <div className="border border-dark-border bg-white overflow-hidden">
                {[
                  { label: 'Deal Size', value: '$3M – $15M' },
                  { label: 'Location', value: 'Growth & supply-constrained markets' },
                  { label: 'Property Type', value: 'Self-storage facilities' },
                  { label: 'Strategy', value: 'Value-add, operational improvement, expansion potential' },
                  { label: 'Hold Period', value: '5+ years' },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-start justify-between gap-6 px-6 py-5 ${i < 4 ? 'border-b border-dark-border' : ''}`}>
                    <span style={{ fontSize: '0.85rem', color: '#6B6860' }} className="uppercase tracking-widest font-sans whitespace-nowrap font-medium">{row.label}</span>
                    <span style={{ fontSize: '1rem', color: '#1a1a18' }} className="font-sans text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label mb-10">Key Experience Highlights</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-serif font-bold mb-2" style={{ fontSize: '3.5rem', color: NAVY, lineHeight: '1' }}>{s.value}</div>
                <div className="uppercase tracking-widest leading-snug mt-2" style={{ fontSize: '0.8rem', color: '#6B6860' }}>{s.label}</div>
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
            <blockquote className="font-serif font-light leading-relaxed italic mb-8 text-white" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)' }}>
              &ldquo;My experience in underwriting, operations, and building scalable infrastructure has prepared me to execute a disciplined investment strategy and deliver long-term value for investors.&rdquo;
            </blockquote>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.85rem', color: '#d4a843' }}>Joshua Ernst — Founder, YEM Acquisitions</div>
            <div className="w-12 h-px mx-auto mt-10" style={{ backgroundColor: '#d4a843' }} />
          </div>
        </div>
      </section>

      {/* Target Returns + Investment Structure */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <div className="section-label">Target Returns</div>
              <h2 className="display-heading mb-10">What investors can expect.</h2>
              <div className="border border-dark-border bg-white overflow-hidden mb-4">
                {[
                  { label: 'IRR', value: '15% – 20%' },
                  { label: 'Equity Multiple', value: '2.0x+' },
                  { label: 'Cash Yield', value: '7% – 10%' },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-center justify-between px-6 py-5 ${i < 2 ? 'border-b border-dark-border' : ''}`}>
                    <span className="uppercase tracking-widest font-sans" style={{ fontSize: '0.85rem', color: '#6B6860' }}>{row.label}</span>
                    <span className="font-serif text-gold" style={{ fontSize: '1.8rem', fontWeight: 300 }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#6B6860', lineHeight: '1.7' }}>
                Returns driven by NOI growth, cap rate expansion, and repositioning upside. Returns shown are targets, not guarantees. All real estate investments involve risk including loss of principal.
              </p>
            </div>
            <div>
              <div className="section-label">Investment Structure</div>
              <h2 className="display-heading mb-10">How we work together.</h2>
              <div className="space-y-3">
                {[
                  'LPs provide 100% of equity',
                  '8% preferred return to LP investors',
                  'Profit split: 80% LP / 20% GP',
                  'Deal-by-deal GP/LP structure',
                  'YEM Acquisitions manages all acquisitions, operations, and execution',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 border border-dark-border bg-white px-5 py-4">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: NAVY }} />
                    <span style={{ fontSize: '1rem', color: '#1a1a18', lineHeight: '1.7' }}>{item}</span>
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
          <h2 className="display-heading mb-14">How we create <em className="text-gold">value.</em></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {valueAdd.map((col, i) => (
              <div key={col.title} className="border border-dark-border bg-white p-7">
                <div className="font-serif font-light mb-4" style={{ fontSize: '3rem', color: NAVY, opacity: 0.25 }}>{String(i + 1).padStart(2, '0')}</div>
                <div className="font-sans uppercase tracking-widest font-semibold mb-4" style={{ fontSize: '0.85rem', color: NAVY }}>{col.title}</div>
                <ul className="space-y-2">
                  {col.items.map((item) => (
                    <li key={item} className="flex gap-2 leading-relaxed" style={{ fontSize: '0.95rem', color: '#6B6860' }}>
                      <span className="text-gold flex-shrink-0">·</span>{item}
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
          <h2 className="display-heading mb-14">Markets we <em className="text-gold">target.</em></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {geoMarkets.map((g) => (
              <div key={g.region} className="border border-dark-border bg-white p-8">
                <div className="w-6 h-px mb-5" style={{ backgroundColor: '#d4a843' }} />
                <div className="font-sans uppercase tracking-widest font-semibold mb-6" style={{ fontSize: '0.85rem', color: NAVY }}>{g.region}</div>
                <div className="grid grid-cols-2 gap-3">
                  {g.markets.map((m) => (
                    <div key={m} className="flex items-center gap-2" style={{ fontSize: '1rem', color: '#1a1a18' }}>
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: NAVY }} />{m}
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
          <h2 className="display-heading mb-14">Built on <em className="text-gold">expertise.</em></h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {experience.map((e) => (
              <div key={e.title} className="border border-dark-border bg-white p-8">
                <div className="gold-divider mb-6" />
                <h3 className="font-serif font-light text-[#1B2B5E] mb-4 leading-snug" style={{ fontSize: '1.3rem' }}>{e.title}</h3>
                <p style={{ fontSize: '1rem', color: '#6B6860', lineHeight: '1.75' }}>{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why YEM */}
      <section className="py-20 border-b border-dark-border">
        <div className="section-container">
          <div className="section-label">Why YEM Acquisitions</div>
          <h2 className="display-heading mb-14">Our <em className="text-gold">differentiators.</em></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {whyCards.map((c) => (
              <div key={c.title} className="border border-dark-border bg-white p-8">
                <div className="w-8 h-px mb-6" style={{ backgroundColor: NAVY }} />
                <h3 className="font-serif font-light text-[#1B2B5E] mb-3" style={{ fontSize: '1.5rem' }}>{c.title}</h3>
                <p style={{ fontSize: '1rem', color: '#6B6860', lineHeight: '1.75' }}>{c.body}</p>
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
              <div className="font-sans uppercase tracking-widest font-semibold mb-4" style={{ fontSize: '0.85rem', color: '#d4a843' }}>Get In Touch</div>
              <h2 className="font-serif font-light text-white leading-[1.05] mb-6" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)' }}>
                Let&apos;s talk <em style={{ color: '#d4a843' }}>self-storage.</em>
              </h2>
              <p className="leading-relaxed mb-10" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.65)' }}>
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
                  <span className="uppercase tracking-widest font-sans w-20 flex-shrink-0 pt-0.5" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)' }}>{c.label}</span>
                  {c.href ? (
                    <a href={c.href} className="transition-colors duration-200 hover:text-gold" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.85)' }}>{c.value}</a>
                  ) : (
                    <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.85)' }}>{c.value}</span>
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
