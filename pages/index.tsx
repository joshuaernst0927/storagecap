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
  { href: '/about', label: 'About' },
  { href: '/leads', label: 'Leads', dot: true },
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
        className="flex items-center gap-1 select-none font-sans uppercase tracking-widest transition-colors duration-200"
        style={{
          fontSize: '0.72rem',
          letterSpacing: '0.1em',
          color: isActive ? '#c9a84c' : '#b0aa9f',
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {item.label}
        <svg
          className="w-2.5 h-2.5 opacity-50 transition-transform duration-150 group-hover:rotate-180 mt-px"
          fill="none" viewBox="0 0 10 6" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className="absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 z-50"
        style={{
          background: '#242424',
          border: '1px solid #3a3a3a',
          minWidth: '190px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-2 overflow-hidden">
          <div style={{ width: '12px', height: '12px', background: '#242424', border: '1px solid #3a3a3a', transform: 'rotate(45deg) translateY(6px)', margin: '0 auto' }} />
        </div>
        {item.dropdown.map((d, i) => (
          <Link
            key={`${d.href}-${i}`}
            href={d.href}
            className="block font-sans uppercase tracking-widest transition-colors duration-100"
            style={{
              padding: '12px 20px',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              borderBottom: i < item.dropdown.length - 1 ? '1px solid #3a3a3a' : 'none',
              color: router.pathname === d.href ? '#c9a84c' : '#b0aa9f',
              backgroundColor: router.pathname === d.href ? '#2e2e2e' : 'transparent',
            }}
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#242424', border: '1px solid #3a3a3a', padding: '2rem', width: '100%', maxWidth: '380px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: '0.7rem', color: '#c9a84c', letterSpacing: '0.14em' }}>Change Password</div>
            <p style={{ color: '#888880', fontSize: '0.8rem', marginTop: '4px' }}>Set a new platform password.</p>
          </div>
          <button onClick={onClose} style={{ color: '#888880', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
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
    <div className="min-h-screen font-sans" style={{ background: '#1a1a1a', color: '#f5f0e8' }}>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {/* Ticker */}
      <div className="overflow-hidden" style={{ background: '#c9a84c', height: '32px', display: 'flex', alignItems: 'center' }}>
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span
              key={i}
              className="font-sans uppercase whitespace-nowrap"
              style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#1a1a1a', fontWeight: 500, padding: '0 2.5rem' }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav
        className="sticky top-0 z-50"
        style={{ background: '#1a1a1a', borderBottom: '1px solid #3a3a3a' }}
      >
        <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
          <div className="flex items-center justify-between" style={{ height: '68px' }}>

            <Link href="/" className="flex-shrink-0 hover:opacity-80 transition-opacity duration-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo" style={{ filter: 'brightness(0) invert(1)' }} />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-7">
              {navItems.map((item) =>
                item.dropdown ? (
                  <DropdownMenu key={item.label} item={item} />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href!}
                    className="font-sans uppercase tracking-widest transition-colors duration-200"
                    style={{
                      fontSize: '0.72rem',
                      letterSpacing: '0.1em',
                      color: router.pathname === item.href ? '#c9a84c' : item.dot ? '#c9a84c' : '#b0aa9f',
                      fontWeight: router.pathname === item.href ? 600 : 400,
                    }}
                  >
                    {item.label}
                    {item.dot && (
                      <span className="ml-1.5 inline-block w-2 h-2 rounded-full align-middle" style={{ background: '#c9a84c' }} />
                    )}
                  </Link>
                )
              )}

              {authed && (
                <div className="flex items-center gap-3 pl-5 ml-2" style={{ borderLeft: '1px solid #3a3a3a' }}>
                  <button
                    onClick={() => setShowChangePw(true)}
                    className="font-sans uppercase tracking-widest transition-colors"
                    style={{ fontSize: '0.65rem', color: '#888880' }}
                  >
                    Password
                  </button>
                  <button
                    onClick={handleLogout}
                    className="font-sans uppercase tracking-widest transition-colors"
                    style={{ fontSize: '0.65rem', color: '#888880' }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1 transition-colors"
              style={{ color: '#b0aa9f' }}
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

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ background: '#242424', borderTop: '1px solid #3a3a3a' }}>
            <div className="px-6 py-6 flex flex-col gap-4">
              {navItems.map((item) =>
                item.dropdown ? (
                  <div key={item.label}>
                    <div className="font-sans uppercase tracking-widest mb-2" style={{ fontSize: '0.6rem', color: '#888880', letterSpacing: '0.14em' }}>{item.label}</div>
                    {item.dropdown.map((d, i) => (
                      <Link
                        key={`${d.href}-${i}`}
                        href={d.href}
                        className="block pl-3 py-1.5 font-sans uppercase tracking-widest"
                        style={{ fontSize: '0.72rem', color: '#b0aa9f' }}
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
                    className="font-sans uppercase tracking-widest"
                    style={{ fontSize: '0.72rem', color: item.dot ? '#c9a84c' : '#b0aa9f' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                    {item.dot && <span className="ml-1.5 inline-block w-2 h-2 rounded-full align-middle" style={{ background: '#c9a84c' }} />}
                  </Link>
                )
              )}
              {authed && (
                <div className="flex gap-4 pt-2" style={{ borderTop: '1px solid #3a3a3a' }}>
                  <button onClick={() => { setMobileOpen(false); setShowChangePw(true) }} className="font-sans uppercase tracking-widest" style={{ fontSize: '0.65rem', color: '#888880' }}>Change Password</button>
                  <button onClick={handleLogout} className="font-sans uppercase tracking-widest" style={{ fontSize: '0.65rem', color: '#888880' }}>Logout</button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <main>{children}</main>

      {!isPipeline && (
        <footer style={{ background: '#111111', borderTop: '1px solid #3a3a3a' }} className="py-16 mt-0">
          <div className="mx-auto px-6 lg:px-12" style={{ maxWidth: '1100px' }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="md:col-span-2">
                <div className="mb-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo" style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
                </div>
                <p className="leading-relaxed max-w-xs" style={{ color: '#888880', fontSize: '0.85rem' }}>
                  Private acquisition firm focused exclusively on self-storage real estate.
                  Systematic sourcing. Institutional execution.
                </p>
              </div>
              <div>
                <div className="font-sans uppercase tracking-widest mb-4" style={{ fontSize: '0.7rem', color: '#c9a84c', letterSpacing: '0.14em' }}>Platform</div>
                <div className="flex flex-col gap-3">
                  {[
                    { href: '/pipeline', label: 'Acquisition Pipeline' },
                    { href: '/underwrite', label: 'Underwrite' },
                    { href: '/acquisitions', label: 'Acquisitions' },
                    { href: '/education', label: 'Education' },
                  ].map(l => (
                    <Link key={l.href} href={l.href} className="transition-colors duration-200" style={{ color: '#888880', fontSize: '0.85rem' }}>{l.label}</Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-sans uppercase tracking-widest mb-4" style={{ fontSize: '0.7rem', color: '#c9a84c', letterSpacing: '0.14em' }}>Connect</div>
                <div className="flex flex-col gap-3">
                  <Link href="/submit-deal" className="transition-colors duration-200" style={{ color: '#888880', fontSize: '0.85rem' }}>Sell Your Facility</Link>
                  <Link href="/invest" className="transition-colors duration-200" style={{ color: '#888880', fontSize: '0.85rem' }}>Investor Relations</Link>
                  <a href="mailto:joshuaernst@gmail.com" className="transition-colors duration-200" style={{ color: '#888880', fontSize: '0.85rem' }}>joshuaernst@gmail.com</a>
                </div>
              </div>
            </div>
            <div className="mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderTop: '1px solid #3a3a3a' }}>
              <p style={{ color: '#555550', fontSize: '0.8rem' }}>
                © 2025 YEM Acquisitions LLC · Woodmere, New York · joshuaernst@gmail.com · 516.305.2484
              </p>
              <p className="uppercase tracking-widest" style={{ color: '#555550', fontSize: '0.75rem' }}>Private &amp; Confidential</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
