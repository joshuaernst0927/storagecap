#!/usr/bin/env node
'use strict'

/**
 * YEM Acquisitions — Local Lead Scraper
 *
 * Sources covered (16 total):
 *   API-based  : CourtListener (bankruptcy filings)
 *   RSS-based  : Craigslist, BizBuySell
 *   Fetch-based: Brevitas, FSBO.com, Crexi, County Tax (Miami-Dade + Harris),
 *                Lis Pendens (Hillsborough), UCC Liens (TX SOS), SOS LLC (FL Sunbiz),
 *   Puppeteer  : LoopNet, Facebook Marketplace*, BizBuySell
 *   Stubs/TODO : Fire Marshal, Out-of-state Owner
 *
 * Usage:
 *   npm run scrape                              (manual)
 *   node C:\Users\joshu\Downloads\storagecap\scripts\run-scrapers.js  (Task Scheduler)
 *
 * Windows Task Scheduler — daily at 7:30 AM:
 *   Program : node
 *   Arguments: C:\Users\joshu\Downloads\storagecap\scripts\run-scrapers.js
 *   Start in : C:\Users\joshu\Downloads\storagecap
 */

const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin   = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())
const fs   = require('fs')
const path = require('path')

// ─── Load .env.local (works on both local dev and Linux server) ────────────────
;(function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
})()

// ─── Config ────────────────────────────────────────────────────────────────────
const LEADS_FILE    = path.join(__dirname, '..', 'public', 'data', 'leads.json')
const CL_TOKEN      = process.env.COURTLISTENER_TOKEN
const TARGET_STATES = ['TX', 'GA', 'SC', 'TN', 'AZ', 'FL', 'AL', 'MS', 'NC', 'OH']

// Browser paths — Linux server first, then Windows local
const CHROME_PATHS = [
  // Linux (DigitalOcean / Ubuntu)
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  // Windows (local dev)
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  (process.env.LOCALAPPDATA  || '') + '\\Google\\Chrome\\Application\\chrome.exe',
  (process.env.PROGRAMFILES  || '') + '\\Google\\Chrome\\Application\\chrome.exe',
  (process.env.PROGRAMFILES  || '') + '\\Microsoft\\Edge\\Application\\msedge.exe',
  (process.env['PROGRAMFILES(X86)'] || '') + '\\Microsoft\\Edge\\Application\\msedge.exe',
]

// ─── Utilities ─────────────────────────────────────────────────────────────────
function generateLeadId() {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function scoreLead(signals) {
  let score = 0

  // Distress signals (max 30)
  if (signals.taxDelinquency)     score += 25
  if (signals.lisPendens)         score += 20
  if (signals.bankruptcy)         score += 18
  if (signals.fireCodeViolations) score += 15
  if (signals.sosInactive)        score += 15
  if (signals.uccLien)            score += 15
  if (signals.decliningOccupancy) score += 10
  if (signals.outOfStateOwner)    score += 10
  if (signals.longTermOwner)      score += 10
  if ((signals.ownerAge || 0) >= 65) score += 10

  // Value-add / stabilization profile (max 25)
  const occ = signals.occupancyPct || null
  const rentGap = signals.rentBelowMarket || false
  if (occ !== null && occ < 70 && rentGap)        score += 25
  else if (occ !== null && occ < 80 && rentGap)   score += 20
  else if (occ !== null && occ < 88)               score += 15
  else if (occ !== null && occ < 93)               score += 8
  else if (occ !== null)                           score += 3
  else                                             score += 10

  return Math.min(score, 100)
}


function isSelfStorage(text) {
  const hits = ['self storage', 'self-storage', 'storage facility',
    'storage units', 'mini storage', 'mini-storage', 'boat storage',
    'rv storage', 'public storage', 'extra space', 'cubesmart',
    'life storage', 'national storage', 'simply storage', 'storage post',
    'storage mart', 'storagemart', 'storage express', 'storage depot']
  const rejects = ['cold storage', 'data storage', 'wine storage',
    'document storage', 'file storage', 'grain storage',
    'warehouse storage', 'moving and storage', 'u-haul', 'uhaul',
    'records storage', 'pool storage', 'luggage storage']
  const lower = (text || '').toLowerCase()
  const hasHit = hits.some(h => lower.includes(h))
  const hasReject = rejects.some(r => lower.includes(r))
  return hasHit && !hasReject
}
function log(source, msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] [${source.padEnd(14)}] ${msg}`)
}

async function safeFetch(url, options = {}) {
  const { timeout = 12000, headers: extraHeaders = {}, ...rest } = options
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeout),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      ...extraHeaders,
    },
  })
  return res
}

function parseRssXml(xml) {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || []
  return items.map(item => ({
    title: item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        ?? item.match(/<title>(.*?)<\/title>/)?.[1] ?? '',
    link:  item.match(/<link>(.*?)<\/link>/)?.[1] ?? '',
    desc:  item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
        ?? item.match(/<description>(.*?)<\/description>/)?.[1] ?? '',
    geo:   item.match(/<[^:]+:location>(.*?)<\/[^:]+:location>/)?.[1] ?? '',
  }))
}

// ─── 1. CourtListener — real API, bankruptcy filings ──────────────────────────
const BANKRUPTCY_COURTS = [
  'flsb','flmb',
  'txsb','txnb',
  'nceb','ncwb',
  'ganb',
  'tnmb',
  'ohnb',
  'scb',
]
const COURT_CITY = {
  flsb:'Miami',    flmb:'Orlando',     flnb:'Tallahassee',
  txsb:'Houston',  txeb:'Tyler',       txnb:'Dallas',    txwb:'San Antonio',
  nceb:'Raleigh',  ncmb:'Greensboro',  ncwb:'Charlotte',
  ganb:'Atlanta',  gamb:'Macon',       gasb:'Savannah',
  tneb:'Knoxville',tnmb:'Nashville',   tnwb:'Memphis',
  ohnb:'Cleveland',ohsb:'Columbus',
  scb:'Columbia',
}
const COURT_STATE = { fl:'FL', tx:'TX', nc:'NC', ga:'GA', tn:'TN', oh:'OH', sc:'SC' }

async function scanCourtListener() {
  log('CourtListener', `Starting — querying ${BANKRUPTCY_COURTS.length} courts (V4 API)...`)
  const filedAfter = new Date(Date.now() - 545 * 86400_000).toISOString().slice(0, 10) // 18 months

  const seen  = new Set()
  const leads = []

  for (let i = 0; i < BANKRUPTCY_COURTS.length; i++) {
    const courtId = BANKRUPTCY_COURTS[i]
    if (i > 0) await new Promise(r => setTimeout(r, 10000))
    try {
      const params = new URLSearchParams({
        q: '"self storage" OR "self-storage" OR "mini storage" OR "storage units" OR "storage facility"', type: 'r', court: courtId,
        page_size: '50', order_by: 'dateFiled desc',
      })

      let res
      for (let attempt = 0; attempt <= 1; attempt++) {
        res = await fetch(`https://www.courtlistener.com/api/rest/v4/search/?${params}`, {
          headers: {
            Authorization: `Token ${CL_TOKEN}`,
            'User-Agent': 'YEMAcquisitions/1.0 (joshuaernst@gmail.com)',
          },
          signal: AbortSignal.timeout(15000),
        })
        if (res.status === 429) {
          if (attempt === 0) {
            log('CourtListener', `${courtId}: 429 rate-limited — waiting 60s before retry...`)
            await new Promise(r => setTimeout(r, 60000))
          } else {
            log('CourtListener', `${courtId}: 429 on retry — skipping court`)
          }
          continue
        }
        break
      }

      if (!res || !res.ok) { log('CourtListener', `${courtId}: HTTP ${res ? res.status : 'no response'}`); continue }
      const data = await res.json()
      if (data.detail) { log('CourtListener', `${courtId}: ${data.detail}`); continue }

      let found = 0
      for (const d of (data.results || [])) {
        if (seen.has(d.docket_id)) continue
        seen.add(d.docket_id)
        const caseName = d.caseName || ''
        if (!/storage/i.test(caseName)) continue
        if (!isSelfStorage(caseName)) continue
        if (d.dateFiled && d.dateFiled < filedAfter) continue

        const state    = COURT_STATE[courtId.slice(0, 2)] || 'US'
        const city     = COURT_CITY[courtId] || courtId.toUpperCase()
        const chapter  = d.chapter ? `Chapter ${d.chapter}` : 'Bankruptcy'
        const debtorM  = caseName.match(/in\s+re:?\s+(.+)/i)
        const ownerName = debtorM
          ? debtorM[1].trim().slice(0, 80)
          : caseName.split(/\s+v\.?\s+/i)[0].trim().slice(0, 80)

        const signals = {
          bankruptcy: true, bankruptcyChapter: chapter,
          bankruptcyDate: d.dateFiled, bankruptcyDocket: d.docketNumber,
          occupancyPct: null, rentBelowMarket: false,
        }
        leads.push({
          id: generateLeadId(),
          facilityName: caseName.slice(0, 80),
          address: `Case No. ${d.docketNumber || 'N/A'}`,
          city, state, ownerName,
          source: 'courtlistener',
          sourceUrl: `https://www.courtlistener.com${d.docket_absolute_url || '/'}`,
          distressSignals: signals,
          score: scoreLead(signals),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          notes: [
            chapter + ' bankruptcy filing',
            d.dateFiled ? `Filed: ${new Date(d.dateFiled).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}` : '',
            `Court: ${courtId.toUpperCase()}`,
          ].filter(Boolean).join(' · '),
        })
        found++
      }
      if (found > 0) log('CourtListener', `${courtId}: ${found} storage leads`)
    } catch (err) {
      log('CourtListener', `${courtId} error: ${err.message}`)
    }
  }

  log('CourtListener', `Found ${leads.length} total leads`)
  return leads
}

