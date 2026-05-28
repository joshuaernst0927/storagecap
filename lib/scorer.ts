import type { PipelineProperty, ScoreBreakdown } from './pipelineData'

export interface ScoreResult {
  total: number
  breakdown: ScoreBreakdown
  explanation: string
}

export function scoreProperty(p: PipelineProperty): ScoreResult {
  const s = p.distressSignals
  const occ = p.occupancy > 1 ? p.occupancy : p.occupancy * 100

  // === MOTIVATION SIGNALS (0–70) ===
  let motivation = 0
  let activeDistressCount = 0

  const taxYears = s.taxDelinquencyYears ?? 0
  if (s.taxDelinquency) {
    motivation += taxYears >= 2 ? 20 : 12
    activeDistressCount++
  }
  if (s.fireCodeViolations) { motivation += 18; activeDistressCount++ }
  if (s.lisPendens) { motivation += 18; activeDistressCount++ }
  if (s.mechanicsLien) { motivation += 10; activeDistressCount++ }
  if (s.expiredPermit) { motivation += 8; activeDistressCount++ }
  if (s.uccLien && (s.uccMaturityMonths ?? 13) <= 12) { motivation += 8; activeDistressCount++ }
  if (s.civilJudgment) { motivation += 6; activeDistressCount++ }
  if (activeDistressCount >= 2) motivation += 10
  motivation = Math.min(70, motivation)

  // === OWNER PROFILE (0–25) ===
  let ownerProfile = 0
  const age = s.ownerAge ?? 0
  if (age >= 65) ownerProfile += 12
  else if (age >= 55) ownerProfile += 7
  if ((s.yearsOwned ?? 0) >= 15) ownerProfile += 8
  if (s.outOfStateOwner) ownerProfile += 5
  if (s.singleAssetOwner) ownerProfile += 5
  if (p.noWebPresence) ownerProfile += 3
  ownerProfile = Math.min(25, ownerProfile)

  // === DEAL QUALITY (0–15) ===
  let dealQuality = 0
  const capRate =
    p.noi && p.estimatedValue ? p.noi / p.estimatedValue
    : p.noi && p.askingPrice ? p.noi / p.askingPrice
    : null
  if (p.unitCount >= 150 && p.unitCount <= 600) dealQuality += 8
  if (capRate !== null && capRate > 0.065) dealQuality += 5
  if ((p.streetRatesBelowMarketPct ?? 0) >= 10) dealQuality += 5
  if (p.valueAddPotential) dealQuality += 4
  if (p.climatePercent === 0 && p.unitCount > 0) dealQuality += 3
  dealQuality = Math.min(15, dealQuality)

  // === VALUE-ADD (0–20) ===
  let valueAdd = 0
  if (occ < 70) valueAdd += 8
  else if (occ < 80) valueAdd += 5
  const rentsBelowPct = p.rentsBelowMarketPct ?? 0
  if (rentsBelowPct >= 15) valueAdd += 8
  else if (rentsBelowPct >= 5) valueAdd += 4
  if (p.excessLand === true) valueAdd += 7
  if (p.climatePercent === 0 && p.unitCount > 0) valueAdd += 5
  if (occ < 80 && rentsBelowPct >= 5) valueAdd += 5
  if (p.selfManaged) valueAdd += 4
  if (s.deferredMaintenance) valueAdd += 3
  if (p.noWebPresence) valueAdd += 2
  valueAdd = Math.min(20, valueAdd)

  // === OFFER & DEAL STRUCTURE (0–20) ===
  let offerDeal = 0
  if (p.offerPrice && p.askingPrice && p.askingPrice > 0) {
    const discountPct = ((p.askingPrice - p.offerPrice) / p.askingPrice) * 100
    if (discountPct >= 15) offerDeal += 10
    else if (discountPct >= 10) offerDeal += 7
    else if (discountPct >= 5) offerDeal += 4
  }
  if (p.offerStatus === 'accepted' || p.offerStatus === 'countered') offerDeal += 8
  const struct = p.dealStructure
  if (struct === 'seller-carry' || struct === 'leaseback' || struct === 'installment') offerDeal += 5
  if (struct === 'all-cash') offerDeal += 3
  if ((p.daysOnMarket ?? 0) >= 90) offerDeal += 6
  // Price per unit vs market (using askingPrice / unitCount vs estimatedValue / unitCount as proxy)
  if (p.offerPrice && p.estimatedValue && p.estimatedValue > 0) {
    const ppuDiscount = ((p.estimatedValue - p.offerPrice) / p.estimatedValue) * 100
    if (ppuDiscount >= 20) offerDeal += 8
    else if (ppuDiscount >= 10) offerDeal += 5
  }
  offerDeal = Math.min(20, offerDeal)

  // === BUSINESS PLAN UPSIDE (0–25) ===
  let businessPlan = 0
  const noiUpsidePct = p.noiUpsidePct ?? 0
  if (noiUpsidePct >= 50) businessPlan += 12
  else if (noiUpsidePct >= 25) businessPlan += 8
  else if (noiUpsidePct >= 10) businessPlan += 5
  if (p.excessLand === true) businessPlan += 8
  const rentIncreasePct = p.rentIncreasePotentialPct ?? 0
  if (rentIncreasePct >= 20) businessPlan += 7
  else if (rentIncreasePct >= 10) businessPlan += 4
  const occUpsidePct = p.occupancyUpsidePct ?? 0
  if (occUpsidePct >= 20) businessPlan += 7
  else if (occUpsidePct >= 10) businessPlan += 4
  if (p.climateConversionPossible) businessPlan += 5
  if (p.selfManaged) businessPlan += 4
  if (p.noWebPresence) businessPlan += 3  // technology / online leasing upside
  // Ancillary income upside — proxy via excess land or value-add flag
  if (p.excessLand === true || p.valueAddPotential) businessPlan += 3
  // Land repositioning proxy
  if (p.excessLand === true && p.exitStrategy === 'sell') businessPlan += 6
  // Exit cap rate compression
  if (p.projectedExitCapRate !== undefined && capRate !== null && p.projectedExitCapRate < capRate - 0.005) businessPlan += 4
  businessPlan = Math.min(25, businessPlan)

  // === NEGATIVES ===
  let negatives = 0
  if (occ >= 95) negatives -= 8
  else if (occ >= 90) negatives -= 4
  const rentsAbovePct = p.rentsAboveMarketPct ?? 0
  if (rentsAbovePct >= 10) negatives -= 8
  if (rentsAbovePct === 0 && occ >= 95) negatives -= 6
  if (p.yearBuilt >= 2020) negatives -= 5
  if (p.institutionalOwner) negatives -= 10
  if (p.brokerListed) negatives -= 5
  if (p.excessLand === false) negatives -= 3
  if (p.climatePercent === 100) negatives -= 2

  // === POSITIVE OVERRIDE ===
  let override = 0
  if (capRate !== null && capRate > 0.075 && occ >= 85) override += 5

  const total = Math.max(0, Math.min(175, motivation + ownerProfile + dealQuality + valueAdd + offerDeal + businessPlan + negatives + override))
  const breakdown: ScoreBreakdown = { motivation, ownerProfile, dealQuality, valueAdd, offerDeal, businessPlan, negatives, override }
  const explanation = buildExplanation(p, breakdown, total, occ, capRate)

  return { total, breakdown, explanation }
}

