import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import { Lead, ContactInfo } from '@/lib/leadsData'

const CL_TOKEN = process.env.COURTLISTENER_TOKEN || ''
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const APOLLO_API_KEY = process.env.APOLLO_API_KEY
const REPO_OWNER = 'joshuaernst0927'
const REPO_NAME = 'storagecap'
const FILE_PATH = 'public/data/leads.json'

// Best-effort: update leads.json in GitHub repo so scraper picks up enriched data.
// Non-fatal — enrichment still succeeds even if this write fails.
async function tryUpdateGitHub(leadId: string, contactInfo: ContactInfo, attyNote?: string): Promise<void> {
  if (!GITHUB_TOKEN) return
  try {
    const getRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (!getRes.ok) return
    const fileData = await getRes.json()
    const leads: Lead[] = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'))
    const idx = leads.findIndex(l => l.id === leadId)
    if (idx < 0) return
    leads[idx] = {
      ...leads[idx],
      contactInfo,
      notes: attyNote
        ? (() => {
            const base = (leads[idx].notes || '').replace(/\s*·\s*(?:Attorney|Trustee)[^]*$/i, '').trim()
            return base ? `${base} · ${attyNote}` : attyNote
          })()
        : leads[idx].notes,
      lastUpdated: new Date().toISOString(),
    }
    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Enrich contact for lead ${leadId}`,
        content: Buffer.from(JSON.stringify(leads, null, 2)).toString('base64'),
        sha: fileData.sha,
      }),
    })
  } catch (e) {
    console.warn('GitHub write failed (non-fatal):', e)
  }
}

function extractDocketId(url: string): string | null {
  const m = url?.match(/\/docket\/(\d+)\//)
  return m ? m[1] : null
}

function parseDebtorAddress(extraInfo: string): string | undefined {
  const lines = extraInfo.split('\n').map(l => l.trim()).filter(Boolean)
  const addrLines: string[] = []
  for (const line of lines) {
    if (/^[A-Z]+-[A-Z]{2}$/.test(line)) break
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

async function lookupEmailViaApollo(name: string, organization: string): Promise<string | undefined> {
  if (!APOLLO_API_KEY) return undefined
  try {
    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({
        api_key: APOLLO_API_KEY,
        name,
        organization_name: organization,
        reveal_personal_emails: false,
      }),
    })
    if (!res.ok) return undefined
    const data = await res.json()
    return data?.person?.email || undefined
  } catch {
    return undefined
  }
}

async function enrichFromCourtListener(sourceUrl: string): Promise<{ contactInfo: ContactInfo; attyNote?: string } | null> {
  const docketId = extractDocketId(sourceUrl)
  if (!docketId) return null

  const data = await clFetch(
    `https://www.courtlistener.com/api/rest/v4/parties/?docket=${docketId}&page_size=50`
  )
  if (!data) return null

  const parties: any[] = data.results || []

  const debtor = parties.find(p =>
    p.party_types?.some((pt: any) => /debtor/i.test(pt.name || ''))
  )
  const debtorTypeInfo = debtor?.party_types?.find((pt: any) => /debtor/i.test(pt.name))?.extra_info || ''
  const mailingAddress = parseDebtorAddress(debtorTypeInfo)

  let phone: string | undefined
  let email: string | undefined
  let attyNote: string | undefined
  let attyName: string | undefined
  let attyFirm: string | undefined

  if (debtor?.attorneys?.length) {
    await new Promise(r => setTimeout(r, 600))
    const attyData = await clFetch(debtor.attorneys[0].attorney)
    if (attyData) {
      const raw: string = attyData.contact_raw || ''
      phone = parsePhone(raw)
      email = parseEmail(raw)
      if (attyData.name) {
        attyName = attyData.name
        const rawLines = raw.split('\n').map((l: string) => l.trim()).filter(Boolean)
        attyFirm = rawLines.find((l: string) => l !== attyData.name && !/\d{3}/.test(l) && !/email/i.test(l)) || ''
        attyNote = `Attorney: ${attyData.name}${phone ? ` · ${phone}` : ''}${attyFirm ? ` · ${attyFirm}` : ''}`
      }
    }
  }

  // Fallback: check each trustee's extra_info and then their attorney
  if (!phone) {
    const trustees = parties.filter(p =>
      p.party_types?.some((pt: any) => /trustee/i.test(pt.name || ''))
    )
    for (const trustee of trustees) {
      const tInfo = trustee?.party_types?.find((pt: any) => /trustee/i.test(pt.name))?.extra_info || ''
      const tPhone = parsePhone(tInfo)
      if (tPhone) {
        phone = tPhone
        attyName = trustee.name
        attyNote = `Trustee: ${trustee.name} · ${phone}`
        break
      }
      if (!phone && trustee?.attorneys?.length) {
        await new Promise(r => setTimeout(r, 600))
        const tAttyData = await clFetch(trustee.attorneys[0].attorney)
        if (tAttyData) {
          const raw: string = tAttyData.contact_raw || ''
          phone = parsePhone(raw)
          email = email || parseEmail(raw)
          if (phone && tAttyData.name) {
            attyName = tAttyData.name
            attyNote = `Trustee Atty: ${tAttyData.name} · ${phone}`
          }
        }
      }
      if (phone) break
    }
  }

  if (!email && attyName) {
    email = await lookupEmailViaApollo(attyName, attyFirm || '')
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

// ─── Handler ──────────────────────────────────────────────────────────────────
// Client sends { leadId, sourceUrl }. We look up CL and return enriched
// contactInfo directly — no filesystem reads/writes needed on Vercel.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { leadId, sourceUrl } = req.body as { leadId?: string; sourceUrl?: string }

  if (!sourceUrl) return res.status(400).json({ error: 'sourceUrl required' })

  const docketId = extractDocketId(sourceUrl)
  if (!docketId) return res.status(200).json({ enriched: 0, message: 'Could not extract docket ID from sourceUrl' })

  try {
    const result = await enrichFromCourtListener(sourceUrl)

    if (!result) return res.status(200).json({ enriched: 0, message: 'No contact data found in docket' })

    // Best-effort GitHub update so leads.json stays fresh for the scraper
    if (leadId) {
      tryUpdateGitHub(leadId, result.contactInfo, result.attyNote).catch(() => {})
    }

    return res.status(200).json({ enriched: 1, contactInfo: result.contactInfo, attyNote: result.attyNote })
  } catch (err) {
    console.error('Enrich error:', err)
    return res.status(500).json({ error: 'Enrichment failed', detail: String(err) })
  }
}
