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

// One row per calendar month. credits_used counts Apollo calls that actually
// returned a match (and therefore consumed a credit). The monthly cap is
// enforced against this number, so repeated runs cannot exceed it.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS apollo_usage (
     period       TEXT PRIMARY KEY,
     credits_used INTEGER NOT NULL DEFAULT 0,
     updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
];

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('ABORT: DATABASE_URL not found'); process.exit(1); }
  const sql = neon(url);

  for (const stmt of STATEMENTS) {
    try {
      await sql.query(stmt);
      console.log('  OK   ' + stmt.replace(/\s+/g, ' ').slice(0, 80));
    } catch (e) {
      console.log('  FAIL ' + stmt.replace(/\s+/g, ' ').slice(0, 80));
      console.log('       ' + e.message);
      process.exit(1);
    }
  }

  const cols = await sql.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='apollo_usage' ORDER BY ordinal_position"
  );
  console.log('');
  console.log('APOLLO_USAGE COLUMNS (' + cols.length + '):');
  for (const c of cols) console.log('  ' + c.column_name + ' : ' + c.data_type);

  const rows = await sql.query('SELECT period, credits_used, updated_at FROM apollo_usage ORDER BY period');
  console.log('');
  console.log('EXISTING ROWS (' + rows.length + '):');
  for (const r of rows) console.log('  ' + r.period + '  used=' + r.credits_used + '  updated=' + r.updated_at);
})();
