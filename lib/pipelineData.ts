export interface NoteEntry {
  id: string
  text: string
  createdAt: string
}

export interface NextStep {
  id: string
  text: string
  dueDate?: string       // YYYY-MM-DD
  completedAt?: string   // ISO timestamp
}

export type ActivityEventType =
  | 'deal_added' | 'stage_changed' | 'status_changed'
  | 'score_changed' | 'letter_sent' | 'note_added' | 'step_completed'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  description: string
  createdAt: string
}

export interface PortfolioEntry {
  finalPurchasePrice: number
  closeDate: string         // YYYY-MM-DD
  initialEquity: number
  debtAmount: number
  lenderName: string
  acquiredAt: string        // ISO timestamp
}

export interface ScoreBreakdown {
  motivation: number      // 0–70
  ownerProfile: number    // 0–25
  dealQuality: number     // 0–15
  valueAdd: number        // 0–20
  offerDeal: number       // 0–20
  businessPlan: number    // 0–25
  negatives: number       // ≤ 0
  override: number        // 0–5
}

export interface ScoreHistoryEntry {
  score: number
  date: string  // ISO timestamp
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
export type UnitMixBucket =
  | 'Small' | 'Medium' | 'Large' | 'XLarge' | 'Jumbo' | 'Other'
  | 'CCSmall' | 'CCMedium' | 'CCLarge' | 'CCXLarge' | 'CCJumbo' | 'CCOther'
  | 'VehicleParking'
  | 'UNCLASSIFIED'

export interface RawUnitMixRow {
  id: string
  sourceLabel: string
  sourceType: 'rentRoll' | 'OM' | 'T12' | 'manual'
  dimensions: { width: number; length: number } | null
  sqft: number | null
  units: number | null
  currentRent: number | null
  marketRent: number | null
  isClimateControlled: boolean
  isVehicleParking: boolean
  bucket: UnitMixBucket
  bucketConfidence: 'certain' | 'flagged'
  rawExtractionConfidence: number | null
}
export interface PipelineProperty {
  id: string
  facilityName: string
  address: string
  city: string
  state: string
  zipCode: string
  unitCount: number
  // unitMix naming architecture (locked):
  //   unitMixSummary — display-only string, shown on pipeline/analyze/score-deal. Never used for calculations.
  //   unitMix — canonical persisted source of truth for structured unit-mix data.
  //     unitMix.rows holds RawUnitMixRow[] exactly as extracted, with derived classification
  //     metadata attached per row. bucket/bucketConfidence are derived, not source of truth —
  //     raw row fields are. Reclassification must be explicit and version-tracked via
  //     lastClassifiedRulesVersion, never silently recomputed on read.
  unitMixSummary?: string
  unitMix?: {
    rows: RawUnitMixRow[]
    lastClassifiedAt: string
    lastClassifiedRulesVersion: string
  }
  yearBuilt: number

  landAcres: number
  climatePercent: number
  estimatedValue: number
  askingPrice?: number
  noi?: number
  grossRevenue?: number
  occupancy: number
  // Rent and T3 NOI — populated when a deal is saved from upload-deal or analyze
  currentAvgRentPerUnit?: number
  marketAvgRentPerUnit?: number
  t3NOI?: number
  // T12 operating expense detail — populated when a deal is saved from upload-deal
  // or analyze. Required so Proforma's Active Deal dropdown can pass real expense
  // values into /api/run-excel instead of defaulting to zero (BUG-01).
  t12Tax?: number
  t12Insurance?: number
  t12Utilities?: number
  t12RepairsMaintenance?: number
  t12Payroll?: number
  t12OfficeEmployee?: number
  t12ManagementFees?: number
  t12Marketing?: number
  t12Administrative?: number
  t12OtherExpenses?: number
  t12TotalExpenses?: number
  // Broker contact (first listed broker only — PipelineProperty does not model
  // a second broker slot)
  brokerPhone?: string
  brokerEmail?: string
  // Years the current owner has held the property. Not currently populated by
  // any extraction path — no source field exists yet in upload-deal or analyze
  // extraction. Present here so it can be wired once that data is available.
  sellerYearsOwned?: number
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
  // Offer & deal structure
  offerPrice?: number
  daysOnMarket?: number
  offerStatus?: 'pending' | 'countered' | 'accepted' | 'rejected'
  dealStructure?: 'standard' | 'seller-carry' | 'leaseback' | 'installment' | 'all-cash'
  // Business plan upside
  projectedYear1NOI?: number
  projectedStabilizedNOI?: number
  noiUpsidePct?: number
  rentIncreasePotentialPct?: number
  occupancyUpsidePct?: number
  climateConversionPossible?: boolean
  exitStrategy?: 'sell' | 'refi' | 'hold'
  projectedExitCapRate?: number
  // Automated motivation score
  motivationScore: number
  scoreBreakdown?: ScoreBreakdown
  scoreExplanation?: string
  scoreHistory?: ScoreHistoryEntry[]
  lastScored?: string  // ISO timestamp
  // Manual / AI 100-pt deal score
  dealScore?: number
  dealType?: 'value-add' | 'stabilized' | 'distressed'
  dealScoreBreakdown?: { locationMarket: number; priceValue: number; sellerMotivation: number; specific: number }
  dealScoreInputs?: Record<string, string | number>
  dealScoredAt?: string
  stage: 'identified' | 'researching' | 'outreach' | 'conversation' | 'loi' | 'dd' | 'closed' | 'dead'
  currentStatus: DealStatus
  priority: 'high' | 'medium' | 'low'
  source: 'county-records' | 'drive-by' | 'inbound' | 'broker' | 'data-scrape'
  addedDate: string
  lastActivity?: string
  notes?: string
  outreachLetter?: string
  noteLog?: NoteEntry[]
  nextSteps?: NextStep[]
  activityLog?: ActivityEvent[]
  portfolioEntry?: PortfolioEntry
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
