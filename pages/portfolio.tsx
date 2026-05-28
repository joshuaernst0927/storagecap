import Head from 'next/head'

interface PortfolioProperty {
  id: string
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  unitCount: number
  yearBuilt: number
  acquiredDate: string
  purchasePrice: number
  currentValue: number
  currentNOI: number
  purchaseNOI: number
  occupancy: number
  purchaseOccupancy: number
  capAtPurchase: number
  currentCap: number
  valueAdd: string[]
  noiHistory: number[]
  historyLabels: string[]
}

const portfolio: PortfolioProperty[] = [
  {
    id: 'port1',
    name: 'Gulf Stream Storage',
    address: '9801 Westheimer Rd',
    city: 'Houston',
    state: 'TX',
    zipCode: '77042',
    unitCount: 340,
    yearBuilt: 2004,
    acquiredDate: 'March 2022',
    purchasePrice: 3200000,
    currentValue: 4100000,
    currentNOI: 295000,
    purchaseNOI: 218000,
    occupancy: 94,
    purchaseOccupancy: 74,
    capAtPurchase: 6.8,
    currentCap: 7.2,
    valueAdd: [
      'Implemented revenue management software — raised rates 31% over 18 months',
      'Rebranded and launched Google/Meta paid acquisition: occupancy lifted 74% → 94%',
      'Added tenant protection insurance program: $28K annual incremental revenue',
      'Renegotiated property management contract: reduced fees from 8% to 5.5%',
    ],
    noiHistory: [218, 227, 238, 248, 255, 263, 278, 295],
    historyLabels: ["Q1'22", "Q2'22", "Q3'22", "Q4'22", "Q1'23", "Q2'23", "Q3'23", "Q4'23"],
  },
  {
    id: 'port2',
    name: 'Peachtree Capital Storage',
    address: '1810 Howell Mill Rd NW',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30318',
    unitCount: 460,
    yearBuilt: 1999,
    acquiredDate: 'August 2022',
    purchasePrice: 4800000,
    currentValue: 6050000,
    currentNOI: 385000,
    purchaseNOI: 292000,
    occupancy: 91,
    purchaseOccupancy: 69,
    capAtPurchase: 6.1,
    currentCap: 6.4,
    valueAdd: [
      'Converted 40 drive-up units to climate-controlled: average rate lifted $28/unit/month',
      'Resolved 3-year tax delinquency at acquisition — cleaned title for lender financing',
      'Replaced offline gate/security system: reduced vandalism incidents and improved lease renewals',
      'Raised street rates from 22% below market to 5% above market over 14-month period',
    ],
    noiHistory: [292, 308, 321, 338, 352, 364, 375, 385],
    historyLabels: ["Q3'22", "Q4'22", "Q1'23", "Q2'23", "Q3'23", "Q4'23", "Q1'24", "Q2'24"],
  },
  {
    id: 'port3',
    name: 'Suncoast Self Storage',
    address: '4714 N Dale Mabry Hwy',
    city: 'Tampa',
    state: 'FL',
    zipCode: '33614',
    unitCount: 280,
    yearBuilt: 2007,
    acquiredDate: 'January 2023',
    purchasePrice: 2900000,
    currentValue: 3720000,
    currentNOI: 238000,
    purchaseNOI: 178000,
    occupancy: 96,
    purchaseOccupancy: 71,
    capAtPurchase: 6.1,
    currentCap: 6.4,
    valueAdd: [
      'Digitized intake: moved from paper lease agreements to fully automated online rental',
      'Launched 24/7 self-serve kiosk — removed on-site manager requirement (saves $52K/yr)',
      'Rate optimization cadence implemented: 14 rate increase rounds executed in 22 months',
      'Exterior renovation and signage refresh: facility reviews improved from 3.2 → 4.6 stars',
    ],
    noiHistory: [178, 188, 197, 208, 215, 224, 230, 238],
    historyLabels: ["Q1'23", "Q2'23", "Q3'23", "Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24"],
  },
]

function Sparkline({ data, color = '#d4a843', w = 180, h = 48 }: { data: number[], color?: string, w?: number, h?: number }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 4
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const fillPts = [
    `${pad},${h - pad}`,
    ...pts,
    `${(w - pad).toFixed(1)},${h - pad}`,
  ].join(' ')

  const last = pts[pts.length - 1].split(',')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polygon points={fillPts} fill={color} opacity="0.07" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={parseFloat(last[0])} cy={parseFloat(last[1])} r="3" fill={color} />
    </svg>
  )
}

