import type { NextApiRequest, NextApiResponse } from 'next'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

// ── Colour tokens (YEM brand) ─────────────────────────────────────────────────
const NAVY  = rgb(0.106, 0.169, 0.369)   // #1B2B5E
const GOLD  = rgb(0.831, 0.659, 0.263)   // #D4A843
const BLACK = rgb(0.071, 0.071, 0.071)
const MID   = rgb(0.35,  0.35,  0.35)
const LIGHT = rgb(0.55,  0.55,  0.55)

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(v: string | number): string {
  const n = typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.-]/g, '')) : v
  if (!n || isNaN(n)) return '—'
  return '$' + Math.round(n).toLocaleString('en-US')
}
function fmtPct(v: string): string {
  if (!v || v.trim() === '') return '—'
  const clean = v.replace('%', '').trim()
  const n = parseFloat(clean)
  if (isNaN(n)) return v
  return n.toFixed(2) + '%'
}
function fmtX(v: string): string {
  if (!v || v.trim() === '') return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return v
  return n.toFixed(2) + 'x'
}
function fmtIRR(v: string): string {
  if (!v || v.trim() === '') return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return v
  return n.toFixed(1) + '%'
}
function safe(v: string | undefined | null): string {
  return (v && String(v).trim() !== '' && String(v).trim() !== 'undefined') ? String(v).trim() : '—'
}

type Page = ReturnType<PDFDocument['addPage']>
type Font = Awaited<ReturnType<PDFDocument['embedFont']>>

function drawWrapped(page: Page, text: string, x: number, y: number, maxWidth: number, size: number, font: Font, color = BLACK, lineHeight?: number): number {
  const lh = lineHeight ?? size * 1.55
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      page.drawText(line, { x, y, size, font, color })
      y -= lh
      line = word
    } else {
      line = test
    }
  }
  if (line) { page.drawText(line, { x, y, size, font, color }); y -= lh }
  return y
}

function rule(page: Page, x: number, y: number, w: number, thickness = 0.5, color = NAVY) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness, color })
}

function kvRow(page: Page, label: string, value: string, x: number, y: number, colW: number, size: number, regular: Font, bold: Font, shade = false): number {
  const rowH = size * 2.2
  if (shade) page.drawRectangle({ x: x - 4, y: y - rowH + size * 0.4, width: colW * 2 + 8, height: rowH, color: rgb(0.965, 0.965, 0.975), borderWidth: 0 })
  page.drawText(label, { x, y, size, font: regular, color: MID })
  page.drawText(value, { x: x + colW, y, size, font: bold, color: BLACK })
  return y - rowH
}

function sectionHead(page: Page, title: string, x: number, y: number, w: number, bold: Font): number {
  page.drawRectangle({ x, y: y - 14, width: w, height: 20, color: NAVY, borderWidth: 0 })
  page.drawText(title, { x: x + 8, y: y - 9, size: 8, font: bold, color: rgb(1, 1, 1) })
  return y - 22
}

