import type { NextApiRequest, NextApiResponse } from 'next'
import { Lead, LeadDistressSignals, generateLeadId, scoreLead } from '@/lib/leadsData'

// ─── Target markets ────────────────────────────────────────────────────────────
const TARGET_STATES = ['TX', 'GA', 'SC', 'TN', 'AZ', 'FL', 'AL', 'MS']

// ─── Craigslist RSS scanner ────────────────────────────────────────────────────
const CRAIGSLIST_CITIES: { city: string; state: string; subdomain: string }[] = [
  { city: 'Dallas', state: 'TX', subdomain: 'dallas' },
  { city: 'Houston', state: 'TX', subdomain: 'houston' },
  { city: 'San Antonio', state: 'TX', subdomain: 'sanantonio' },
  { city: 'Atlanta', state: 'GA', subdomain: 'atlanta' },
  { city: 'Nashville', state: 'TN', subdomain: 'nashville' },
  { city: 'Phoenix', state: 'AZ', subdomain: 'phoenix' },
  { city: 'Tampa', state: 'FL', subdomain: 'tampa' },
  { city: 'Jacksonville', state: 'FL', subdomain: 'jacksonville' },
  { city: 'Columbia', state: 'SC', subdomain: 'columbia' },
  { city: 'Birmingham', state: 'AL', subdomain: 'birmingham' },
]

