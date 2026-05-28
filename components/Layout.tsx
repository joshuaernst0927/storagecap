import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const tickerItems = [
  '8 Properties in Pipeline',
  '3 High-Motivation Targets',
  'Avg Motivation Score: 72',
  '6 Markets Tracked',
  '1 Active Conversation',
  'Sun Belt Focus',
  'Off-Market Acquisitions Only',
]

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()

  const navLinks = [
    { href: '/about', label: 'About', dot: false },
    { href: '/pipeline', label: 'Pipeline', dot: true },
    { href: '/deals', label: 'Deals', dot: false },
    { href: '/portfolio', label: 'Portfolio', dot: false },
    { href: '/acquisitions', label: 'Acquisitions', dot: false },
    { href: '/invest', label: 'Investors', dot: false },
    { href: '/analyze', label: 'Analyzer', dot: false },
    { href: '/upload-deal', label: 'Upload Deal', dot: false },
  ]

  const isPipeline = router.pathname === '/pipeline'

  return (
    <div className="min-h-screen bg-dark-bg text-[#1a1a18] font-sans">
      {/* Ticker bar */}
      <div className="overflow-hidden border-b border-dark-border bg-dark-surface h-8 flex items-center">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="flex items-center gap-6 px-8 uppercase tracking-widest text-dark-muted whitespace-nowrap" style={{ fontSize: '0.7rem' }}>
              <span className="w-2 h-2 bg-gold/60 rounded-full flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <nav
        className="sticky top-0 z-50 bg-white border-b border-dark-border"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between" style={{ height: '154px' }}>

            <Link href="/" className="flex-shrink-0 hover:opacity-80 transition-opacity duration-200" style={{ padding: '8px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Logo.png"
                alt="YEM Acquisitions"
                className="site-logo"
              />
            </Link>

            <div className="hidden md:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${router.pathname === link.href ? '!text-[#1a1a18] !font-bold' : ''} ${link.dot ? '!text-gold hover:!text-gold/80' : ''}`}
                >
                  {link.label}
                  {link.dot && (
                    <span className="ml-1.5 inline-block w-2.5 h-2.5 bg-gold rounded-full align-middle" />
                  )}
                </Link>
              ))}
              <Link href="/submit-deal" className="btn-gold-sm">
                Submit Deal
              </Link>
            </div>

            <button
              className="md:hidden text-dark-muted hover:text-[#1a1a18] transition-colors p-1"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <div className="w-5 flex flex-col gap-1.5">
                <span className={`h-px bg-current transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`h-px bg-current transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
                <span className={`h-px bg-current transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-dark-border bg-dark-surface">
            <div className="px-6 py-6 flex flex-col gap-5">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="nav-link" onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <Link href="/submit-deal" className="btn-gold text-center mt-2" onClick={() => setMobileOpen(false)}>
                Submit Deal
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main>{children}</main>

      {!isPipeline && (
        <footer style={{ backgroundColor: '#1B2B5E' }} className="mt-24 py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="md:col-span-2">
                <div className="mb-5">
                  <div style={{ backgroundColor: 'white', padding: '8px 14px', borderRadius: '6px', display: 'inline-block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo" />
                  </div>
                </div>
                <p className="leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                  Private acquisition firm focused exclusively on self-storage real estate.
                  Systematic sourcing. Institutional execution.
                </p>
              </div>
              <div>
                <div className="section-label">Platform</div>
                <div className="flex flex-col gap-3">
                  <Link href="/pipeline" className="footer-link">Acquisition Pipeline</Link>
                  <Link href="/analyze" className="footer-link">Property Analyzer</Link>
                  <Link href="/acquisitions" className="footer-link">Acquisitions</Link>
                  <Link href="/education" className="footer-link">Education</Link>
                </div>
              </div>
              <div>
                <div className="section-label">Connect</div>
                <div className="flex flex-col gap-3">
                  <Link href="/submit-deal" className="footer-link">Submit a Deal</Link>
                  <Link href="/invest" className="footer-link">Investor Relations</Link>
                  <a href="mailto:joshuaernst@gmail.com" className="footer-link">
                    joshuaernst@gmail.com
                  </a>
                </div>
              </div>
            </div>
            <div className="mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>© 2024 YEM Acquisitions LLC. All rights reserved.</p>
              <p className="tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Private &amp; Confidential</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