function addFooter(page: Page, propertyName: string, italic: Font, regular: Font, W: number, ML: number, MR: number) {
  const footerY = 28
  page.drawRectangle({ x: 0, y: 0, width: W, height: footerY + 6, color: NAVY, borderWidth: 0 })
  const footerText = `Confidential — submitted solely in connection with the proposed acquisition of ${safe(propertyName)}`
  page.drawText(footerText, { x: ML, y: footerY - 8, size: 7, font: italic, color: rgb(0.65, 0.65, 0.65) })
  page.drawText('YEM Acquisitions  ·  yemacquisitions.com', { x: W - MR - 145, y: footerY - 8, size: 7, font: regular, color: GOLD })
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const d = req.body as Record<string, string>

    const pdfDoc = await PDFDocument.create()
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const italic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    const W = 612, H = 792
    const ML = 56, MR = 56
    const CW = W - ML - MR

    // ── PAGE 1 ────────────────────────────────────────────────────────────────
    let page = pdfDoc.addPage([W, H])
    let y = H - 44

    // Header bar
    page.drawRectangle({ x: 0, y: H - 52, width: W, height: 52, color: NAVY, borderWidth: 0 })
    page.drawText('YEM ACQUISITIONS', { x: ML, y: H - 32, size: 13, font: bold, color: rgb(1, 1, 1) })
    page.drawText('LETTER OF INTENT — SELF-STORAGE ACQUISITION', { x: ML, y: H - 46, size: 7.5, font: regular, color: GOLD })
    page.drawText(safe(d.date), { x: W - MR - 80, y: H - 39, size: 8, font: regular, color: rgb(0.8, 0.8, 0.8) })

    y = H - 70

    // To / Re block
    const brokerLine = [d.broker1_name, d.broker2_name].filter(v => v && v.trim() !== '' && v !== '—').join(' & ') || '—'
    page.drawText('To:', { x: ML, y, size: 9, font: bold, color: NAVY })
    page.drawText(brokerLine, { x: ML + 28, y, size: 9, font: regular, color: BLACK })
    y -= 13
    const brokerageStr = safe(d.brokerage)
    if (brokerageStr !== '—') {
      page.drawText(brokerageStr, { x: ML + 28, y, size: 9, font: regular, color: MID })
      y -= 13
    }
    const phones = [safe(d.broker1_phone), safe(d.broker2_phone)].filter(p => p !== '—').join('  ·  ')
    if (phones) { page.drawText(phones, { x: ML + 28, y, size: 8, font: regular, color: LIGHT }); y -= 13 }

    y -= 6
    page.drawText('RE:', { x: ML, y, size: 9, font: bold, color: NAVY })
    page.drawText(`Letter of Intent — Acquisition of ${safe(d.property_name)}`, { x: ML + 28, y, size: 9, font: bold, color: BLACK })
    y -= 20

    // Salutation
    const salutation = (d.salutation && d.salutation.trim() !== '' && d.salutation !== '—')
      ? d.salutation
      : brokerLine !== '—' ? `Dear ${brokerLine},` : 'Dear Broker,'
    page.drawText(salutation, { x: ML, y, size: 9.5, font: regular, color: BLACK })
    y -= 18

    // Opening paragraph
    const propDesc = (d.property_description && d.property_description.trim() !== '' && d.property_description !== '—')
      ? d.property_description
      : [
          safe(d.units) !== '—' ? `${safe(d.units)}-unit` : '',
          'self-storage facility',
          safe(d.sf) !== '—' ? `totaling ${safe(d.sf)} SF` : '',
          safe(d.year_built) !== '—' ? `built ${safe(d.year_built)}` : '',
        ].filter(Boolean).join(' ')

    y = drawWrapped(page, `I am pleased to submit this Letter of Intent to acquire ${safe(d.property_name)} (the "Property"), a ${propDesc}. This offer reflects my independent underwriting of the asset based on available operating information.`, ML, y, CW, 9.5, regular, BLACK)
    y -= 6

    if (d.underwriting_narrative && d.underwriting_narrative.trim() !== '' && d.underwriting_narrative !== '—') {
      y = drawWrapped(page, d.underwriting_narrative, ML, y, CW, 9.5, regular, BLACK)
      y -= 6
    }

    y -= 4
    rule(page, ML, y, CW, 0.75, GOLD)
    y -= 16

    // ── SECTION I — PRINCIPAL TERMS ───────────────────────────────────────────
    y = sectionHead(page, 'I.  PRINCIPAL TERMS OF OFFER', ML, y, CW, bold)
    y -= 8

    const colW = CW * 0.52
    let shade = false
    const kv = (label: string, value: string) => { y = kvRow(page, label, value, ML, y, colW, 9, regular, bold, shade); shade = !shade }

    kv('Offer Price', fmt$(d.offer_price))
    kv('All-In Cost (purchase + closing costs + GP fee + IR12)', fmt$(d.all_in_cost))
    kv('Implied Going-In Cap Rate', fmtPct(d.going_in_cap))
    kv('Year 3 Cap Rate', fmtPct(d.yr3_cap))
    kv('Pro Forma Cap Rate (Y5)', fmtPct(d.pf_cap))
    kv('Exit Cap Rate', fmtPct(d.exit_cap))
    kv('Earnest Money Deposit (within 10 business days of PSA)', fmt$(d.emd))

    y -= 6
    page.drawText('EMD Disbursement:', { x: ML, y, size: 8.5, font: bold, color: NAVY })
    y -= 12
    y = drawWrapped(page, 'Held in escrow; hard upon expiration of Due Diligence Period; refundable prior thereto except for Buyer default.', ML + 8, y, CW - 8, 8.5, regular, MID)
    y -= 4

    shade = false
    const propLine = [safe(d.units) !== '—' ? `${safe(d.units)} units` : '', safe(d.sf) !== '—' ? `${safe(d.sf)} SF` : '', safe(d.year_built) !== '—' ? `Built ${safe(d.year_built)}` : '', safe(d.occupancy) !== '—' ? `${safe(d.occupancy)} occupied` : ''].filter(Boolean).join('  ·  ')
    kv('Property', safe(d.property_name) !== '—' ? `${safe(d.property_name)}  ·  ${propLine}` : propLine)
    kv('Asset Type', 'Self-Storage')
    kv('Due Diligence Period', `${safe(d.dd_days) !== '—' ? safe(d.dd_days) : '30-45'} days from PSA execution`)
    kv('Closing Period', `${safe(d.closing_days) !== '—' ? safe(d.closing_days) : '30-45'} days following Due Diligence expiration`)
    kv('Financing Contingency', 'Yes — subject to Buyer obtaining satisfactory bridge financing')
    kv('Seller Representations', 'Standard reps re: title, litigation, environmental, and operating condition')
    kv('Prorations', 'Rents, taxes, and operating expenses prorated as of closing date')
    kv('Brokerage', `Seller to pay all commissions; ${safe(d.buyer_broker) !== '—' ? safe(d.buyer_broker) : 'Buyer is unrepresented'}`)

    y -= 10
    rule(page, ML, y, CW, 0.4)
    y -= 14

    // ── SECTION II — ACQUISITION STRUCTURE ───────────────────────────────────
    y = sectionHead(page, 'II.  ACQUISITION STRUCTURE & CLOSING TIMELINE', ML, y, CW, bold)
    y -= 8

    shade = false
    const kv2 = (label: string, value: string) => { y = kvRow(page, label, value, ML, y, colW, 9, regular, bold, shade); shade = !shade }

    kv2('Bridge Rate', 'SOFR + 400 bps = interest-only')
    kv2('Bridge Loan (65% LTV)', fmt$(d.bridge_loan))
    kv2('Annual Debt Service', fmt$(d.annual_ds))
    kv2('12-Month Interest Reserve (funded at closing)', fmt$(d.interest_reserve))
    kv2('Door CapEx Reserve (funded at closing)', fmt$(d.capex_reserve))
    kv2('LP Equity Required', fmt$(d.lp_equity))
    kv2('GP Co-Invest', safe(d.gp_coinvest) === '0' || safe(d.gp_coinvest) === '—' ? '$0' : fmt$(d.gp_coinvest))
    kv2('GP Acquisition Fee', `${fmt$(d.gp_fee_total)} (${safe(d.gp_fee_income)}% of offer price)`)

    y -= 6
    y = drawWrapped(page, 'Bridge debt at 65% LTV. LP funds 100% of required equity. 12-month interest reserve funded at closing eliminates any DSCR constraint in Year 1. The GP acquisition fee is split: 50% GP income at close, 50% reinvested as GP co-invest alongside LP.', ML + 8, y, CW - 8, 8.5, regular, MID)

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    addFooter(page, d.property_name, italic, regular, W, ML, MR)
    page = pdfDoc.addPage([W, H])
    page.drawRectangle({ x: 0, y: H - 32, width: W, height: 32, color: NAVY, borderWidth: 0 })
    page.drawText('YEM ACQUISITIONS  —  LETTER OF INTENT (CONTINUED)', { x: ML, y: H - 21, size: 7.5, font: regular, color: rgb(0.7, 0.7, 0.7) })
    page.drawText(safe(d.property_name), { x: W - MR - 180, y: H - 21, size: 8, font: bold, color: GOLD })
    y = H - 52

    // ── SECTION III — RETURN SUMMARY ─────────────────────────────────────────
    y = sectionHead(page, 'III.  RETURN SUMMARY', ML, y, CW, bold)
    y -= 8

    const half = (CW - 16) / 2
    const rightX = ML + half + 16

    page.drawText('PRICING & CAPITAL STRUCTURE', { x: ML, y, size: 7.5, font: bold, color: NAVY })
    page.drawText('PROJECTED RETURNS', { x: rightX, y, size: 7.5, font: bold, color: NAVY })
    y -= 4
    rule(page, ML, y, half, 0.4, NAVY)
    rule(page, rightX, y, half, 0.4, NAVY)
    y -= 14

    const leftRows: [string, string][] = [
      ['Offer Price',         fmt$(d.offer_price)],
      ['Bridge Loan @ IO',    fmt$(d.bridge_loan)],
      ['Annual Debt Service', fmt$(d.annual_ds)],
      ['Interest Reserve',    fmt$(d.interest_reserve)],
      ['CapEx Reserve',       fmt$(d.capex_reserve)],
      ['LP Equity Required',  fmt$(d.lp_equity)],
      ['GP Co-Invest',        safe(d.gp_coinvest) === '0' || safe(d.gp_coinvest) === '—' ? '$0' : fmt$(d.gp_coinvest)],
      ['All-In Cost',         fmt$(d.all_in_cost)],
    ]
    const rightRows: [string, string][] = [
      ['Going-In Cap Rate',   fmtPct(d.going_in_cap)],
      ['Year 3 Cap Rate',     fmtPct(d.yr3_cap)],
      ['Pro Forma Cap Rate',  fmtPct(d.pf_cap)],
      ['Exit Cap Rate',       fmtPct(d.exit_cap)],
      ['LP MoIC',             fmtX(d.lp_moic)],
      ['LP IRR',              fmtIRR(d.lp_irr)],
      ['GP MoIC',             fmtX(d.gp_moic)],
      ['GP IRR',              fmtIRR(d.gp_irr)],
    ]

    const startY = y
    let ly = startY, ry = startY
    const panelColW = half * 0.56
    leftRows.forEach(([k, v], i)  => { ly = kvRow(page, k, v, ML,     ly, panelColW, 8.5, regular, bold, i % 2 === 0) })
    rightRows.forEach(([k, v], i) => { ry = kvRow(page, k, v, rightX, ry, panelColW, 8.5, regular, bold, i % 2 === 0) })

    y = Math.min(ly, ry) - 10

    if (d.waterfall && d.waterfall.trim() !== '' && d.waterfall !== '—') {
      page.drawText('Waterfall:', { x: ML, y, size: 8.5, font: bold, color: NAVY })
      y -= 12
      y = drawWrapped(page, d.waterfall, ML + 8, y, CW - 8, 8.5, regular, MID)
      y -= 4
    }

    y -= 6
    rule(page, ML, y, CW, 0.4)
    y -= 14

    // ── SECTION IV — RENT & VALUE-ADD STRATEGY ───────────────────────────────
    y = sectionHead(page, 'IV.  RENT & VALUE-ADD STRATEGY', ML, y, CW, bold)
    y -= 8

    const rentText = (d.rent_strategy && d.rent_strategy.trim() !== '' && d.rent_strategy !== '—')
      ? d.rent_strategy
      : '25% off first 3 months for new tenants, then full list rate, with 3% increases every 6 months thereafter until market rate is achieved.'
    y = drawWrapped(page, rentText, ML, y, CW, 9.5, regular, BLACK)
    y -= 6

    if (safe(d.breakeven_occ) !== '—') {
      page.drawText('Breakeven Occupancy:', { x: ML, y, size: 8.5, font: bold, color: NAVY })
      page.drawText(d.breakeven_occ.includes('%') ? d.breakeven_occ : d.breakeven_occ + '%', { x: ML + 124, y, size: 8.5, font: bold, color: BLACK })
      y -= 14
    }

    y -= 6
    rule(page, ML, y, CW, 0.4)
    y -= 14

    // ── SECTION V — NON-BINDING ───────────────────────────────────────────────
    y = sectionHead(page, 'V.  NON-BINDING NATURE & GOVERNING TERMS', ML, y, CW, bold)
    y -= 8

    y = drawWrapped(page, "This Letter of Intent is submitted in good faith and represents Buyer's current offer. This LOI is non-binding and does not constitute a binding contract or obligation on either party. A binding agreement will only arise upon full execution of a mutually acceptable Purchase and Sale Agreement.", ML, y, CW, 9, regular, BLACK)
    y -= 6

    const expiryText = (d.offer_expiry && d.offer_expiry.trim() !== '' && d.offer_expiry !== '—')
      ? `This offer will remain open through ${d.offer_expiry}.`
      : 'This offer will remain open for 5 business days from the date hereof.'
    y = drawWrapped(page, expiryText, ML, y, CW, 9, regular, BLACK)
    y -= 14

    rule(page, ML, y, CW, 0.4)
    y -= 14

    // ── SECTION VI — CLOSING REMARKS ─────────────────────────────────────────
    y = sectionHead(page, 'VI.  CLOSING REMARKS', ML, y, CW, bold)
    y -= 8

    y = drawWrapped(page, 'I look forward to working with you and the Seller toward a mutually successful transaction. I am available to discuss any aspect of this offer at your earliest convenience.', ML, y, CW, 9.5, regular, BLACK)
    y -= 24

    page.drawText('Respectfully submitted,', { x: ML, y, size: 9.5, font: regular, color: BLACK })
    y -= 30
    rule(page, ML, y, 160, 0.5, NAVY)
    y -= 14
    page.drawText('Joshua Ernst', { x: ML, y, size: 11, font: bold, color: NAVY })
    y -= 14
    page.drawText('Principal, Self-Storage Acquisitions', { x: ML, y, size: 9, font: regular, color: MID })
    y -= 12
    page.drawText('(516) 305-2484  ·  joshuaernst@gmail.com  ·  Woodmere, NY', { x: ML, y, size: 8.5, font: regular, color: LIGHT })

    addFooter(page, d.property_name, italic, regular, W, ML, MR)

    // ── Serialize & send ──────────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save()
    const filename = `LOI-${(d.property_name || 'property').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBytes.length)
    res.send(Buffer.from(pdfBytes))

  } catch (err) {
    console.error('generate-loi error:', err)
    res.status(500).json({ error: 'PDF generation failed', detail: String(err) })
  }
}
