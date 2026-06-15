import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import { ContactInfo } from '@/lib/leadsData'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apolloKey = process.env.APOLLO_API_KEY
  if (!apolloKey) {
    return res.status(200).json({ contact: null, noKey: true })
  }

  const { ownerName, ownerEntity, city, state } = req.body as {
    ownerName: string
    ownerEntity?: string
    city: string
    state: string
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
      return res.status(200).json({ contact: null, error: `Apollo returned ${apolloRes.status}` })
    }

    const data = await apolloRes.json()
    const person = data.person

    if (!person) {
      return res.status(200).json({ contact: null, notFound: true })
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

    return res.status(200).json({ contact })
  } catch (err) {
    console.error('Apollo enrichment error:', err)
    return res.status(500).json({ error: 'Enrichment failed', detail: String(err) })
  }
}
