import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'
import { Lead, LeadDistressSignals, generateLeadId, scoreLead, getLeadTier, SOURCE_LABELS } from '@/lib/leadsData'

// ─── Target markets ────────────────────────────────────────────────────────────
const TARGET_STATES = ['TX', 'GA', 'SC', 'TN', 'AZ', 'FL', 'AL', 'MS']
const CL_TARGET_STATES = ['FL', 'TX', 'NC', 'GA', 'TN', 'OH', 'SC']

// ─── CourtListener — bankruptcy court IDs by target state ─────────────────────
// Suffix 'b' = bankruptcy court
const BANKRUPTCY_COURTS = new Set([
  'flsb', 'flmb', 'flnb',          // Florida
  'txsb', 'txeb', 'txnb', 'txwb',  // Texas
  'nceb', 'ncmb', 'ncwb',          // North Carolina
  'ganb', 'gamb', 'gasb',          // Georgia
  'tneb', 'tnmb', 'tnwb',          // Tennessee
  'ohnb', 'ohsb',                   // Ohio
  'scb',                            // South Carolina
])

// Extract 2-char state abbreviation from court ID (e.g. "flsb" → "FL")
const COURT_STATE_MAP: Record<string, string> = {
  fl: 'FL', tx: 'TX', nc: 'NC', ga: 'GA',
  tn: 'TN', oh: 'OH', sc: 'SC',
}

function stateFromCourtId(courtId: string): string | null {
  const prefix = courtId.slice(0, 2).toLowerCase()
  return COURT_STATE_MAP[prefix] || null
}

function cityFromCourtId(courtId: string): string {
  const labels: Record<string, string> = {
    flsb: 'Miami, FL',       flmb: 'Orlando, FL',     flnb: 'Tallahassee, FL',
    txsb: 'Houston, TX',     txeb: 'Tyler, TX',        txnb: 'Dallas, TX',       txwb: 'San Antonio, TX',
    nceb: 'Raleigh, NC',     ncmb: 'Greensboro, NC',  ncwb: 'Charlotte, NC',
    ganb: 'Atlanta, GA',     gamb: 'Macon, GA',        gasb: 'Savannah, GA',
    tneb: 'Knoxville, TN',   tnmb: 'Nashville, TN',   tnwb: 'Memphis, TN',
    ohnb: 'Cleveland, OH',   ohsb: 'Columbus, OH',
    scb:  'Columbia, SC',
  }
  return labels[courtId] || courtId.toUpperCase()
}

function chapterFromCause(cause: string): string {
  const m = (cause || '').match(/chapter\s+(\d+)/i)
  return m ? `Chapter ${m[1]}` : 'Bankruptcy'
}

// ─── CourtListener dockets query ──────────────────────────────────────────────
interface CLDocket {
  id: number
  absolute_url?: string
  case_name?: string
  case_name_short?: string
  docket_number?: string
  court_id?: string
  court?: string   // may be URL like ".../courts/flsb/"
  date_filed?: string
  cause?: string
  nature_of_suit?: string
}

