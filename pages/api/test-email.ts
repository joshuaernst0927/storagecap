import type { NextApiRequest, NextApiResponse } from 'next'
import nodemailer from 'nodemailer'
import { buildDigestHtml } from './run-leads'
import { Lead } from '@/lib/leadsData'

const SAMPLE_LEADS: Lead[] = [
  {
    id: 'test_001',
    facilityName: 'In re: Sunshine Storage Holdings LLC',
    address: 'Case No. 2:24-bk-10421',
    city: 'Tampa',
    state: 'FL',
    ownerName: 'Sunshine Storage Holdings LLC',
    source: 'courtlistener',
    sourceUrl: 'https://www.courtlistener.com/docket/test/',
    distressSignals: { bankruptcy: true, bankruptcyChapter: 'Chapter 11', bankruptcyDate: '2024-11-03' },
    score: 18,
    status: 'new',
    foundAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    notes: 'Chapter 11 filing · Filed: Nov 3, 2024 · Court: FLSB',
  },
  {
    id: 'test_002',
    facilityName: 'ABC Self Storage — Dallas TX',
    address: 'See listing',
    city: 'Dallas',
    state: 'TX',
    ownerName: 'Robert Johnson',
    source: 'craigslist',
    sourceUrl: 'https://dallas.craigslist.org/test',
    distressSignals: { taxDelinquency: true, outOfStateOwner: true },
    score: 35,
    status: 'new',
    foundAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'test_003',
    facilityName: 'Metro Mini Storage',
    address: '4400 Fulton Industrial Blvd',
    city: 'Atlanta',
    state: 'GA',
    ownerName: 'Carol Briggs',
    source: 'bizbuysell',
    sourceUrl: 'https://www.bizbuysell.com/test',
    distressSignals: { lisPendens: true, decliningOccupancy: true },
    askingPrice: 2_800_000,
    score: 30,
    status: 'new',
    foundAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  },
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const emailPass = process.env.EMAIL_PASSWORD
  if (!emailPass) {
    return res.status(500).json({ error: 'EMAIL_PASSWORD not configured' })
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'joshuaernst@gmail.com',
      pass: emailPass,
    },
  })

  try {
    // Verify SMTP connection
    await transporter.verify()

    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    await transporter.sendMail({
      from: '"YEM Acquisitions" <joshuaernst@gmail.com>',
      to: 'joshuaernst@gmail.com',
      subject: `YEM Leads — TEST EMAIL — ${dateStr} — ${SAMPLE_LEADS.length} sample leads`,
      html: buildDigestHtml(SAMPLE_LEADS, now),
    })

    return res.status(200).json({
      success: true,
      message: 'Test email sent to joshuaernst@gmail.com',
      sampleLeads: SAMPLE_LEADS.length,
    })
  } catch (err) {
    console.error('Test email error:', err)
    return res.status(500).json({
      error: 'Email failed',
      detail: String(err),
    })
  }
}
