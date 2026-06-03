import type { NextApiRequest, NextApiResponse } from 'next'
import Anthropic from '@anthropic-ai/sdk'
import { UNIVERSAL_CRITERIA, SPECIFIC_CRITERIA, type DealType, type DealScoreInputs } from '@/lib/dealScore'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { facilityName, address, city, state, askingPrice, noi, capRate, occupancy, unitCount, yearBuilt, sqft, highlights } = req.body

  const allCriteria = [
    ...UNIVERSAL_CRITERIA,
    ...SPECIFIC_CRITERIA['value-add'],
    ...SPECIFIC_CRITERIA['stabilized'],
    ...SPECIFIC_CRITERIA['distressed'],
  ]

  const dealLines = [
    facilityName        && `Facility: ${facilityName}`,
    (city || state)     && `Location: ${[address, city, state].filter(Boolean).join(', ')}`,
    askingPrice         && `Asking Price: $${Number(askingPrice).toLocaleString()}`,
    noi                 && `NOI: $${Number(noi).toLocaleString()}/yr`,
    capRate             && `Cap Rate: ${capRate}%`,
    occupancy           && `Occupancy: ${occupancy}%`,
    unitCount           && `Units: ${unitCount}`,
    yearBuilt           && `Year Built: ${yearBuilt}`,
    sqft                && `Sq Ft: ${sqft}`,
    (highlights as string[] | undefined)?.length && `Highlights: ${(highlights as string[]).join('; ')}`,
  ].filter(Boolean).join('\n')

  const criteriaDesc = allCriteria
    .map(c => `  "${c.key}": ${c.hint} (0–${c.max} pts, group: ${c.group})`)
    .join('\n')

  const prompt = `Score this self-storage acquisition deal on a 100-point framework.

DEAL:
${dealLines}

CRITERIA:
${criteriaDesc}

Instructions:
1. Choose dealType: "value-add" (rent gap/occupancy upside below 90%), "stabilized" (income play, strong occupancy 90%+, quality cap), or "distressed" (owner problem — liens/violations/age — but asset has bones)
2. Score each criterion 0 to its max based only on available evidence. Score conservatively — score 0 if data is missing.
3. Return ONLY a JSON object with no markdown:

{
  "dealType": "value-add",
  "reasoning": "One sentence explaining deal type and overall quality level.",
  "scores": {
    "highwayVisibility": 0,
    "populationGrowth": 0,
    "supplyConstraints": 0,
    "rentTrajectory": 0,
    "priceVsReplacement": 0,
    "currentVsFutureNOI": 0,
    "goingInCapVsMarket": 0,
    "pricePerUnitVsComps": 0,
    "distressLevel": 0,
    "timePressure": 0,
    "offMarketBonus": 0,
    "rentToMarketGap": 0,
    "occupancyUpside": 0,
    "expansionOptionality": 0,
    "expenseReduction": 0,
    "goingInCapThreshold": 0,
    "occupancyStability": 0,
    "expenseRatioEfficiency": 0,
    "refinanceHoldOption": 0,
    "ownerVsAssetProblem": 0,
    "physicalBones": 0,
    "pathToStabilization": 0
  }
}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    const dealType: DealType = ['value-add', 'stabilized', 'distressed'].includes(parsed.dealType)
      ? parsed.dealType as DealType
      : 'value-add'
    const scores = parsed.scores ?? {}
    const inputs: DealScoreInputs = { dealType, ...scores }

    return res.status(200).json({ inputs, reasoning: parsed.reasoning ?? '' })
  } catch (err) {
    return res.status(500).json({ error: 'Auto-scoring failed', detail: String(err) })
  }
}
