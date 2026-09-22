import { Lead } from './leadsData'

// Backed by Postgres via /api/properties.
// A small in-memory cache keeps the synchronous call sites working:
// refreshLeads() fills it, loadLeads() reads it.

let cache: Lead[] = []
let loaded = false

async function api(body: any): Promise<any> {
  const res = await fetch('/api/properties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('api ' + res.status)
  return res.json()
}

/** Fetch all properties from the database into the cache. */
export async function refreshLeads(): Promise<Lead[]> {
  if (typeof window === 'undefined') return []
  try {
    const res = await fetch('/api/properties')
    if (!res.ok) throw new Error('api ' + res.status)
    const data = await res.json()
    cache = Array.isArray(data.leads) ? data.leads : []
    loaded = true
    return cache
  } catch (e) {
    console.error('refreshLeads failed:', e)
    return cache
  }
}

export function loadLeads(): Lead[] {
  return cache
}

export function isLoaded(): boolean {
  return loaded
}

export function saveLeads(leads: Lead[]): void {
  cache = leads
  void api({ action: 'upsertMany', leads }).catch(e => console.error('saveLeads failed:', e))
}

export function upsertLead(lead: Lead): void {
  const idx = cache.findIndex(l => l.id === lead.id)
  const next = { ...lead, lastUpdated: new Date().toISOString() }
  if (idx >= 0) cache[idx] = next
  else cache.unshift(next)
  void api({ action: 'upsert', lead: next }).catch(e => console.error('upsertLead failed:', e))
}

export function upsertLeads(incoming: Lead[]): { added: number; updated: number } {
  const map = new Map(cache.map(l => [l.id, l]))
  let added = 0
  let updated = 0

  for (const lead of incoming) {
    if (map.has(lead.id)) {
      map.set(lead.id, { ...lead, lastUpdated: new Date().toISOString() })
      updated++
    } else {
      map.set(lead.id, lead)
      added++
    }
  }

  cache = Array.from(map.values())
  void api({ action: 'upsertMany', leads: incoming }).catch(e => console.error('upsertLeads failed:', e))
  return { added, updated }
}

export function updateLeadStatus(id: string, updates: Partial<Lead>): void {
  const idx = cache.findIndex(l => l.id === id)
  if (idx >= 0) {
    cache[idx] = { ...cache[idx], ...updates, lastUpdated: new Date().toISOString() }
  }
  void api({ action: 'update', id, updates }).catch(e => console.error('updateLeadStatus failed:', e))
}

export function deleteLead(id: string): void {
  cache = cache.filter(l => l.id !== id)
  void api({ action: 'delete', id }).catch(e => console.error('deleteLead failed:', e))
}

export function clearAllLeads(): void {
  const ids = cache.map(l => l.id)
  cache = []
  void Promise.all(ids.map(id => api({ action: 'delete', id })))
    .catch(e => console.error('clearAllLeads failed:', e))
}