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

const COLUMNS = [
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS zip_code TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS unit_count INTEGER",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_entity TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS asking_price_raw TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS pipeline_id TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS outreach_letter TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS email_subject TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS email_body TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS email_history JSONB",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_score INTEGER",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_type TEXT",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_scored_at TIMESTAMPTZ",
  "ALTER TABLE properties ADD COLUMN IF NOT EXISTS notes TEXT",
];

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('ABORT: DATABASE_URL not found'); process.exit(1); }
  const sql = neon(url);

  for (const stmt of COLUMNS) {
    try {
      await sql.query(stmt);
      console.log('  OK   ' + stmt.replace('ALTER TABLE properties ADD COLUMN IF NOT EXISTS ', '+ '));
    } catch (e) {
      console.log('  FAIL ' + stmt);
      console.log('       ' + e.message);
      process.exit(1);
    }
  }

  const cols = await sql.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='properties' ORDER BY ordinal_position"
  );
  console.log('');
  console.log('PROPERTIES COLUMNS (' + cols.length + '):');
  console.log('  ' + cols.map(c => c.column_name).join(', '));
})();