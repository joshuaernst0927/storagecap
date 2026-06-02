import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { Lead, ContactInfo } from '@/lib/leadsData'

const CL_TOKEN = process.env.COURTLISTENER_TOKEN || '25e0d81f7c377dbdd866ba6165afe7af4fa9c99e'
const LEADS_FILE = path.join(process.cwd(), 'public', 'data', 'leads.json')

function readLeads(): Lead[] {
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')) } catch { return [] }
}
function writeLeads(leads: Lead[]): void {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2))
}

function extractDocketId(url: string): string | null {
  const m = url?.match(/\/docket\/(\d+)\//)
  return m ? m[1] : null
}

// Parse "902 S Friendswood Drive\nFriendswood, TX 77546\nGALVESTON-TX\nTax ID..." → address only
function parseDebtorAddress(extraInfo: string): string | undefined {
  const lines = extraInfo.split('\n').map(l => l.trim()).filter(Boolean)
  const addrLines: string[] = []
  for (const line of lines) {
    if (/^[A-Z]+-[A-Z]{2}$/.test(line)) break   // COUNTY-STATE marker
    if (/^(Tax ID|TERMINATED|DISMISSED|Pro Se)/i.test(line)) break
    addrLines.push(line)
  }
  return addrLines.length ? addrLines.join(', ') : undefined
}

function parsePhone(text: string): string | undefined {
  const m = text.match(/\b(\d{3})[\-\.\s](\d{3})[\-\.\s](\d{4})\b/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined
}

function parseEmail(text: string): string | undefined {
  const m = text.match(/Email:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/)
  return m ? m[1].trim() : undefined
}

async function clFetch(url: string): Promise<any | null> {
  const res = await fetch(url, {
    headers: { Authorization: `Token ${CL_TOKEN}`, 'User-Agent': 'YEMAcquisitions/1.0' },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.detail ? null : data
}

async function enrichFromCourtListener(lead: Lead): Promise<{ contactInfo: ContactInfo; attyNote?: string } | null> {
  const docketId = extractDocketId(lead.sourceUrl || '')
  if (!docketId) return null

  const data = await clFetch(
    `https://www.courtlistener.com/api/rest/v4/parties/?docket=${docketId}&page_size=50`
  )
  if (!data) return null

  const parties: any[] = data.results || []

  // ── Debtor address ──────────────────────────────────────────────────────────
  const debtor = parties.find(p =>
    p.party_types?.some((pt: any) => /debtor/i.test(pt.name || ''))
  )
  const debtorTypeInfo = debtor?.party_types?.find((pt: any) => /debtor/i.test(pt.name))?.extra_info || ''
  const mailingAddress = parseDebtorAddress(debtorTypeInfo)

  // ── Debtor's attorney contact ───────────────────────────────────────────────
  let phone: string | undefined
  let email: string | undefined
  let attyNote: string | undefined

  if (debtor?.attorneys?.length) {
    await new Promise(r => setTimeout(r, 600))
    const attyData = await clFetch(debtor.attorneys[0].attorney)
    if (attyData) {
      const raw: string = attyData.contact_raw || ''
      phone = parsePhone(raw)
      email = parseEmail(raw)
      if (attyData.name) {
        const rawLines = raw.split('\n').map((l: string) => l.trim()).filter(Boolean)
        attyNote = `Attorney: ${attyData.name}${phone ? ` · ${phone}` : ''}${rawLines[0] && rawLines[0] !== attyData.name ? ` · ${rawLines[0]}` : ''}`
      }
    }
  }

  // ── Fallback: trustee phone ─────────────────────────────────────────────────
  if (!phone) {
    const trustee = parties.find(p =>
      p.party_types?.some((pt: any) => /trustee/i.test(pt.name || ''))
    )
    const tInfo = trustee?.party_types?.find((pt: any) => /trustee/i.test(pt.name))?.extra_info || ''
    phone = parsePhone(tInfo)
    if (phone && trustee?.name) attyNote = `Trustee: ${trustee.name} · ${phone}`
  }

  if (!mailingAddress && !phone) return null

  return {
    contactInfo: {
      mailingAddress,
      phone,
      email: email || undefined,
      enrichedAt: new Date().toISOString(),
      enrichedBy: 'manual',
    },
    attyNote,
  }
}

// ─── Handler — enriches one lead at a time (call per-lead from client) ─────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { leadId } = req.body as { leadId?: string }
  const leads = readLeads()

  const lead = leadId
    ? leads.find(l => l.id === leadId)
    : leads.find(l =>
        l.source === 'courtlistener' &&
        !l.contactInfo?.mailingAddress && !l.contactInfo?.phone
      )

  if (!lead) return res.status(200).json({ enriched: 0, message: 'No eligible lead found' })

  try {
    const result = await enrichFromCourtListener(lead)

    if (!result) return res.status(200).json({ enriched: 0, message: 'No contact data in docket' })

    const idx = leads.findIndex(l => l.id === lead.id)
    if (idx < 0) return res.status(200).json({ enriched: 0 })

    const existing = leads[idx]
    leads[idx] = {
      ...existing,
      contactInfo: result.contactInfo,
      notes: result.attyNote
        ? `${existing.notes ? existing.notes + ' · ' : ''}${result.attyNote}`
        : existing.notes,
      lastUpdated: new Date().toISOString(),
    }
    writeLeads(leads)

    return res.status(200).json({ enriched: 1, lead: leads[idx] })
  } catch (err) {
    console.error('Enrich error:', err)
    return res.status(500).json({ error: 'Enrichment failed', detail: String(err) })
  }
}
