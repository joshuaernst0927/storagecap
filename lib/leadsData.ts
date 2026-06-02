export type LeadSource =
  | 'county-tax'
  | 'fire-marshal'
  | 'ucc-lien'
  | 'lis-pendens'
  | 'courtlistener'
  | 'loopnet'
  | 'brevitas'
  | 'crexi'
  | 'bizbuysell'
  | 'facebook'
  | 'craigslist'
  | 'fsbo'
  | 'long-term-owner'
  | 'out-of-state-owner'
  | 'manual'

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'added-to-pipeline' | 'dead'

export interface LeadDistressSignals {
  taxDelinquency?: boolean
  taxDelinquencyAmount?: number
  fireCodeViolations?: boolean
  lisPendens?: boolean
  bankruptcy?: boolean
  bankruptcyChapter?: string   // "Chapter 7", "Chapter 11", etc.
  bankruptcyDate?: string      // ISO date of filing
  bankruptcyDocket?: string    // case number
  decliningOccupancy?: boolean
  outOfStateOwner?: boolean
  longTermOwner?: boolean
  yearsOwned?: number
  ownerAge?: number
}

export interface ContactInfo {
  mailingAddress?: string
  phone?: string
  email?: string
  linkedIn?: string
  enrichedAt?: string
  enrichedBy?: 'apollo' | 'manual'
}

export interface EmailRecord {
  sentAt: string
  subject: string
}

export interface Lead {
  id: string
  facilityName?: string
  address: string
  city: string
  state: string
  zipCode?: string
  unitCount?: number
  askingPrice?: number
  ownerName: string
  ownerEntity?: string
  source: LeadSource
  sourceUrl?: string
  distressSignals: LeadDistressSignals
  score: number
  status: LeadStatus
  foundAt: string
  lastUpdated: string
  contactedAt?: string
  notes?: string
  outreachLetter?: string
  pipelineId?: string
  contactInfo?: ContactInfo
  emailSubject?: string
  emailBody?: string
  emailHistory?: EmailRecord[]
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  'county-tax': 'County Tax',
  'fire-marshal': 'Fire Marshal',
  'ucc-lien': 'UCC Lien',
  'lis-pendens': 'Lis Pendens',
  'courtlistener': 'Court Filing',
  'loopnet': 'LoopNet',
  'brevitas': 'Brevitas',
  'crexi': 'Crexi',
  'bizbuysell': 'BizBuySell',
  'facebook': 'Facebook',
  'craigslist': 'Craigslist',
  'fsbo': 'FSBO',
  'long-term-owner': 'Long-Term Owner',
  'out-of-state-owner': 'Out-of-State Owner',
  'manual': 'Manual Entry',
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  'new': 'New',
  'contacted': 'Contacted',
  'qualified': 'Qualified',
  'added-to-pipeline': 'In Pipeline',
  'dead': 'Dead',
}

export function scoreLead(signals: LeadDistressSignals): number {
  let score = 0
  if (signals.taxDelinquency) score += 25
  if (signals.fireCodeViolations) score += 15
  if (signals.lisPendens) score += 20
  if (signals.bankruptcy) score += 18
  if (signals.decliningOccupancy) score += 10
  if (signals.outOfStateOwner) score += 10
  if (signals.longTermOwner) score += 10
  if ((signals.ownerAge ?? 0) >= 65) score += 10
  return Math.min(score, 100)
}

export function getLeadTier(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 40) return 'HOT'
  if (score >= 15) return 'WARM'
  return 'COLD'
}

export function generateLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
