const AUTH_KEY = 'yem_auth'

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
