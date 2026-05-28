export interface DistressSignals {
  taxDelinquency: boolean
  taxDelinquencyAmount?: number
  taxDelinquencyYears?: number
  fireCodeViolations: boolean
  fireCodeCount?: number
  fireCodeDetails?: string[]
  codeViolations: string[]
  lisPendens: boolean
  lisPendensAmount?: number
  decliningOccupancy: boolean
  occupancyTrend?: number
  deferredMaintenance: boolean
  maintenanceIssues?: string[]
  outOfStateOwner: boolean
  ownerAge?: number
  yearsOwned?: number
}

export type DealStatus = 'outreach-sent' | 'call-scheduled' | 'loi-stage' | 'under-contract'

export interface PipelineProperty {
  id: string
  facilityName: string
  address: string
  city: string
  state: string
  zipCode: string
  unitCount: number
  unitMix: string
  yearBuilt: number
  landAcres: number
  climatePercent: number
  estimatedValue: number
  askingPrice?: number
  noi?: number
  grossRevenue?: number
  occupancy: number
  ownerName: string
  ownerEntity: string
  ownerEntityState: string
  ownerEntityFormed?: string
  registeredAgent?: string
  ownerMailingAddress: string
  ownerPhone?: string
  ownerEmail?: string
  distressSignals: DistressSignals
  motivationScore: number
  stage: 'identified' | 'researching' | 'outreach' | 'conversation' | 'loi' | 'dd' | 'closed' | 'dead'
  currentStatus: DealStatus
  priority: 'high' | 'medium' | 'low'
  source: 'county-records' | 'drive-by' | 'inbound' | 'broker' | 'data-scrape'
  addedDate: string
  lastActivity?: string
  notes?: string
  outreachLetter?: string
}

export const mockProperties: PipelineProperty[] = []

export const STAGES = [
  { key: 'identified', label: 'Identified' },
  { key: 'researching', label: 'Researching' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'conversation', label: 'In Conversation' },
  { key: 'loi', label: 'LOI Sent' },
  { key: 'dd', label: 'Under DD' },
  { key: 'closed', label: 'Closed' },
  { key: 'dead', label: 'Dead' },
] as const

export function tier(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 75) return 'HOT'
  if (score >= 50) return 'WARM'
  return 'COLD'
}

export function tierColor(t: 'HOT' | 'WARM' | 'COLD'): string {
  if (t === 'HOT') return 'text-red-700 border-red-400/50 bg-red-50'
  if (t === 'WARM') return 'text-amber-700 border-amber-500/50 bg-amber-50'
  return 'text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]'
}

export function statusLabel(s: DealStatus): string {
  const map: Record<DealStatus, string> = {
    'outreach-sent': 'Outreach Sent',
    'call-scheduled': 'Call Scheduled',
    'loi-stage': 'LOI Stage',
    'under-contract': 'Under Contract',
  }
  return map[s]
}

export function statusColor(s: DealStatus): string {
  const map: Record<DealStatus, string> = {
    'outreach-sent': 'text-[#5A5A55] border-[#E0DDD4]',
    'call-scheduled': 'text-blue-700 border-blue-400/40 bg-blue-50',
    'loi-stage': 'text-amber-700 border-amber-500/40 bg-amber-50',
    'under-contract': 'text-green-700 border-green-500/40 bg-green-50',
  }
  return map[s]
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-red-700 border-red-400/50 bg-red-50'
  if (score >= 65) return 'text-amber-700 border-amber-500/50 bg-amber-50'
  if (score >= 45) return 'text-yellow-700 border-yellow-500/50 bg-yellow-50'
  return 'text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]'
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'HIGH'
  if (score >= 65) return 'MOD-HIGH'
  if (score >= 45) return 'MODERATE'
  return 'LOW'
}

export function stageBadgeColor(stage: string): string {
  const map: Record<string, string> = {
    identified: 'text-[#5A5A55] border-[#E0DDD4]',
    researching: 'text-blue-700 border-blue-400/40 bg-blue-50',
    outreach: 'text-amber-700 border-amber-500/40 bg-amber-50',
    conversation: 'text-purple-700 border-purple-400/40 bg-purple-50',
    loi: 'text-green-700 border-green-500/40 bg-green-50',
    dd: 'text-emerald-700 border-emerald-500/40 bg-emerald-50',
    closed: 'text-emerald-700 border-emerald-500/40 bg-emerald-50',
    dead: 'text-[#5A5A55]/50 border-[#E0DDD4]/50',
  }
  return map[stage] ?? 'text-[#5A5A55] border-[#E0DDD4]'
}
