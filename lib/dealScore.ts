export type DealType = 'value-add' | 'stabilized' | 'distressed'

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  'value-add': 'Value-Add',
  'stabilized': 'Stabilized Cash Flow',
  'distressed': 'Distressed Turnaround',
}

// ─── Criteria definitions ─────────────────────────────────────────────────────

export interface Criterion {
  key: string
  label: string
  hint: string
  max: number
  group: 'location' | 'price' | 'motivation' | 'value-add' | 'stabilized' | 'distressed'
}

export const UNIVERSAL_CRITERIA: Criterion[] = [
  // Location & Market (20 pts)
  { key: 'highwayVisibility',  label: 'Highway Visibility / Access',          hint: '5 = direct highway frontage, high daily traffic; 0 = hidden, poor access',    max: 5, group: 'location' },
  { key: 'populationGrowth',   label: 'Population Growth & Demand Drivers',   hint: '5 = high-growth MSA with strong in-migration; 0 = shrinking or flat market', max: 5, group: 'location' },
  { key: 'supplyConstraints',  label: 'Supply Constraints Within 3 Miles',    hint: '5 = infill, no land available for new supply; 0 = multiple competitors planned', max: 5, group: 'location' },
  { key: 'rentTrajectory',     label: 'Market Rent Trajectory',               hint: '5 = rents rising 8%+ annually; 0 = flat or declining market rents',           max: 5, group: 'location' },
  // Acquisition Price vs Value (20 pts)
  { key: 'priceVsReplacement', label: 'Price vs Replacement Cost',            hint: '5 = buying at <60% of replacement; 0 = at or above replacement cost',         max: 5, group: 'price' },
  { key: 'currentVsFutureNOI', label: 'Paying for Current vs Future NOI',     hint: '5 = priced on current depressed NOI with clear upside; 0 = priced on pro forma', max: 5, group: 'price' },
  { key: 'goingInCapVsMarket', label: 'Going-In Cap vs Market Cap Rate',      hint: '5 = going-in cap ≥200bps above market; 0 = at or below market cap',           max: 5, group: 'price' },
  { key: 'pricePerUnitVsComps','label': 'Price Per Unit vs Comps',            hint: '5 = >20% below comp trades; 0 = at or above comp pricing',                    max: 5, group: 'price' },
  // Seller Motivation (15 pts)
  { key: 'distressLevel',      label: 'Bankruptcy / Foreclosure / Distress',  hint: '5 = active BK/foreclosure/lien; 0 = no financial distress visible',            max: 5, group: 'motivation' },
  { key: 'timePressure',       label: 'Time Pressure',                        hint: '5 = hard deadline (maturity, tax sale, divorce); 0 = no urgency',              max: 5, group: 'motivation' },
  { key: 'offMarketBonus',     label: 'Off-Market vs Brokered',               hint: '5 = direct to owner, no competition; 0 = fully brokered with multiple offers', max: 5, group: 'motivation' },
]

export const VALUE_ADD_CRITERIA: Criterion[] = [
  { key: 'rentToMarketGap',      label: 'Rent-to-Market Gap',               hint: '15 = rents >30% below market with proven comps; 0 = at or above market',      max: 15, group: 'value-add' },
  { key: 'occupancyUpside',      label: 'Occupancy Upside',                  hint: '15 = <65% occupied with clear demand; 0 = already stabilized near market',    max: 15, group: 'value-add' },
  { key: 'expansionOptionality', label: 'Expansion Optionality',             hint: '10 = excess land for phased expansion; 0 = landlocked, no expansion possible', max: 10, group: 'value-add' },
  { key: 'expenseReduction',     label: 'Expense Reduction Potential',       hint: '5 = self-managed, bloated OpEx, clear cuts; 0 = already efficiently run',     max: 5,  group: 'value-add' },
]

export const STABILIZED_CRITERIA: Criterion[] = [
  { key: 'goingInCapThreshold',     label: 'Going-In Cap vs 7.5% Threshold',        hint: '20 = going-in cap ≥8.5%; 0 = below 6.5%',                                     max: 20, group: 'stabilized' },
  { key: 'occupancyStability',      label: 'Occupancy Stability (90%+ for 2+ Yrs)', hint: '10 = 92%+ for 3+ years with low churn; 0 = recently stabilized or volatile',   max: 10, group: 'stabilized' },
  { key: 'expenseRatioEfficiency',  label: 'Expense Ratio Efficiency',               hint: '10 = OpEx ratio <35% of EGR; 0 = OpEx >55% of EGR',                           max: 10, group: 'stabilized' },
  { key: 'refinanceHoldOption',     label: 'Refinance / Hold Optionality',           hint: '5 = strong refi upside locked in near-term; 0 = trapped in current structure', max: 5,  group: 'stabilized' },
]