function BarChart({ data, labels, color = '#d4a843' }: { data: number[], labels: string[], color?: string }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((v, i) => {
        const heightPct = (v / max) * 100
        const isLast = i === data.length - 1
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full transition-all duration-300"
              style={{
                height: `${heightPct}%`,
                backgroundColor: isLast ? color : `${color}40`,
                minHeight: '4px',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function Portfolio() {
  const totalValue = portfolio.reduce((s, p) => s + p.currentValue, 0)
  const totalNOI = portfolio.reduce((s, p) => s + p.currentNOI, 0)
  const totalPurchase = portfolio.reduce((s, p) => s + p.purchasePrice, 0)
  const totalUnrealizedGain = totalValue - totalPurchase
  const totalUnits = portfolio.reduce((s, p) => s + p.unitCount, 0)

  return (
    <>
      <Head>
        <title>Portfolio — YEM Acquisitions</title>
        <meta name="description" content="YEM Acquisitions owned portfolio of self-storage facilities." />
      </Head>

      {/* Hero */}
      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Portfolio</div>
        <h1 className="display-heading text-6xl md:text-8xl max-w-3xl mb-8">
          Owned &amp; operated.<br />
          <em className="text-gold">Performing.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          YEM Acquisitions&apos; current portfolio of owned self-storage facilities.
          Each property was acquired through our distress sourcing pipeline and stabilized through systematic operational improvements.
        </p>
      </section>

      {/* Portfolio Summary */}
      <section className="border-b border-dark-border bg-dark-surface py-10">
        <div className="section-container">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Properties Owned', value: `${portfolio.length}` },
              { label: 'Total Units', value: totalUnits.toLocaleString() },
              { label: 'Portfolio Value', value: `$${(totalValue / 1000000).toFixed(1)}M` },
              { label: 'Annual NOI', value: `$${Math.round(totalNOI / 1000)}K` },
              { label: 'Unrealized Gain', value: `+$${(totalUnrealizedGain / 1000000).toFixed(1)}M` },
            ].map(s => (
              <div key={s.label} className="border border-dark-border bg-dark-bg p-5">
                <div className="font-serif text-3xl font-light text-gold mb-1">{s.value}</div>
                <div className="text-dark-muted text-xs uppercase tracking-widest font-sans">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Properties */}
      <section className="py-20">
        <div className="section-container space-y-10">
          {portfolio.map((prop, i) => {
            const appreciation = ((prop.currentValue - prop.purchasePrice) / prop.purchasePrice * 100).toFixed(0)
            const noiGrowth = ((prop.currentNOI - prop.purchaseNOI) / prop.purchaseNOI * 100).toFixed(0)
            const occLift = prop.occupancy - prop.purchaseOccupancy

            return (
              <div key={prop.id} className="border border-dark-border">
                {/* Property header */}
                <div className="border-b border-dark-border px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-surface">
                  <div>
                    <div className="flex items-center gap-4 mb-1">
                      <span className="font-mono text-xs text-dark-muted">{String(i + 1).padStart(2, '0')}</span>
                      <h2 className="font-serif text-3xl font-light text-[#1B2B5E]">{prop.name}</h2>
                      <span className="tag tag-muted">{prop.acquiredDate}</span>
                    </div>
                    <p className="text-dark-muted text-sm ml-8">{prop.address}, {prop.city}, {prop.state} {prop.zipCode}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-green-600 font-mono font-bold text-xl">+{appreciation}%</div>
                    <div className="text-dark-muted text-xs uppercase tracking-widest">value appreciation</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-dark-border">

                  {/* Financial snapshot */}
                  <div className="p-8">
                    <div className="section-label-sm mb-5">Financial Snapshot</div>
                    <div className="space-y-3 text-sm">
                      {[
                        ['Purchase Price', `$${(prop.purchasePrice / 1000000).toFixed(1)}M`, false],
                        ['Current Value', `$${(prop.currentValue / 1000000).toFixed(1)}M`, true],
                        ['Unrealized Gain', `+$${((prop.currentValue - prop.purchasePrice) / 1000).toFixed(0)}K`, true],
                        ['NOI at Purchase', `$${(prop.purchaseNOI / 1000).toFixed(0)}K`, false],
                        ['Current NOI', `$${(prop.currentNOI / 1000).toFixed(0)}K (+${noiGrowth}%)`, true],
                        ['Cap at Purchase', `${prop.capAtPurchase}%`, false],
                        ['Units / Year Built', `${prop.unitCount} / ${prop.yearBuilt}`, false],
                      ].map(([label, value, highlight]) => (
                        <div key={label as string} className="flex justify-between items-center border-b border-dark-border pb-3 last:border-0 last:pb-0">
                          <span className="text-dark-muted text-xs uppercase tracking-widest">{label as string}</span>
                          <span className={`font-mono text-sm ${highlight ? 'text-gold' : 'text-[#1a1a18]'}`}>{value as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Operations */}
                  <div className="p-8">
                    <div className="section-label-sm mb-5">Operations</div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[
                        { label: 'Occupancy', current: `${prop.occupancy}%`, change: `+${occLift}pp`, good: true },
                        { label: 'NOI Growth', current: `+${noiGrowth}%`, change: 'since acq.', good: true },
                        { label: 'Value Lift', current: `+${appreciation}%`, change: 'unrealized', good: true },
                      ].map(m => (
                        <div key={m.label} className="border border-dark-border bg-dark-bg p-3 text-center">
                          <div className="text-xs uppercase tracking-widest text-dark-muted mb-1">{m.label}</div>
                          <div className="font-serif text-xl font-light text-gold leading-tight">{m.current}</div>
                          <div className="text-green-600 text-xs mt-0.5">{m.change}</div>
                        </div>
                      ))}
                    </div>

                    <div className="section-label-sm mb-3">Value-Add Executed</div>
                    <ul className="space-y-2">
                      {prop.valueAdd.map((item, j) => (
                        <li key={j} className="flex gap-2.5 text-xs text-dark-muted leading-relaxed">
                          <span className="text-gold flex-shrink-0">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* NOI Chart */}
                  <div className="p-8">
                    <div className="section-label-sm mb-5">NOI Trend</div>

                    <div className="mb-6">
                      <div className="text-dark-muted text-xs uppercase tracking-widest mb-1">Quarterly NOI ($K)</div>
                      <div className="font-serif text-4xl font-light text-gold">
                        ${Math.round(prop.currentNOI / 1000)}K
                      </div>
                      <div className="text-green-600 text-xs mt-0.5">current run rate</div>
                    </div>

                    <div className="mb-3">
                      <Sparkline data={prop.noiHistory} w={260} h={60} />
                    </div>

                    <div className="mb-5">
                      <BarChart data={prop.noiHistory} labels={prop.historyLabels} />
                    </div>

                    {/* Labels */}
                    <div className="flex justify-between mt-1">
                      <span className="text-dark-muted text-[9px] font-sans">{prop.historyLabels[0]}</span>
                      <span className="text-dark-muted text-[9px] font-sans">{prop.historyLabels[prop.historyLabels.length - 1]}</span>
                    </div>

                    <div className="mt-5 pt-5 border-t border-dark-border grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-dark-muted uppercase tracking-widest mb-1">Acq. Date</div>
                        <div className="text-[#1a1a18]">{prop.acquiredDate}</div>
                      </div>
                      <div>
                        <div className="text-dark-muted uppercase tracking-widest mb-1">Acq. Price</div>
                        <div className="text-[#1a1a18]">${(prop.purchasePrice / 1000000).toFixed(1)}M</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Investor CTA */}
      <section className="py-20 bg-dark-surface border-t border-dark-border">
        <div className="section-container">
          <div className="max-w-2xl">
            <div className="section-label">Co-Investment</div>
            <h2 className="display-heading text-5xl mb-6">Invest alongside YEM Acquisitions.</h2>
            <p className="text-dark-muted leading-relaxed mb-10">
              Accredited investors can access co-investment opportunities in future acquisitions.
              The same sourcing process, underwriting standards, and operational playbook — on a deal-by-deal basis.
            </p>
            <div className="flex gap-4">
              <a href="/invest" className="btn-gold">Investor Inquiry</a>
              <a href="/deals" className="btn-gold-outline">View Available Deals</a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