async function clFetch(query: string, token: string, filedAfter: string, court?: string): Promise<CLDocket[]> {
  const params = new URLSearchParams({
    q: query,
    order_by: 'date_filed',
    date_filed__gte: filedAfter,
    page_size: '50',
    format: 'json',
  })
  if (court) params.set('court', court)
  const url = `https://www.courtlistener.com/api/rest/v3/dockets/?${params}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      'User-Agent': 'YEMAcquisitions/1.0 (joshuaernst@gmail.com)',
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`CL ${court || 'global'} HTTP ${res.status}`)
  const data = await res.json()
  return (data.results || []) as CLDocket[]
}

function courtIdFromDocket(d: CLDocket): string {
  if (d.court_id) return d.court_id.toLowerCase()
  // court field is a URL like ".../courts/flsb/"
  if (d.court) {
    const m = d.court.match(/\/courts\/([^/]+)\/?$/)
    if (m) return m[1].toLowerCase()
  }
  return ''
}

async function scanCourtListener(): Promise<{ leads: Lead[]; errors: string[] }> {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) return { leads: [], errors: ['COURTLISTENER_TOKEN not configured'] }

  // 1 year lookback — bankruptcy cases linger for months
  const filedAfter = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)

  // Query EVERY target bankruptcy court directly so we never have to post-filter by court.
  // Broader keyword "storage" catches "ABC Storage LLC", "Self Storage Partners", etc.
  const courtIds = Array.from(BANKRUPTCY_COURTS)
  const results = await Promise.allSettled(
    courtIds.map(courtId => clFetch('storage', token, filedAfter, courtId))
  )

  const errors: string[] = []
  const seen = new Set<number>()
  const rawResults: CLDocket[] = []

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const msg = String(r.reason)
      errors.push(`${courtIds[i]}: ${msg}`)
      console.error(`CourtListener ${courtIds[i]} failed:`, msg)
    } else {
      for (const d of r.value) {
        if (!seen.has(d.id)) {
          seen.add(d.id)
          rawResults.push(d)
        }
      }
    }
  })

  console.log(`CourtListener: ${rawResults.length} raw dockets across ${courtIds.length} courts`)

  const leads: Lead[] = []

  for (const docket of rawResults) {
    const courtId = courtIdFromDocket(docket) || courtIds[0] // fallback to first court
    const state = stateFromCourtId(courtId)
    if (!state) continue

    const caseName = docket.case_name || docket.case_name_short || 'Unknown Case'

    // Must mention storage in the case name to be relevant
    if (!/storage/i.test(caseName)) continue

    const debtorMatch = caseName.match(/in\s+re:?\s+(.+)/i)
    const ownerName = debtorMatch
      ? debtorMatch[1].trim().slice(0, 80)
      : caseName.split(/\s+v\.?\s+/i)[0].trim().slice(0, 80)

    const chapter = chapterFromCause(docket.cause || docket.nature_of_suit || '')
    const locationStr = cityFromCourtId(courtId)
    const [city] = locationStr.split(', ')

    const signals: LeadDistressSignals = {
      bankruptcy: true,
      bankruptcyChapter: chapter,
      bankruptcyDate: docket.date_filed,
      bankruptcyDocket: docket.docket_number,
    }

    leads.push({
      id: generateLeadId(),
      facilityName: caseName.slice(0, 80),
      address: `Case No. ${docket.docket_number || 'N/A'}`,
      city,
      state,
      ownerName,
      source: 'courtlistener',
      sourceUrl: docket.absolute_url
        ? `https://www.courtlistener.com${docket.absolute_url}`
        : `https://www.courtlistener.com/docket/${docket.id}/`,
      distressSignals: signals,
      score: scoreLead(signals),
      status: 'new',
      foundAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      notes: [
        `${chapter} bankruptcy filing`,
        docket.date_filed ? `Filed: ${new Date(docket.date_filed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '',
        docket.cause ? `Cause: ${docket.cause}` : '',
        `Court: ${courtId.toUpperCase()}`,
      ].filter(Boolean).join(' · '),
    })
  }

  console.log(`CourtListener: ${leads.length} storage leads after name filter`)
  return { leads, errors }
}

// ─── Craigslist RSS scanner ────────────────────────────────────────────────────
const CRAIGSLIST_CITIES = [
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

async function scanCraigslist(): Promise<{ leads: Lead[]; errors: string[] }> {
  const results = await Promise.allSettled(
    CRAIGSLIST_CITIES.map(async ({ city, state, subdomain }) => {
      const url = `https://${subdomain}.craigslist.org/search/bfs?query=self+storage&format=rss`
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error(`craigslist ${subdomain}: HTTP ${res.status}`)
      const xml = await res.text()
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
      const leads: Lead[] = []
      for (const item of items.slice(0, 5)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
        const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || ''
        if (!/self.?storage|storage (unit|facility|business|property)/i.test(`${title} ${desc}`)) continue
        if (!/for sale|selling|price|asking/i.test(`${title} ${desc}`)) continue
        const priceMatch = desc.match(/\$\s*([\d,]+)/)
        const signals: LeadDistressSignals = {}
        leads.push({
          id: generateLeadId(),
          facilityName: title.slice(0, 80),
          address: 'See listing',
          city, state,
          askingPrice: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined,
          ownerName: 'Unknown',
          source: 'craigslist',
          sourceUrl: link,
          distressSignals: signals,
          score: scoreLead(signals),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
      }
      return leads
    })
  )
  const errors: string[] = []
  const leads = results.flatMap(r => {
    if (r.status === 'rejected') { console.error(String(r.reason)); errors.push(String(r.reason)); return [] }
    return r.value
  })
  return { leads, errors }
}

