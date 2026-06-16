import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ExpenseLineItem {
  id:         string
  label:      string
  amount:     number
  source?:    string
  confidence?: number
}

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
    operatingExpenses,
  } = req.body as {
    propertyName?: string; address?: string; city?: string; state?: string
    unitCount?: string; unitMix?: string; occupancy?: string; askingPrice?: string
    noi?: string; grossRevenue?: string; yearBuilt?: string; sqft?: string
    capRate?: string; brokerName?: string; ownerName?: string; sourceType?: string
    notes?: string; operatingExpenses?: ExpenseLineItem[]
  }

  if (!city || !state || !unitCount || !occupancy || !askingPrice || !noi) {
    return res.status(400).json({ error: 'Required: city, state, unitCount, occupancy, askingPrice, noi' })
  }

  const asking     = parseFloat(String(askingPrice).replace(/[^0-9.]/g, ''))
  const statedNOI  = parseFloat(String(noi).replace(/[^0-9.]/g, ''))
  const units      = parseFloat(String(unitCount))
  const sf         = sqft  ? parseFloat(String(sqft).replace(/[^0-9.]/g, ''))  : null
  const revenue    = grossRevenue ? parseFloat(String(grossRevenue).replace(/[^0-9.]/g, '')) : null
  const capRateNum = capRate ? parseFloat(String(capRate)) : null

  const impliedCap   = asking > 0 && statedNOI > 0 ? ((statedNOI / asking) * 100) : null
  const effectiveCap = capRateNum ?? impliedCap
  const pricePerUnit = units > 0 ? asking / units : null
  const pricePerSF   = sf && sf > 0 ? asking / sf : null
  const isMarketed   = sourceType === 'broker' || (brokerName && brokerName.trim().length > 0)

  // ── Operating expense reconciliation ────────────────────────────────────────
  const expenses: ExpenseLineItem[] = Array.isArray(operatingExpenses) ? operatingExpenses : []
  const hasExpenses = expenses.length > 0
  const totalOpEx   = hasExpenses ? expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) : null
  const expenseRatioFromLineItems = (totalOpEx != null && revenue && revenue > 0)
    ? (totalOpEx / revenue * 100) : null
  const expenseRatioSimple = (revenue && revenue > 0)
    ? ((revenue - statedNOI) / revenue * 100) : null
  const expenseRatio = expenseRatioFromLineItems ?? expenseRatioSimple

  // Reconcile: Revenue − OpEx = Calculated NOI
  const calcNOI    = (revenue != null && totalOpEx != null) ? (revenue - totalOpEx) : null
  const noiVariance = (calcNOI != null && statedNOI > 0)
    ? Math.abs(calcNOI - statedNOI) / statedNOI : null
  const noiMismatch = noiVariance != null && noiVariance > 0.02

  // ── Property summary lines ───────────────────────────────────────────────────
  const lines: string[] = [
    `Name: ${propertyName || 'Undisclosed'}`,
    address ? `Address: ${address}` : null,
    `Location: ${city}, ${state}`,
    `Units: ${unitCount}${unitMix ? ` | Mix: ${unitMix}` : ''}`,
    `Occupancy: ${pct(parseFloat(String(occupancy)))} | Year Built: ${yearBuilt || 'Unknown'}`,
    sf ? `Rentable SF: ${sf.toLocaleString()} SF` : null,
    `Asking Price: ${fmt(asking)} | Stated Annual NOI: ${fmt(statedNOI)}`,
    revenue ? `Gross Revenue: ${fmt(revenue)}` : null,
    expenseRatio != null ? `Expense Ratio: ${pct(expenseRatio)} (industry benchmark ~35–45%)` : null,
    effectiveCap ? `Cap Rate: ${pct(effectiveCap)} (${capRateNum ? 'stated' : 'implied'})` : null,
    pricePerUnit ? `Price/Unit: ${fmt(pricePerUnit)}` : null,
    pricePerSF   ? `Price/SF: ${fmt(pricePerSF)}`   : null,
    brokerName   ? `Broker: ${brokerName}` : null,
    ownerName    ? `Owner/Seller: ${ownerName}` : null,
    isMarketed   ? 'Deal context: Marketed / broker-listed' : 'Deal context: Off-market / direct',
    notes        ? `Notes: ${notes}` : null,
  ].filter(Boolean) as string[]

  // ── Operating expense table for prompt ──────────────────────────────────────
  let expenseBlock = ''
  if (hasExpenses) {
    const rows = expenses
      .map(e => {
        const src  = e.source ? ` [${e.source}]` : ''
        const conf = e.confidence != null ? ` (conf: ${(e.confidence * 100).toFixed(0)}%)` : ''
        return `  • ${e.label}${src}: ${fmt(e.amount)}${conf}`
      })
      .join('\n')

    expenseBlock = `\n\n**OPERATING EXPENSES (extracted from documents):**\n${rows}\n  ─────────────────────────────────\n  Total Operating Expenses: ${fmt(totalOpEx)}`

    if (calcNOI != null) {
      expenseBlock += `\n  Calculated NOI (Revenue − OpEx): ${fmt(calcNOI)}`
      expenseBlock += `\n  Stated NOI: ${fmt(statedNOI)}`
      if (noiMismatch) {
        expenseBlock += `\n  ⚠ NOI MISMATCH: variance is ${pct(noiVariance! * 100)} — investigate before underwriting`
      } else {
        expenseBlock += `\n  ✓ NOI reconciles within 2%`
      }
    }
  }

  // ── Prompt ──────────────────────────────────────────────────────────────────
  const prompt = `You are a senior acquisition analyst at a private self-storage investment firm. \
Provide a rigorous, institutional-quality deal triage analysis. The goal is a fast go/no-go verdict.

**PROPERTY:**
${lines.join('\n')}${expenseBlock}

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

**4. Expense Quality & NOI Integrity**
${hasExpenses
  ? `Review every line item in the operating expense table above. \
Flag any unusual, missing, or suspicious expenses (e.g. missing management fee, below-market insurance, no reserves, \
one-time items mixed into recurring expenses). \
Comment on expense quality and any items that warrant further diligence. \
${noiMismatch ? `There is a ${pct(noiVariance! * 100)} variance between the stated NOI and the calculated NOI — identify the most likely cause.` : 'The NOI reconciles cleanly — confirm this is consistent with the expense detail.'}`
  : `No line-item expense detail was provided. \
Comment on what expense categories are typically seen in self-storage operations and flag what diligence \
items should be requested (T12 by category, management fee structure, tax bills, insurance binder).`}

**5. Value-Add Upside**
Identify specific, quantifiable upside: rate optimization (estimate $/unit/month gap to market), expansion potential, operational improvements. \
If occupancy is below 90%, estimate stabilized NOI and implied value at market cap rates.

**6. Key Risks**
Top 3–5 risks: supply pipeline, age/capex requirements, market saturation, operational complexity, \
${isMarketed ? 'competitive bidding process' : 'off-market execution risk'}. Be specific.

**7. Go / No-Go Verdict**
**STRONG BUY / BUY / NEGOTIATE / PASS** — one clear recommendation. \
If Buy or Negotiate, provide a target offer price or range with supporting math. \
If Pass, state the exact reason and what would need to change.

Be direct, quantitative, and institutional. No hedging.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2200,
      messages: [{ role: 'user', content: prompt }],
    })
    const analysis = message.content[0].type === 'text' ? message.content[0].text : ''
    return res.status(200).json({ analysis })
  } catch (err) {
    console.error('Anthropic error:', err)
    return res.status(500).json({ error: 'Analysis unavailable. Check ANTHROPIC_API_KEY.' })
  }
}
