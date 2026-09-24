import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import { ContactInfo } from '@/lib/leadsData'
import { looksLikePersonName } from '@/lib/apolloEligibility'
import { getUsage, recordCredit } from '@/lib/apolloUsage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return

  const apolloKey = process.env.APOLLO_API_KEY

  // GET — cap status for the pre-flight summary. Costs nothing.
  if (req.method === 'GET') {
    const usage = await getUsage()
    return res.status(200).json({ ...usage, hasKey: !!apolloKey })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!apolloKey) {
    return res.status(200).json({ contact: null, noKey: true })
  }

  const { ownerName, ownerEntity, city, state } = req.body as {
    ownerName?: string
    ownerEntity?: string
    city?: string
    state?: string
  }

  // --- local screening: never spend a credit on a lookup that cannot match ---
  if (!ownerName || !ownerName.trim()) {
    return res.status(200).json({ contact: null, skipped: 'no-owner-name' })
  }
  if (!looksLikePersonName(ownerName)) {
    // Apollo people/match matches a person; a company or placeholder name
    // would consume a credit and return nothing.
    return res.status(200).json({ contact: null, skipped: 'not-a-person-name' })
  }

  // --- hard monthly cap, checked against the database on every single call ---
  const before = await getUsage()
  if (before.capReached) {
    return res.status(200).json({
      contact: null,
      capReached: true,
      cap: before.cap,
      used: before.used,
      remaining: 0,
      period: before.period,
    })
  }

  const nameParts = ownerName.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  try {
    const apolloRes = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        api_key: apolloKey,
        first_name: firstName,
        last_name: lastName,
        organization_name: ownerEntity || undefined,
        city,
        state,
        reveal_personal_emails: true,
      }),
    })

    if (!apolloRes.ok) {
      return res.status(200).json({
        contact: null,
        error: `Apollo returned ${apolloRes.status}`,
        used: before.used,
        cap: before.cap,
        remaining: before.remaining,
      })
    }

    const data = await apolloRes.json()
    const person = data.person

    if (!person) {
      // No match: Apollo does not reveal anything, so no credit is recorded.
      return res.status(200).json({
        contact: null,
        notFound: true,
        used: before.used,
        cap: before.cap,
        remaining: before.remaining,
      })
    }

    const contact: ContactInfo = {
      phone: person.phone_numbers?.[0]?.sanitized_number || undefined,
      email: person.email || undefined,
      linkedIn: person.linkedin_url || undefined,
      mailingAddress: [
        person.city,
        person.state,
      ].filter(Boolean).join(', ') || undefined,
      enrichedAt: new Date().toISOString(),
      enrichedBy: 'apollo',
    }

    // A match means Apollo revealed data and consumed a credit.
    const used = await recordCredit(before.period)

    return res.status(200).json({
      contact,
      used,
      cap: before.cap,
      remaining: Math.max(0, before.cap - used),
      period: before.period,
    })
  } catch (err) {
    console.error('Apollo enrichment error:', err)
    return res.status(500).json({ error: 'Enrichment failed', detail: String(err) })
  }
}