// ─── BizBuySell scanner ────────────────────────────────────────────────────────
async function scanBizBuySell(): Promise<{ leads: Lead[]; errors: string[] }> {
  const results = await Promise.allSettled(
    TARGET_STATES.slice(0, 4).map(async (state) => {
      const url = `https://www.bizbuysell.com/self-storage-businesses-for-sale/?q=${state}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YEMAcquisitions/1.0)' },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) throw new Error(`bizbuysell ${state}: HTTP ${res.status}`)
      const html = await res.text()
      const listingPattern = /<a[^>]+href="(\/Business-Opportunity\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/g
      const leads: Lead[] = []
      let match, count = 0
      while ((match = listingPattern.exec(html)) !== null && count < 5) {
        const rawTitle = match[2].replace(/<[^>]+>/g, '').trim()
        if (!rawTitle || !/storage/i.test(rawTitle)) continue
        const priceMatch = html.slice(match.index, match.index + 500).match(/\$([\d,]+)/)
        const signals: LeadDistressSignals = {}
        leads.push({
          id: generateLeadId(),
          facilityName: rawTitle,
          address: 'See listing', city: state, state,
          askingPrice: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined,
          ownerName: 'Unknown',
          source: 'bizbuysell',
          sourceUrl: `https://www.bizbuysell.com${match[1]}`,
          distressSignals: signals,
          score: scoreLead(signals),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
        count++
      }
      return leads
    })
  )
  const errors: string[] = []
  const leads = results.flatMap(r => {
    if (r.status === 'rejected') { console.error(String(r.reason)); errors.push(String(r.reason)); return [] }
    return r.value
  })
  return { leads, errors }
}

// ─── LoopNet fetch scraper ─────────────────────────────────────────────────────
// Note: LoopNet is JS-rendered — this captures SEO-pre-rendered content only.
// Full scraping requires Playwright (see backend/agents/monitor.py).
const LOOPNET_STATES = ['fl', 'tx', 'nc', 'ga', 'tn']
const LOOPNET_STATE_MAP: Record<string, string> = {
  fl: 'FL', tx: 'TX', nc: 'NC', ga: 'GA', tn: 'TN',
}

