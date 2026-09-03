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
  // Scrapers write this inconsistently: most emit a formatted string
  // ("$525,000"), LoopNet emits a raw number. Use parseAskingPrice()/
  // formatAskingPrice() rather than reading it directly.
  askingPrice?: number | string
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
  // Manual 100-pt deal score (set via /score-deal)
  dealScore?: number
  dealType?: 'value-add' | 'stabilized' | 'distressed'
  dealScoredAt?: string
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

// ─── Stage 1: Pre-Underwriting Lead Score ──────────────────────────────────────
//
// Implements the YEM Lead & Underwriting Scoring Framework (Sept 2026), Section 2,
// with one documented deviation approved by Josh on 2026-09-02:
//
//   The published framework allocates Geography 50 / Scale 20 / Ownership 15 /
//   Land 15 and contains no slot for distress signals. Because YEM's lead sources
//   (CourtListener, PACER, county tax, lis pendens, fire marshal) exist primarily
//   to surface seller motivation, a fifth 20-point "Distress & Motivation" bucket
//   was added, funded by removing 5 points evenly from each of the four original
//   buckets. Sub-tables are rescaled proportionally. Total remains 100.
//
//     Geography 45 | Scale 15 | Ownership 10 | Land 10 | Distress 20
//
// Framework rules preserved verbatim:
//   - Stage 1 uses ONLY fields present in the lead record. Never infer facts.
//   - Never blended with Stage 2 (documented-property score).
//   - Every component reports its source field and availability status.
//   - Missing data uses the published "unavailable default", never a neutral guess.
//   - A Stage 1 score is a PRIORITIZATION score, not an investment conclusion.

export type AvailabilityStatus = 'available' | 'unavailable' | 'assumption'

export interface Stage1Component {
  label: string
  points: number
  maxPoints: number
  source: string
  availability: AvailabilityStatus
}

export type Stage1Priority = 'Priority 1' | 'Priority 2' | 'Priority 3' | 'Low Priority'

export interface Stage1Result {
  stage1Score: number
  components: Stage1Component[]
  priority: Stage1Priority
  tier: 'HOT' | 'WARM' | 'COLD'
}

// ── Shared parsing helpers ────────────────────────────────────────────────────
// Scrapers write askingPrice inconsistently: most write a formatted string
// ("$525,000"), LoopNet writes a raw number, many write null. Parse defensively.

const MIN_CREDIBLE_PRICE = 10_000

export function parseAskingPrice(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= MIN_CREDIBLE_PRICE ? raw : null

  const text = String(raw).trim()
  if (!text) return null

  // Handle "$1.2M" / "$1.2 Million" / "$850K" shorthand.
  const shorthand = text.match(/([\d.]+)\s*(million|mil|m|k)\b/i)
  if (shorthand) {
    const n = parseFloat(shorthand[1])
    if (!Number.isFinite(n)) return null
    const unit = shorthand[2].toLowerCase()
    const value = unit === 'k' ? n * 1_000 : n * 1_000_000
    return value >= MIN_CREDIBLE_PRICE ? value : null
  }

  const digits = text.replace(/[^0-9.]/g, '')
  if (!digits) return null
  const value = parseFloat(digits)
  if (!Number.isFinite(value)) return null
  // Values below the floor are malformed scrapes (e.g. "$$7"), not real prices.
  return value >= MIN_CREDIBLE_PRICE ? value : null
}

