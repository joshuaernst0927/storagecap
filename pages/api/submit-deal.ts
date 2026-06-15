/**
 * /api/submit-deal — PUBLIC endpoint (no auth required).
 * Receives seller lead submissions from the public website.
 *
 * Persistence strategy (matches leads.json pattern in enrich-leads.ts):
 *   1. Write submission to public/data/submissions.json in GitHub repo via GitHub API.
 *   2. Send admin email notification via Gmail SMTP.
 *
 * Failure handling (per spec):
 *   - GitHub save succeeds, email fails   → return success (lead is captured)
 *   - Email succeeds, GitHub save fails   → return success (lead is captured via email)
 *   - Both fail                           → return 500 (lead was not captured)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import nodemailer from 'nodemailer'

const REPO_OWNER  = 'joshuaernst0927'
const REPO_NAME   = 'storagecap'
const FILE_PATH   = 'public/data/submissions.json'
const ADMIN_EMAIL = 'joshuaernst@gmail.com'

interface Submission {
  id: string
  referenceNumber: string
  propertyName: string
  address: string
  city: string
  state: string
  zip: string
  unitCount: number
  occupancy: number
  askingPrice: string
  grossRevenue: string
  noi: string
  yearBuilt: string
  landAcres: string
  climatePercent: string
  expansionLand: string
  notes: string
  sellerName: string
  email: string
  phone: string
  role: string
  submittedAt: string
  status: string
}

let refCounter = 100

function generateReference(): string {
  refCounter++
  return `YEM-${String(refCounter).padStart(4, '0')}`
}

// ── GitHub write ─────────────────────────────────────────────────────────────

async function saveToGitHub(submission: Submission): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.warn('GITHUB_TOKEN not set — skipping GitHub save')
    return false
  }

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  try {
    // Get current file (if it exists)
    let sha: string | undefined
    let existing: Submission[] = []
    const getRes = await fetch(apiUrl, { headers })
    if (getRes.ok) {
      const fileData = await getRes.json()
      sha = fileData.sha
      existing = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'))
    } else if (getRes.status !== 404) {
      console.error('GitHub GET failed:', getRes.status)
      return false
    }

    const updated = [submission, ...existing]
    const putBody: Record<string, string> = {
      message: `New seller submission: ${submission.referenceNumber} — ${submission.propertyName}`,
      content: Buffer.from(JSON.stringify(updated, null, 2)).toString('base64'),
    }
    if (sha) putBody.sha = sha

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putBody),
    })

    if (!putRes.ok) {
      console.error('GitHub PUT failed:', putRes.status, await putRes.text())
      return false
    }

    return true
  } catch (err) {
    console.error('GitHub save error:', err)
    return false
  }
}

// ── Admin email ──────────────────────────────────────────────────────────────

async function sendAdminEmail(submission: Submission): Promise<boolean> {
  const emailPw = process.env.EMAIL_PASSWORD
  if (!emailPw) {
    console.warn('EMAIL_PASSWORD not set — skipping admin email')
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: ADMIN_EMAIL, pass: emailPw },
    })

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1B2B5E;padding:20px 24px">
          <h2 style="color:#D4A843;margin:0;font-size:18px">New Seller Submission — YEM Acquisitions</h2>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;width:160px">Reference</td><td style="padding:6px 0;font-weight:600">${submission.referenceNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Property</td><td style="padding:6px 0;font-weight:600">${submission.propertyName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Location</td><td style="padding:6px 0">${submission.city}, ${submission.state} ${submission.zip}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Units</td><td style="padding:6px 0">${submission.unitCount || 'N/A'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Occupancy</td><td style="padding:6px 0">${submission.occupancy ? submission.occupancy + '%' : 'N/A'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Asking Price</td><td style="padding:6px 0">${submission.askingPrice}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">NOI</td><td style="padding:6px 0">${submission.noi || 'N/A'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Year Built</td><td style="padding:6px 0">${submission.yearBuilt || 'N/A'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Climate %</td><td style="padding:6px 0">${submission.climatePercent || 'N/A'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Expansion Land</td><td style="padding:6px 0">${submission.expansionLand}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;border-top:1px solid #e5e7eb">Seller</td><td style="padding:6px 0;border-top:1px solid #e5e7eb;font-weight:600">${submission.sellerName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Role</td><td style="padding:6px 0">${submission.role || 'N/A'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0"><a href="mailto:${submission.email}">${submission.email}</a></td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Phone</td><td style="padding:6px 0">${submission.phone || 'N/A'}</td></tr>
          </table>
          ${submission.notes ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:4px"><strong>Notes:</strong><br/>${submission.notes}</div>` : ''}
          <div style="margin-top:20px;font-size:12px;color:#9ca3af">Submitted: ${submission.submittedAt}</div>
        </div>
      </div>
    `

    await transporter.sendMail({
      from: ADMIN_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[YEM] New Seller Submission — ${submission.propertyName} (${submission.referenceNumber})`,
      html,
    })

    return true
  } catch (err) {
    console.error('Admin email error:', err)
    return false
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as Record<string, string>

  const required = ['propertyName', 'city', 'state', 'unitCount', 'occupancy', 'askingPrice', 'sellerName', 'email']
  const missing = required.filter(f => !body[f])
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
  }

  const submission: Submission = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    referenceNumber: generateReference(),
    propertyName: body.propertyName || '',
    address: body.address || '',
    city: body.city || '',
    state: body.state || '',
    zip: body.zip || '',
    unitCount: parseInt(body.unitCount) || 0,
    occupancy: parseInt(body.occupancy) || 0,
    askingPrice: body.askingPrice ? `$${body.askingPrice}` : 'TBD',
    grossRevenue: body.grossRevenue ? `$${body.grossRevenue}` : '',
    noi: body.noi ? `$${body.noi}` : '',
    yearBuilt: body.yearBuilt || '',
    landAcres: body.landAcres || '',
    climatePercent: body.climatePercent || '',
    expansionLand: body.expansionLand || 'no',
    notes: body.notes || '',
    sellerName: body.sellerName || '',
    email: body.email || '',
    phone: body.phone || '',
    role: body.role || '',
    submittedAt: new Date().toISOString(),
    status: 'new',
  }

  // Run both independently — neither blocks the other
  const [githubOk, emailOk] = await Promise.all([
    saveToGitHub(submission),
    sendAdminEmail(submission),
  ])

  // Per spec: both fail = error (lead not captured)
  if (!githubOk && !emailOk) {
    console.error('CRITICAL: Both GitHub save and admin email failed for submission', submission.referenceNumber)
    return res.status(500).json({
      error: 'Submission could not be saved. Please try again or contact us directly.',
    })
  }

  // Either or both succeeded — lead is captured
  return res.status(200).json({
    success: true,
    referenceNumber: submission.referenceNumber,
    message: 'Your submission has been received. Our team will respond within 5 business days.',
  })
}
