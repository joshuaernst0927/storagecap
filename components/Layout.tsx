import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { isAuthenticated, clearAuth } from '@/lib/auth'
import { ChangePasswordForm } from '@/components/AuthGate'

const tickerItems = [
  '8 Properties in Pipeline',
  '3 High-Motivation Targets',
  'Avg Motivation Score: 72',
  '6 Markets Tracked',
  '1 Active Conversation',
  'Sun Belt Focus',
  'Off-Market Acquisitions Only',
  '15–20% Target IRR',
]

type NavItem =
  | { href: string; label: string; dot?: boolean; dropdown?: never }
  | { label: string; dropdown: { href: string; label: string }[]; href?: never; dot?: never }

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  {
    label: 'About Us',
    dropdown: [
      { href: '/about', label: 'About YEM' },
      { href: '/acquisitions', label: 'Our Criteria' },
    ],
  },
  { href: '/leads', label: 'Leads', dot: true },
  {
    label: 'Acquisitions',
    dropdown: [
      { href: '/submit-deal', label: 'Sell Your Facility' },
      { href: '/upload-deal', label: 'Import Deal' },
    ],
  },
  { href: '/pipeline', label: 'Pipeline', dot: true },
  { href: '/deals', label: 'Deals' },
  { href: '/portfolio', label: 'Portfolio' },
  {
    label: 'Investors',
    dropdown: [
      { href: '/invest', label: 'Invest With Us' },
      { href: '/investor-deal-access', label: 'Deal Access Request' },
    ],
  },
  {
    label: 'Underwrite',
    dropdown: [
      { href: '/underwrite', label: 'Underwrite Deal' },
      { href: '/generate-loi', label: 'Generate LOI' },
    ],
  },
]

