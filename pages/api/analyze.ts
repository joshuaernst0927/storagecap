import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function fmt(n: number | null | undefined, prefix = '$'): string {
  if (n == null || isNaN(n)) return 'N/A'
  return `${prefix}${Math.round(n).toLocaleString()}`
}

function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/A'
  return `${Number(n).toFixed(2)}%`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    propertyName, address, city, state,
    unitCount, unitMix, occupancy, askingPrice, noi, grossRevenue,
    yearBuilt, sqft, capRate, brokerName, ownerName, sourceType, notes,
  } = req.body

  if (!city || !state || !unitCount || !occupancy || !askingPrice || !noi) {
    return res.status(400).json({ error: 'Required: city, state, unitCount, occupancy, askingPrice, noi' })
  }

  const asking      = parseFloat(String(askingPrice).replace(/[^0-9.]/g, ''))
  const netIncome   = parseFloat(String(noi).replace(/[^0-9.]/g, ''))
  const units       = parseFloat(String(unitCount))
  const sf          = sqft ? parseFloat(String(sqft).replace(/[^0-9.]/g, '')) : null
  const revenue     = grossRevenue ? parseFloat(String(grossRevenue).replace(/[^0-9.]/g, '')) : null
  const capRateNum  = capRate ? parseFloat(String(capRate)) : null

  const impliedCap   = asking > 0 && netIncome > 0 ? ((netIncome / asking) * 100) : null
  const effectiveCap = capRateNum ?? impliedCap
  const pricePerUnit = units > 0 ? asking / units : null
  const pricePerSF   = sf && sf > 0 ? asking / sf : null
  const expenseRatio = revenue && revenue > 0 ? ((revenue - netIncome) / revenue * 100) : null
  const isMarketed   = sourceType === 'broker' || (brokerName && brokerName.trim().length > 0)

  const lines: string[] = [
    `Name: ${propertyName || 'Undisclosed'}`,
    address ? `Address: ${address}` : null,
    `Location: ${city}, ${state}`,
    `Units: ${unitCount}${unitMix ? ` | Mix: ${unitMix}` : ''}`,
    `Occupancy: ${pct(parseFloat(String(occupancy)))} | Year Built: ${yearBuilt || 'Unknown'}`,
    sf ? `Rentable SF: ${sf.toLocaleString()} SF` : null,
    `Asking Price: ${fmt(asking)} | Annual NOI: ${fmt(netIncome)}`,
    revenue ? `Gross Revenue: ${fmt(revenue)} | Expense Ratio: ${pct(expenseRatio)}` : null,
    effectiveCap ? `Cap Rate: ${pct(effectiveCap)} (${capRateNum ? 'stated' : 'implied'})` : null,
    pricePerUnit ? `Price/Unit: ${fmt(pricePerUnit)}` : null,
    pricePerSF ? `Price/SF: ${fmt(pricePerSF)}` : null,
    brokerName ? `Broker: ${brokerName}` : null,
    ownerName ? `Owner/Seller: ${ownerName}` : null,
    isMarketed ? 'Deal context: Marketed / broker-listed' : 'Deal context: Off-market / direct',
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean) as string[]

  const prompt = `You are a senior acquisition analyst at a private self-storage investment firm. \
Provide a rigorous, institutional-quality deal triage analysis. The goal is a fast go/no-go verdict.

**PROPERTY:**
${lines.join('\n')}

Provide a comprehensive analysis with these exact sections:

**1. Cap Rate & Pricing Analysis**
Evaluate the ${effectiveCap ? pct(effectiveCap) : 'implied cap rate'} vs. current self-storage market cap rates in ${city}, ${state}. \
Is pricing fair, aggressive, or discounted? Comment on price-per-unit${pricePerSF ? ' and price-per-SF' : ''} relative to replacement cost and recent trades. Be quantitative.

**2. Market Assessment**
Analyze self-storage demand fundamentals for ${city}, ${state}: population and employment trends, new supply pipeline, competitive density. \
Rate the market: **Strong / Moderate / Weak** with one-sentence rationale.

**3. Operational Assessment**
Evaluate current performance at ${pct(parseFloat(String(occupancy)))} occupancy. \
${revenue ? `Expense ratio of ${pct(expenseRatio)} vs. self-storage industry benchmark (~35–45%).` : ''} \
Is there a revenue gap to market? Does occupancy suggest pricing strength or weakness?

**4. Value-Add Upside**
Identify specific, quantifiable upside: rate optimization (estimate $/unit/month gap to market), expansion potential, operational improvements. \
If occupancy is below 90%, estimate stabilized NOI and implied value at market cap rates.

**5. Key Risks**
Top 3–5 risks: supply pipeline, age/capex requirements, market saturation, operational complexity, ${isMarketed ? 'competitive bidding process' : 'off-market execution risk'}. Be specific.

**6. Go / No-Go Verdict**
**STRONG BUY / BUY / NEGOTIATE / PASS** — one clear recommendation. \
If Buy or Negotiate, provide a target offer price or range with supporting math. \
If Pass, state the exact reason and what would need to change.

Be direct, quantitative, and institutional. No hedging.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    })
    const analysis = message.content[0].type === 'text' ? message.content[0].text : ''
    return res.status(200).json({ analysis })
  } catch (err) {
    console.error('Anthropic error:', err)
    return res.status(500).json({ error: 'Analysis unavailable. Check ANTHROPIC_API_KEY.' })
  }
}
