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

const puppeteer = require('puppeteer-core')
const fs        = require('fs')
const path      = require('path')

// ─── Config ────────────────────────────────────────────────────────────────────
const LEADS_FILE   = path.join(__dirname, '..', 'public', 'data', 'leads.json')
const CL_TOKEN     = process.env.COURTLISTENER_TOKEN || '25e0d81f7c377dbdd866ba6165afe7af4fa9c99e'
const TARGET_STATES = ['TX', 'GA', 'SC', 'TN', 'AZ', 'FL', 'AL', 'MS', 'NC', 'OH']

// Chrome paths to try (Windows)
const CHROME_PATHS = [
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
  log('CourtListener', 'Starting — querying 19 bankruptcy courts...')
  const filedAfter = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)

  const results = await Promise.allSettled(
    BANKRUPTCY_COURTS.map(async courtId => {
      const params = new URLSearchParams({
        q: 'storage', order_by: 'date_filed',
        date_filed__gte: filedAfter, page_size: '50', format: 'json', court: courtId,
      })
      const res = await fetch(`https://www.courtlistener.com/api/rest/v3/dockets/?${params}`, {
        headers: {
          Authorization: `Token ${CL_TOKEN}`,
          'User-Agent': 'YEMAcquisitions/1.0 (joshuaernst@gmail.com)',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return { courtId, dockets: data.results || [] }
    })
  )

  const seen = new Set()
  const leads = []

  for (const r of results) {
    if (r.status === 'rejected') { log('CourtListener', `Error: ${r.reason}`); continue }
    const { courtId, dockets } = r.value
    for (const d of dockets) {
      if (seen.has(d.id)) continue
      seen.add(d.id)

      const caseName = d.case_name || d.case_name_short || ''
      if (!/storage/i.test(caseName)) continue

      const state = COURT_STATE[courtId.slice(0, 2)] || 'US'
      const city  = COURT_CITY[courtId] || courtId.toUpperCase()
      const chM   = (d.cause || '').match(/chapter\s+(\d+)/i)
      const chapter = chM ? `Chapter ${chM[1]}` : 'Bankruptcy'
      const debtorM = caseName.match(/in\s+re:?\s+(.+)/i)
      const ownerName = debtorM
        ? debtorM[1].trim().slice(0, 80)
        : caseName.split(/\s+v\.?\s+/i)[0].trim().slice(0, 80)

      const signals = {
        bankruptcy: true, bankruptcyChapter: chapter,
        bankruptcyDate: d.date_filed, bankruptcyDocket: d.docket_number,
      }
      leads.push({
        id: generateLeadId(),
        facilityName: caseName.slice(0, 80),
        address: `Case No. ${d.docket_number || 'N/A'}`,
        city, state, ownerName,
        source: 'courtlistener',
        sourceUrl: `https://www.courtlistener.com/docket/${d.id}/`,
        distressSignals: signals,
        score: scoreLead(signals),
        status: 'new',
        foundAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: [
          chapter + ' bankruptcy filing',
          d.date_filed ? `Filed: ${new Date(d.date_filed).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}` : '',
          d.cause ? `Cause: ${d.cause}` : '',
          `Court: ${courtId.toUpperCase()}`,
        ].filter(Boolean).join(' · '),
      })
    }
  }

  log('CourtListener', `Found ${leads.length} leads`)
  return leads
}

// ─── 2. Craigslist — national RSS feed ────────────────────────────────────────
async function scanCraigslist() {
  log('Craigslist', 'Starting...')
  const queries = [
    'https://www.craigslist.org/search/bfs?format=rss&query=self+storage+for+sale',
    'https://www.craigslist.org/search/bfs?format=rss&query=storage+facility+for+sale',
    'https://www.craigslist.org/search/bfs?format=rss&query=self+storage+business+sale',
  ]

  const seen = new Set()
  const leads = []

  for (const url of queries) {
    try {
      const res = await safeFetch(url)
      if (!res.ok) { log('Craigslist', `HTTP ${res.status} — ${url}`); continue }
      const xml = await res.text()
      for (const item of parseRssXml(xml)) {
        if (!item.title || seen.has(item.link)) continue
        seen.add(item.link)
        if (!/storage/i.test(`${item.title} ${item.desc}`)) continue
        if (!/for sale|selling|price|asking/i.test(`${item.title} ${item.desc}`)) continue

        const combo = `${item.geo} ${item.desc} ${item.title}`
        const stateM = combo.match(/,\s*([A-Z]{2})(?:\s+\d{5})?/)
        const state  = stateM?.[1] || 'US'
        if (state !== 'US' && !TARGET_STATES.includes(state)) continue
        const cityM  = combo.match(/([A-Za-z][A-Za-z\s]+),\s*[A-Z]{2}/)
        const city   = cityM?.[1]?.trim() || state

        const priceM = combo.match(/\$\s*([\d,]+)/)
        const signals = {}
        leads.push({
          id: generateLeadId(),
          facilityName: item.title.slice(0, 80),
          address: 'See listing', city, state,
          askingPrice: priceM ? parseInt(priceM[1].replace(/,/g, '')) : undefined,
          ownerName: 'Unknown',
          source: 'craigslist',
          sourceUrl: item.link,
          distressSignals: signals,
          score: scoreLead(signals),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
      }
    } catch (err) {
      log('Craigslist', `Error: ${err.message}`)
    }
  }

  log('Craigslist', `Found ${leads.length} leads`)
  return leads
}

// ─── 3. BizBuySell — public RSS feed ──────────────────────────────────────────
async function scanBizBuySell() {
  log('BizBuySell', 'Starting...')
  const queries = [
    'https://www.bizbuysell.com/rss/businesses-for-sale.aspx?q=self+storage',
    'https://www.bizbuysell.com/rss/businesses-for-sale.aspx?q=storage+facility',
  ]

  const seen = new Set()
  const leads = []

  for (const url of queries) {
    try {
      const res = await safeFetch(url)
      if (!res.ok) { log('BizBuySell', `HTTP ${res.status}`); continue }
      const xml = await res.text()
      for (const item of parseRssXml(xml)) {
        if (!item.title || seen.has(item.link)) continue
        seen.add(item.link)
        if (!/storage/i.test(item.title)) continue

        const combo  = `${item.desc} ${item.title}`
        const locM   = combo.match(/([A-Za-z][A-Za-z\s]+),\s*([A-Z]{2})/)
        const state  = locM?.[2] || 'US'
        const city   = locM?.[1]?.trim() || state

        const priceM = combo.match(/\$\s*([\d,.]+)\s*[Mm]illion|\$\s*([\d,]+)/)
        let askingPrice
        if (priceM) {
          if (priceM[1]) askingPrice = Math.round(parseFloat(priceM[1].replace(/,/g, '')) * 1_000_000)
          else if (priceM[2]) askingPrice = parseInt(priceM[2].replace(/,/g, ''))
        }

        const signals = {}
        leads.push({
          id: generateLeadId(),
          facilityName: item.title.slice(0, 80),
          address: 'See listing', city, state, askingPrice,
          ownerName: 'Unknown',
          source: 'bizbuysell',
          sourceUrl: item.link,
          distressSignals: signals,
          score: scoreLead(signals),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
      }
    } catch (err) {
      log('BizBuySell', `Error: ${err.message}`)
    }
  }

  log('BizBuySell', `Found ${leads.length} leads`)
  return leads
}

// ─── 4. Brevitas — fetch + __NEXT_DATA__ parse ────────────────────────────────
async function scanBrevitas() {
  log('Brevitas', 'Starting...')
  const queries = [
    'https://www.brevitas.com/for-sale/?q=self+storage',
    'https://www.brevitas.com/for-sale/?q=storage+facility',
  ]

  const seen = new Set()
  const leads = []

  for (const url of queries) {
    try {
      const res = await safeFetch(url)
      if (!res.ok) { log('Brevitas', `HTTP ${res.status}`); continue }
      const html = await res.text()

      // Try __NEXT_DATA__ (Brevitas is Next.js)
      const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
      if (ndMatch) {
        const pageData = JSON.parse(ndMatch[1])
        const listings = pageData?.props?.pageProps?.listings
          || pageData?.props?.pageProps?.properties
          || pageData?.props?.pageProps?.results
          || []
        for (const l of listings) {
          const name = l.title || l.name || ''
          const key  = l.id || l.slug || l.url || name
          if (!name || !/storage/i.test(name) || seen.has(key)) continue
          seen.add(key)

          const addr  = typeof l.address === 'string' ? l.address : (l.address?.full || l.location || '')
          const stateM = addr.match(/,\s*([A-Z]{2})/)
          const state  = stateM?.[1] || l.state || 'US'
          const cityM  = addr.match(/^([^,]+)/)
          const city   = cityM?.[1]?.trim() || l.city || state

          leads.push({
            id: generateLeadId(),
            facilityName: name.slice(0, 80),
            address: addr || 'See listing', city, state,
            askingPrice: typeof l.price === 'number' ? l.price : undefined,
            ownerName: 'Unknown',
            source: 'brevitas',
            sourceUrl: l.url ? `https://www.brevitas.com${l.url}` : url,
            distressSignals: {},
            score: scoreLead({}),
            status: 'new',
            foundAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          })
        }
      }

      // Fallback: JSON-LD
      if (leads.filter(l => l.source === 'brevitas').length === 0) {
        const jldBlocks = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []
        for (const block of jldBlocks) {
          try {
            const obj   = JSON.parse(block.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''))
            const items = Array.isArray(obj) ? obj : (obj['@graph'] || [obj])
            for (const item of items) {
              if (!item.name || !/storage/i.test(item.name) || seen.has(item.url || item.name)) continue
              seen.add(item.url || item.name)
              const addr = item.address || {}
              leads.push({
                id: generateLeadId(),
                facilityName: item.name.slice(0, 80),
                address: addr.streetAddress || 'See listing',
                city: addr.addressLocality || 'Unknown',
                state: addr.addressRegion || 'US',
                askingPrice: item.offers?.price || undefined,
                ownerName: 'Unknown',
                source: 'brevitas',
                sourceUrl: item.url || url,
                distressSignals: {},
                score: scoreLead({}),
                status: 'new',
                foundAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
              })
            }
          } catch { /* skip malformed block */ }
        }
      }
    } catch (err) {
      log('Brevitas', `Error: ${err.message}`)
    }
  }

  log('Brevitas', `Found ${leads.length} leads`)
  return leads
}

// ─── 5. FSBO.com — fetch ──────────────────────────────────────────────────────
async function scanFSBO() {
  log('FSBO', 'Starting...')
  const leads = []
  try {
    const res = await safeFetch('https://www.fsbo.com/search?keywords=self+storage&type=commercial')
    if (!res.ok) { log('FSBO', `HTTP ${res.status}`); return leads }
    const html = await res.text()

    const jldBlocks = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const block of jldBlocks) {
      try {
        const obj   = JSON.parse(block.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''))
        const items = Array.isArray(obj) ? obj : (obj['@graph'] || [obj])
        for (const item of items) {
          if (!item.name || !/storage/i.test(item.name)) continue
          const addr = item.address || {}
          leads.push({
            id: generateLeadId(),
            facilityName: item.name.slice(0, 80),
            address: addr.streetAddress || 'See listing',
            city: addr.addressLocality || 'Unknown',
            state: addr.addressRegion || 'US',
            askingPrice: item.offers?.price || undefined,
            ownerName: item.seller?.name || 'Unknown',
            source: 'fsbo',
            sourceUrl: item.url || 'https://www.fsbo.com',
            distressSignals: {},
            score: scoreLead({}),
            status: 'new',
            foundAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch { /* skip */ }
    }
  } catch (err) {
    log('FSBO', `Error: ${err.message}`)
  }
  log('FSBO', `Found ${leads.length} leads`)
  return leads
}

// ─── 6. Crexi — fetch + __NEXT_DATA__ / JSON API ──────────────────────────────
async function scanCrexi() {
  log('Crexi', 'Starting...')
  const leads = []
  try {
    // Crexi exposes search results in their page's __NEXT_DATA__ or a JSON endpoint
    const res = await safeFetch(
      'https://www.crexi.com/properties?types=SelfStorage&statuses=ForSale',
      { timeout: 15000 }
    )
    if (!res.ok) { log('Crexi', `HTTP ${res.status}`); return leads }
    const html = await res.text()

    const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (ndMatch) {
      const pageData = JSON.parse(ndMatch[1])
      const properties = pageData?.props?.pageProps?.properties
        || pageData?.props?.pageProps?.listings
        || pageData?.props?.pageProps?.initialProperties
        || []
      for (const p of properties) {
        const name = p.name || p.title || p.propertyName || ''
        if (!name) continue
        const addr   = p.address || p.location || ''
        const stateM = (typeof addr === 'string' ? addr : '').match(/,\s*([A-Z]{2})/)
        const state  = stateM?.[1] || p.state || 'US'
        const cityM  = (typeof addr === 'string' ? addr : '').match(/^([^,]+)/)
        const city   = cityM?.[1]?.trim() || p.city || state

        leads.push({
          id: generateLeadId(),
          facilityName: name.slice(0, 80),
          address: (typeof addr === 'string' ? addr : '') || 'See Crexi listing',
          city, state,
          askingPrice: p.askingPrice || p.price || undefined,
          ownerName: 'Crexi Listing',
          source: 'crexi',
          sourceUrl: p.url ? `https://www.crexi.com${p.url}` : `https://www.crexi.com/properties/${p.id || p.slug}`,
          distressSignals: {},
          score: scoreLead({}),
          status: 'new',
          foundAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    log('Crexi', `Error: ${err.message}`)
  }
  log('Crexi', `Found ${leads.length} leads`)
  return leads
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
      browser = await puppeteer.launch({
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
      scanCourtListener(),
      scanCraigslist(),
      scanBizBuySell(),
      scanBrevitas(),
      scanFSBO(),
      scanCrexi(),
    ])

    const fetchLeads = fetchResults.flatMap(r => r.status === 'fulfilled' ? r.value : [])

    // ── Browser-based scrapers run sequentially ──
    const browserLeads = []
    if (browser) {
      log('Runner', 'Running Puppeteer-based scrapers...')
      try { browserLeads.push(...await scanLoopNet(browser)) } catch (e) { log('LoopNet', `Fatal: ${e.message}`) }
      try { browserLeads.push(...await scanFacebook(browser)) } catch (e) { log('Facebook', `Fatal: ${e.message}`) }
    }

    const allLeads = [...fetchLeads, ...browserLeads]

    // ── Summary ──
    const counts = {}
    for (const l of allLeads) counts[l.source] = (counts[l.source] || 0) + 1

    console.log('\n================================================')
    console.log('  RESULTS')
    console.log('================================================')
    for (const [source, count] of Object.entries(counts)) {
      console.log(`  ${source.padEnd(16)}: ${count}`)
    }
    console.log(`  ${'TOTAL'.padEnd(16)}: ${allLeads.length}`)

    persistLeads(allLeads)

  } finally {
    if (browser) await browser.close()
  }

  console.log('\n  Done. Run `npm run dev` and visit /leads to see results.\n')
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
