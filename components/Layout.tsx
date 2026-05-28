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

type NavItem =
  | { href: string; label: string; dot?: boolean; dropdown?: never }
  | { label: string; dropdown: { href: string; label: string }[]; href?: never; dot?: never }

const navItems: NavItem[] = [
  { href: '/about', label: 'About' },
  {
    label: 'Acquisitions',
    dropdown: [
      { href: '/acquisitions', label: 'Our Criteria' },
      { href: '/submit-deal', label: 'Sell Your Facility' },
      { href: '/upload-deal', label: 'Import Deal' },
    ],
  },
  { href: '/pipeline', label: 'Pipeline', dot: true },
  { href: '/deals', label: 'Deals' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/education', label: 'Education' },
  {
    label: 'Investors',
    dropdown: [
      { href: '/invest', label: 'Invest With Us' },
      { href: '/submit-deal', label: 'Investor Deal Submission' },
    ],
  },
  { href: '/underwrite', label: 'Underwrite' },
]

function DropdownMenu({ item }: { item: Extract<NavItem, { dropdown: unknown }> }) {
  const router = useRouter()
  const isActive = item.dropdown.some(d => router.pathname === d.href)

  return (
    <div className="relative group">
      <button
        className={`nav-link flex items-center gap-1 select-none ${isActive ? '!text-[#1a1a18] !font-bold' : ''}`}
      >
        {item.label}
        <svg
          className="w-3 h-3 opacity-40 transition-transform duration-150 group-hover:rotate-180 mt-px"
          fill="none" viewBox="0 0 10 6" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown panel */}
      <div
        className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 invisible opacity-0 group-hover:visible group-hover:opacity-100
          transition-all duration-150 bg-white border border-dark-border shadow-lg min-w-[200px] z-50"
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
      >
        {/* Arrow notch */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-2 overflow-hidden">
          <div className="w-3 h-3 bg-white border-l border-t border-dark-border rotate-45 translate-y-1.5 mx-auto" />
        </div>
        {item.dropdown.map((d, i) => (
          <Link
            key={`${d.href}-${i}`}
            href={d.href}
            className={`block px-5 py-3 text-xs uppercase tracking-widest font-sans transition-colors duration-100
              border-b border-dark-border last:border-b-0
              ${router.pathname === d.href
                ? 'text-gold bg-dark-bg font-bold'
                : 'text-[#1B2B5E] hover:text-gold hover:bg-dark-bg'
              }`}
          >
            {d.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
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
              <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo" />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-7">
              {navItems.map((item, i) =>
                item.dropdown ? (
                  <DropdownMenu key={item.label} item={item} />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href!}
                    className={`nav-link ${router.pathname === item.href ? '!text-[#1a1a18] !font-bold' : ''} ${item.dot ? '!text-gold hover:!text-gold/80' : ''}`}
                  >
                    {item.label}
                    {item.dot && (
                      <span className="ml-1.5 inline-block w-2.5 h-2.5 bg-gold rounded-full align-middle" />
                    )}
                  </Link>
                )
              )}
            </div>

            {/* Mobile hamburger */}
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

        {/* Mobile menu — flattens dropdowns */}
        {mobileOpen && (
          <div className="md:hidden border-t border-dark-border bg-dark-surface">
            <div className="px-6 py-6 flex flex-col gap-4">
              {navItems.map((item) =>
                item.dropdown ? (
                  <div key={item.label}>
                    <div className="text-[0.6rem] uppercase tracking-widest text-dark-muted mb-2 mt-1">{item.label}</div>
                    {item.dropdown.map((d, i) => (
                      <Link
                        key={`${d.href}-${i}`}
                        href={d.href}
                        className="block pl-3 py-1.5 nav-link text-sm"
                        onClick={() => setMobileOpen(false)}
                      >
                        {d.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href!}
                    className={`nav-link ${item.dot ? '!text-gold' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                    {item.dot && <span className="ml-1.5 inline-block w-2 h-2 bg-gold rounded-full align-middle" />}
                  </Link>
                )
              )}
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
                  <Link href="/underwrite" className="footer-link">Underwrite</Link>
                  <Link href="/acquisitions" className="footer-link">Acquisitions</Link>
                  <Link href="/education" className="footer-link">Education</Link>
                </div>
              </div>
              <div>
                <div className="section-label">Connect</div>
                <div className="flex flex-col gap-3">
                  <Link href="/submit-deal" className="footer-link">Sell Your Facility</Link>
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