// ─── 2. Lands of America / Land.com — DEPRECATED ─────────────────────────────
async function scanLandsOfAmerica() {
  // DEPRECATED — returns HTTP 400, replaced by BizBuySell/BizQuest
  return []
}

// ─── 2b. BizBuySell — self storage listings by state ──────────────────────────
async function scanBizBuySell(browser) {
  log('BizBuySell', 'Starting (Puppeteer stealth)...')
  const leads = []
  if (!browser) { log('BizBuySell', 'No browser — skipping'); return leads }

  const states = ['texas','georgia','south-carolina','tennessee','arizona','florida','alabama','mississippi','north-carolina','ohio','wisconsin','indiana']

  const randDelay = (min = 2000, max = 5000) => new Promise(r => setTimeout(r, min + Math.floor(Math.random() * (max - min))))

  const randomViewport = () => ({
    width:  1200 + Math.floor(Math.random() * 320),
    height: 800  + Math.floor(Math.random() * 200),
    deviceScaleFactor: 1,
  })

  const stealthMouseMove = async (page) => {
    const vp = page.viewport() || { width: 1280, height: 900 }
    const steps = 3 + Math.floor(Math.random() * 4)
    for (let s = 0; s < steps; s++) {
      const x = 100 + Math.floor(Math.random() * (vp.width  - 200))
      const y = 100 + Math.floor(Math.random() * (vp.height - 200))
      await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 10) })
      await new Promise(r => setTimeout(r, 80 + Math.floor(Math.random() * 150)))
    }
  }

  for (const state of states) {
    try {
      const page = await browser.newPage()
      await page.setViewport(randomViewport())
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

      const urls = [
        `https://www.bizbuysell.com/${state}/storage-facilities-and-warehouses-for-sale/`,
        `https://www.bizbuysell.com/${state}/storage-facility-and-warehouse-business-real-estate/`,
      ]
      for (const url of urls) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await randDelay(2000, 5000)
          await stealthMouseMove(page)
          await randDelay(500, 1500)

          const html = await page.content()
          const stateName = state.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          const stateAbbr = {
            texas:'TX', georgia:'GA', 'south-carolina':'SC', tennessee:'TN', arizona:'AZ',
            florida:'FL', alabama:'AL', mississippi:'MS', 'north-carolina':'NC', ohio:'OH',
            wisconsin:'WI', indiana:'IN',
          }[state] || state.slice(0,2).toUpperCase()

          const titles = [...html.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 5)
          const links = [...html.matchAll(/href="(\/(?:businesses|real-estate)\/[^"?#]+)"/gi)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i)
          const prices = [...html.matchAll(/\$([\d,]+(?:\.\d+)?(?:\s*(?:Million|M|K))?)/gi)].map(m => m[0])
          const phones = [...html.matchAll(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g)].map(m => m[0])

          for (let i = 0; i < Math.min(titles.length, links.length, 25); i++) {
            const title = titles[i]
            if (!title || title.length < 5) continue
            if (!/storage|warehouse|self.stor/i.test(title + (links[i] || ''))) continue
            const signals = { bankruptcy: false, occupancyPct: null, rentBelowMarket: false }
            leads.push({
              id: generateLeadId(),
              facilityName: title.substring(0, 120),
              businessName: title.substring(0, 120),
              address: stateName,
              city: stateName,
              state: stateAbbr,
              askingPrice: prices[i] || null,
              ownerName: 'BizBuySell Listing',
              contactInfo: phones[i] ? { phone: phones[i] } : {},
              source: 'bizbuysell',
              sourceUrl: `https://www.bizbuysell.com${links[i] || ''}`,
              distressSignals: signals,
              score: scoreLead(signals),
              signals: {},
              status: 'new',
              foundAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              notes: `BizBuySell listing — ${stateName}`,
            })
          }
        } catch (pe) { log('BizBuySell', `${state} page error: ${pe.message}`) }
        await randDelay(2000, 5000)
      }
      await page.close()
    } catch (err) { log('BizBuySell', `${state} error: ${err.message}`) }
    await randDelay(2000, 4000)
  }
  log('BizBuySell', `Found ${leads.length} leads`)
  return leads
}

// ─── 2c. BizQuest — self storage listings ─────────────────────────────────────
async function scanBizQuest() {
  log('BizQuest', 'Starting...')
  const leads = []
  try {
    const urls = [
      'https://www.bizquest.com/self-storage-businesses-for-sale/',
    ]
    for (const url of urls) {
      const res = await safeFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      })
      if (!res.ok) { log('BizQuest', `HTTP ${res.status}`); continue }
      const html = await res.text()
      const titles = [...html.matchAll(/<h\d[^>]*class="[^"]*(?:title|name|listing)[^"]*"[^>]*>([\s\S]*?)<\/h\d>/gi)].map(m => m[1].replace(/<[^>]+>/g,'').trim()).filter(t => t.length > 5)
      const links = [...html.matchAll(/href="(\/(?:buy\/)?[^"?#]+storage[^"?#]*)"/gi)].map(m => m[1]).filter((v,i,a) => a.indexOf(v) === i)
      const prices = [...html.matchAll(/\$([\d,]+(?:\s*(?:Million|M|K))?)/gi)].map(m => m[0])
      const INCLUDE_TERMS = /(self[\s-]?storage|mini[\s-]?storage|storage facilit|storage unit|storage yard|boat.{0,10}storage|rv.{0,10}storage|secure storage)/i
      const EXCLUDE_TERMS = /(logistic|freight|3pl|trucking|fulfillment|warehous|saas|software|moving compan|portable storage|franchise|auto repair|marine|waterfront|dealership|flex building|transportation|delivery|courier)/i
      for (let i = 0; i < Math.min(titles.length, 20); i++) {
        if (!titles[i] || titles[i].length < 5) continue
        const t = titles[i]
        if (EXCLUDE_TERMS.test(t)) continue
        if (!INCLUDE_TERMS.test(t)) continue
        leads.push({
          id: generateLeadId(),
          businessName: t.substring(0, 100),
          address: '',
          city: '', state: '',
          askingPrice: prices[i] || null,
          ownerName: 'BizQuest Listing',
          source: 'bizquest',
          sourceUrl: links[i] ? `https://www.bizquest.com${links[i]}` : url,
          score: scoreLead({ bankruptcy: false, occupancyPct: null, rentBelowMarket: false }),
          signals: {},
          distressSignals: {
            taxDelinquency: false,
            fireCodeViolations: false,
            lisPendens: false,
            decliningOccupancy: false,
            outOfStateOwner: false,
            longTermOwner: false,
            occupancyPct: null,
            rentBelowMarket: false,
          },
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          notes: 'BizQuest listing — address not provided by source, see sourceUrl for details.',
        })
      }
      await new Promise(r => setTimeout(r, 800))
    }
  } catch (err) { log('BizQuest', `Error: ${err.message}`) }
  log('BizQuest', `Found ${leads.length} leads`)
  return leads
}