async function scanCraigslist(): Promise<Lead[]> {
  const leads: Lead[] = []

  for (const { city, state, subdomain } of CRAIGSLIST_CITIES) {
    try {
      const url = `https://${subdomain}.craigslist.org/search/bfs?query=self+storage&format=rss`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const xml = await res.text()

      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
      for (const item of items.slice(0, 5)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
        const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || ''

        const isSelfStorage = /self.?storage|storage (unit|facility|business|property)/i.test(`${title} ${desc}`)
        const isForSale = /for sale|selling|price|asking/i.test(`${title} ${desc}`)
        if (!isSelfStorage || !isForSale) continue

        const priceMatch = desc.match(/\$\s*([\d,]+)/)
        const askingPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined

        const signals: LeadDistressSignals = {}
        const score = scoreLead(signals)

        leads.push({
          id: generateLeadId(),
          facilityName: title.slice(0, 80),
          address: 'See listing',
          city,
          state,
          askingPrice,
          ownerName: 'Unknown',
          source: 'craigslist',
          sourceUrl: link,
          distressSignals: signals,
          score,
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
      }
    } catch {
      // Individual city failure is non-fatal
    }
  }

  return leads
}

// ─── BizBuySell scanner ────────────────────────────────────────────────────────
async function scanBizBuySell(): Promise<Lead[]> {
  const leads: Lead[] = []

  for (const state of TARGET_STATES.slice(0, 4)) {
    try {
      const url = `https://www.bizbuysell.com/self-storage-businesses-for-sale/?q=${state}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YEMAcquisitions/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const html = await res.text()

      // Extract listing cards
      const listingPattern = /<a[^>]+href="(\/Business-Opportunity\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/g
      let match
      let count = 0
      while ((match = listingPattern.exec(html)) !== null && count < 5) {
        const href = match[1]
        const rawTitle = match[2].replace(/<[^>]+>/g, '').trim()
        if (!rawTitle || !/storage/i.test(rawTitle)) continue

        const priceMatch = html.slice(match.index, match.index + 500).match(/\$([\d,]+)/)
        const asking = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined

        const signals: LeadDistressSignals = {}
        leads.push({
          id: generateLeadId(),
          facilityName: rawTitle,
          address: 'See listing',
          city: state,
          state,
          askingPrice: asking,
          ownerName: 'Unknown',
          source: 'bizbuysell',
          sourceUrl: `https://www.bizbuysell.com${href}`,
          distressSignals: signals,
          score: scoreLead(signals),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
        count++
      }
    } catch {
      // Non-fatal
    }
  }

  return leads
}

// ─── CourtListener scanner (free REST API, no key needed) ─────────────────────
async function scanCourtListener(): Promise<Lead[]> {
  const leads: Lead[] = []

  try {
    const url = 'https://www.courtlistener.com/api/rest/v4/search/?type=r&q=%22self+storage%22&filed_after=' +
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) +
      '&order_by=score+desc&format=json&page_size=20'

    const res = await fetch(url, {
      headers: { 'User-Agent': 'YEMAcquisitions/1.0 (joshuaernst@gmail.com)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`CourtListener ${res.status}`)
    const data = await res.json()

    for (const result of (data.results || []).slice(0, 10)) {
      const caseName: string = result.caseName || result.case_name || ''
      const court: string = result.court || result.court_id || ''
      const stateMatch = court.match(/\b(tx|ga|sc|tn|az|fl|al|ms)\b/i)?.[1]?.toUpperCase()
      if (!stateMatch) continue

      const signals: LeadDistressSignals = { lisPendens: true }
      leads.push({
        id: generateLeadId(),
        facilityName: caseName.slice(0, 80),
        address: 'See court record',
        city: court,
        state: stateMatch,
        ownerName: caseName.split(/\bv\.?\b/i)[0]?.trim().slice(0, 60) || 'Unknown',
        source: 'courtlistener',
        sourceUrl: `https://www.courtlistener.com${result.absolute_url || ''}`,
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })
    }
  } catch {
    // Non-fatal
  }

  return leads
}

// ─── LoopNet stub (returns empty; scraping requires Playwright) ───────────────
async function scanLoopNet(): Promise<Lead[]> {
  return []
}

// ─── Facebook Marketplace stub ────────────────────────────────────────────────
async function scanFacebook(): Promise<Lead[]> {
  return []
}

// ─── Email digest via Resend ──────────────────────────────────────────────────
async function sendLeadDigest(leads: Lead[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || leads.length === 0) return

  const hot = leads.filter(l => l.score >= 70)
  const warm = leads.filter(l => l.score >= 40 && l.score < 70)

  const rows = (arr: Lead[]) =>
    arr.map(l =>
      `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${l.facilityName || l.address}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${l.city}, ${l.state}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${l.source}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:bold;color:${l.score >= 70 ? '#c0392b' : '#e67e22'}">${l.score}</td>
      </tr>`
    ).join('')

  const html = `
    <h2 style="font-family:Georgia,serif;color:#1B2B5E">YEM Acquisitions — Morning Lead Digest</h2>
    <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    <p><strong>${leads.length} new leads</strong> found — ${hot.length} HOT · ${warm.length} WARM</p>
    ${hot.length ? `<h3 style="color:#c0392b">🔴 HOT Leads (${hot.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px">
      <thead><tr style="background:#f8f8f8">
        <th style="padding:6px 12px;text-align:left">Facility</th>
        <th style="padding:6px 12px;text-align:left">Location</th>
        <th style="padding:6px 12px;text-align:left">Source</th>
        <th style="padding:6px 12px;text-align:left">Score</th>
      </tr></thead>
      <tbody>${rows(hot)}</tbody>
    </table>` : ''}
    ${warm.length ? `<h3 style="color:#e67e22">🟡 WARM Leads (${warm.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px">
      <thead><tr style="background:#f8f8f8">
        <th style="padding:6px 12px;text-align:left">Facility</th>
        <th style="padding:6px 12px;text-align:left">Location</th>
        <th style="padding:6px 12px;text-align:left">Source</th>
        <th style="padding:6px 12px;text-align:left">Score</th>
      </tr></thead>
      <tbody>${rows(warm)}</tbody>
    </table>` : ''}
    <p style="margin-top:24px;font-size:12px;color:#999">YEM Acquisitions Lead Intelligence · Automated Morning Digest</p>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'YEM Leads <leads@yemacquisitions.com>',
      to: ['joshuaernst@gmail.com'],
      subject: `YEM Lead Digest — ${leads.length} new leads (${new Date().toLocaleDateString()})`,
      html,
    }),
  })
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Protect cron from public access
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow direct POST from authenticated UI (no secret header)
    if (req.method === 'GET') {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const sendEmail = req.query.email !== '0'

  try {
    const [craigslistLeads, bizBuySellLeads, courtLeads, loopnetLeads, fbLeads] =
      await Promise.allSettled([
        scanCraigslist(),
        scanBizBuySell(),
        scanCourtListener(),
        scanLoopNet(),
        scanFacebook(),
      ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : [])))

    const allLeads = [...craigslistLeads, ...bizBuySellLeads, ...courtLeads, ...loopnetLeads, ...fbLeads]

    const sources = {
      craigslist: craigslistLeads.length,
      bizbuysell: bizBuySellLeads.length,
      courtlistener: courtLeads.length,
      loopnet: loopnetLeads.length,
      facebook: fbLeads.length,
    }

    if (sendEmail && allLeads.length > 0) {
      try {
        await sendLeadDigest(allLeads)
      } catch {
        // Email failure is non-fatal
      }
    }

    return res.status(200).json({
      success: true,
      total: allLeads.length,
      sources,
      leads: allLeads,
      scannedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Lead scan error:', err)
    return res.status(500).json({ error: 'Lead scan failed', detail: String(err) })
  }
}
