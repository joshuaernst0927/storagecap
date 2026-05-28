import Head from 'next/head'
import Link from 'next/link'

const articles = [
  {
    category: 'Valuation',
    title: 'How Cap Rates Work in Self-Storage — And Why They\'re Compressing',
    excerpt: 'Self-storage cap rates fell from 7.2% to 5.8% in six years. What\'s driving it, where they\'re headed, and how sellers should price today.',
    read: '6 min',
    date: 'Nov 2024',
    featured: true,
  },
  {
    category: 'Market Intelligence',
    title: 'Why Self-Storage Outperforms in Every Economic Cycle',
    excerpt: 'Life transitions drive self-storage demand regardless of the economy. We break down the structural tailwinds that make it uniquely resilient.',
    read: '5 min',
    date: 'Oct 2024',
  },
  {
    category: 'Seller Guide',
    title: 'Reading Your T-12: What Buyers Actually Look At',
    excerpt: 'Sophisticated buyers focus on gross potential revenue, move-in/move-out patterns, and rate trajectories — not just net income. Know what they\'ll ask.',
    read: '7 min',
    date: 'Oct 2024',
  },
  {
    category: 'Value-Add',
    title: 'The Operational Playbook: From Mom-and-Pop to Institutional',
    excerpt: 'Revenue management software, digital marketing, unit mix optimization, and tenant insurance programs — the levers that move NOI fast.',
    read: '9 min',
    date: 'Sep 2024',
  },
  {
    category: 'Tax Strategy',
    title: '1031 Exchange Essentials for Self-Storage Owners',
    excerpt: 'Defer capital gains indefinitely through like-kind exchanges. Timelines, ID rules, reverse exchanges, and the common mistakes that cost sellers millions.',
    read: '7 min',
    date: 'Sep 2024',
  },
  {
    category: 'Finance',
    title: 'Seller Financing: Increase Your Net Proceeds and Defer Taxes',
    excerpt: 'Carrying back a note often beats a cash sale on an after-tax basis. How to structure seller financing to protect yourself and maximize yield.',
    read: '6 min',
    date: 'Aug 2024',
  },
  {
    category: 'Due Diligence',
    title: 'The Self-Storage Due Diligence Checklist: 47 Items Buyers Verify',
    excerpt: 'What a sophisticated buyer checks in 30 days of due diligence — and how sellers can prepare documents in advance to accelerate closing.',
    read: '10 min',
    date: 'Aug 2024',
  },
  {
    category: 'Market Timing',
    title: 'When to Sell: How to Read Cap Rate Cycles',
    excerpt: 'The relationship between interest rates, cap rates, and asset values. Historical patterns for Sun Belt self-storage and the signals that precede corrections.',
    read: '6 min',
    date: 'Jul 2024',
  },
]

export default function Education() {
  return (
    <>
      <Head>
        <title>Education — YEM Acquisitions</title>
        <meta name="description" content="Self-storage valuation, exit strategy, and market intelligence for owners, operators, and investors." />
      </Head>

      <section className="relative overflow-hidden border-b border-dark-border" style={{ backgroundColor: '#1B2B5E' }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200)', opacity: 0.18 }}
        />
        <div className="relative z-10 page-hero">
          <div className="section-label" style={{ color: '#D4A843' }}>Education</div>
          <h1 className="font-serif font-light text-white leading-[1.05] max-w-3xl mb-6" style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)' }}>
            Know your asset.<br />
            <em style={{ color: '#D4A843' }}>Know your options.</em>
          </h1>
          <p className="text-lg max-w-xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Practical resources for self-storage owners and operators on valuation,
            exit planning, tax strategy, and market dynamics.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="section-container">
          {/* Featured */}
          <div className="mb-8">
            <Link href="#" className="group grid grid-cols-1 md:grid-cols-2 border border-dark-border hover:border-gold/40 transition-colors duration-300">
              <div className="p-10 md:p-14">
                <div className="section-label">{articles[0].category}</div>
                <h2 className="font-serif text-4xl font-light text-[#1B2B5E] group-hover:text-gold transition-colors duration-200 leading-snug mb-5">
                  {articles[0].title}
                </h2>
                <p className="text-dark-muted leading-relaxed mb-8">{articles[0].excerpt}</p>
                <div className="flex items-center gap-4">
                  <span className="text-dark-muted text-xs font-sans">{articles[0].date}</span>
                  <span className="w-1 h-1 bg-dark-border rounded-full" />
                  <span className="text-dark-muted text-xs font-sans">{articles[0].read} read</span>
                </div>
              </div>
              <div className="bg-dark-surface border-l border-dark-border flex items-center justify-center p-14">
                <div className="text-center">
                  <div className="font-serif text-7xl font-light text-gold/20 leading-none mb-4">7.2→<br />5.8%</div>
                  <p className="text-dark-muted text-xs uppercase tracking-widest">Cap rate compression<br />2018 – 2024</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.slice(1).map(a => (
              <Link key={a.title} href="#" className="group block border border-dark-border bg-dark-surface p-7 hover:border-gold/40 transition-colors duration-300">
                <div className="section-label-sm mb-3">{a.category}</div>
                <h3 className="font-serif text-xl font-light text-[#1B2B5E] group-hover:text-gold transition-colors duration-200 leading-snug mb-4">
                  {a.title}
                </h3>
                <p className="text-dark-muted text-sm leading-relaxed mb-6">{a.excerpt}</p>
                <div className="flex items-center gap-3 border-t border-dark-border pt-4 text-dark-muted text-xs font-sans">
                  <span>{a.date}</span>
                  <span>·</span>
                  <span>{a.read} read</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-dark-surface border-t border-dark-border">
        <div className="section-container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-dark-border p-10 bg-dark-bg">
              <div className="gold-divider mb-6" />
              <h3 className="font-serif text-3xl font-light text-[#1B2B5E] mb-4">Ready to sell?</h3>
              <p className="text-dark-muted text-sm leading-relaxed mb-6">Confidential review. 5-day response. No broker required.</p>
              <Link href="/submit-deal" className="btn-gold">Submit a Deal</Link>
            </div>
            <div className="border border-dark-border p-10 bg-dark-bg">
              <div className="gold-divider mb-6" />
              <h3 className="font-serif text-3xl font-light text-[#1B2B5E] mb-4">AI Property Analyzer</h3>
              <p className="text-dark-muted text-sm leading-relaxed mb-6">Get an instant institutional-quality analysis of any self-storage asset.</p>
              <Link href="/analyze" className="btn-gold-outline">Open Analyzer</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