// ─── 3. Showcase.com ──────────────────────────────────────────────────────────
async function scanShowcase() {
  log('Showcase', 'Starting...')
  const leads = []
  try {
    const urls = [
      'https://www.showcase.com/search/?q=self+storage&property_type=industrial&transaction_type=sale',
      'https://www.showcase.com/search/?q=storage+facility&transaction_type=sale',
    ]
    for (const url of urls) {
      const res = await safeFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      })
      if (!res.ok) { log('Showcase', `HTTP ${res.status}`); continue }
      const html = await res.text()
      const jsonMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1])
          const props = data?.props?.pageProps
          const listings = props?.listings || props?.results || props?.properties || []
          for (const l of listings.slice(0, 20)) {
            leads.push({
              id: generateLeadId(),
              businessName: l.name || l.title || l.address || 'Showcase Listing',
              address: l.address || l.street || 'See Showcase listing',
              city: l.city || '', state: l.state || '',
              askingPrice: l.price ? `$${l.price.toLocaleString()}` : null,
              ownerName: l.broker || 'Showcase Listing',
              source: 'showcase',
              sourceUrl: l.url ? `https://www.showcase.com${l.url}` : url,
              score: scoreLead({ bankruptcy: false, occupancyPct: null, rentBelowMarket: false }),
              signals: {},
              foundAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              notes: 'Showcase.com listing',
            })
          }
        } catch(e) {}
      }
    }
  } catch (err) { log('Showcase', `Error: ${err.message}`) }
  log('Showcase', `Found ${leads.length} leads`)
  return leads
}

// ─── 4. Brevitas ──────────────────────────────────────────────────────────────
async function scanBrevitas() {
  log('Brevitas', 'Starting...')
  const leads = []
  try {
    const urls = [
      'https://www.brevitas.com/search/?q=self+storage&type=sale',
      'https://www.brevitas.com/search/?q=storage+facility&type=sale',
    ]
    for (const url of urls) {
      const res = await safeFetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://www.brevitas.com/',
        }
      })
      if (!res.ok) { log('Brevitas', `HTTP ${res.status}`); continue }
      const html = await res.text()
      const jsonMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1])
          const listings = data?.props?.pageProps?.listings || data?.props?.pageProps?.results || []
          for (const l of listings.slice(0, 20)) {
            leads.push({
              id: generateLeadId(),
              businessName: l.name || l.title || l.address || 'Brevitas Listing',
              address: l.address || l.street || 'See Brevitas listing',
              city: l.city || '', state: l.state || '',
              askingPrice: l.price ? `$${Number(l.price).toLocaleString()}` : null,
              ownerName: l.brokerName || l.agentName || 'Brevitas Listing',
              source: 'brevitas',
              sourceUrl: l.url ? `https://www.brevitas.com${l.url}` : url,
              score: scoreLead({ bankruptcy: false, occupancyPct: null, rentBelowMarket: false }),
              signals: {},
              foundAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              notes: 'Brevitas CRE listing',
            })
          }
        } catch(e) {}
      }
    }
  } catch (err) { log('Brevitas', `Error: ${err.message}`) }
  log('Brevitas', `Found ${leads.length} leads`)
  return leads
}

// ─── 5. FSBO.com ──────────────────────────────────────────────────────────────
async function scanFSBO() {
  log('FSBO', 'Starting...')
  const leads = []
  try {
    const res = await safeFetch('https://www.fsbo.com/search?keywords=self+storage&type=commercial', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    if (!res.ok) { log('FSBO', `HTTP ${res.status}`); return leads }
    const html = await res.text()
    const titles = [...html.matchAll(/<h\d[^>]*>([\s\S]*?)<\/h\d>/gi)].map(m => m[1].replace(/<[^>]+>/g,'').trim()).filter(t => /storage/i.test(t))
    const links = [...html.matchAll(/href="(\/listing[^"?#]+)"/gi)].map(m => m[1]).filter((v,i,a) => a.indexOf(v)===i)
    for (let i = 0; i < Math.min(titles.length, links.length, 20); i++) {
      leads.push({
        id: generateLeadId(),
        businessName: titles[i] || 'FSBO Storage Listing',
        address: 'See FSBO listing', city: '', state: '',
        askingPrice: null,
        ownerName: 'FSBO Owner',
        source: 'fsbo',
        sourceUrl: `https://www.fsbo.com${links[i]}`,
        score: scoreLead({ bankruptcy: false, occupancyPct: null, rentBelowMarket: false }),
        signals: {},
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: 'FSBO.com commercial listing',
      })
    }
  } catch (err) { log('FSBO', `Error: ${err.message}`) }
  log('FSBO', `Found ${leads.length} leads`)
  return leads
}

// ─── 6. Crexi — Puppeteer stealth, response sniffing only (no interception) ────
async function scanCrexi(browser) {
  log('Crexi', 'Starting (Puppeteer stealth, response sniffing)...')
  const leads = []
  if (!browser) { log('Crexi', 'No browser — skipping'); return leads }

  const TARGET_STATES_CREXI = ['TX','GA','SC','TN','AZ','FL','AL','MS','NC','OH','WI','IN']

  const randDelay = (min = 2000, max = 4000) => new Promise(r => setTimeout(r, min + Math.floor(Math.random() * (max - min))))

  const randomViewport = () => ({
    width:  1200 + Math.floor(Math.random() * 320),
    height: 800  + Math.floor(Math.random() * 200),
    deviceScaleFactor: 1,
  })

  const stealthMouseMove = async (page) => {
    const vp = page.viewport() || { width: 1280, height: 900 }
    const steps = 3 + Math.floor(Math.random() * 4)
    for (let s = 0; s < steps; s++) {
      const x = 100 + Math.floor(Math.random() * (vp.width  - 200))
      const y = 100 + Math.floor(Math.random() * (vp.height - 200))
      await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 10) })
      await new Promise(r => setTimeout(r, 80 + Math.floor(Math.random() * 150)))
    }
  }

  for (const state of TARGET_STATES_CREXI) {
    let page
    try {
      page = await browser.newPage()
      await page.setViewport(randomViewport())
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

      const apiResults = []

      page.on('response', async res => {
        try {
          const u = res.url()
          if (u.includes('crexi.com') && (u.includes('/search') || u.includes('/properties') || u.includes('/api/')) && (res.headers()['content-type'] || '').includes('json')) {
            const json = await res.json().catch(() => null)
            if (json) {
              const items = json.data || json.results || json.properties || json.listings || []
              if (Array.isArray(items) && items.length > 0) apiResults.push(...items)
            }
          }
        } catch (e) {}
      })

      await stealthMouseMove(page)
      const url = `https://www.crexi.com/properties?types=SelfStorage&statuses=ForSale&states=${state}`
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 })
      await randDelay(2000, 4000)

      if (apiResults.length > 0) {
        for (const p of apiResults.slice(0, 25)) {
          const addr = p.address || p.location || p.street || p.fullAddress || ''
          leads.push({
            id: generateLeadId(),
            facilityName: p.name || p.title || (typeof addr === 'string' ? addr : '') || 'Crexi Listing',
            businessName: p.name || p.title || 'Crexi Listing',
            address: typeof addr === 'string' ? addr : 'See Crexi listing',
            city: p.city || p.municipality || '',
            state: p.state || p.stateCode || state,
            askingPrice: (p.price || p.askingPrice) ? `$${Number(p.price || p.askingPrice).toLocaleString()}` : null,
            ownerName: p.brokerName || p.contactName || p.agentName || 'Crexi Listing',
            contactInfo: {
              phone: p.brokerPhone || p.contactPhone || p.phone || null,
              email: p.brokerEmail || p.contactEmail || p.email || null,
            },
            source: 'crexi',
            sourceUrl: p.url ? `https://www.crexi.com${p.url}` : `https://www.crexi.com/properties/${p.id || p.slug || ''}`,
            distressSignals: { bankruptcy: false, occupancyPct: null, rentBelowMarket: false },
            score: scoreLead({ bankruptcy: false, occupancyPct: null, rentBelowMarket: false }),
            signals: {},
            status: 'new',
            foundAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            notes: `Crexi self-storage listing — ${state}`,
          })
        }
      }
      log('Crexi', `${state}: ${apiResults.length} API results`)
    } catch (err) { log('Crexi', `${state} error: ${err.message}`) }
    finally { if (page) await page.close().catch(() => {}) }
    await randDelay(2000, 4000)
  }

  log('Crexi', `Found ${leads.length} total leads`)
  return leads
}

