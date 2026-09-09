// Regenerates lib/collegeTowns.ts and scripts/collegeTowns.js from real IPEDS data.
// Sources (data/ipeds/): hd2025.csv, effy2025_dist.csv, ef2024a.csv, ef2023a.csv, ef2022a.csv
// Run: node scripts/generate-college-towns.js
const fs = require('fs')
const path = require('path')

const IPEDS = path.join('data', 'ipeds')

// ---- CSV parsing (quote-aware; IPEDS has quoted fields containing commas) ----
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out.map(f => f.trim())
}

// BOM may decode as U+FEFF or as latin1 bytes depending on read encoding
function stripBom(s) {
  return s.replace(/^\uFEFF/, '').replace(/^\u00EF\u00BB\u00BF/, '')
}

function load(file) {
  const full = path.join(IPEDS, file)
  const lines = fs.readFileSync(full, 'latin1').split(/\r?\n/).filter(l => l.trim())
  const headers = parseCsvLine(stripBom(lines[0]))
  const rows = []
  let skipped = 0
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i])
    if (f.length !== headers.length) { skipped++; continue }
    const o = {}
    headers.forEach((h, j) => o[h] = f[j])
    rows.push(o)
  }
  if (skipped) console.log(`  ${file}: skipped ${skipped} malformed rows`)
  return rows
}

// ---- Gateway markets: cap rates too compressed for the value-add/land thesis ----
// Hardcoded so regeneration can never reintroduce them.
const GATEWAY_EXCLUSIONS = new Set([
  // NYC
  'new york|ny', 'brooklyn|ny', 'bronx|ny', 'queens|ny', 'staten island|ny',
  'flushing|ny', 'jamaica|ny', 'long island city|ny',
  // LA + inner suburbs
  'los angeles|ca', 'pasadena|ca', 'santa monica|ca', 'beverly hills|ca',
  'west hollywood|ca', 'culver city|ca', 'glendale|ca', 'burbank|ca',
  'inglewood|ca', 'el segundo|ca',
  // Chicago
  'chicago|il', 'evanston|il',
  // SF Bay inner
  'san francisco|ca', 'oakland|ca', 'berkeley|ca', 'daly city|ca',
  // Boston
  'boston|ma', 'cambridge|ma', 'somerville|ma', 'brookline|ma', 'chestnut hill|ma',
  // DC
  'washington|dc',
  // Miami
  'miami|fl', 'miami beach|fl', 'coral gables|fl',
  // Seattle
  'seattle|ca', 'seattle|wa',
])

// ---- Thresholds ----
// Footprint, set Sept 8 2026: states east of the Mississippi, PLUS Texas,
// Oklahoma, Louisiana and Minnesota. TX and OK included explicitly because
// they carry heavy self-storage inventory. Iowa, Missouri and Arkansas are
// OUT despite bordering the river. Supersedes the earlier all-50-states footprint.
const FOOTPRINT_STATES = new Set([
  'AL','CT','DE','FL','GA','IL','IN','KY','LA','MA','MD','ME','MI','MN','MS',
  'NC','NH','NJ','NY','OH','OK','PA','RI','SC','TN','TX','VA','VT','WI','WV',
])

// Carnegie Basic 1-14 = the Associate's Colleges family (community colleges).
// Some large community college systems reclassify to IPEDS SECTOR 1 once they
// grant any bachelor's degree (Houston City College, Dallas College, Lone Star
// College System, Broward College), so SECTOR alone does not catch them.
// Their students overwhelmingly commute from existing homes and generate no
// move-in/move-out storage demand, so enrollment is discounted, not dropped.
// NOTE: 0.25 is a tunable judgment, not a measured figure.
const COMMUTER_WEIGHT = 0.25
const CARNEGIE_COMMUTER_MIN = 1
const CARNEGIE_COMMUTER_MAX = 14

const ONLINE_EXCLUDE_PCT = 0.50   // >=50% exclusively-online => not a physical anchor
const MIN_TOWN_STUDENTS = 3000    // matches prior table's floor
const KEEP_SECTORS = new Set(['1', '2']) // public 4yr+, private nonprofit 4yr+

