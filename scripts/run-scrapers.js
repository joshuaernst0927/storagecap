#!/usr/bin/env node
'use strict'

/**
 * YEM Acquisitions — Local Lead Scraper
 *
 * Sources covered (13 total):
 *   API-based  : CourtListener (bankruptcy filings)
 *   RSS-based  : Craigslist, BizBuySell
 *   Fetch-based: Brevitas, FSBO.com, Crexi
 *   Puppeteer  : LoopNet, Facebook Marketplace*
 *   Stubs/TODO : County Tax Rolls, Fire Marshal, UCC Liens, Lis Pendens, Out-of-state Owner
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
  if (signals.taxDelinquency)     score += 25
  if (signals.fireCodeViolations) score += 15
  if (signals.lisPendens)         score += 20
  if (signals.bankruptcy)         score += 18
  if (signals.decliningOccupancy) score += 10
  if (signals.outOfStateOwner)    score += 10
  if (signals.longTermOwner)      score += 10
  if ((signals.ownerAge || 0) >= 65) score += 10
  return Math.min(score, 100)
}

function log(source, msg) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] [${source.padEnd(14)}] ${msg}`)
}

async function safeFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ...options.headers,
    },
    signal: AbortSignal.timeout(options.timeout || 12000),
    ...options,
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
  'flsb','flmb','flnb',
  'txsb','txeb','txnb','txwb',
  'nceb','ncmb','ncwb',
  'ganb','gamb','gasb',
  'tneb','tnmb','tnwb',
  'ohnb','ohsb',
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

  // Query each bankruptcy court sequentially — 13s apart to stay under 5 req/min limit
  for (let i = 0; i < BANKRUPTCY_COURTS.length; i++) {
    const courtId = BANKRUPTCY_COURTS[i]
    if (i > 0) await new Promise(r => setTimeout(r, 13000))
    try {
      const params = new URLSearchParams({
        q: 'storage', type: 'r', court: courtId,
        page_size: '50', order_by: 'dateFiled desc',
      })
      const res = await fetch(`https://www.courtlistener.com/api/rest/v4/search/?${params}`, {
        headers: {
          Authorization: `Token ${CL_TOKEN}`,
          'User-Agent': 'YEMAcquisitions/1.0 (joshuaernst@gmail.com)',
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) { log('CourtListener', `${courtId}: HTTP ${res.status}`); continue }
      const data = await res.json()
      if (data.detail) { log('CourtListener', `${courtId}: ${data.detail}`); continue }

      let found = 0
      for (const d of (data.results || [])) {
        if (seen.has(d.docket_id)) continue
        seen.add(d.docket_id)
        const caseName = d.caseName || ''
        if (!/storage/i.test(caseName)) continue
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

// ─── 2. Lands of America / Land.com — RSS feed for rural/commercial storage ────
async function scanLandsOfAmerica() {
  // DEPRECATED — returns HTTP 400, replaced by BizBuySell/BizQuest
  return []
}

// ─── 2b. BizBuySell — self storage listings by state ──────────────────────────
async function scanBizBuySell(browser) {
  log('BizBuySell', 'Starting (Puppeteer stealth)...')
  const leads = []
  if (!browser) { log('BizBuySell', 'No browser — skipping'); return leads }
  const states = ['texas','georgia','south-carolina','tennessee','arizona','florida','alabama','mississippi','north-carolina','ohio']
  for (const state of states) {
    try {
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      const urls = [
        `https://www.bizbuysell.com/${state}/storage-facilities-and-warehouses-for-sale/`,
        `https://www.bizbuysell.com/${state}/storage-facility-and-warehouse-business-real-estate/`,
      ]
      for (const url of urls) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
          await new Promise(r => setTimeout(r, 1500))
          const html = await page.content()
          const stateName = state.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          const titles = [...html.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 5)
          const links = [...html.matchAll(/href="(\/(?:businesses|real-estate)\/[^"?#]+)"/gi)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i)
          const prices = [...html.matchAll(/\$([\d,]+(?:\.\d+)?(?:\s*(?:Million|M|K))?)/gi)].map(m => m[0])
          const phones = [...html.matchAll(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g)].map(m => m[0])
          for (let i = 0; i < Math.min(titles.length, links.length, 25); i++) {
            const title = titles[i]
            if (!title || title.length < 5) continue
            if (!/storage|warehouse|self.stor/i.test(title + (links[i] || ''))) continue
            leads.push({
              id: generateLeadId(),
              facilityName: title.substring(0, 120),
              businessName: title.substring(0, 120),
              address: stateName,
              city: stateName,
              state: state.substring(0, 2).toUpperCase(),
              askingPrice: prices[i] || null,
              ownerName: 'BizBuySell Listing',
              contactInfo: phones[i] ? { phone: phones[i] } : {},
              source: 'bizbuysell',
              sourceUrl: `https://www.bizbuysell.com${links[i] || ''}`,
              distressSignals: { bankruptcy: false },
              score: scoreLead({ bankruptcy: false }),
              signals: {},
              status: 'new',
              foundAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              notes: `BizBuySell listing — ${stateName}`,
            })
          }
        } catch (pe) { log('BizBuySell', `${state} page error: ${pe.message}`) }
        await new Promise(r => setTimeout(r, 1000))
      }
      await page.close()
    } catch (err) { log('BizBuySell', `${state} error: ${err.message}`) }
    await new Promise(r => setTimeout(r, 800))
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
          score: scoreLead({ bankruptcy: false }),
          signals: {},
          distressSignals: {
            taxDelinquency: false,
            fireCodeViolations: false,
            lisPendens: false,
            decliningOccupancy: false,
            outOfStateOwner: false,
            longTermOwner: false,
          },
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          notes: 'BizQuest listing \u2014 address not provided by source, see sourceUrl for details.',
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
              score: scoreLead({ bankruptcy: false }),
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
              score: scoreLead({ bankruptcy: false }),
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
        score: scoreLead({ bankruptcy: false }),
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

// ─── 6. Crexi — Puppeteer stealth (403 on plain fetch) ────────────────────────
async function scanCrexi(browser) {
  log('Crexi', 'Temporarily disabled — re-enable after request interception fix')
  return []
  const TARGET_STATES_CREXI = ['TX','GA','SC','TN','AZ','FL','AL','MS','NC','OH']
  for (const state of TARGET_STATES_CREXI) {
    try {
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      const apiResults = []
      await page.setRequestInterception(true)
      page.on('request', req => { try { if (!req.isInterceptResolutionHandled()) req.continue() } catch (_) {} })
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
      const url = `https://www.crexi.com/properties?types=SelfStorage&statuses=ForSale&states=${state}`
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 })
      await new Promise(r => setTimeout(r, 3000))
      await page.setRequestInterception(false)
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
            distressSignals: { bankruptcy: false },
            score: scoreLead({ bankruptcy: false }),
            signals: {},
            status: 'new',
            foundAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            notes: `Crexi self-storage listing — ${state}`,
          })
        }
      }
      await page.close()
    } catch (err) { log('Crexi', `${state} error: ${err.message}`) }
    await new Promise(r => setTimeout(r, 1200))
  }
  log('Crexi', `Found ${leads.length} leads`)
  return leads
}

// ─── PAID STUBS — activate by adding API key to .env.local ────────────────────
async function scanLisPendens() {
  // REQUIRES: BATCHDATA_API_KEY in .env.local
  // BatchData lis pendens API: https://batchdata.com/docs
  if (!process.env.BATCHDATA_API_KEY) { log('LisPendens', 'BATCHDATA_API_KEY not set — skipping'); return [] }
  log('LisPendens', 'TODO: implement BatchData lis pendens query')
  return []
}

async function scanCountyTax() {
  // REQUIRES: BATCHDATA_API_KEY in .env.local
  if (!process.env.BATCHDATA_API_KEY) { log('CountyTax', 'BATCHDATA_API_KEY not set — skipping'); return [] }
  log('CountyTax', 'TODO: implement BatchData tax delinquency query')
  return []
}

async function scanUCCLiens() {
  // REQUIRES: BATCHDATA_API_KEY in .env.local
  if (!process.env.BATCHDATA_API_KEY) { log('UCCLiens', 'BATCHDATA_API_KEY not set — skipping'); return [] }
  log('UCCLiens', 'TODO: implement BatchData UCC lien query')
  return []
}

async function scanOutOfStateOwners() {
  // REQUIRES: ATTOM_API_KEY in .env.local
  if (!process.env.ATTOM_API_KEY) { log('OutOfStateOwners', 'ATTOM_API_KEY not set — skipping'); return [] }
  log('OutOfStateOwners', 'TODO: implement ATTOM out-of-state owner query')
  return []
}

async function scanFireMarshal() {
  log('FireMarshal', 'TODO: county-level fire marshal violation feeds — skipping')
  return []
}

// ─── 7. LoopNet — Puppeteer (JS-rendered, requires real browser) ───────────────
const LOOPNET_STATES = [
  { slug: 'florida',    abbr: 'FL' },
  { slug: 'texas',      abbr: 'TX' },
  { slug: 'georgia',    abbr: 'GA' },
  { slug: 'tennessee',  abbr: 'TN' },
  { slug: 'north-carolina', abbr: 'NC' },
  { slug: 'south-carolina', abbr: 'SC' },
  { slug: 'alabama',    abbr: 'AL' },
]

async function scanLoopNet(browser) {
  log('LoopNet', 'Starting (Puppeteer)...')
  const leads = []

  for (const { slug, abbr } of LOOPNET_STATES) {
    let page
    try {
      page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 900 })

      const url = `https://www.loopnet.com/search/self-storage-facilities/${slug}/for-sale/`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Wait up to 8s for listings to appear
      await page.waitForFunction(
        () => document.querySelectorAll('[data-listing-id], [class*="PropertyCard"]').length > 0,
        { timeout: 8000 }
      ).catch(() => {})

      const pageLeads = await page.evaluate((state) => {
        const items = []
        // LoopNet uses data-listing-id on container divs
        const cards = Array.from(document.querySelectorAll('[data-listing-id]'))
        if (cards.length === 0) {
          // Fallback: look for listing title elements
          document.querySelectorAll('[class*="property-name"], [class*="PropertyName"], [class*="listing-name"]').forEach(el => {
            const name = el.textContent?.trim()
            if (!name || !/storage/i.test(name)) return
            const card  = el.closest('article, [class*="card"], [class*="Card"], li, div[class*="listing"]')
            const link  = (card?.querySelector('a[href*="/listing/"]') || el.closest('a'))?.href
            const price = card?.querySelector('[class*="price"], [class*="Price"]')?.textContent?.trim()
            const addr  = card?.querySelector('[class*="address"], [class*="Address"]')?.textContent?.trim()
            items.push({ name: name.slice(0, 80), address: addr || '', price: price || '', url: link || '' })
          })
          return items
        }
        cards.forEach(card => {
          const name  = card.querySelector('[class*="property-name"],[class*="PropertyName"],[class*="listing-name"],h3,h4')?.textContent?.trim()
          const addr  = card.querySelector('[class*="address"],[class*="Address"],[class*="location"]')?.textContent?.trim()
          const price = card.querySelector('[class*="price"],[class*="Price"]')?.textContent?.trim()
          const link  = (card.querySelector('a[href*="/listing/"]') || card.closest('a'))?.href
            || `https://www.loopnet.com/listing/${card.getAttribute('data-listing-id')}/`
          if (!name || !/storage/i.test(name)) return
          items.push({ name: name.slice(0, 80), address: addr || '', price: price || '', url: link })
        })
        return items
      }, abbr)

      for (const l of pageLeads) {
        const priceM = (l.price || '').replace(/,/g, '').match(/\$([\d.]+)\s*([Mm])?/)
        let askingPrice
        if (priceM) {
          const val = parseFloat(priceM[1])
          askingPrice = priceM[2] ? Math.round(val * 1_000_000) : Math.round(val)
        }
        const addrM = (l.address || '').match(/^([^,]+)/)
        leads.push({
          id: generateLeadId(),
          facilityName: l.name,
          address: l.address || 'See LoopNet listing',
          city: addrM?.[1]?.trim() || abbr,
          state: abbr,
          askingPrice,
          ownerName: 'LoopNet Listing',
          source: 'loopnet',
          sourceUrl: l.url,
          distressSignals: {},
          score: scoreLead({}),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
      }
      log('LoopNet', `${slug}: ${pageLeads.length} leads`)
    } catch (err) {
      log('LoopNet', `${slug} error: ${err.message}`)
    } finally {
      if (page) await page.close().catch(() => {})
    }
  }

  log('LoopNet', `Total: ${leads.length} leads`)
  return leads
}

// ─── 8. Facebook Marketplace — Puppeteer (requires session cookies) ───────────
async function scanFacebook(browser) {
  // Facebook requires login. To enable:
  // 1. Log into facebook.com/marketplace/category/propertyforsale in Chrome manually
  // 2. Export cookies via a browser extension (e.g. "EditThisCookie") to scripts/fb-cookies.json
  // 3. Uncomment the body below
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
    // Wait for listings
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

// ─── 9. County Tax Rolls — STUB ───────────────────────────────────────────────
// TODO: Each county has its own data portal. Priority counties:
//   FL: https://www.miamidade.gov/Apps/PA/propertysearch/ (Miami-Dade)
//       https://www.hcpafl.org/ (Hillsborough/Tampa)
//   TX: https://www.hcad.org/ (Harris/Houston)
//       https://www.dallascad.org/ (Dallas)
//   GA: https://www.cofcga.gov/taxassessor (Chatham/Savannah)
// Many counties expose delinquent tax lists as downloadable CSVs.
// Query: properties with "storage" in business name + delinquent taxes.
async function scanCountyTax() {
  log('CountyTax', 'Stub — see TODO comments in source for county-specific API setup')
  return []
}

// ─── 10. Fire Marshal Violations — STUB ───────────────────────────────────────
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

// ─── 11. UCC Liens — STUB ─────────────────────────────────────────────────────
// TODO: UCC filings are searchable at each state's Secretary of State office.
//   TX: https://mycpa.cpa.state.tx.us/ucc/
//   FL: https://efile.sunbiz.org/uccsrch.html
//   GA: https://ecorp.sos.ga.gov/BusinessSearch/UCCSearch
// Search for "storage" in debtor name with recent filings.
async function scanUCCLiens() {
  log('UCCLiens', 'Stub — see TODO comments for state SOS portal setup')
  return []
}

// ─── 12. Lis Pendens — STUB ───────────────────────────────────────────────────
// TODO: Lis pendens are recorded at the county clerk/recorder level.
//   Many counties expose searchable records:
//   Hillsborough (Tampa): https://pubrec.hillsclerk.com/
//   Harris (Houston): https://www.cclerk.hctx.net/
//   Fulton (Atlanta): https://www.fultoncountyga.gov/services/courts/clerk-of-courts
// Look for "storage" + recent filings in target counties.
async function scanLisPendens() {
  log('LisPendens', 'Stub — see TODO comments for county clerk portal setup')
  return []
}

// ─── 13. Out-of-state Owner Analysis — STUB ───────────────────────────────────
// TODO: Cross-reference property records with owner mailing address.
// Some counties provide bulk property data downloads:
//   FL: https://floridarevenue.com/property/Pages/DataPortal.aspx
//   TX: https://comptroller.texas.gov/taxes/property-tax/
// Filter: properties where owner mailing state != property state.
async function scanOutOfStateOwners() {
  log('OutOfState', 'Stub — see TODO comments for state property data portals')
  return []
}

// ─── Persist to leads.json ────────────────────────────────────────────────────
function persistLeads(newLeads) {
  let existing = []
  try {
    existing = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'))
  } catch { /* file doesn't exist yet */ }

  // Deduplicate: existing + new, keyed by sourceUrl (or id as fallback)
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

  // Find Chrome on the user's machine
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
    // ── Fetch-based scrapers run in parallel ──
    log('Runner', 'Running API + fetch-based scrapers in parallel...')
    const fetchResults = await Promise.allSettled([
      Promise.race([scanCourtListener(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('CourtListener hard timeout')),90000))]),
      // scanBizBuySell moved to browser block
      scanBizQuest(),
      scanShowcase(),
      scanBrevitas(),
      scanFSBO(),
      scanLisPendens(),
      scanCountyTax(),
      scanUCCLiens(),
      scanOutOfStateOwners(),
      scanFireMarshal(),
    ])

    const fetchLeads = fetchResults.flatMap(r => r.status === 'fulfilled' ? r.value : [])

    // ── Persist fetch leads immediately — do not wait for browser scrapers ──
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

    // ── Browser-based scrapers run sequentially — optional, non-blocking ──
    const browserLeads = []
    if (browser) {
      log('Runner', 'Running Puppeteer-based scrapers...')
      try { browserLeads.push(...await scanLoopNet(browser)) } catch (e) { log('LoopNet', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanBizBuySell(browser)) } catch (e) { log('BizBuySell', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanCrexi(browser)) } catch (e) { log('Crexi', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanFacebook(browser)) } catch (e) { log('Facebook', `Fatal: ${e.message}`) }
    }

    // ── Persist browser leads if any found ──
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
        return age < 25 * 60 * 60 * 1000
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
