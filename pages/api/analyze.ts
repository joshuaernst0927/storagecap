import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { propertyName, city, state, unitCount, unitMix, occupancy, askingPrice, noi, yearBuilt, notes } = req.body

  if (!city || !state || !unitCount || !occupancy || !askingPrice || !noi) {
    return res.status(400).json({ error: 'Required: city, state, unitCount, occupancy, askingPrice, noi' })
  }

  const asking = parseFloat(String(askingPrice).replace(/[^0-9.]/g, ''))
  const netIncome = parseFloat(String(noi).replace(/[^0-9.]/g, ''))
  const impliedCap = ((netIncome / asking) * 100).toFixed(2)
  const pricePerUnit = (asking / parseFloat(String(unitCount))).toFixed(0)

  const prompt = `You are a senior acquisition analyst at a private self-storage investment firm. Provide a rigorous, institutional-quality acquisition analysis.

**Property:**
- Name: ${propertyName || 'Undisclosed'}
- Location: ${city}, ${state}
- Units: ${unitCount} | Mix: ${unitMix || 'Not provided'}
- Occupancy: ${occupancy}% | Year Built: ${yearBuilt || 'Unknown'}
- Asking Price: $${askingPrice} | Annual NOI: $${noi}
- Implied Cap Rate: ${impliedCap}% | Price/Unit: $${pricePerUnit}
- Notes: ${notes || 'None'}

Provide a comprehensive analysis with these exact sections:

**1. Cap Rate & Pricing Analysis**
Evaluate the implied cap rate vs. current market rates for self-storage in this geography. Is pricing fair, aggressive, or discounted? Comment on price-per-unit relative to replacement cost. Be specific and quantitative.

**2. Market Assessment**
Analyze self-storage demand fundamentals for ${city}, ${state}. Population trends, employment base, new supply pipeline, competitive landscape. Rate: Strong / Moderate / Weak with rationale.

**3. Operational Assessment**
Based on occupancy and unit mix, evaluate current operational performance. Is there a revenue gap to market? Does occupancy suggest competitive positioning strength or weakness?

**4. Value-Add Opportunities**
Identify specific, quantifiable upside: rate optimization (estimate $/unit/month gap), unit mix conversion, ancillary revenue, expansion potential, operational improvements.

**5. Key Risk Factors**
List the top 3–5 risks: supply risk, age/capex requirements, market saturation, operational complexity, macro factors. Be specific.

**6. Recommendation**
**Strong Buy / Buy / Negotiate / Pass** — clear recommendation with rationale. If Buy or Negotiate, provide a suggested offer price or range with supporting logic.

Write directly and quantitatively. Institutional tone. No excessive hedging.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    const analysis = message.content[0].type === 'text' ? message.content[0].text : ''
    return res.status(200).json({ analysis })
  } catch (err) {
    console.error('Anthropic error:', err)
    return res.status(500).json({ error: 'Analysis unavailable. Check ANTHROPIC_API_KEY.' })
  }
}
