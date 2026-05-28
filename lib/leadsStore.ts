import { Lead } from './leadsData'

const LEADS_KEY = 'yem_leads'

export function loadLeads(): Lead[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LEADS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Lead[]
  } catch {
    return []
  }
}

export function saveLeads(leads: Lead[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads))
}

export function upsertLead(lead: Lead): void {
  const leads = loadLeads()
  const idx = leads.findIndex(l => l.id === lead.id)
  if (idx >= 0) {
    leads[idx] = { ...lead, lastUpdated: new Date().toISOString() }
  } else {
    leads.unshift(lead)
  }
  saveLeads(leads)
}

export function upsertLeads(incoming: Lead[]): { added: number; updated: number } {
  const existing = loadLeads()
  const map = new Map(existing.map(l => [l.id, l]))
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

  saveLeads(Array.from(map.values()))
  return { added, updated }
}

export function updateLeadStatus(id: string, updates: Partial<Lead>): void {
  const leads = loadLeads()
  const idx = leads.findIndex(l => l.id === id)
  if (idx >= 0) {
    leads[idx] = { ...leads[idx], ...updates, lastUpdated: new Date().toISOString() }
    saveLeads(leads)
  }
}

export function deleteLead(id: string): void {
  const leads = loadLeads().filter(l => l.id !== id)
  saveLeads(leads)
}

export function clearAllLeads(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(LEADS_KEY)
}