export const DISTRESSED_CRITERIA: Criterion[] = [
  { key: 'ownerVsAssetProblem', label: 'Owner Problem vs Asset Problem',          hint: '20 = pure owner problem (mismanagement/debt); 0 = structural/location flaws', max: 20, group: 'distressed' },
  { key: 'physicalBones',       label: 'Physical Bones (Structure/Location/Mix)', hint: '15 = solid structure, great location, good unit mix; 0 = deferred maintenance & poor location', max: 15, group: 'distressed' },
  { key: 'pathToStabilization', label: 'Clear Path to Stabilization in 24–36 Months', hint: '10 = defined playbook, comparable success nearby; 0 = unclear path or prior failed attempts', max: 10, group: 'distressed' },
]

export const SPECIFIC_CRITERIA: Record<DealType, Criterion[]> = {
  'value-add': VALUE_ADD_CRITERIA,
  'stabilized': STABILIZED_CRITERIA,
  'distressed': DISTRESSED_CRITERIA,
}

export const GROUP_LABELS: Record<string, { label: string; max: number; color: string }> = {
  location:    { label: 'Location & Market',           max: 20, color: 'text-blue-700' },
  price:       { label: 'Acquisition Price vs Value',  max: 20, color: 'text-purple-700' },
  motivation:  { label: 'Seller Motivation',           max: 15, color: 'text-amber-700' },
  'value-add': { label: 'Value-Add Upside',            max: 45, color: 'text-green-700' },
  stabilized:  { label: 'Stabilized Quality',          max: 45, color: 'text-teal-700' },
  distressed:  { label: 'Turnaround Thesis',           max: 45, color: 'text-red-700' },
}

// ─── Score inputs / result types ─────────────────────────────────────────────

export interface DealScoreInputs {
  dealType: DealType
  [key: string]: number | string
}

export interface DealScoreBreakdown {
  locationMarket: number    // 0-20
  priceValue: number        // 0-20
  sellerMotivation: number  // 0-15
  specific: number          // 0-45
}

export interface DealScoreResult {
  total: number
  breakdown: DealScoreBreakdown
  tier: 'HOT' | 'WARM' | 'PASS'
  dealType: DealType
}

export function computeDealScore(inputs: DealScoreInputs): DealScoreResult {
  const sum = (...keys: string[]) => keys.reduce((acc, k) => acc + (Number(inputs[k]) || 0), 0)

  const locationMarket   = sum('highwayVisibility', 'populationGrowth', 'supplyConstraints', 'rentTrajectory')
  const priceValue       = sum('priceVsReplacement', 'currentVsFutureNOI', 'goingInCapVsMarket', 'pricePerUnitVsComps')
  const sellerMotivation = sum('distressLevel', 'timePressure', 'offMarketBonus')

  let specific = 0
  if (inputs.dealType === 'value-add') {
    specific = sum('rentToMarketGap', 'occupancyUpside', 'expansionOptionality', 'expenseReduction')
  } else if (inputs.dealType === 'stabilized') {
    specific = sum('goingInCapThreshold', 'occupancyStability', 'expenseRatioEfficiency', 'refinanceHoldOption')
  } else {
    specific = sum('ownerVsAssetProblem', 'physicalBones', 'pathToStabilization')
  }

  const total = locationMarket + priceValue + sellerMotivation + specific

  return {
    total,
    breakdown: { locationMarket, priceValue, sellerMotivation, specific },
    tier: getDealScoreTier(total),
    dealType: inputs.dealType,
  }
}

export function getDealScoreTier(score: number): 'HOT' | 'WARM' | 'PASS' {
  if (score >= 75) return 'HOT'
  if (score >= 40) return 'WARM'
  return 'PASS'
}

export function dealScoreTierColor(tier: 'HOT' | 'WARM' | 'PASS'): string {
  if (tier === 'HOT')  return 'bg-green-50 text-green-700 border-green-300'
  if (tier === 'WARM') return 'bg-amber-50 text-amber-700 border-amber-300'
  return 'bg-gray-100 text-gray-500 border-gray-300'
}

export function dealScoreDotColor(tier: 'HOT' | 'WARM' | 'PASS'): string {
  if (tier === 'HOT')  return 'bg-green-500'
  if (tier === 'WARM') return 'bg-amber-500'
  return 'bg-gray-400'
}

// Default blank inputs for the scoring form
export function blankInputs(dealType: DealType): DealScoreInputs {
  const all = [...UNIVERSAL_CRITERIA, ...SPECIFIC_CRITERIA[dealType]]
  const out: DealScoreInputs = { dealType }
  for (const c of all) out[c.key] = 0
  return out
}
