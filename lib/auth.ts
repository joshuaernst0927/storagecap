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

// Check against localStorage custom password first, then hardcoded default.
// Fully client-side — no API call, works identically on localhost and Vercel.
export async function verifyPassword(password: string): Promise<boolean> {
  const custom = getCustomPassword()
  if (custom !== null) return password === custom
  return password === 'YEM2025'
}