async function scanLoopNet(): Promise<{ leads: Lead[]; errors: string[] }> {
  const results = await Promise.allSettled(
    LOOPNET_STATES.map(async (stateSlug) => {
      const url = `https://www.loopnet.com/search/self-storage-facilities/${stateSlug}/for-sale/`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) throw new Error(`loopnet ${stateSlug}: HTTP ${res.status}`)
      const html = await res.text()
      const state = LOOPNET_STATE_MAP[stateSlug]
      const leads: Lead[] = []

      // Try JSON-LD structured data first
      const jsonLdMatches = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []
      for (const block of jsonLdMatches) {
        try {
          const jsonStr = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')
          const obj = JSON.parse(jsonStr)
          const items = Array.isArray(obj) ? obj : obj['@graph'] ? obj['@graph'] : [obj]
          for (const item of items) {
            if (!item.name || !/storage/i.test(item.name)) continue
            const addr = item.address || {}
            const priceSpec = item.offers?.price || item.price
            leads.push({
              id: generateLeadId(),
              facilityName: item.name.slice(0, 80),
              address: [addr.streetAddress, addr.addressLocality].filter(Boolean).join(', ') || 'See listing',
              city: addr.addressLocality || state,
              state: addr.addressRegion || state,
              askingPrice: priceSpec ? Math.round(parseFloat(String(priceSpec).replace(/[^\d.]/g, ''))) || undefined : undefined,
              ownerName: 'LoopNet Listing',
              source: 'loopnet',
              sourceUrl: item.url || url,
              distressSignals: {},
              score: scoreLead({}),
              status: 'new',
              foundAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            })
          }
        } catch { /* bad JSON block */ }
      }

      // Fallback: regex-parse listing cards from SSR HTML
      if (leads.filter(l => l.state === state && l.source === 'loopnet').length === 0) {
        const cardPattern = /data-listing-id="(\d+)"[\s\S]{0,2000}?<[^>]+class="[^"]*(?:property-name|listing-title)[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi
        let m
        let count = 0
        while ((m = cardPattern.exec(html)) !== null && count < 8) {
          const listingId = m[1]
          const rawName = m[2].replace(/<[^>]+>/g, '').trim()
          if (!rawName || !/storage/i.test(rawName)) continue

          const chunk = html.slice(m.index, m.index + 1500)
          const priceM = chunk.match(/\$\s*([\d,]+(?:\.\d+)?)\s*[MK]?/i)
          let price: number | undefined
          if (priceM) {
            const raw = priceM[0]
            const val = parseFloat(priceM[1].replace(/,/g, ''))
            price = raw.includes('M') ? Math.round(val * 1_000_000) :
                    raw.includes('K') ? Math.round(val * 1_000) : Math.round(val)
          }

          const cityM = chunk.match(/([A-Za-z\s]+),\s+([A-Z]{2})\s+\d{5}/)
          const city = cityM ? cityM[1].trim() : state

          leads.push({
            id: generateLeadId(),
            facilityName: rawName.slice(0, 80),
            address: 'See LoopNet listing',
            city, state,
            askingPrice: price,
            ownerName: 'LoopNet Listing',
            source: 'loopnet',
            sourceUrl: `https://www.loopnet.com/listing/${listingId}/`,
            distressSignals: {},
            score: scoreLead({}),
            status: 'new',
            foundAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          })
          count++
        }
      }
      return leads
    })
  )
  const errors: string[] = []
  const leads = results.flatMap(r => {
    if (r.status === 'rejected') { console.error(String(r.reason)); errors.push(String(r.reason)); return [] }
    return r.value
  })
  return { leads, errors }
}

// ─── Gmail transporter ────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'joshuaernst@gmail.com',
      pass: process.env.EMAIL_PASSWORD,
    },
  })
}

// ─── Top distress signal label for a lead ────────────────────────────────────
function topSignal(lead: Lead): string {
  const s = lead.distressSignals
  if (s.taxDelinquency) return 'Tax Delinquency'
  if (s.bankruptcy) return s.bankruptcyChapter || 'Bankruptcy Filing'
  if (s.lisPendens) return 'Lis Pendens'
  if (s.fireCodeViolations) return 'Fire Code Violations'
  if (s.decliningOccupancy) return 'Declining Occupancy'
  if (s.outOfStateOwner) return 'Out-of-State Owner'
  if (s.longTermOwner) return 'Long-Term Owner'
  return 'Off-Market Signal'
}

