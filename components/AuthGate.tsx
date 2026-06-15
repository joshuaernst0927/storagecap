import { useState, useEffect, ReactNode, FormEvent } from 'react'
import { isAuthenticated, verifyPassword, clearAuth } from '@/lib/auth'

// ─── Change Password Form ─────────────────────────────────────────────────────
// Password changes now require contacting admin — client-side password storage
// has been removed for security. This form is kept for UI continuity but
// informs the user that password changes are managed server-side.

export function ChangePasswordForm({ onBack }: { onBack?: () => void }) {
  return (
    <div className="text-center py-2 space-y-4">
      <div className="gold-divider mx-auto" />
      <p className="text-dark-muted text-sm">
        Password changes are managed through your server environment variables.
      </p>
      <p className="text-dark-muted text-xs">
        Update <code className="text-gold">ADMIN_PASSWORD</code> in Vercel to change the platform password.
      </p>
      {onBack && (
        <button
          onClick={onBack}
          className="text-gold text-xs uppercase tracking-widest hover:text-gold/80 transition-colors"
        >
          ← Back to Login
        </button>
      )}
    </div>
  )
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [mode, setMode] = useState<'login' | 'change-password'>('login')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Validate session server-side on mount
  useEffect(() => {
    isAuthenticated().then(ok => setAuthed(ok))
  }, [])

  if (authed === null) return null
  if (authed) return <>{children}</>

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await verifyPassword(password)
    setLoading(false)
    if (ok) {
      setAuthed(true)
    } else {
      setError('Incorrect password.')
      setPassword('')
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-dark-border bg-dark-surface p-10">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo mx-auto mb-6" />
          <div className="gold-divider mx-auto mb-5" />
          {mode === 'login' ? (
            <>
              <div className="section-label">Internal Access</div>
              <p className="text-dark-muted text-xs mt-2">This area is restricted to authorized users.</p>
            </>
          ) : (
            <>
              <div className="section-label">Change Password</div>
              <p className="text-dark-muted text-xs mt-2">Set a new platform password.</p>
            </>
          )}
        </div>

        {mode === 'login' ? (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label-text">Password</label>
                <input
                  type="password"
                  className="input-field"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-50">
                {loading ? 'Verifying...' : 'Access Platform'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                onClick={() => { setMode('change-password'); setError('') }}
                className="text-dark-muted text-xs uppercase tracking-widest hover:text-[#1a1a18] transition-colors"
              >
                Change Password
              </button>
            </div>
          </>
        ) : (
          <ChangePasswordForm onBack={() => setMode('login')} />
        )}
      </div>
    </div>
  )
}