// Display helper. Prevents the "$$525,000" double-dollar bug caused by calling
// .toLocaleString() on an already-formatted string, and suppresses malformed
// scrapes (e.g. "$$7") rather than echoing them to the UI.
export function formatAskingPrice(raw: number | string | null | undefined): string {
  const parsed = parseAskingPrice(raw)
  if (parsed !== null) {
    return `$${parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  if (!text || !/\d/.test(text)) return '—'
  // Contains digits but failed to parse. If those digits amount to an
  // implausible price, the value is a malformed scrape — hide it. Otherwise
  // it is likely a range or annotated value worth showing verbatim.
  const digits = parseFloat(text.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(digits) || digits < MIN_CREDIBLE_PRICE) return '—'
  return text
}

// ── 2.1 Geographic fit — 45 points (framework 50, rescaled) ───────────────────
// Fixed lookup table per framework: "Do not ask the model to independently infer
// population growth or market quality at upload." Scoped to the 11 states YEM
// targets: NC FL TX OK SC GA AL OH IN KY TN.

const TIER_A_TARGET_MARKETS = new Set([
  // Named in the framework document itself.
  'charlotte,nc', 'raleigh,nc', 'durham,nc', 'cary,nc', 'apex,nc', 'concord,nc',
  'jacksonville,fl',
  'columbus,oh', 'cincinnati,oh',
  'madison,wi',
  // Suburban Nashville (framework names "suburban Nashville", not core).
  'brentwood,tn', 'franklin,tn', 'hendersonville,tn', 'mount juliet,tn',
  'smyrna,tn', 'murfreesboro,tn', 'gallatin,tn', 'spring hill,tn',
])

const TIER_B_CONNECTED_SECONDARY = new Set([
  'greensboro,nc', 'winston-salem,nc', 'fayetteville,nc', 'wilmington,nc',
  'high point,nc', 'asheville,nc', 'gastonia,nc', 'huntersville,nc',
  'columbia,sc', 'savannah,ga', 'augusta,ga',
  'cleveland,oh', 'dayton,oh', 'akron,oh', 'toledo,oh',
  'indianapolis,in', 'carmel,in', 'fishers,in',
  'louisville,ky',
  'knoxville,tn', 'chattanooga,tn', 'clarksville,tn',
])

const TIER_C_OTHER_SECONDARY = new Set([
  'charleston,sc', 'greenville,sc', 'north charleston,sc', 'rock hill,sc',
  'spartanburg,sc', 'myrtle beach,sc', 'summerville,sc',
  'birmingham,al', 'huntsville,al', 'montgomery,al', 'mobile,al', 'auburn,al',
  'tulsa,ok', 'oklahoma city,ok', 'norman,ok', 'broken arrow,ok', 'edmond,ok',
  'fort wayne,in', 'evansville,in', 'south bend,in', 'bloomington,in',
  'lexington,ky', 'bowling green,ky', 'owensboro,ky',
  'memphis,tn', 'johnson city,tn', 'kingsport,tn',
  'macon,ga', 'columbus,ga', 'athens,ga', 'warner robins,ga',
  'ocala,fl', 'gainesville,fl', 'lakeland,fl', 'pensacola,fl', 'tallahassee,fl',
  'fort myers,fl', 'sarasota,fl', 'port st. lucie,fl', 'daytona beach,fl',
  'waco,tx', 'killeen,tx', 'tyler,tx', 'lubbock,tx', 'amarillo,tx',
  'college station,tx', 'mcallen,tx', 'corpus christi,tx', 'abilene,tx',
  'canton,oh', 'youngstown,oh',
])

// Primary metros inside target regions — deprioritized per YEM's secondary-market thesis.
const TIER_D_PRIMARY_METROS = new Set([
  'atlanta,ga',
  'tampa,fl', 'orlando,fl', 'miami,fl', 'fort lauderdale,fl', 'st. petersburg,fl',
  'saint petersburg,fl', 'hialeah,fl', 'west palm beach,fl',
  'dallas,tx', 'houston,tx', 'fort worth,tx', 'arlington,tx', 'plano,tx',
  'austin,tx', 'san antonio,tx', 'el paso,tx',
  'nashville,tn',
])

const TARGET_STATES = new Set(['nc', 'fl', 'tx', 'ok', 'sc', 'ga', 'al', 'oh', 'in', 'ky', 'tn', 'wi'])

function normalizeCityKey(city: string, state: string): string {
  return `${city.trim().toLowerCase().replace(/\s+/g, ' ')},${state.trim().toLowerCase()}`
}

function scoreGeography(lead: Lead): Stage1Component {
  const label = 'Geographic fit'
  const maxPoints = 45
  const city = (lead.city || '').trim()
  const state = (lead.state || '').trim()

  if (!state) {
    return { label, points: 4, maxPoints, source: 'No location on lead record', availability: 'unavailable' }
  }

  const stateKey = state.toLowerCase()

  if (!city) {
    // State known, city missing — score the state band only, flagged as partial.
    const points = TARGET_STATES.has(stateKey) ? 14 : 4
    return {
      label, points, maxPoints,
      source: `State: ${state} (city not provided)`,
      availability: 'assumption',
    }
  }

  const key = normalizeCityKey(city, state)
  let points: number
  if (TIER_A_TARGET_MARKETS.has(key)) points = 45
  else if (TIER_B_CONNECTED_SECONDARY.has(key)) points = 40
  else if (TIER_C_OTHER_SECONDARY.has(key)) points = 32
  else if (TIER_D_PRIMARY_METROS.has(key)) points = 22
  else if (TARGET_STATES.has(stateKey)) points = 14
  else points = 4

  return { label, points, maxPoints, source: `${city}, ${state}`, availability: 'available' }
}

// ── 2.2 Deal-size / facility-scale fit — 15 points (framework 20, rescaled) ───
// Framework: "Claude must not create an estimated value when the upload lacks a
// pricing or scale field." Unavailable default = 4.

function scoreDealSize(lead: Lead): Stage1Component {
  const label = 'Deal-size / scale fit'
  const maxPoints = 15
  const price = parseAskingPrice(lead.askingPrice)

  if (price !== null) {
    let points: number
    if (price >= 3_000_000 && price <= 15_000_000) points = 15
    else if (price >= 1_500_000 && price < 3_000_000) points = 9
    else if (price > 15_000_000 && price <= 22_500_000) points = 9
    else points = 2
    return {
      label, points, maxPoints,
      source: `Asking price: $${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      availability: 'available',
    }
  }

  if (lead.unitCount && lead.unitCount > 0) {
    // Scale proxy only — explicitly NOT a value estimate.
    const points = lead.unitCount >= 150 ? 9 : 2
    return {
      label, points, maxPoints,
      source: `Unit count: ${lead.unitCount} (no price on record)`,
      availability: 'assumption',
    }
  }

  return {
    label, points: 4, maxPoints,
    source: 'No price, value, units, or building SF provided',
    availability: 'unavailable',
  }
}