// ─── Build HTML email body ────────────────────────────────────────────────────
export function buildDigestHtml(leads: Lead[], scanDate: Date = new Date()): string {
  const hot = leads.filter(l => getLeadTier(l.score) === 'HOT').sort((a, b) => b.score - a.score)
  const warm = leads.filter(l => getLeadTier(l.score) === 'WARM')
  const bkCount = leads.filter(l => l.distressSignals.bankruptcy).length
  const top5 = [...leads].sort((a, b) => b.score - a.score).slice(0, 5)

  const dateStr = scanDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Source breakdown
  const sourceCounts: Record<string, number> = {}
  for (const l of leads) {
    sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1
  }
  const sourceRows = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([src, count]) => `
      <tr>
        <td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;color:#555">${SOURCE_LABELS[src as keyof typeof SOURCE_LABELS] || src}</td>
        <td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1B2B5E">${count}</td>
      </tr>`).join('')

  // Top 5 leads by score
  const tierStyle = (score: number) => {
    const t = getLeadTier(score)
    if (t === 'HOT') return 'background:#fef2f2;color:#c0392b;border:1px solid #fecaca'
    if (t === 'WARM') return 'background:#fffbeb;color:#d97706;border:1px solid #fde68a'
    return 'background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb'
  }
  const hotRows = top5.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">
        <div style="font-weight:600;color:#1a1a18">${l.facilityName || l.address}</div>
        <div style="font-size:12px;color:#888;margin-top:2px">${l.city}, ${l.state}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;white-space:nowrap">
        <span style="${tierStyle(l.score)};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;font-family:monospace">${l.score} · ${getLeadTier(l.score)}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555">${topSignal(l)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888">${SOURCE_LABELS[l.source as keyof typeof SOURCE_LABELS] || l.source}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e6ea;border-radius:4px;overflow:hidden;max-width:600px">

        <!-- Header -->
        <tr>
          <td style="background:#1B2B5E;padding:28px 32px">
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:300;color:#ffffff">YEM Acquisitions</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;text-transform:uppercase;letter-spacing:0.1em">Morning Lead Digest</div>
          </td>
        </tr>

        <!-- Date + summary -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #f0f0f0">
            <div style="font-size:13px;color:#888;margin-bottom:12px">${dateStr}</div>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:24px;text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#1B2B5E;line-height:1">${leads.length}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">New Leads</div>
                </td>
                <td style="padding-right:24px;text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#c0392b;line-height:1">${hot.length}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">HOT</div>
                </td>
                <td style="padding-right:24px;text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#e67e22;line-height:1">${warm.length}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">WARM</div>
                </td>
                ${bkCount ? `<td style="text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#7c3aed;line-height:1">${bkCount}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">Bankruptcy</div>
                </td>` : ''}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Source breakdown -->
        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #f0f0f0">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;margin-bottom:10px">By Source</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
              ${sourceRows}
            </table>
          </td>
        </tr>

        <!-- Top 5 HOT leads -->
        ${top5.length ? `
        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #f0f0f0">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;margin-bottom:10px">Top Leads by Score</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
              <thead>
                <tr style="background:#f8f9fa">
                  <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Facility</th>
                  <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Score</th>
                  <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Signal</th>
                  <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Source</th>
                </tr>
              </thead>
              <tbody>${hotRows}</tbody>
            </table>
          </td>
        </tr>` : ''}

        <!-- CTA -->
        <tr>
          <td style="padding:24px 32px;text-align:center">
            <a href="https://yemacquisitions.com/leads" style="display:inline-block;background:#D4A843;color:#ffffff;text-decoration:none;padding:12px 28px;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">
              View All Leads →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:11px;color:#aaa;text-align:center">
              YEM Acquisitions LLC · Woodmere, New York · Automated Lead Intelligence · Weekdays 8 AM EST
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Send lead digest via Gmail SMTP ─────────────────────────────────────────
export async function sendLeadDigest(leads: Lead[], scanDate: Date = new Date()): Promise<void> {
  if (!process.env.EMAIL_PASSWORD) {
    console.warn('EMAIL_PASSWORD not set — skipping digest email')
    return
  }
  if (leads.length === 0) return

  const transporter = createTransporter()
  const dateStr = scanDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const hot = leads.filter(l => getLeadTier(l.score) === 'HOT')

  await transporter.sendMail({
    from: '"YEM Acquisitions" <joshuaernst@gmail.com>',
    to: 'joshuaernst@gmail.com',
    subject: `YEM Leads — ${dateStr} — ${leads.length} new lead${leads.length !== 1 ? 's' : ''} found${hot.length ? ` (${hot.length} HOT)` : ''}`,
    html: buildDigestHtml(leads, scanDate),
  })
}

