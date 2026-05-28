import { useState, useEffect, ReactNode, FormEvent } from 'react'
import { isAuthenticated, setAuthenticated } from '@/lib/auth'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAuthed(isAuthenticated())
  }, [])

  // Avoid flash while checking sessionStorage
  if (authed === null) return null

  if (authed) return <>{children}</>

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setAuthenticated()
        setAuthed(true)
      } else {
        setError('Incorrect password.')
        setPassword('')
      }
    } catch {
      setError('Could not connect. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-dark-border bg-dark-surface p-10">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo.png" alt="YEM Acquisitions" className="site-logo mx-auto mb-6" />
          <div className="gold-divider mx-auto mb-5" />
          <div className="section-label">Internal Access</div>
          <p className="text-dark-muted text-xs mt-2">This area is restricted to authorized users.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
      </div>
    </div>
  )
}