console.log('Loading IPEDS files...')
const hd = load('hd2025.csv')
console.log(`  hd2025: ${hd.length} institutions`)

// ---- Online-dominant exclusion (evidence-based, not a name list) ----
const distRows = load('effy2025_dist.csv').filter(r => r.EFFYDLEV === '1')
const onlinePct = {}
for (const r of distRows) {
  const tot = parseInt(r.EFYDETOT, 10)
  const exc = parseInt(r.EFYDEEXC, 10)
  if (!isNaN(tot) && !isNaN(exc) && tot > 0) onlinePct[r.UNITID] = exc / tot
}
console.log(`  effy2025_dist: ${Object.keys(onlinePct).length} institutions with distance-ed data`)

// ---- Enrollment by year (EFALEVEL=1 = all students, total) ----
function loadEnrollment(file) {
  const m = {}
  for (const r of load(file)) {
    if (r.EFALEVEL !== '1') continue
    const v = parseInt(r.EFTOTLT, 10)
    if (!isNaN(v)) m[r.UNITID] = v
  }
  return m
}
const enr2024 = loadEnrollment('ef2024a.csv')
const enr2023 = loadEnrollment('ef2023a.csv')
const enr2022 = loadEnrollment('ef2022a.csv')
console.log(`  enrollment: 2024=${Object.keys(enr2024).length} 2023=${Object.keys(enr2023).length} 2022=${Object.keys(enr2022).length}`)

// ---- Build qualifying institution list ----
const stats = { total: 0, wrongSector: 0, outOfFootprint: 0, online: 0, noEnrollment: 0, closed: 0, kept: 0, commuter: 0 }
const institutions = []
for (const r of hd) {
  stats.total++
  if (!KEEP_SECTORS.has(r.SECTOR)) { stats.wrongSector++; continue }
  if (!FOOTPRINT_STATES.has((r.STABBR || '').trim().toUpperCase())) { stats.outOfFootprint++; continue }
  if (r.CYACTIVE === '2') { stats.closed++; continue }   // not currently active
  const pct = onlinePct[r.UNITID]
  if (pct !== undefined && pct >= ONLINE_EXCLUDE_PCT) { stats.online++; continue }
  const e24 = enr2024[r.UNITID]
  if (e24 === undefined || e24 <= 0) { stats.noEnrollment++; continue }
  const lat = parseFloat(r.LATITUDE)
  const lon = parseFloat(r.LONGITUD)
  const carnegie = parseInt(r.C21BASIC, 10)
  const isCommuter = !isNaN(carnegie) && carnegie >= CARNEGIE_COMMUTER_MIN && carnegie <= CARNEGIE_COMMUTER_MAX
  if (isCommuter) stats.commuter++
  institutions.push({
    isCommuter,
    unitid: r.UNITID,
    name: r.INSTNM,
    city: r.CITY,
    state: r.STABBR,
    lat: isNaN(lat) ? null : lat,
    lon: isNaN(lon) ? null : lon,
    e2024: e24,
    e2023: enr2023[r.UNITID] !== undefined ? enr2023[r.UNITID] : null,
    e2022: enr2022[r.UNITID] !== undefined ? enr2022[r.UNITID] : null,
    onlinePct: pct === undefined ? null : pct,
  })
  stats.kept++
}
console.log('\nInstitution filter:')
console.log(`  total in HD2025:        ${stats.total}`)
console.log(`  dropped, wrong sector:  ${stats.wrongSector}`)
console.log(`  dropped, out of footprint: ${stats.outOfFootprint}`)
console.log(`  dropped, not active:    ${stats.closed}`)
console.log(`  dropped, >=50% online:  ${stats.online}`)
console.log(`  dropped, no enrollment: ${stats.noEnrollment}`)
console.log(`  KEPT:                   ${stats.kept}`)
console.log(`     of which commuter/2yr (weighted ${COMMUTER_WEIGHT}): ${stats.commuter}`)

