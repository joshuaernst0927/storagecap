import type { NextApiRequest, NextApiResponse } from 'next'
import { neon } from '@neondatabase/serverless'
import { requireAuth } from '@/lib/serverAuth'

const sql = neon(process.env.DATABASE_URL as string)

// DB row -> Lead shape the UI expects
function toLead(r: any) {
  return {
    id: r.id,
    facilityName: r.facility_name ?? undefined,
    address: r.address ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    zipCode: r.zip_code ?? undefined,
    unitCount: r.unit_count ?? undefined,
    askingPrice: r.asking_price_raw ?? (r.asking_price != null ? Number(r.asking_price) : undefined),
    ownerName: r.owner_name ?? '',
    ownerEntity: r.owner_entity ?? undefined,
    source: r.source,
    sourceUrl: r.source_url ?? undefined,
    distressSignals: r.distress_signals ?? {},
    score: r.score ?? 0,
    status: r.status ?? 'new',
    foundAt: r.first_seen ? new Date(r.first_seen).toISOString() : new Date().toISOString(),
    lastUpdated: r.last_updated ? new Date(r.last_updated).toISOString() : new Date().toISOString(),
    contactedAt: r.contacted_at ? new Date(r.contacted_at).toISOString() : undefined,
    notes: r.notes ?? undefined,
    outreachLetter: r.outreach_letter ?? undefined,
    pipelineId: r.pipeline_id ?? undefined,
    contactInfo: r.contact_info ?? undefined,
    emailSubject: r.email_subject ?? undefined,
    emailBody: r.email_body ?? undefined,
    emailHistory: r.email_history ?? undefined,
    dealScore: r.deal_score ?? undefined,
    dealType: r.deal_type ?? undefined,
    dealScoredAt: r.deal_scored_at ? new Date(r.deal_scored_at).toISOString() : undefined,
  }
}

const BROKER = ['crexi', 'loopnet', 'bizquest']

function dedupeKey(x: any): string {
  const norm = (s: any) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  const url = norm(x.sourceUrl)
  const addr = norm(x.address)
  const city = norm(x.city)
  const st = norm(x.state)
  const name = norm(x.facilityName || x.ownerName)
  if (addr) return 'a|' + addr + '|' + city + '|' + st
  if (url && name) return 'u|' + url + '|' + name
  if (url) return 'u|' + url
  return 'n|' + name + '|' + city + '|' + st
}

function priceNum(v: any): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''))
    return isFinite(n) && n > 0 ? n : null
  }
  return null
}

