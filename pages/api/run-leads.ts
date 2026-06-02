import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import nodemailer from 'nodemailer'
import { Lead, getLeadTier, SOURCE_LABELS } from '@/lib/leadsData'

// Scrapers have moved to scripts/run-scrapers.js (runs locally via npm run scrape).
// This endpoint only reads the cached leads.json and optionally sends the daily digest.

// ─── Gmail SMTP ───────────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: 'joshuaernst@gmail.com', pass: process.env.EMAIL_PASSWORD },
  })
}

function topSignal(lead: Lead): string {
  const s = lead.distressSignals
  if (s.taxDelinquency)     return 'Tax Delinquency'
  if (s.bankruptcy)         return s.bankruptcyChapter || 'Bankruptcy Filing'
  if (s.lisPendens)         return 'Lis Pendens'
  if (s.fireCodeViolations) return 'Fire Code Violations'
  if (s.decliningOccupancy) return 'Declining Occupancy'
  if (s.outOfStateOwner)    return 'Out-of-State Owner'
  if (s.longTermOwner)      return 'Long-Term Owner'
  return 'Off-Market Signal'
}

export function buildDigestHtml(leads: Lead[], scanDate: Date = new Date()): string {
  const hot     = leads.filter(l => getLeadTier(l.score) === 'HOT').sort((a, b) => b.score - a.score)
  const warm    = leads.filter(l => getLeadTier(l.score) === 'WARM')
  const bkCount = leads.filter(l => l.distressSignals.bankruptcy).length
  const top5    = [...leads].sort((a, b) => b.score - a.score).slice(0, 5)
  const dateStr = scanDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const sourceCounts: Record<string, number> = {}
  for (const l of leads) sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1
  const sourceRows = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([src, count]) => `
      <tr>
        <td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;color:#555">${SOURCE_LABELS[src as keyof typeof SOURCE_LABELS] || src}</td>
        <td style="padding:5px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#1B2B5E">${count}</td>
      </tr>`).join('')

  const tierStyle = (score: number) => {
    const t = getLeadTier(score)
    if (t === 'HOT')  return 'background:#fef2f2;color:#c0392b;border:1px solid #fecaca'
    if (t === 'WARM') return 'background:#fffbeb;color:#d97706;border:1px solid #fde68a'
    return 'background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb'
  }
  const topRows = top5.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">
        <div style="font-weight:600;color:#1a1a18">${l.facilityName || l.address}</div>
        <div style="font-size:12px;color:#888;margin-top:2px">${l.city}, ${l.state}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;white-space:nowrap">
        <span style="${tierStyle(l.score)};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;font-family:monospace">${l.score} · ${getLeadTier(l.score)}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555">${topSignal(l)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888">${SOURCE_LABELS[l.source as keyof typeof SOURCE_LABELS] || l.source}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e6ea;border-radius:4px;overflow:hidden;max-width:600px">
        <tr>
          <td style="background:#1B2B5E;padding:28px 32px">
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:300;color:#ffffff">YEM Acquisitions</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;text-transform:uppercase;letter-spacing:0.1em">Morning Lead Digest</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #f0f0f0">
            <div style="font-size:13px;color:#888;margin-bottom:12px">${dateStr}</div>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:24px;text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#1B2B5E;line-height:1">${leads.length}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">Total Leads</div>
                </td>
                <td style="padding-right:24px;text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#c0392b;line-height:1">${hot.length}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">HOT</div>
                </td>
                <td style="padding-right:24px;text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#e67e22;line-height:1">${warm.length}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">WARM</div>
                </td>
                ${bkCount ? `<td style="text-align:center">
                  <div style="font-family:Georgia,serif;font-size:36px;font-weight:300;color:#7c3aed;line-height:1">${bkCount}</div>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:4px">Bankruptcy</div>
                </td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #f0f0f0">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;margin-bottom:10px">By Source</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">${sourceRows}</table>
          </td>
        </tr>
        ${top5.length ? `
        <tr>
          <td style="padding:20px 32px;border-bottom:1px solid #f0f0f0">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:600;margin-bottom:10px">Top Leads by Score</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
              <thead><tr style="background:#f8f9fa">
                <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Facility</th>
                <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Score</th>
                <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Signal</th>
                <th style="padding:6px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Source</th>
              </tr></thead>
              <tbody>${topRows}</tbody>
            </table>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:24px 32px;text-align:center">
            <a href="https://yemacquisitions.com/leads" style="display:inline-block;background:#D4A843;color:#ffffff;text-decoration:none;padding:12px 28px;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">
              View All Leads →
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #f0f0f0">
            <p style="margin:0;font-size:11px;color:#aaa;text-align:center">
              YEM Acquisitions LLC · Woodmere, New York · Automated Lead Intelligence · Weekdays 8 AM EST
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendLeadDigest(leads: Lead[], scanDate: Date = new Date()): Promise<void> {
  if (!process.env.EMAIL_PASSWORD) { console.warn('EMAIL_PASSWORD not set — skipping digest'); return }
  if (leads.length === 0) return
  const transporter = createTransporter()
  const dateStr = scanDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const hot = leads.filter(l => getLeadTier(l.score) === 'HOT')
  await transporter.sendMail({
    from: '"YEM Acquisitions" <joshuaernst@gmail.com>',
    to: 'joshuaernst@gmail.com',
    subject: `YEM Leads — ${dateStr} — ${leads.length} lead${leads.length !== 1 ? 's' : ''}${hot.length ? ` (${hot.length} HOT)` : ''}`,
    html: buildDigestHtml(leads, scanDate),
  })
}

// ─── Read leads.json ──────────────────────────────────────────────────────────
function readLeads(): Lead[] {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'leads.json')
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Lead[]
  } catch {
    return []
  }
}

// ─── Handler — reads cached leads, optionally sends digest ───────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.method === 'GET') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const leads = readLeads()
  const sendEmail = req.query.email !== '0'

  if (sendEmail && leads.length > 0) {
    try { await sendLeadDigest(leads, new Date()) } catch (err) {
      console.error('Digest email failed:', err)
    }
  }

  const sources: Record<string, number> = {}
  for (const l of leads) sources[l.source] = (sources[l.source] || 0) + 1

  return res.status(200).json({
    success: true,
    total: leads.length,
    sources,
    bankruptcy: leads.filter(l => l.distressSignals?.bankruptcy).length,
    leads,
    scannedAt: new Date().toISOString(),
    note: 'Leads loaded from leads.json — run `npm run scrape` locally to refresh',
  })
}
