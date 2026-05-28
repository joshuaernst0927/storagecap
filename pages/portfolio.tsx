import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { loadSavedProperties } from '@/lib/pipelineStore'
import type { PipelineProperty } from '@/lib/pipelineData'
import AuthGate from '@/components/AuthGate'

export default function Portfolio() {
  const [closedDeals, setClosedDeals] = useState<PipelineProperty[]>([])

  useEffect(() => {
    const all = loadSavedProperties()
    setClosedDeals(all.filter(p => p.stage === 'closed' && p.portfolioEntry))
  }, [])

  const totalPurchase = closedDeals.reduce((s, p) => s + (p.portfolioEntry?.finalPurchasePrice ?? 0), 0)
  const totalEquity = closedDeals.reduce((s, p) => s + (p.portfolioEntry?.initialEquity ?? 0), 0)
  const totalDebt = closedDeals.reduce((s, p) => s + (p.portfolioEntry?.debtAmount ?? 0), 0)
  const totalUnits = closedDeals.reduce((s, p) => s + p.unitCount, 0)

  return (
    <AuthGate>
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
          Each property was acquired through our distress sourcing pipeline.
        </p>
      </section>

      {closedDeals.length > 0 && (
        <section className="border-b border-dark-border bg-dark-surface py-10">
          <div className="section-container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Properties Owned', value: `${closedDeals.length}` },
                { label: 'Total Units', value: totalUnits.toLocaleString() },
                { label: 'Total Invested', value: `$${(totalPurchase / 1000000).toFixed(1)}M` },
                { label: 'Total Equity In', value: `$${(totalEquity / 1000000).toFixed(1)}M` },
              ].map(s => (
                <div key={s.label} className="border border-dark-border bg-dark-bg p-5">
                  <div className="font-serif text-3xl font-light text-gold mb-1">{s.value}</div>
                  <div className="text-dark-muted text-xs uppercase tracking-widest font-sans">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Properties */}
      <section className="py-20">
        <div className="section-container space-y-10">
          {closedDeals.length === 0 ? (
            <div className="py-24 text-center text-dark-muted border border-dark-border bg-dark-surface">
              <p className="font-serif text-3xl font-light mb-3 text-[#1B2B5E]">No closed deals yet.</p>
              <p className="text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                When you mark a pipeline deal as &ldquo;Closed,&rdquo; it will appear here with full acquisition details.
              </p>
              <Link href="/pipeline" className="btn-gold">Go to Pipeline</Link>
            </div>
          ) : (
            closedDeals.map((prop, i) => {
              const pe = prop.portfolioEntry!
              const ltv = pe.debtAmount && pe.finalPurchasePrice
                ? ((pe.debtAmount / pe.finalPurchasePrice) * 100).toFixed(0)
                : null
              const capRate = prop.noi && pe.finalPurchasePrice
                ? ((prop.noi / pe.finalPurchasePrice) * 100).toFixed(2)
                : null
              const ppu = pe.finalPurchasePrice / prop.unitCount

              return (
                <div key={prop.id} className="border border-dark-border">
                  {/* Header */}
                  <div className="border-b border-dark-border px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-surface">
                    <div>
                      <div className="flex items-center gap-4 mb-1">
                        <span className="font-mono text-xs text-dark-muted">{String(i + 1).padStart(2, '0')}</span>
                        <h2 className="font-serif text-3xl font-light text-[#1B2B5E]">{prop.facilityName}</h2>
                        <span className="tag bg-emerald-50 text-emerald-700 border-emerald-500/40">Closed {pe.closeDate}</span>
                      </div>
                      <p className="text-dark-muted text-sm ml-8">{prop.address}, {prop.city}, {prop.state} {prop.zipCode}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-gold font-mono font-bold text-xl">${(pe.finalPurchasePrice / 1000000).toFixed(2)}M</div>
                      <div className="text-dark-muted text-xs uppercase tracking-widest">purchase price</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-dark-border">

                    {/* Acquisition details */}
                    <div className="p-8">
                      <div className="section-label-sm mb-5">Acquisition Details</div>
                      <div className="space-y-3 text-sm">
                        {[
                          ['Purchase Price', `$${(pe.finalPurchasePrice / 1000000).toFixed(2)}M`, true],
                          ['Equity Invested', `$${(pe.initialEquity / 1000).toFixed(0)}K`, false],
                          ['Debt / Loan', pe.debtAmount ? `$${(pe.debtAmount / 1000).toFixed(0)}K` : '—', false],
                          ['LTV', ltv ? `${ltv}%` : '—', false],
                          ['Lender', pe.lenderName || '—', false],
                          ['Close Date', pe.closeDate, false],
                        ].map(([label, value, highlight]) => (
                          <div key={label as string} className="flex justify-between items-center border-b border-dark-border pb-3 last:border-0 last:pb-0">
                            <span className="text-dark-muted text-xs uppercase tracking-widest">{label as string}</span>
                            <span className={`font-mono text-sm ${highlight ? 'text-gold' : 'text-[#1a1a18]'}`}>{value as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Property details */}
                    <div className="p-8">
                      <div className="section-label-sm mb-5">Property Details</div>
                      <div className="space-y-3 text-sm">
                        {[
                          ['Units', prop.unitCount.toString(), false],
                          ['Year Built', prop.yearBuilt.toString(), false],
                          ['Occupancy at Acq.', `${prop.occupancy}%`, false],
                          ['NOI at Acq.', prop.noi ? `$${(prop.noi / 1000).toFixed(0)}K` : '—', false],
                          ['Cap Rate (Acq.)', capRate ? `${capRate}%` : '—', false],
                          ['Price / Unit', `$${Math.round(ppu).toLocaleString()}`, false],
                        ].map(([label, value, highlight]) => (
                          <div key={label as string} className="flex justify-between items-center border-b border-dark-border pb-3 last:border-0 last:pb-0">
                            <span className="text-dark-muted text-xs uppercase tracking-widest">{label as string}</span>
                            <span className={`font-mono text-sm ${highlight ? 'text-gold' : 'text-[#1a1a18]'}`}>{value as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sourcing / score */}
                    <div className="p-8">
                      <div className="section-label-sm mb-5">Sourcing &amp; Score</div>
                      <div className="space-y-3 text-sm">
                        {[
                          ['Source', prop.source, false],
                          ['Motivation Score', `${prop.motivationScore} / 175`, true],
                          ['Owner', prop.ownerName, false],
                          ['Entity', prop.ownerEntity || '—', false],
                          ['Added', prop.addedDate, false],
                        ].map(([label, value, highlight]) => (
                          <div key={label as string} className="flex justify-between items-center border-b border-dark-border pb-3 last:border-0 last:pb-0">
                            <span className="text-dark-muted text-xs uppercase tracking-widest">{label as string}</span>
                            <span className={`font-mono text-sm ${highlight ? 'text-gold' : 'text-[#1a1a18]'}`}>{value as string}</span>
                          </div>
                        ))}
                      </div>
                      {prop.scoreExplanation && (
                        <div className="mt-4 pt-4 border-t border-dark-border">
                          <div className="text-dark-muted text-xs uppercase tracking-widest mb-2">Acquisition Thesis</div>
                          <p className="text-dark-muted text-xs leading-relaxed italic">{prop.scoreExplanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
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
    </AuthGate>
  )
}