// ─── 7. County Tax — Miami-Dade FL + Harris County TX ─────────────────────────
async function scanCountyTax(browser) {
  log('CountyTax', 'Starting — Miami-Dade FL + Harris County TX (Puppeteer)...')
  const leads = []
  if (!browser) { log('CountyTax', 'No browser — skipping'); return leads }

  // Miami-Dade FL
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.goto(
      'https://www.miamidade.gov/Apps/PA/propertysearch/#/',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2000))

    // Use the XML proxy — run inside page.evaluate() to bypass CORS
    const mdResults = await page.evaluate(async () => {
      try {
        const res = await fetch(
          'https://www.miamidade.gov/Apps/PA/PApublicServiceProxy/PaServicesProxy.aspx?Operation=GetPropertySearchByValue&Value=self+storage&ValueType=owner&FolioRange=all&ItemCount=50',
          { headers: { 'Accept': 'application/xml, text/xml, */*' } }
        )
        if (!res.ok) return []
        const text = await res.text()
        const entries = text.match(/<MinimumAddress>[\s\S]*?<\/MinimumAddress>/g) || []
        return entries.slice(0, 20).map(entry => ({
          addr:  entry.match(/<Address>(.*?)<\/Address>/)?.[1] || '',
          owner: entry.match(/<Owner>(.*?)<\/Owner>/)?.[1] || '',
          folio: entry.match(/<Folionumber>(.*?)<\/Folionumber>/)?.[1] || '',
        }))
      } catch (e) { return [] }
    })

    for (const { addr, owner, folio } of mdResults) {
      if (!addr) continue
      if (!isSelfStorage(addr + ' ' + owner)) continue
      const signals = { taxDelinquency: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: addr,
        address: addr,
        city: 'Miami',
        state: 'FL',
        ownerName: owner,
        source: 'countytax_miamidade',
        sourceUrl: `https://www.miamidade.gov/Apps/PA/propertysearch/#/?folio=${folio}`,
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Miami-Dade tax delinquency signal · Folio: ${folio}`,
      })
    }
    log('CountyTax', `Miami-Dade: ${leads.length} leads`)
  } catch (err) {
    log('CountyTax', `Miami-Dade error: ${err.message}`)
  } finally {
    if (page) await page.close().catch(() => {})
  }

  // Harris County TX
  let page2
  try {
    page2 = await browser.newPage()
    await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page2.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page2.goto(
      'https://public.hcad.org/records/quicksearch.asp?searchtype=owner&searchval=storage&tab=0',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const beforeCount = leads.length
    const harrisRows = await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 21)
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
        return cells
      }).filter(cells => cells.length >= 3)
    })

    for (const cells of harrisRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { taxDelinquency: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[1] || cells[0] || 'Harris County Storage Property',
        address: cells[2] || '',
        city: 'Houston',
        state: 'TX',
        ownerName: cells[0] || '',
        source: 'countytax_harris',
        sourceUrl: 'https://public.hcad.org/records/quicksearch.asp',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: 'Harris County TX tax delinquency signal',
      })
    }
    log('CountyTax', `Harris County: ${leads.length - beforeCount} leads`)
  } catch (err) {
    log('CountyTax', `Harris County error: ${err.message}`)
  } finally {
    if (page2) await page2.close().catch(() => {})
  }

  // Franklin County OH (Columbus)
  let page3
  try {
    page3 = await browser.newPage()
    await page3.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page3.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page3.goto(
      'https://property.franklincountyauditor.com/_web/search/commonsearch.aspx?mode=address',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2000))
    // Search via evaluate to submit the form
    const ohRows = await page3.evaluate(async () => {
      try {
        const res = await fetch(
          'https://oh-franklin-treasurer.publicaccessnow.com/api/PropertySearch?query=self+storage&type=owner',
          { headers: { Accept: 'application/json' } }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (data.items || data.results || []).slice(0, 20).map(p => ({
          addr:  p.address || p.siteAddress || '',
          owner: p.ownerName || p.owner || '',
        }))
      } catch { return [] }
    })
    const beforeOH = leads.length
    for (const { addr, owner } of ohRows) {
      if (!addr && !owner) continue
      if (!isSelfStorage(addr + ' ' + owner)) continue
      const signals = { taxDelinquency: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: addr || owner,
        address: addr,
        city: 'Columbus',
        state: 'OH',
        ownerName: owner,
        source: 'countytax_franklin_oh',
        sourceUrl: 'https://property.franklincountyauditor.com',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: 'Franklin County OH tax delinquency signal',
      })
    }
    log('CountyTax', `Franklin County OH: ${leads.length - beforeOH} leads`)
  } catch (err) {
    log('CountyTax', `Franklin County OH error: ${err.message}`)
  } finally {
    if (page3) await page3.close().catch(() => {})
  }

  // Davidson County TN (Nashville) — Trustee delinquent list
  let page4
  try {
    page4 = await browser.newPage()
    await page4.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page4.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page4.goto(
      'https://www.padctn.org/prc/property/search/3?owner_name=self+storage',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeTN = leads.length
    const tnRows = await page4.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 21)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of tnRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { taxDelinquency: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[1] || cells[0] || 'Davidson County TN Storage',
        address: cells[2] || '',
        city: 'Nashville',
        state: 'TN',
        ownerName: cells[0] || '',
        source: 'countytax_davidson_tn',
        sourceUrl: 'https://www.padctn.org/prc/property/search/3',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: 'Davidson County TN tax delinquency signal',
      })
    }
    log('CountyTax', `Davidson County TN: ${leads.length - beforeTN} leads`)
  } catch (err) {
    log('CountyTax', `Davidson County TN error: ${err.message}`)
  } finally {
    if (page4) await page4.close().catch(() => {})
  }

  // Mecklenburg County NC (Charlotte)
  let page5
  try {
    page5 = await browser.newPage()
    await page5.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page5.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page5.goto(
      'https://polaris3g.mecklenburgcountync.gov/#',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2000))
    const beforeNC = leads.length
    const ncRows = await page5.evaluate(async () => {
      try {
        const res = await fetch(
          'https://polaris3g.mecklenburgcountync.gov/api/feature?fields=OWNER%2CADDRESS&where=UPPER(OWNER)+LIKE+%27%25SELF+STORAGE%25%27&returnGeometry=false',
          { headers: { Accept: 'application/json' } }
        )
        if (!res.ok) return []
        const data = await res.json()
        return (data.features || []).slice(0, 20).map(f => ({
          addr:  f.attributes?.ADDRESS || '',
          owner: f.attributes?.OWNER   || '',
        }))
      } catch { return [] }
    })
    for (const { addr, owner } of ncRows) {
      if (!isSelfStorage(addr + ' ' + owner)) continue
      const signals = { taxDelinquency: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: addr || owner,
        address: addr,
        city: 'Charlotte',
        state: 'NC',
        ownerName: owner,
        source: 'countytax_mecklenburg_nc',
        sourceUrl: 'https://polaris3g.mecklenburgcountync.gov',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: 'Mecklenburg County NC tax delinquency signal',
      })
    }
    log('CountyTax', `Mecklenburg County NC: ${leads.length - beforeNC} leads`)
  } catch (err) {
    log('CountyTax', `Mecklenburg County NC error: ${err.message}`)
  } finally {
    if (page5) await page5.close().catch(() => {})
  }

  // Marion County IN (Indianapolis)
  let page6
  try {
    page6 = await browser.newPage()
    await page6.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page6.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page6.goto(
      'https://www.indy.gov/activity/property-assessment-search',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeIN = leads.length
    const inRows = await page6.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 21)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of inRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { taxDelinquency: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[1] || cells[0] || 'Marion County IN Storage',
        address: cells[2] || '',
        city: 'Indianapolis',
        state: 'IN',
        ownerName: cells[0] || '',
        source: 'countytax_marion_in',
        sourceUrl: 'https://www.indy.gov/activity/property-assessment-search',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: 'Marion County IN tax delinquency signal',
      })
    }
    log('CountyTax', `Marion County IN: ${leads.length - beforeIN} leads`)
  } catch (err) {
    log('CountyTax', `Marion County IN error: ${err.message}`)
  } finally {
    if (page6) await page6.close().catch(() => {})
  }

  log('CountyTax', `Found ${leads.length} total leads`)
  return leads
}

// ─── 8. Lis Pendens — Hillsborough FL + Harris County TX ─────────────────────
async function scanLisPendens(browser) {
  log('LisPendens', 'Starting — Hillsborough FL + Harris County TX (Puppeteer)...')
  const leads = []
  if (!browser) { log('LisPendens', 'No browser — skipping'); return leads }

  // Hillsborough County FL (Tampa)
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.goto(
      'https://www.hillsclerk.com/records/official-records-search',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const hillsRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr[class*="result"], tbody tr')).slice(0, 15)
      return rows.map(row => ({
        cells: Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim()),
        href:  row.querySelector('a[href*="document"]')?.getAttribute('href') || '',
      })).filter(r => r.cells.length > 0)
    })

    for (const { cells, href } of hillsRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { lisPendens: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'Hillsborough Storage Property',
        address: cells[1] || '',
        city: 'Tampa',
        state: 'FL',
        ownerName: cells[0] || '',
        source: 'lispendens_hillsborough',
        sourceUrl: href ? `https://www.hillsclerk.com${href}` : 'https://www.hillsclerk.com/records/official-records-search',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Hillsborough County lis pendens · ${cells[2] || ''}`,
      })
    }
    log('LisPendens', `Hillsborough: ${leads.length} leads`)
  } catch (err) {
    log('LisPendens', `Hillsborough error: ${err.message}`)
  } finally {
    if (page) await page.close().catch(() => {})
  }

  // Harris County TX
  let page2
  try {
    page2 = await browser.newPage()
    await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page2.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page2.goto(
      'https://www.cclerk.hctx.net/Applications/WebSearch/SP.aspx?From=RP&SearchType=Party&PartyName=self+storage&DocType=LP&DateFrom=01/01/2023&DateTo=12/31/2026',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const beforeCount = leads.length
    const harrisRows = await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 16)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })

    for (const cells of harrisRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { lisPendens: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'Harris County Storage Property',
        address: '',
        city: 'Houston',
        state: 'TX',
        ownerName: cells[0] || '',
        source: 'lispendens_harris',
        sourceUrl: 'https://www.cclerk.hctx.net',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Harris County TX lis pendens · ${cells[1] || ''}`,
      })
    }
    log('LisPendens', `Harris County: ${leads.length - beforeCount} leads`)
  } catch (err) {
    log('LisPendens', `Harris County error: ${err.message}`)
  } finally {
    if (page2) await page2.close().catch(() => {})
  }

  // Cuyahoga County OH (Cleveland) — Common Pleas Court
  let page3
  try {
    page3 = await browser.newPage()
    await page3.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page3.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page3.goto(
      'https://cpdocket.cp.cuyahogacounty.us/Search.aspx?q=self+storage&t=case',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeOH = leads.length
    const ohRows = await page3.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr, .search-result')).slice(1, 16)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of ohRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { lisPendens: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'Cuyahoga County OH Storage Property',
        address: '',
        city: 'Cleveland',
        state: 'OH',
        ownerName: cells[0] || '',
        source: 'lispendens_cuyahoga_oh',
        sourceUrl: 'https://cpdocket.cp.cuyahogacounty.us',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Cuyahoga County OH lis pendens · ${cells[1] || ''}`,
      })
    }
    log('LisPendens', `Cuyahoga County OH: ${leads.length - beforeOH} leads`)
  } catch (err) {
    log('LisPendens', `Cuyahoga County OH error: ${err.message}`)
  } finally {
    if (page3) await page3.close().catch(() => {})
  }

  // Davidson County TN (Nashville) — Circuit Court Clerk
  let page4
  try {
    page4 = await browser.newPage()
    await page4.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page4.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page4.goto(
      'https://sci.ccc.nashville.gov/Search/CaseSearch?casetype=Civil&party=self+storage',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeTN = leads.length
    const tnRows = await page4.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 16)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of tnRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { lisPendens: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'Davidson County TN Storage Property',
        address: '',
        city: 'Nashville',
        state: 'TN',
        ownerName: cells[0] || '',
        source: 'lispendens_davidson_tn',
        sourceUrl: 'https://sci.ccc.nashville.gov',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Davidson County TN lis pendens · ${cells[1] || ''}`,
      })
    }
    log('LisPendens', `Davidson County TN: ${leads.length - beforeTN} leads`)
  } catch (err) {
    log('LisPendens', `Davidson County TN error: ${err.message}`)
  } finally {
    if (page4) await page4.close().catch(() => {})
  }

  // Mecklenburg County NC (Charlotte) — Register of Deeds
  let page5
  try {
    page5 = await browser.newPage()
    await page5.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page5.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page5.goto(
      'https://meckrod.manatron.com/RealEstate/SearchEntry.aspx?SearchType=GrantorGrantee&GrantorGrantee=self+storage&DocType=LP',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeNC = leads.length
    const ncRows = await page5.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 16)
      return rows.map(row => ({
        cells: Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim()),
        href:  row.querySelector('a')?.getAttribute('href') || '',
      })).filter(r => r.cells.length >= 2)
    })
    for (const { cells, href } of ncRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { lisPendens: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'Mecklenburg County NC Storage Property',
        address: '',
        city: 'Charlotte',
        state: 'NC',
        ownerName: cells[0] || '',
        source: 'lispendens_mecklenburg_nc',
        sourceUrl: href ? `https://meckrod.manatron.com${href}` : 'https://meckrod.manatron.com',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Mecklenburg County NC lis pendens · ${cells[1] || ''}`,
      })
    }
    log('LisPendens', `Mecklenburg County NC: ${leads.length - beforeNC} leads`)
  } catch (err) {
    log('LisPendens', `Mecklenburg County NC error: ${err.message}`)
  } finally {
    if (page5) await page5.close().catch(() => {})
  }

  // Marion County IN (Indianapolis) — Superior Court
  let page7
  try {
    page7 = await browser.newPage()
    await page7.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page7.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page7.goto(
      'https://public.courts.in.gov/mycase/#/vw/Search?court=39D01&party=self+storage&caseType=MF',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeIN = leads.length
    const inRows = await page7.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr, [class*="case-row"]')).slice(1, 16)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of inRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { lisPendens: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'Marion County IN Storage Property',
        address: '',
        city: 'Indianapolis',
        state: 'IN',
        ownerName: cells[0] || '',
        source: 'lispendens_marion_in',
        sourceUrl: 'https://public.courts.in.gov/mycase',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Marion County IN lis pendens · ${cells[1] || ''}`,
      })
    }
    log('LisPendens', `Marion County IN: ${leads.length - beforeIN} leads`)
  } catch (err) {
    log('LisPendens', `Marion County IN error: ${err.message}`)
  } finally {
    if (page7) await page7.close().catch(() => {})
  }

  log('LisPendens', `Found ${leads.length} total leads`)
  return leads
}

// ─── 9. UCC Liens — TX SOS + FL Sunbiz ───────────────────────────────────────
async function scanUCCLiens(browser) {
  log('UCCLiens', 'Starting — TX SOS + FL Sunbiz (Puppeteer)...')
  const leads = []
  if (!browser) { log('UCCLiens', 'No browser — skipping'); return leads }

  // Texas SOS UCC
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.goto(
      'https://mycpa.cpa.state.tx.us/ucc/searchResultsAction.do?debtorName=self+storage&searchType=DEBTOR_NAME&fileNumberSearch=false',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const txRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 16)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })

    for (const cells of txRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const fileNum = cells[1] || ''
      const signals = { uccLien: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'TX UCC Storage Debtor',
        address: cells[2] || '',
        city: '',
        state: 'TX',
        ownerName: cells[0] || '',
        source: 'ucc_texas',
        sourceUrl: fileNum
          ? `https://mycpa.cpa.state.tx.us/ucc/searchResultsAction.do?fileNumber=${fileNum}&fileNumberSearch=true`
          : 'https://mycpa.cpa.state.tx.us/ucc/',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `Texas SOS UCC lien filing · File: ${fileNum || 'N/A'}`,
      })
    }
    log('UCCLiens', `TX SOS: ${leads.length} leads`)
  } catch (err) {
    log('UCCLiens', `TX SOS error: ${err.message}`)
  } finally {
    if (page) await page.close().catch(() => {})
  }

  // Florida Sunbiz UCC
  let page2
  try {
    page2 = await browser.newPage()
    await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page2.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page2.goto(
      'https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&inquiryDirectionType=ForwardList&searchNameOrder=SELF+STORAGE&activeFlag=inactive',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const beforeCount = leads.length
    const flRows = await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 16)
      return rows.map(row => ({
        cells: Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim()),
        href:  row.querySelector('a[href*="SearchResultDetail"]')?.getAttribute('href') || '',
      })).filter(r => r.cells.length >= 2)
    })

    for (const { cells, href } of flRows) {
      if (!isSelfStorage(cells[0])) continue
      const signals = { uccLien: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'FL UCC Storage Entity',
        address: '',
        city: '',
        state: 'FL',
        ownerName: cells[0] || '',
        source: 'ucc_florida',
        sourceUrl: href ? `https://search.sunbiz.org${href}` : 'https://search.sunbiz.org',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `FL Sunbiz UCC lien signal · Status: ${cells[1] || 'N/A'}`,
      })
    }
    log('UCCLiens', `FL Sunbiz: ${leads.length - beforeCount} leads`)
  } catch (err) {
    log('UCCLiens', `FL Sunbiz error: ${err.message}`)
  } finally {
    if (page2) await page2.close().catch(() => {})
  }

  // North Carolina SOS UCC
  let page3
  try {
    page3 = await browser.newPage()
    await page3.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page3.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page3.goto(
      'https://www.sosnc.gov/online_services/ucc/search_results?search_type=debtor_name&debtor_name=self+storage',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeNC = leads.length
    const ncRows = await page3.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 16)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of ncRows) {
      if (!isSelfStorage(cells.join(' '))) continue
      const signals = { uccLien: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'NC UCC Storage Debtor',
        address: cells[2] || '',
        city: '',
        state: 'NC',
        ownerName: cells[0] || '',
        source: 'ucc_nc',
        sourceUrl: 'https://www.sosnc.gov/online_services/ucc',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `NC SOS UCC lien filing · File: ${cells[1] || 'N/A'}`,
      })
    }
    log('UCCLiens', `NC SOS: ${leads.length - beforeNC} leads`)
  } catch (err) {
    log('UCCLiens', `NC SOS error: ${err.message}`)
  } finally {
    if (page3) await page3.close().catch(() => {})
  }

  log('UCCLiens', `Found ${leads.length} total leads`)
  return leads
}

