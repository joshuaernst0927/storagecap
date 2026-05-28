import { useState, useEffect, ReactNode, FormEvent } from 'react'
import {
  isAuthenticated, setAuthenticated,
  getCustomPassword, setCustomPassword, verifyPassword,
} from '@/lib/auth'

// ─── Change Password Form ─────────────────────────────────────────────────────

export function ChangePasswordForm({ onBack, onSuccess }: {
  onBack?: () => void
  onSuccess?: () => void
}) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPw.length < 4) { setError('New password must be at least 4 characters.'); return }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    setLoading(true)
    const ok = await verifyPassword(currentPw)
    setLoading(false)
    if (!ok) { setError('Current password is incorrect.'); return }
    setCustomPassword(newPw)
    setSuccess(true)
    onSuccess?.()
  }

  if (success) {
    return (
      <div className="text-center py-2 space-y-4">
        <div className="gold-divider mx-auto" />
        <p className="text-green-700 text-sm font-medium">Password updated successfully.</p>
        <p className="text-dark-muted text-xs">Your new password is saved and will be used next time you log in.</p>
        {onBack && (
          <button onClick={onBack} className="text-gold text-xs uppercase tracking-widest hover:text-gold/80 transition-colors">
            ← Back to Login
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label-text">Current Password</label>
        <input
          type="password"
          className="input-field"
          value={currentPw}
          onChange={e => setCurrentPw(e.target.value)}
          placeholder="Current password"
          autoFocus
          required
        />
      </div>
      <div>
        <label className="label-text">New Password</label>
        <input
          type="password"
          className="input-field"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          placeholder="New password"
          required
        />
      </div>
      <div>
        <label className="label-text">Confirm New Password</label>
        <input
          type="password"
          className="input-field"
          value={confirmPw}
          onChange={e => setConfirmPw(e.target.value)}
          placeholder="Confirm new password"
          required
        />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-50">
        {loading ? 'Verifying...' : 'Update Password'}
      </button>
      {onBack && (
        <button type="button" onClick={onBack} className="w-full text-center text-dark-muted text-xs uppercase tracking-widest hover:text-[#1a1a18] transition-colors pt-1">
          ← Back to Login
        </button>
      )}
    </form>
  )
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [mode, setMode] = useState<'login' | 'change-password'>('login')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAuthed(isAuthenticated())
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
      setAuthenticated()
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