// ---- Aggregate by town (SUM enrollment across institutions) ----
const towns = {}
for (const inst of institutions) {
  const key = inst.city.trim().toLowerCase() + '|' + inst.state.trim().toLowerCase()
  if (!towns[key]) {
    towns[key] = {
      city: inst.city.trim(), state: inst.state.trim().toUpperCase(),
      students: 0, e2023: 0, e2022: 0,
      studentsRaw: 0, studentsResidential: 0, studentsCommuter: 0,
      has2023: false, has2022: false,
      institutions: [], lats: [], lons: [],
    }
  }
  const t = towns[key]
  const w = inst.isCommuter ? COMMUTER_WEIGHT : 1
  t.students += Math.round(inst.e2024 * w)
  t.studentsRaw += inst.e2024
  if (inst.isCommuter) t.studentsCommuter += inst.e2024
  else t.studentsResidential += inst.e2024
  if (inst.e2023 !== null) { t.e2023 += Math.round(inst.e2023 * w); t.has2023 = true }
  if (inst.e2022 !== null) { t.e2022 += Math.round(inst.e2022 * w); t.has2022 = true }
  t.institutions.push({ name: inst.name, students: inst.e2024, weighted: Math.round(inst.e2024 * w), isCommuter: inst.isCommuter })
  if (inst.lat !== null && inst.lon !== null) { t.lats.push(inst.lat); t.lons.push(inst.lon) }
}

// ---- Apply gateway exclusions + size floor ----
const excludedGateway = []
const final = {}
for (const key of Object.keys(towns)) {
  const t = towns[key]
  if (GATEWAY_EXCLUSIONS.has(key)) { excludedGateway.push(`${t.city}, ${t.state} (${t.students})`); continue }
  if (t.students < MIN_TOWN_STUDENTS) continue
  t.institutions.sort((a, b) => b.weighted - a.weighted)
  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
  final[key] = {
    city: t.city,
    state: t.state,
    students: t.students,
    studentsRaw: t.studentsRaw,
    studentsResidential: t.studentsResidential,
    studentsCommuter: t.studentsCommuter,
    institution: t.institutions[0].name,
    institutionCount: t.institutions.length,
    lat: t.lats.length ? Number(avg(t.lats).toFixed(6)) : null,
    lon: t.lons.length ? Number(avg(t.lons).toFixed(6)) : null,
    students2023: t.has2023 ? t.e2023 : null,
    students2022: t.has2022 ? t.e2022 : null,
  }
}

const keys = Object.keys(final).sort((a, b) => {
  const A = final[a], B = final[b]
  if (A.state !== B.state) return A.state < B.state ? -1 : 1
  return B.students - A.students
})

console.log(`\nTowns after aggregation + gateway exclusion + >=${MIN_TOWN_STUDENTS} floor: ${keys.length}`)
console.log(`Gateway markets excluded (${excludedGateway.length}):`)
excludedGateway.sort().forEach(g => console.log('   ', g))

// ---- Emit ----
const header = `// Auto-generated from IPEDS (NCES) data. DO NOT HAND-EDIT.
// Regenerate: node scripts/generate-college-towns.js
//
// Sources: HD2025 (directory + coordinates), EFFY2025_DIST (distance-ed share),
//          EF2024A / EF2023A / EF2022A (fall enrollment, EFALEVEL=1 total).
//
// Screen applied:
//   - Footprint: states east of the Mississippi PLUS TX, OK, LA, MN.
//     (TX/OK included for self-storage inventory depth. IA, MO, AR excluded.)
//   - Community colleges (Carnegie Basic 1-14) are KEPT but their enrollment
//     is weighted at ${COMMUTER_WEIGHT} - commuter students living at home do not
//     generate move-in/move-out storage demand. 'students' is the WEIGHTED
//     figure; studentsRaw / studentsResidential / studentsCommuter carry the
//     unweighted split so the weight can be retuned without regenerating.
//   - IPEDS SECTOR 1 or 2 only (public 4yr+, private nonprofit 4yr+).
//     2-year, less-than-2-year, and for-profit institutions excluded: commuter
//     populations with no move-in/move-out cycle driving storage demand.
//   - Institutions >=${(ONLINE_EXCLUDE_PCT * 100).toFixed(0)}% exclusively-distance enrollment excluded, measured from
//     IPEDS data rather than a hardcoded name list. This correctly separates
//     e.g. ASU Campus Immersion (kept) from ASU Digital Immersion (dropped).
//   - Inactive institutions (CYACTIVE=2) excluded.
//   - Enrollment SUMMED across all qualifying institutions per town.
//   - Gateway markets hardcoded out (cap rates too compressed for the
//     value-add/land thesis); regeneration cannot reintroduce them.
//   - Towns below ${MIN_TOWN_STUDENTS} total students dropped.
//
// ${keys.length} towns.
`