// ─── 10. SOS LLC — FL Sunbiz + TX Comptroller + GA SOS ───────────────────────
async function scanSOSLLC(browser) {
  log('SOSLLC', 'Starting — FL Sunbiz + TX Comptroller + GA SOS (Puppeteer)...')
  const leads = []
  if (!browser) { log('SOSLLC', 'No browser — skipping'); return leads }

  // Florida Sunbiz
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.goto(
      'https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&inquiryDirectionType=ForwardList&searchNameOrder=SELF+STORAGE&activeFlag=inactive',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const flRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 21)
      return rows.map(row => ({
        cells: Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim()),
        href:  row.querySelector('a[href*="SearchResultDetail"]')?.getAttribute('href') || '',
      })).filter(r => r.cells.length >= 2)
    })

    for (const { cells, href } of flRows) {
      if (!isSelfStorage(cells[0])) continue
      const signals = { sosInactive: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'FL Inactive Storage LLC',
        address: '',
        city: '',
        state: 'FL',
        ownerName: cells[0] || '',
        source: 'sos_florida',
        sourceUrl: href ? `https://search.sunbiz.org${href}` : 'https://search.sunbiz.org',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `FL Sunbiz inactive/dissolved storage LLC · Status: ${cells[1] || 'Inactive'}`,
      })
    }
    log('SOSLLC', `FL Sunbiz: ${leads.length} leads`)
  } catch (err) {
    log('SOSLLC', `FL Sunbiz error: ${err.message}`)
  } finally {
    if (page) await page.close().catch(() => {})
  }

  // Texas Comptroller
  let page2
  try {
    page2 = await browser.newPage()
    await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page2.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page2.goto(
      'https://mycpa.cpa.state.tx.us/coa/coaSearchBtn.do?sortDir=&sortBy=&totalRows=&searchType=name&searchBar=self+storage&submitBtn=Search',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const beforeTX = leads.length
    const txRows = await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 21)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })

    for (const cells of txRows) {
      if (!isSelfStorage(cells[0])) continue
      if (!/inactive|forfeited|dissolved/i.test(cells.join(' '))) continue
      const signals = { sosInactive: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'TX Inactive Storage LLC',
        address: '',
        city: '',
        state: 'TX',
        ownerName: cells[0] || '',
        source: 'sos_texas',
        sourceUrl: 'https://mycpa.cpa.state.tx.us/coa/',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `TX Comptroller inactive storage entity · Status: ${cells[1] || 'Inactive'}`,
      })
    }
    log('SOSLLC', `TX Comptroller: ${leads.length - beforeTX} leads`)
  } catch (err) {
    log('SOSLLC', `TX Comptroller error: ${err.message}`)
  } finally {
    if (page2) await page2.close().catch(() => {})
  }

  // Georgia SOS
  let page3
  try {
    page3 = await browser.newPage()
    await page3.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page3.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page3.goto(
      'https://ecorp.sos.ga.gov/BusinessSearch/BusinessInformation?businessId=0&businessType=domestic+limited+liability+company&businessStatus=Dissolved&searchTerm=self+storage',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))

    const beforeGA = leads.length
    const gaRows = await page3.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 21)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })

    for (const cells of gaRows) {
      if (!isSelfStorage(cells[0])) continue
      const signals = { sosInactive: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'GA Inactive Storage LLC',
        address: '',
        city: '',
        state: 'GA',
        ownerName: cells[0] || '',
        source: 'sos_georgia',
        sourceUrl: 'https://ecorp.sos.ga.gov/BusinessSearch',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `GA SOS dissolved storage entity · Status: ${cells[1] || 'Dissolved'}`,
      })
    }
    log('SOSLLC', `GA SOS: ${leads.length - beforeGA} leads`)
  } catch (err) {
    log('SOSLLC', `GA SOS error: ${err.message}`)
  } finally {
    if (page3) await page3.close().catch(() => {})
  }

  // Ohio SOS
  let page4
  try {
    page4 = await browser.newPage()
    await page4.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page4.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page4.goto(
      'https://businesssearch.ohiosos.gov/?=businessDetails&businessType=LLC&status=Cancelled&searchVal=self+storage',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeOH = leads.length
    const ohRows = await page4.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr, [class*="result-row"]')).slice(1, 21)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of ohRows) {
      if (!isSelfStorage(cells[0])) continue
      const signals = { sosInactive: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'OH Inactive Storage LLC',
        address: '', city: '', state: 'OH',
        ownerName: cells[0] || '',
        source: 'sos_ohio',
        sourceUrl: 'https://businesssearch.ohiosos.gov',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `OH SOS inactive/cancelled storage LLC · Status: ${cells[1] || 'Inactive'}`,
      })
    }
    log('SOSLLC', `OH SOS: ${leads.length - beforeOH} leads`)
  } catch (err) {
    log('SOSLLC', `OH SOS error: ${err.message}`)
  } finally {
    if (page4) await page4.close().catch(() => {})
  }

  // North Carolina SOS
  let page5
  try {
    page5 = await browser.newPage()
    await page5.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page5.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page5.goto(
      'https://www.sosnc.gov/online_services/search/by_title/_business_registration_results?name=self+storage&status=Withdrawn',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeNC = leads.length
    const ncRows = await page5.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr')).slice(1, 21)
      return rows.map(row => ({
        cells: Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim()),
        href:  row.querySelector('a')?.getAttribute('href') || '',
      })).filter(r => r.cells.length >= 2)
    })
    for (const { cells, href } of ncRows) {
      if (!isSelfStorage(cells[0])) continue
      const signals = { sosInactive: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'NC Inactive Storage LLC',
        address: '', city: '', state: 'NC',
        ownerName: cells[0] || '',
        source: 'sos_nc',
        sourceUrl: href ? `https://www.sosnc.gov${href}` : 'https://www.sosnc.gov',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `NC SOS inactive/withdrawn storage entity · Status: ${cells[1] || 'Inactive'}`,
      })
    }
    log('SOSLLC', `NC SOS: ${leads.length - beforeNC} leads`)
  } catch (err) {
    log('SOSLLC', `NC SOS error: ${err.message}`)
  } finally {
    if (page5) await page5.close().catch(() => {})
  }

  // Indiana SOS
  let page6
  try {
    page6 = await browser.newPage()
    await page6.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    await page6.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page6.goto(
      'https://bsd.sos.in.gov/PublicBusiness/GetPublicBusiness?SearchText=self+storage&Status=Inactive',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    )
    await new Promise(r => setTimeout(r, 2500))
    const beforeIN = leads.length
    const inRows = await page6.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr, [class*="result"]')).slice(1, 21)
      return rows.map(row =>
        Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim())
      ).filter(cells => cells.length >= 2)
    })
    for (const cells of inRows) {
      if (!isSelfStorage(cells[0])) continue
      if (!/inactive|dissolved|revoked/i.test(cells.join(' '))) continue
      const signals = { sosInactive: true, occupancyPct: null, rentBelowMarket: false }
      leads.push({
        id: generateLeadId(),
        facilityName: cells[0] || 'IN Inactive Storage LLC',
        address: '', city: '', state: 'IN',
        ownerName: cells[0] || '',
        source: 'sos_indiana',
        sourceUrl: 'https://bsd.sos.in.gov/PublicBusiness',
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: `IN SOS inactive storage entity · Status: ${cells[1] || 'Inactive'}`,
      })
    }
    log('SOSLLC', `IN SOS: ${leads.length - beforeIN} leads`)
  } catch (err) {
    log('SOSLLC', `IN SOS error: ${err.message}`)
  } finally {
    if (page6) await page6.close().catch(() => {})
  }

  log('SOSLLC', `Found ${leads.length} total leads`)
  return leads
}

