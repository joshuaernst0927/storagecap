export interface ScoreBreakdown {
  motivation: number      // 0–70
  ownerProfile: number    // 0–25
  dealQuality: number     // 0–15
  valueAdd: number        // 0–20
  negatives: number       // ≤ 0
  override: number        // 0–5
}

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
  mechanicsLien?: boolean
  expiredPermit?: boolean
  uccLien?: boolean
  uccMaturityMonths?: number
  civilJudgment?: boolean
  civilJudgmentAmount?: number
  decliningOccupancy: boolean
  occupancyTrend?: number
  deferredMaintenance: boolean
  maintenanceIssues?: string[]
  outOfStateOwner: boolean
  ownerAge?: number
  yearsOwned?: number
  singleAssetOwner?: boolean
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
  // Value-add / deal quality signals
  noWebPresence?: boolean
  streetRatesBelowMarketPct?: number   // % below market street rate, e.g. 12
  valueAddPotential?: boolean
  rentsBelowMarketPct?: number         // % rents are below market, e.g. 15
  rentsAboveMarketPct?: number         // % rents are above market, e.g. 5
  excessLand?: boolean                 // true = expansion land available, false = confirmed none
  selfManaged?: boolean
  institutionalOwner?: boolean
  brokerListed?: boolean
  // Score
  motivationScore: number
  scoreBreakdown?: ScoreBreakdown
  scoreExplanation?: string
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
  if (score >= 85) return 'HOT'
  if (score >= 55) return 'WARM'
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

// Score out of 130 points
export function scoreColor(score: number): string {
  if (score >= 85) return 'text-red-700 border-red-400/50 bg-red-50'
  if (score >= 65) return 'text-amber-700 border-amber-500/50 bg-amber-50'
  if (score >= 40) return 'text-yellow-700 border-yellow-500/50 bg-yellow-50'
  return 'text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]'
}

export function vaScoreColor(va: number): string {
  if (va >= 14) return 'text-emerald-700 border-emerald-500/50 bg-emerald-50'
  if (va >= 8) return 'text-teal-700 border-teal-500/50 bg-teal-50'
  return 'text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]'
}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'HOT'
  if (score >= 65) return 'WARM+'
  if (score >= 40) return 'WARM'
  return 'COLD'
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