const iface = `export interface CollegeTownMatch {
  city: string
  state: string
  students: number
  studentsRaw?: number
  studentsResidential?: number
  studentsCommuter?: number
  institution: string
  institutionCount?: number
  lat?: number | null
  lon?: number | null
  students2023?: number | null
  students2022?: number | null
}
`

function entryLine(k) {
  const t = final[k]
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `  '${esc(k)}': { city: '${esc(t.city)}', state: '${t.state}', students: ${t.students}, studentsRaw: ${t.studentsRaw}, studentsResidential: ${t.studentsResidential}, studentsCommuter: ${t.studentsCommuter}, institution: '${esc(t.institution)}', institutionCount: ${t.institutionCount}, lat: ${t.lat}, lon: ${t.lon}, students2023: ${t.students2023}, students2022: ${t.students2022} },`
}
const entries = keys.map(entryLine).join('\n')

const aliases = `const CITY_ALIASES${'RECORD_TYPE'} = {
  'state college|pa': 'university park|pa',
  'oxford|ms': 'university|ms',
}
`

const docComment = `/**
 * Looks up whether a lead's city/state matches a known college town.
 * Returns null (not undefined) on no match - this is a LOOKUP, not a
 * screen. Non-matching leads are NOT discarded here or anywhere in the
 * pipeline; the scorer uses this to rank, never to drop a lead.
 * Gateway markets are excluded from this table by design (see header).
 */
`

// TypeScript twin
const ts = header + iface +
  `const COLLEGE_TOWNS: Record<string, CollegeTownMatch> = {\n${entries}\n}\n` +
  aliases.replace('RECORD_TYPE', ': Record<string, string>') +
  docComment +
  `export function matchCollegeTown(city: string | undefined | null, state: string | undefined | null): CollegeTownMatch | null {
  if (!city || !state) return null
  const key = city.trim().toLowerCase() + '|' + state.trim().toLowerCase()
  if (COLLEGE_TOWNS[key]) return COLLEGE_TOWNS[key]
  const aliasKey = CITY_ALIASES[key]
  if (aliasKey && COLLEGE_TOWNS[aliasKey]) return COLLEGE_TOWNS[aliasKey]
  return null
}
`

// JS twin (scraper runs standalone under Node, no build step)
const js = header +
  `const COLLEGE_TOWNS = {\n${entries}\n}\n` +
  aliases.replace('RECORD_TYPE', '') +
  docComment +
  `function matchCollegeTown(city, state) {
  if (!city || !state) return null
  const key = String(city).trim().toLowerCase() + '|' + String(state).trim().toLowerCase()
  if (COLLEGE_TOWNS[key]) return COLLEGE_TOWNS[key]
  const aliasKey = CITY_ALIASES[key]
  if (aliasKey && COLLEGE_TOWNS[aliasKey]) return COLLEGE_TOWNS[aliasKey]
  return null
}

module.exports = { matchCollegeTown, COLLEGE_TOWNS }
`

fs.writeFileSync(path.join('lib', 'collegeTowns.ts'), ts, 'utf8')
fs.writeFileSync(path.join('scripts', 'collegeTowns.js'), js, 'utf8')
console.log(`\nWrote lib/collegeTowns.ts (${ts.length} bytes)`)
console.log(`Wrote scripts/collegeTowns.js (${js.length} bytes)`)

// ---- Spot-check output ----
console.log('\nTOP 15 TOWNS BY SUMMED ENROLLMENT:')
keys.slice().sort((a, b) => final[b].students - final[a].students).slice(0, 15)
  .forEach(k => {
    const t = final[k]
    console.log(`  ${String(t.students).padStart(7)}  ${t.city}, ${t.state}  (${t.institutionCount} inst, top: ${t.institution})`)
  })