// ─── 12. LoopNet — Puppeteer stealth, response sniffing ─────────────────────────
const LOOPNET_STATES = [
  { slug: 'florida',        abbr: 'FL' },
  { slug: 'texas',          abbr: 'TX' },
  { slug: 'georgia',        abbr: 'GA' },
  { slug: 'tennessee',      abbr: 'TN' },
  { slug: 'north-carolina', abbr: 'NC' },
  { slug: 'south-carolina', abbr: 'SC' },
  { slug: 'alabama',        abbr: 'AL' },
  { slug: 'ohio',           abbr: 'OH' },
  { slug: 'wisconsin',      abbr: 'WI' },
  { slug: 'indiana',        abbr: 'IN' },
]

async function scanLoopNet(browser) {
  log('LoopNet', 'Starting (Puppeteer stealth, response sniffing)...')
  const leads = []
  if (!browser) { log('LoopNet', 'No browser — skipping'); return leads }

  const randDelay = (min = 2000, max = 5000) => new Promise(r => setTimeout(r, min + Math.floor(Math.random() * (max - min))))

  const randomViewport = () => ({
    width:  1200 + Math.floor(Math.random() * 320),
    height: 800  + Math.floor(Math.random() * 200),
    deviceScaleFactor: 1,
  })

  const stealthMouseMove = async (page) => {
    const vp = page.viewport() || { width: 1280, height: 900 }
    const steps = 3 + Math.floor(Math.random() * 4)
    for (let s = 0; s < steps; s++) {
      const x = 100 + Math.floor(Math.random() * (vp.width  - 200))
      const y = 100 + Math.floor(Math.random() * (vp.height - 200))
      await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 10) })
      await new Promise(r => setTimeout(r, 80 + Math.floor(Math.random() * 150)))
    }
  }

  for (const { slug, abbr } of LOOPNET_STATES) {
    let page
    try {
      page = await browser.newPage()
      await page.setViewport(randomViewport())
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

      const apiResults = []

      // Attach response listener BEFORE navigation — no setRequestInterception
      page.on('response', async res => {
        try {
          const u = res.url()
          const ct = res.headers()['content-type'] || ''
          if (!ct.includes('json')) return
          if (!u.includes('loopnet.com')) return
          if (u.includes('/api/') || u.includes('/search') || u.includes('/listings') || u.includes('/graphql')) {
            const json = await res.json().catch(() => null)
            if (!json) return
            const items =
              json.data?.listings ||
              json.data?.properties ||
              json.data?.results ||
              json.data?.searchListings?.listings ||
              json.listings ||
              json.properties ||
              json.results ||
              []
            if (Array.isArray(items) && items.length > 0) apiResults.push(...items)
          }
        } catch (e) {}
      })

      await stealthMouseMove(page)
      const url = `https://www.loopnet.com/search/self-storage-facilities/${slug}/for-sale/`
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 })
      await randDelay(2000, 4000)

      if (apiResults.length > 0) {
        for (const p of apiResults.slice(0, 25)) {
          const name = p.name || p.title || p.propertyName || p.listingName || ''
          const addr = p.address || p.street || p.streetAddress || ''
          if (!name && !addr) continue
          const priceRaw = p.price || p.askingPrice || p.listPrice || p.salePrice || null
          const askingPrice = priceRaw ? Math.round(Number(String(priceRaw).replace(/[^0-9.]/g, ''))) : undefined
          const addrM = addr.match(/^([^,]+)/)
          leads.push({
            id: generateLeadId(),
            facilityName: (name || addr).slice(0, 80),
            address: addr || 'See LoopNet listing',
            city: p.city || addrM?.[1]?.trim() || abbr,
            state: p.state || p.stateCode || abbr,
            askingPrice,
            ownerName: p.brokerName || p.contactName || p.agentName || 'LoopNet Listing',
            contactInfo: {
              phone: p.brokerPhone || p.phone || null,
              email: p.brokerEmail || p.email || null,
            },
            source: 'loopnet',
            sourceUrl: p.url ? (p.url.startsWith('http') ? p.url : `https://www.loopnet.com${p.url}`)
              : (p.id ? `https://www.loopnet.com/listing/${p.id}/` : url),
            distressSignals: { occupancyPct: null, rentBelowMarket: false },
            score: scoreLead({ occupancyPct: null, rentBelowMarket: false }),
            signals: {},
            status: 'new',
            foundAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            notes: `LoopNet self-storage listing — ${abbr}`,
          })
        }
      }
      log('LoopNet', `${slug}: ${apiResults.length} API results → ${leads.length} total leads so far`)
    } catch (err) {
      log('LoopNet', `${slug} error: ${err.message}`)
    } finally {
      if (page) await page.close().catch(() => {})
    }
    await randDelay(2000, 5000)
  }

  log('LoopNet', `Total: ${leads.length} leads`)
  return leads
}