function DropdownMenu({ item }: { item: Extract<NavItem, { dropdown: unknown }> }) {
  const router = useRouter()
  const isActive = item.dropdown.some(d => router.pathname === d.href)

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1 select-none nav-link"
        style={{ color: isActive ? '#D4A843' : undefined }}
      >
        {item.label}
        <svg className="w-3 h-3 opacity-40 transition-transform duration-150 group-hover:rotate-180 mt-px"
          fill="none" viewBox="0 0 10 6" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 z-50"
        style={{ background: '#FFFFFF', border: '1px solid #E0DDD4', minWidth: '200px', boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-2 overflow-hidden">
          <div className="w-3 h-3 bg-white border-l border-t border-dark-border rotate-45 translate-y-1.5 mx-auto" />
        </div>
        {item.dropdown.map((d, i) => (
          <Link key={`${d.href}-${i}`} href={d.href}
            className="block px-5 py-3 font-sans uppercase tracking-widest transition-colors duration-100 border-b border-dark-border last:border-b-0"
            style={{ fontSize: '0.75rem', color: router.pathname === d.href ? '#D4A843' : '#1B2B5E' }}
          >
            {d.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-surface border border-dark-border p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="section-label">Change Password</div>
            <p className="text-dark-muted text-xs mt-1">Set a new platform password.</p>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-[#1a1a18] transition-colors text-lg leading-none">✕</button>
        </div>
        <ChangePasswordForm onSuccess={onClose} />
      </div>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const router = useRouter()
  const isPipeline = router.pathname === '/pipeline'

  useEffect(() => {
    setAuthed(isAuthenticated())
  }, [router.pathname])

  const handleLogout = () => {
    clearAuth()
    setAuthed(false)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-white text-[#1a1a18] font-sans">
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {/* Ticker */}
      <div className="overflow-hidden" style={{ background: '#D4A843', height: '32px', display: 'flex', alignItems: 'center' }}>
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="font-sans uppercase whitespace-nowrap"
              style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#1B2B5E', fontWeight: 600, padding: '0 2.5rem' }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-dark-border" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="flex items-center justify-between" style={{ height: '72px' }}>

            <Link href="/" className="flex-shrink-0 hover:opacity-80 transition-opacity duration-200" style={{ padding: '8px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo" />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) =>
                item.dropdown ? (
                  <DropdownMenu key={item.label} item={item} />
                ) : (
                  <Link key={item.href} href={item.href!}
                    className={`nav-link ${router.pathname === item.href ? '!text-gold !font-semibold' : ''} ${item.dot ? '!text-gold' : ''}`}
                  >
                    {item.label}
                    {item.dot && <span className="ml-1.5 inline-block w-2.5 h-2.5 bg-gold rounded-full align-middle" />}
                  </Link>
                )
              )}

              {authed && (
                <div className="flex items-center gap-3 pl-5 ml-2 border-l border-dark-border">
                  <button onClick={() => setShowChangePw(true)}
                    className="text-dark-muted text-[0.65rem] uppercase tracking-widest hover:text-[#1a1a18] transition-colors">
                    Password
                  </button>
                  <button onClick={handleLogout}
                    className="text-dark-muted text-[0.65rem] uppercase tracking-widest hover:text-[#1a1a18] transition-colors">
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden text-dark-muted hover:text-[#1a1a18] transition-colors p-1"
              onClick={() => setMobileOpen(!mobileOpen)}>
              <div className="w-5 flex flex-col gap-1.5">
                <span className={`h-px bg-current transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`h-px bg-current transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
                <span className={`h-px bg-current transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-dark-border bg-dark-surface">
            <div className="px-6 py-6 flex flex-col gap-4">
              {navItems.map((item) =>
                item.dropdown ? (
                  <div key={item.label}>
                    <div className="text-[0.6rem] uppercase tracking-widest text-dark-muted mb-2 mt-1">{item.label}</div>
                    {item.dropdown.map((d, i) => (
                      <Link key={`${d.href}-${i}`} href={d.href}
                        className="block pl-3 py-1.5 nav-link text-sm"
                        onClick={() => setMobileOpen(false)}>
                        {d.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link key={item.href} href={item.href!}
                    className={`nav-link ${item.dot ? '!text-gold' : ''}`}
                    onClick={() => setMobileOpen(false)}>
                    {item.label}
                    {item.dot && <span className="ml-1.5 inline-block w-2 h-2 bg-gold rounded-full align-middle" />}
                  </Link>
                )
              )}
              {authed && (
                <div className="flex gap-4 pt-2 border-t border-dark-border mt-1">
                  <button onClick={() => { setMobileOpen(false); setShowChangePw(true) }}
                    className="text-dark-muted text-xs uppercase tracking-widest">Change Password</button>
                  <button onClick={handleLogout}
                    className="text-dark-muted text-xs uppercase tracking-widest">Logout</button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <main>{children}</main>

      {!isPipeline && (
        <footer style={{ backgroundColor: '#1B2B5E' }} className="mt-0 py-14">
          <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
              <div className="md:col-span-2">
                <div className="mb-4" style={{ background: 'white', display: 'inline-block', padding: '8px 14px', borderRadius: '4px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo" />
                </div>
                <p className="leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                  Private acquisition firm focused exclusively on self-storage real estate. Systematic sourcing. Institutional execution.
                </p>
              </div>
              <div>
                <div className="section-label">Platform</div>
                <div className="flex flex-col gap-3">
                  <Link href="/" className="footer-link">Home</Link>
                  <Link href="/pipeline" className="footer-link">Acquisition Pipeline</Link>
                  <Link href="/underwrite" className="footer-link">Underwrite</Link>
                  <Link href="/acquisitions" className="footer-link">Acquisitions</Link>
                </div>
              </div>
              <div>
                <div className="section-label">Connect</div>
                <div className="flex flex-col gap-3">
                  <Link href="/submit-deal" className="footer-link">Sell Your Facility</Link>
                  <Link href="/invest" className="footer-link">Investor Relations</Link>
                  <a href="mailto:joshuaernst@gmail.com" className="footer-link">joshuaernst@gmail.com</a>
                </div>
              </div>
            </div>
            <div className="mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                © 2025 YEM Acquisitions LLC · Woodmere, New York · joshuaernst@gmail.com · 516.305.2484
              </p>
              <p className="uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Private &amp; Confidential</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