// ── 2.3 Ownership / value-add proxy — 10 points (framework 15, rescaled) ──────

const INSTITUTIONAL_OWNER = /\breit\b|commercial mortgage trust|public storage|extra space|cubesmart|life storage|u-?haul|national storage|wells fargo|\bubs\b|wfrbs|\bbank\b/i
const REGIONAL_OPERATOR = /storage (group|partners|holdings|management|properties|investors)|storage centers/i

function scoreOwnership(lead: Lead): Stage1Component {
  const label = 'Ownership / value-add proxy'
  const maxPoints = 10
  const ownerBlob = `${lead.ownerName || ''} ${lead.ownerEntity || ''}`.trim()

  if (INSTITUTIONAL_OWNER.test(ownerBlob)) {
    return { label, points: 0, maxPoints, source: `Institutional owner: ${lead.ownerName}`, availability: 'available' }
  }
  if (REGIONAL_OPERATOR.test(ownerBlob)) {
    return { label, points: 3, maxPoints, source: `Regional operator: ${lead.ownerName}`, availability: 'available' }
  }

  const years = lead.distressSignals?.yearsOwned
  if (typeof years === 'number' && Number.isFinite(years)) {
    let points: number
    if (years >= 10) points = 10
    else if (years >= 5) points = 8
    else points = 5
    return { label, points, maxPoints, source: `Held ${years} years`, availability: 'available' }
  }

  if (lead.distressSignals?.longTermOwner) {
    return { label, points: 8, maxPoints, source: 'Flagged long-term owner (duration not specified)', availability: 'assumption' }
  }

  return {
    label, points: 2, maxPoints,
    source: 'Owner type or hold duration unavailable',
    availability: 'unavailable',
  }
}

// ── 2.4 Expansion / land indication — 10 points (framework 15, rescaled) ──────