async function upsert(lead: any) {
  // A lead can collide two ways: same id (primary key) or same property
  // (dedupe_key). Delete any row sharing this id but keyed to a different
  // property, so the ON CONFLICT (dedupe_key) path below always applies.
  await sql.query(
    'DELETE FROM properties WHERE id = $1 AND (dedupe_key IS DISTINCT FROM $2)',
    [lead.id, dedupeKey(lead)]
  )

  const key = dedupeKey(lead)
  await sql.query(
    `INSERT INTO properties
      (id, facility_name, owner_name, owner_entity, address, city, state, zip_code,
       unit_count, source, source_url, is_off_market, distress_signals, contact_info,
       asking_price, asking_price_raw, score, status, notes, outreach_letter, pipeline_id,
       email_subject, email_body, email_history, deal_score, deal_type, deal_scored_at,
       contacted_at, dedupe_key, first_seen, last_updated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET
       facility_name   = COALESCE(EXCLUDED.facility_name, properties.facility_name),
       owner_name      = COALESCE(EXCLUDED.owner_name, properties.owner_name),
       contact_info    = COALESCE(EXCLUDED.contact_info, properties.contact_info),
       asking_price    = COALESCE(EXCLUDED.asking_price, properties.asking_price),
       score           = EXCLUDED.score,
       status          = EXCLUDED.status,
       notes           = COALESCE(EXCLUDED.notes, properties.notes),
       outreach_letter = COALESCE(EXCLUDED.outreach_letter, properties.outreach_letter),
       pipeline_id     = COALESCE(EXCLUDED.pipeline_id, properties.pipeline_id),
       email_subject   = COALESCE(EXCLUDED.email_subject, properties.email_subject),
       email_body      = COALESCE(EXCLUDED.email_body, properties.email_body),
       email_history   = COALESCE(EXCLUDED.email_history, properties.email_history),
       deal_score      = COALESCE(EXCLUDED.deal_score, properties.deal_score),
       deal_type       = COALESCE(EXCLUDED.deal_type, properties.deal_type),
       deal_scored_at  = COALESCE(EXCLUDED.deal_scored_at, properties.deal_scored_at),
       contacted_at    = COALESCE(EXCLUDED.contacted_at, properties.contacted_at),
       last_updated    = NOW()`,
    [
      lead.id,
      lead.facilityName ?? null,
      lead.ownerName ?? null,
      lead.ownerEntity ?? null,
      lead.address ?? null,
      lead.city ?? null,
      lead.state ?? null,
      lead.zipCode ?? null,
      lead.unitCount ?? null,
      lead.source,
      lead.sourceUrl ?? null,
      !BROKER.includes(lead.source),
      lead.distressSignals ? JSON.stringify(lead.distressSignals) : null,
      lead.contactInfo ? JSON.stringify(lead.contactInfo) : null,
      priceNum(lead.askingPrice),
      typeof lead.askingPrice === 'string' ? lead.askingPrice : null,
      lead.score ?? 0,
      lead.status ?? 'new',
      lead.notes ?? null,
      lead.outreachLetter ?? null,
      lead.pipelineId ?? null,
      lead.emailSubject ?? null,
      lead.emailBody ?? null,
      lead.emailHistory ? JSON.stringify(lead.emailHistory) : null,
      lead.dealScore ?? null,
      lead.dealType ?? null,
      lead.dealScoredAt ?? null,
      lead.contactedAt ?? null,
      key,
      lead.foundAt ?? new Date().toISOString(),
      lead.lastUpdated ?? new Date().toISOString(),
    ]
  )
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return

  try {
    if (req.method === 'GET') {
      const rows = await sql.query(
        'SELECT * FROM properties ORDER BY is_off_market DESC, score DESC NULLS LAST, last_updated DESC'
      )
      return res.status(200).json({ leads: rows.map(toLead) })
    }

    if (req.method === 'POST') {
      const { action, lead, leads, id, updates } = req.body || {}

      if (action === 'upsert' && lead) {
        await upsert(lead)
        return res.status(200).json({ ok: true })
      }

      if (action === 'upsertMany' && Array.isArray(leads)) {
        let n = 0
        for (const l of leads) { await upsert(l); n++ }
        return res.status(200).json({ ok: true, count: n })
      }

      if (action === 'update' && id && updates) {
        const map: Record<string, string> = {
          status: 'status', notes: 'notes', score: 'score',
          contactedAt: 'contacted_at', outreachLetter: 'outreach_letter',
          pipelineId: 'pipeline_id', emailSubject: 'email_subject',
          emailBody: 'email_body', dealScore: 'deal_score',
          dealType: 'deal_type', dealScoredAt: 'deal_scored_at',
        }
        const sets: string[] = []
        const vals: any[] = []
        let i = 1
        for (const [k, col] of Object.entries(map)) {
          if (updates[k] !== undefined) { sets.push(col + ' = $' + i++); vals.push(updates[k]) }
        }
        if (updates.contactInfo !== undefined) {
          sets.push('contact_info = $' + i++); vals.push(JSON.stringify(updates.contactInfo))
        }
        if (updates.emailHistory !== undefined) {
          sets.push('email_history = $' + i++); vals.push(JSON.stringify(updates.emailHistory))
        }
        if (!sets.length) return res.status(200).json({ ok: true, changed: 0 })
        sets.push('last_updated = NOW()')
        vals.push(id)
        await sql.query('UPDATE properties SET ' + sets.join(', ') + ' WHERE id = $' + i, vals)
        return res.status(200).json({ ok: true })
      }

      if (action === 'delete' && id) {
        await sql.query('DELETE FROM properties WHERE id = $1', [id])
        return res.status(200).json({ ok: true })
      }

      return res.status(400).json({ error: 'Unknown action' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('properties api error:', err)
    return res.status(500).json({ error: 'Database error', detail: String(err?.message || err) })
  }
}