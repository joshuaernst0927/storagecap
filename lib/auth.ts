/**
 * lib/auth.ts — client-side auth helpers.
 *
 * Password validation is now entirely server-side via /api/auth.
 * Session state is validated server-side via /api/session.
 * No password or secret is ever stored or compared client-side.
 */

/**
 * Check session validity by pinging the server.
 * Returns true if the HTTP-only session cookie is present and valid.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch('/api/session', { method: 'GET', credentials: 'same-origin' })
    if (!res.ok) return false
    const data = await res.json()
    return data.ok === true
  } catch {
    return false
  }
}

/**
 * Attempt login by posting password to /api/auth.
 * Server sets HTTP-only cookie on success.
 * Returns true on success, false on incorrect password.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    return data.ok === true
  } catch {
    return false
  }
}

/**
 * Clear session by calling /api/auth logout action.
 * Server clears the HTTP-only cookie.
 */
export async function clearAuth(): Promise<void> {
  try {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'logout' }),
    })
  } catch {
    // Best effort
  }
}

// ── Legacy stubs — kept so existing callers don't break at compile time ────────
// These are no-ops. The real work is now done server-side.

/** @deprecated — session is now server-side. Use isAuthenticated() (async). */
export function setAuthenticated(): void { /* no-op */ }

/** @deprecated — custom passwords are no longer supported client-side. */
export function getCustomPassword(): string | null { return null }

/** @deprecated — custom passwords are no longer supported client-side. */
export function setCustomPassword(_pw: string): void { /* no-op */ }