// ─── 13. Facebook Marketplace — Puppeteer (requires session cookies) ───────────
async function scanFacebook(browser) {
  log('Facebook', 'Skipped — add FB session cookies to scripts/fb-cookies.json to enable')
  /*
  const cookiePath = path.join(__dirname, 'fb-cookies.json')
  if (!fs.existsSync(cookiePath)) return []
  const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
  let page
  try {
    page = await browser.newPage()
    await page.setCookie(...cookies)
    await page.goto('https://www.facebook.com/marketplace/category/propertyforsale?query=self+storage', {
      waitUntil: 'networkidle2', timeout: 30000
    })
    await page.waitForSelector('[data-pagelet="MarketplaceSearch"]', { timeout: 15000 })
    // TODO: extract listings from DOM
  } catch (err) {
    log('Facebook', `Error: ${err.message}`)
  } finally {
    if (page) await page.close().catch(() => {})
  }
  */
  return []
}

// ─── 14. Out-of-state Owner Analysis — STUB ───────────────────────────────────
// TODO: Cross-reference property records with owner mailing address.
// Some counties provide bulk property data downloads:
//   FL: https://floridarevenue.com/property/Pages/DataPortal.aspx
//   TX: https://comptroller.texas.gov/taxes/property-tax/
// Filter: properties where owner mailing state != property state.
async function scanOutOfStateOwners() {
  if (!process.env.ATTOM_API_KEY) { log('OutOfStateOwners', 'ATTOM_API_KEY not set — skipping'); return [] }
  log('OutOfState', 'Stub — see TODO comments for state property data portals')
  return []
}

