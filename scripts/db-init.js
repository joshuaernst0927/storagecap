const fs = require('fs');
const path = require('path');

// load .env.local
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

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('ABORT: DATABASE_URL not found in .env.local'); process.exit(1); }

  const sql = neon(url);
  const schema = fs.readFileSync(path.join(__dirname, 'db-schema.sql'), 'utf8');

  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.split('\n').every(l => l.trim().startsWith('--')));

  console.log('executing ' + statements.length + ' statements...');
  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').slice(0, 70);
    try {
      await sql.query(stmt);
      console.log('  OK   ' + label);
    } catch (e) {
      console.log('  FAIL ' + label);
      console.log('       ' + e.message);
      process.exit(1);
    }
  }

  const tables = await sql.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('');
  console.log('TABLES NOW IN DATABASE:');
  tables.forEach(r => console.log('   ' + r.table_name));
})();