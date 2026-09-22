const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i < 0) return;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
});

const { neon } = require('@neondatabase/serverless');

const BROKER = ['crexi', 'loopnet', 'bizquest'];

const SOURCES = [
  path.join(__dirname, '..', 'public', 'data', 'leads.json'),
  'C:/Users/joshu/Downloads/leads-backup/leads.local.20260922.json',
];

function clean(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/\uFFFD/g, '-').replace(/\s+/g, ' ').trim();
}

function dedupeKey(x) {
  const url = (x.sourceUrl || '').trim().toLowerCase();
  const addr = clean(x.address || '').toLowerCase();
  const city = clean(x.city || '').toLowerCase();
  const st = clean(x.state || '').toLowerCase();
  const name = clean(x.facilityName || x.businessName || x.ownerName || '').toLowerCase();
  if (addr) return 'a|' + addr + '|' + city + '|' + st;
  if (url && name) return 'u|' + url + '|' + name;
  if (url) return 'u|' + url;
  return 'n|' + name + '|' + city + '|' + st;
}

function load(f) {
  if (!fs.existsSync(f)) { console.log('  (missing, skipped) ' + f); return []; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const a = Array.isArray(j) ? j : (j.leads || []);
  console.log('  ' + a.length + ' leads from ' + path.basename(f));
  return a;
}

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('ABORT: DATABASE_URL not found'); process.exit(1); }
  const sql = neon(url);

  console.log('READING SOURCES:');
  let all = [];
  SOURCES.forEach(f => { all = all.concat(load(f)); });
  console.log('  total rows read: ' + all.length);

  const byKey = new Map();
  for (const x of all) {
    const k = dedupeKey(x);
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, x); continue; }
    const a = new Date(x.lastUpdated || x.foundAt || 0).getTime();
    const b = new Date(prev.lastUpdated || prev.foundAt || 0).getTime();
    if (a > b) byKey.set(k, x);
  }
  console.log('  unique properties after dedupe: ' + byKey.size);

  let ins = 0, upd = 0, fail = 0;
  for (const [key, x] of byKey) {
    const offMarket = !BROKER.includes(x.source);
    try {
      const r = await sql.query(
        'INSERT INTO properties (id, facility_name, business_name, owner_name, address, city, state, source, source_url, is_off_market, distress_signals, signals, college_town, contact_info, asking_price, score, stage, dedupe_key, first_seen, last_updated) ' +
        'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ' +
        'ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET last_updated = EXCLUDED.last_updated, score = EXCLUDED.score, contact_info = EXCLUDED.contact_info ' +
        'RETURNING (xmax = 0) AS inserted',
        [
          x.id,
          clean(x.facilityName) || null,
          clean(x.businessName) || null,
          clean(x.ownerName) || null,
          clean(x.address) || null,
          clean(x.city) || null,
          clean(x.state) || null,
          x.source,
          x.sourceUrl || null,
          offMarket,
          x.distressSignals ? JSON.stringify(x.distressSignals) : null,
          x.signals ? JSON.stringify(x.signals) : null,
          x.collegeTownMatch ? JSON.stringify({ match: x.collegeTownMatch, students: x.collegeTownStudents, institution: x.collegeTownInstitution }) : null,
          x.contactInfo ? JSON.stringify(x.contactInfo) : null,
          typeof x.askingPrice === 'number' ? x.askingPrice : null,
          typeof x.score === 'number' ? x.score : null,
          'lead',
          key,
          x.foundAt || null,
          x.lastUpdated || x.foundAt || null,
        ]
      );
      if (r[0] && r[0].inserted) ins++; else upd++;

      if (x.notes && clean(x.notes)) {
        await sql.query(
          'INSERT INTO property_notes (property_id, kind, body) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM property_notes WHERE property_id = $1 AND body = $3)',
          [x.id, 'import', clean(x.notes)]
        );
      }
    } catch (e) {
      fail++;
      if (fail <= 5) console.log('  FAIL ' + (x.id || '?') + ': ' + e.message);
    }
  }

  console.log('');
  console.log('IMPORT RESULT: inserted ' + ins + ' | updated ' + upd + ' | failed ' + fail);

  const tot = await sql.query('SELECT COUNT(*)::int AS n FROM properties');
  const off = await sql.query('SELECT COUNT(*)::int AS n FROM properties WHERE is_off_market');
  const bySrc = await sql.query('SELECT source, COUNT(*)::int AS n FROM properties GROUP BY source ORDER BY n DESC');
  const notes = await sql.query('SELECT COUNT(*)::int AS n FROM property_notes');

  console.log('');
  console.log('DATABASE NOW HOLDS:');
  console.log('  properties: ' + tot[0].n + '  (off-market: ' + off[0].n + ')');
  bySrc.forEach(r => console.log('    ' + r.source + ': ' + r.n));
  console.log('  notes: ' + notes[0].n);
})();