const EXPLICIT_LAND = /excess land|expansion potential|room to expand|additional acreage|expandable|adjacent (lot|parcel|land)|land included/i
const POSSIBLE_LAND = /\b\d+(\.\d+)?\s*acres?\b|undeveloped|vacant (lot|parcel|land)/i
const NO_EXPANSION = /fully built|no expansion|built[- ]out site|maximum density/i

function scoreLandExpansion(lead: Lead): Stage1Component {
  const label = 'Expansion / land indication'
  const maxPoints = 10
  const blob = `${lead.notes || ''} ${lead.facilityName || ''}`.trim()

  if (NO_EXPANSION.test(blob)) {
    return { label, points: 0, maxPoints, source: 'Record indicates fully built site', availability: 'available' }
  }
  if (EXPLICIT_LAND.test(blob)) {
    return { label, points: 10, maxPoints, source: 'Explicit expansion/excess land in listing text', availability: 'available' }
  }
  if (POSSIBLE_LAND.test(blob)) {
    return { label, points: 4, maxPoints, source: 'Possible land indication in listing text', availability: 'assumption' }
  }

  return {
    label, points: 2, maxPoints,
    source: 'No acreage or land information',
    availability: 'unavailable',
  }
}

// ── Distress & motivation — 20 points (YEM addition, 2026-09-02) ──────────────
// Signals stack, capped at 20. Deliberately EXCLUDES yearsOwned / longTermOwner /
// outOfStateOwner, which are already scored in the Ownership bucket — the
// framework's "no double counting" rule applies here.

interface DistressWeight { key: keyof LeadDistressSignals; points: number; label: string }

const DISTRESS_WEIGHTS: DistressWeight[] = [
  { key: 'taxDelinquency',      points: 8, label: 'Tax delinquency' },
  { key: 'bankruptcy',          points: 7, label: 'Bankruptcy filing' },
  { key: 'lisPendens',          points: 6, label: 'Lis pendens' },
  { key: 'fireCodeViolations',  points: 4, label: 'Fire code violations' },
  { key: 'decliningOccupancy',  points: 3, label: 'Declining occupancy' },
]

function scoreDistress(lead: Lead): Stage1Component {
  const label = 'Distress & motivation'
  const maxPoints = 20
  const signals = lead.distressSignals || {}
  const hits: string[] = []
  let raw = 0

  for (const w of DISTRESS_WEIGHTS) {
    if (signals[w.key]) {
      raw += w.points
      hits.push(w.label)
    }
  }

  const age = signals.ownerAge
  if (typeof age === 'number' && age >= 65) {
    raw += 2
    hits.push(`Owner age ${age}`)
  }

  if (hits.length === 0) {
    return {
      label, points: 0, maxPoints,
      source: 'No distress signals present on lead record',
      availability: 'unavailable',
    }
  }

  return {
    label,
    points: Math.min(raw, maxPoints),
    maxPoints,
    source: hits.join(', '),
    availability: 'available',
  }
}

// ── 2.5 Priority bands (framework, unchanged) ────────────────────────────────

function stage1Priority(score: number): Stage1Priority {
  if (score >= 80) return 'Priority 1'
  if (score >= 60) return 'Priority 2'
  if (score >= 40) return 'Priority 3'
  return 'Low Priority'
}

// HOT/WARM/COLD badge mapped onto the framework's own bands:
//   Priority 1 -> HOT, Priority 2/3 -> WARM, Low Priority -> COLD
function stage1Tier(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 80) return 'HOT'
  if (score >= 40) return 'WARM'
  return 'COLD'
}

export function calculateStage1Score(lead: Lead): Stage1Result {
  const components: Stage1Component[] = [
    scoreGeography(lead),
    scoreDealSize(lead),
    scoreOwnership(lead),
    scoreLandExpansion(lead),
    scoreDistress(lead),
  ]
  const total = components.reduce((sum, c) => sum + c.points, 0)
  const stage1Score = Math.max(0, Math.min(Math.round(total), 100))
  return {
    stage1Score,
    components,
    priority: stage1Priority(stage1Score),
    tier: stage1Tier(stage1Score),
  }
}