// ─── 15. Fire Marshal Violations — STUB ───────────────────────────────────────
// TODO: Fire code violation data is typically from city/county open data portals.
//   Examples:
//   NYC: https://data.cityofnewyork.us/Housing-Development/DOB-Violations/3h2n-5cm9
//   Dallas: https://www.dallasopendata.com/
//   Tampa: https://www.tampa.gov/community-affairs/code-enforcement
// Filter for "storage" in property description + outstanding violations.
async function scanFireMarshal() {
  log('FireMarshal', 'Stub — see TODO comments for city open-data portal setup')
  return []
}

// ─── Persist to leads.json ────────────────────────────────────────────────────
function persistLeads(newLeads) {
  let existing = []
  try {
    existing = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'))
  } catch { /* file doesn't exist yet */ }

  const existingKeys = new Set(existing.map(l => l.sourceUrl || l.id))
  const deduped      = newLeads.filter(l => !existingKeys.has(l.sourceUrl || l.id))
  if (deduped.length === 0) {
    console.log(`\n  No new leads found; leads.json unchanged.`)
    return { total: existing.length, added: 0 }
  }

  const merged = [...existing, ...deduped]
  merged.sort((a, b) => new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime())
  const final = merged.slice(0, 1000)

  const dir = path.dirname(LEADS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(LEADS_FILE, JSON.stringify(final, null, 2))

  console.log(`\n  Saved ${final.length} total leads  (+${deduped.length} new, ${existing.length} existing)`)
  console.log(`  File: ${LEADS_FILE}`)
  return { total: final.length, added: deduped.length }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n================================================')
  console.log('  YEM Acquisitions — Lead Scraper')
  console.log(`  ${new Date().toLocaleString()}`)
  console.log('================================================\n')

  const executablePath = CHROME_PATHS.find(p => { try { return fs.existsSync(p) } catch { return false } })
  let browser = null

  if (executablePath) {
    try {
      browser = await puppeteerExtra.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      })
      log('Browser', `Chrome: ${executablePath}`)
    } catch (err) {
      log('Browser', `Failed to launch Chrome: ${err.message}`)
    }
  } else {
    log('Browser', 'Chrome not found — LoopNet (Puppeteer) will be skipped')
    log('Browser', 'Install Chrome or update CHROME_PATHS in scripts/run-scrapers.js')
  }

  try {
    log('Runner', 'Running API + fetch-based scrapers in parallel...')
    const fetchResults = await Promise.allSettled([
      Promise.race([scanCourtListener(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('CourtListener hard timeout')),90000))]),
      // scanBizBuySell moved to browser block
      scanBizQuest(),
      scanShowcase(),
      scanBrevitas(),
      scanFSBO(),
      scanOutOfStateOwners(),
      scanFireMarshal(),
    ])

    const fetchLeads = fetchResults.flatMap(r => r.status === 'fulfilled' ? r.value : [])

    console.log('\n================================================')
    console.log('  FETCH RESULTS')
    console.log('================================================')
    const fetchCounts = {}
    for (const l of fetchLeads) fetchCounts[l.source] = (fetchCounts[l.source] || 0) + 1
    for (const [source, count] of Object.entries(fetchCounts)) {
      console.log(`  ${source.padEnd(16)}: ${count}`)
    }
    console.log(`  ${'FETCH TOTAL'.padEnd(16)}: ${fetchLeads.length}`)
    persistLeads(fetchLeads)
    console.log('  [Persist] Fetch leads persisted successfully.')

    const browserLeads = []
    if (browser) {
      log('Runner', 'Running Puppeteer-based scrapers...')
      try { browserLeads.push(...await scanLoopNet(browser)) } catch (e) { log('LoopNet', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanBizBuySell(browser)) } catch (e) { log('BizBuySell', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanCrexi(browser)) } catch (e) { log('Crexi', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanFacebook(browser))   } catch (e) { log('Facebook',   `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanCountyTax(browser))  } catch (e) { log('CountyTax',  `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanLisPendens(browser)) } catch (e) { log('LisPendens', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanUCCLiens(browser))   } catch (e) { log('UCCLiens',   `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanSOSLLC(browser))     } catch (e) { log('SOSLLC',     `Fatal: ${e.message}`) }
    }

    if (browserLeads.length > 0) {
      console.log('\n================================================')
      console.log('  BROWSER RESULTS')
      console.log('================================================')
      const browserCounts = {}
      for (const l of browserLeads) browserCounts[l.source] = (browserCounts[l.source] || 0) + 1
      for (const [source, count] of Object.entries(browserCounts)) {
        console.log(`  ${source.padEnd(16)}: ${count}`)
      }
      console.log(`  ${'BROWSER TOTAL'.padEnd(16)}: ${browserLeads.length}`)
      persistLeads(browserLeads)
      console.log('  [Persist] Browser leads persisted successfully.')
    } else {
      console.log('\n  [Browser] No browser leads found or browser scrapers skipped.')
    }

    const allLeads = [...fetchLeads, ...browserLeads]
    console.log(`\n  [Done] Total leads collected this run: ${allLeads.length}`)

    // ── Daily email digest ──
    try {
      const allSaved = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'data', 'leads.json'), 'utf-8'))
      const newLeads = allSaved.filter(l => {
        const age = Date.now() - new Date(l.foundAt).getTime()
        return age < 6 * 60 * 60 * 1000
      })
      if (newLeads.length > 0 && process.env.EMAIL_PASSWORD) {
        const nodemailer = require('nodemailer')
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com', port: 587, secure: false,
          auth: { user: 'joshuaernst@gmail.com', pass: process.env.EMAIL_PASSWORD },
        })
        const rows = newLeads.map(l => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee"><b>${l.facilityName || l.businessName || l.address}</b><br><span style="font-size:12px;color:#888">${l.city || ''}, ${l.state || ''}</span></td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${l.source}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${l.askingPrice || '—'}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${(l.contactInfo && l.contactInfo.phone) || (l.notes || '').match(/\d{3}[.\-\s]\d{3}[.\-\s]\d{4}/) || '—'}</td></tr>`).join('')
        const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:32px"><table width="600" style="background:#fff;border:1px solid #e2e6ea;border-radius:4px;overflow:hidden;margin:0 auto"><tr><td style="background:#1B2B5E;padding:24px 32px"><div style="font-family:Georgia,serif;font-size:20px;color:#fff">YEM Acquisitions</div><div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;text-transform:uppercase;letter-spacing:0.1em">Morning Lead Digest — ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div></td></tr><tr><td style="padding:24px 32px"><p style="margin:0 0 16px;color:#333"><b>${newLeads.length} new lead${newLeads.length===1?'':'s'}</b> found today across ${[...new Set(newLeads.map(l=>l.source))].join(', ')}.</p><table width="100%" cellpadding="0" cellspacing="0"><tr style="background:#f8f9fa"><th style="padding:8px 10px;text-align:left;font-size:12px;color:#555">Property</th><th style="padding:8px 10px;text-align:left;font-size:12px;color:#555">Source</th><th style="padding:8px 10px;text-align:left;font-size:12px;color:#555">Price</th><th style="padding:8px 10px;text-align:left;font-size:12px;color:#555">Phone</th></tr>${rows}</table></td></tr><tr><td style="padding:16px 32px;background:#f8f9fa;font-size:11px;color:#aaa;text-align:center">YEM Acquisitions LLC · Woodmere, NY · Automated lead digest</td></tr></table></body></html>`
        await transporter.sendMail({
          from: 'YEM Acquisitions <joshuaernst@gmail.com>',
          to: 'joshuaernst@gmail.com',
          subject: `YEM Lead Digest — ${newLeads.length} new lead${newLeads.length===1?'':'s'} — ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}`,
          html,
        })
        log('Email', `Digest sent — ${newLeads.length} new leads`)
      } else if (!process.env.EMAIL_PASSWORD) {
        log('Email', 'EMAIL_PASSWORD not set — digest skipped')
      } else {
        log('Email', 'No new leads today — digest skipped')
      }
    } catch(emailErr) { log('Email', `Digest error: ${emailErr.message}`) }

  } finally {
    if (browser) await browser.close()
  }

  console.log('\n  Done. Run `npm run dev` and visit /leads to see results.\n')
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