function buildExplanation(
  p: PipelineProperty,
  b: ScoreBreakdown,
  total: number,
  occ: number,
  capRate: number | null,
): string {
  const s = p.distressSignals

  let s1: string
  if (b.motivation >= 30) {
    const signals: string[] = []
    if (s.taxDelinquency) signals.push(`${s.taxDelinquencyYears ?? 1}-year tax delinquency`)
    if (s.fireCodeViolations) signals.push('active fire code violations')
    if (s.lisPendens) signals.push('lis pendens filing')
    if (s.mechanicsLien) signals.push('mechanics lien')
    if (s.civilJudgment) signals.push('civil judgment')
    if (s.uccLien) signals.push('maturing UCC lien')
    s1 = `High motivation seller with ${signals.join(' and ')}.`
  } else if (b.motivation >= 12) {
    const signals: string[] = []
    if (s.taxDelinquency) signals.push('tax delinquency')
    if (s.uccLien) signals.push('maturing UCC lien')
    if (s.expiredPermit) signals.push('expired permit')
    if (s.civilJudgment) signals.push('civil judgment')
    s1 = `Early distress indicators — ${signals.join(', ')}.`
  } else if (b.offerDeal >= 12) {
    const pct = p.offerPrice && p.askingPrice ? (((p.askingPrice - p.offerPrice) / p.askingPrice) * 100).toFixed(0) : null
    s1 = pct ? `Strong deal structure with offer ${pct}% below ask.` : 'Favorable deal structure with meaningful discount to ask.'
  } else if (b.businessPlan >= 15) {
    s1 = 'High-upside business plan with multiple value creation levers.'
  } else if (b.ownerProfile >= 15) {
    const details: string[] = []
    if (s.ownerAge && s.ownerAge >= 55) details.push(`age-${s.ownerAge} owner`)
    if (s.yearsOwned && s.yearsOwned >= 15) details.push(`${s.yearsOwned} years of ownership`)
    s1 = `Favorable owner profile — ${details.join(' and ')} suggest succession or liquidity motivation.`
  } else if (b.valueAdd >= 15) {
    s1 = 'Strong value-add profile with multiple improvement levers.'
  } else if (capRate !== null && capRate > 0.075) {
    s1 = `Above-market ${(capRate * 100).toFixed(1)}% cap rate on a stabilized asset.`
  } else if (total >= 70) {
    s1 = 'Moderate opportunity with financial upside and a manageable entry point.'
  } else {
    s1 = 'Limited distress and value-add signals — primarily a financial-quality play.'
  }

  let s2: string
  if (p.institutionalOwner) {
    s2 = 'Institutional or REIT ownership limits off-market negotiation potential.'
  } else if (occ >= 95 && rentsAboveAtMarket(p)) {
    s2 = 'Fully stabilized at above-market rents — limited upside, better suited for a core buyer.'
  } else if (p.yearBuilt >= 2020) {
    s2 = 'Recently built facility — limited value-add runway, pricing should reflect stabilized yield.'
  } else if (b.businessPlan >= 15) {
    const upsides: string[] = []
    if ((p.noiUpsidePct ?? 0) >= 25) upsides.push(`${p.noiUpsidePct}% NOI upside`)
    if ((p.rentIncreasePotentialPct ?? 0) >= 10) upsides.push(`${p.rentIncreasePotentialPct}% rent increase potential`)
    if ((p.occupancyUpsidePct ?? 0) >= 10) upsides.push(`${p.occupancyUpsidePct}% occupancy upside`)
    if (p.excessLand === true) upsides.push('expansion land')
    s2 = `Business plan upside through ${upsides.join(', ')}.`
  } else if (b.valueAdd >= 15) {
    const upsides: string[] = []
    if (occ < 80) upsides.push(`occupancy at ${occ.toFixed(0)}% has room to grow`)
    if ((p.rentsBelowMarketPct ?? 0) >= 10) upsides.push(`rents ${p.rentsBelowMarketPct}% below market`)
    if (p.excessLand === true) upsides.push('expansion land available')
    if (p.selfManaged) upsides.push('professional management upside')
    s2 = `Strong value-add path through ${upsides.join(', ')}.`
  } else if (b.motivation >= 18 && b.valueAdd >= 5) {
    s2 = 'Motivated seller combined with operational upside makes this a priority outreach target.'
  } else if (occ < 75) {
    s2 = 'Below-average occupancy and deferred maintenance create a clear basis-play opportunity.'
  } else if (total < 40) {
    s2 = 'Monitor for further distress development before committing outreach resources.'
  } else {
    s2 = 'Outreach warranted to explore seller motivation and pricing flexibility.'
  }

  return `${s1} ${s2}`
}

function rentsAboveAtMarket(p: PipelineProperty): boolean {
  return (p.rentsAboveMarketPct ?? 0) >= 0 && (p.rentsBelowMarketPct ?? 0) === 0
}