// ─── Persist leads ────────────────────────────────────────────────────────────
// Writes to public/data/leads.json in dev. On Vercel the fs is read-only except
// /tmp, so we fall back there (ephemeral per-instance, but better than nothing).
function persistLeads(newLeads: Lead[]): void {
  const candidates = [
    path.join(process.cwd(), 'public', 'data', 'leads.json'),
    '/tmp/leads.json',
  ]
  for (const filePath of candidates) {
    try {
      let existing: Lead[] = []
      try { existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { /* empty */ }
      const existingIds = new Set(existing.map((l: Lead) => l.id))
      const merged = [...existing, ...newLeads.filter(l => !existingIds.has(l.id))]
      merged.sort((a, b) => new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime())
      fs.writeFileSync(filePath, JSON.stringify(merged.slice(0, 500), null, 2))
      console.log(`Persisted ${merged.length} leads to ${filePath}`)
      return
    } catch (err) {
      console.warn(`persistLeads: could not write to ${filePath}:`, String(err))
    }
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.method === 'GET') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sendEmail = req.query.email !== '0'

  // Race all scanners against a hard deadline so Vercel never kills the function mid-flight
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('scan timeout')), 50000)
  )

  try {
    const [clResult, crResult, bbResult, lnResult] =
      await Promise.race([
        Promise.allSettled([
          scanCourtListener(),
          scanCraigslist(),
          scanBizBuySell(),
          scanLoopNet(),
        ]).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value : { leads: [], errors: [String((r as PromiseRejectedResult).reason)] })),
        deadline,
      ]) as Array<{ leads: Lead[]; errors: string[] }>

    const courtLeads = clResult.leads
    const craigslistLeads = crResult.leads
    const bizBuySellLeads = bbResult.leads
    const loopnetLeads = lnResult.leads

    const scanErrors = {
      courtlistener: clResult.errors,
      craigslist: crResult.errors,
      bizbuysell: bbResult.errors,
      loopnet: lnResult.errors,
    }

    // Log a summary so Vercel function logs show exactly what happened
    console.log('Scan complete:', {
      courtlistener: courtLeads.length,
      craigslist: craigslistLeads.length,
      bizbuysell: bizBuySellLeads.length,
      loopnet: loopnetLeads.length,
      errors: Object.entries(scanErrors).flatMap(([k, v]) => v.map(e => `${k}: ${e}`)),
    })

    const allLeads = [...courtLeads, ...craigslistLeads, ...bizBuySellLeads, ...loopnetLeads]

    if (allLeads.length > 0) persistLeads(allLeads)

    if (sendEmail && allLeads.length > 0) {
      try { await sendLeadDigest(allLeads, new Date()) } catch (err) {
        console.error('Digest email failed:', err)
      }
    }

    return res.status(200).json({
      success: true,
      total: allLeads.length,
      sources: {
        courtlistener: courtLeads.length,
        craigslist: craigslistLeads.length,
        bizbuysell: bizBuySellLeads.length,
        loopnet: loopnetLeads.length,
      },
      errors: scanErrors,
      bankruptcy: courtLeads.length,
      leads: allLeads,
      scannedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Lead scan error:', err)
    return res.status(500).json({ error: 'Lead scan failed', detail: String(err) })
  }
}
