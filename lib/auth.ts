const AUTH_KEY = 'yem_auth'
const CUSTOM_PW_KEY = 'yem_custom_password'

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AUTH_KEY) === 'true'
}

export function setAuthenticated(): void {
  if (typeof window !== 'undefined') sessionStorage.setItem(AUTH_KEY, 'true')
}

export function clearAuth(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(AUTH_KEY)
}

export function getCustomPassword(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CUSTOM_PW_KEY)
}

export function setCustomPassword(pw: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(CUSTOM_PW_KEY, pw)
}

// Check against localStorage custom password first, then fall back to API
// (API checks ADMIN_PASSWORD env var, defaults to "YEM2025")
export async function verifyPassword(password: string): Promise<boolean> {
  const custom = getCustomPassword()
  if (custom !== null) return password === custom
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    return res.ok
  } catch {
    return false
  }
}
