import type { NextApiRequest, NextApiResponse } from 'next'

interface Lead {
  id: string
  referenceNumber: string
  propertyName: string
  city: string
  state: string
  unitCount: number
  occupancy: number
  askingPrice: string
  noi: string
  sellerName: string
  email: string
  phone: string
  submittedAt: string
  status: string
  rawData: Record<string, unknown>
}

// In-memory store — resets on server restart. Replace with a real DB for production.
const leads: Lead[] = []
let counter = 42

function generateReference(): string {
  counter++
  return `SCP-${String(counter).padStart(4, '0')}`
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ leads })
  }

  if (req.method === 'POST') {
    const body = req.body as Record<string, string>

    const required = ['propertyName', 'city', 'state', 'unitCount', 'occupancy', 'askingPrice', 'sellerName', 'email']
    const missing = required.filter(f => !body[f])
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
    }

    const lead: Lead = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      referenceNumber: generateReference(),
      propertyName: body.propertyName,
      city: body.city,
      state: body.state,
      unitCount: parseInt(body.unitCount) || 0,
      occupancy: parseInt(body.occupancy) || 0,
      askingPrice: body.askingPrice ? `$${body.askingPrice}` : 'TBD',
      noi: body.noi ? `$${body.noi}` : 'TBD',
      sellerName: body.sellerName,
      email: body.email,
      phone: body.phone || '',
      submittedAt: new Date().toISOString().split('T')[0],
      status: 'new',
      rawData: body,
    }

    leads.unshift(lead)

    return res.status(200).json({
      success: true,
      referenceNumber: lead.referenceNumber,
      message: 'Your submission has been received. Our team will respond within 5 business days.',
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
