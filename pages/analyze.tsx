import Head from 'next/head'
import Link from 'next/link'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import { saveProperty } from '@/lib/pipelineStore'
import { FileDropZone, type UploadFile } from '@/components/FileChips'
import DealScoreBadge from '@/components/DealScoreBadge'
import { computeDealScore, type DealScoreInputs } from '@/lib/dealScore'
import type { PipelineProperty, DistressSignals } from '@/lib/pipelineData'
import AuthGate from '@/components/AuthGate'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Form {
  propertyName: string
  address: string
  city: string
  state: string
  unitCount: string
  unitMix: string
  occupancy: string
  askingPrice: string
  noi: string
  grossRevenue: string
  sqft: string
  capRate: string
  yearBuilt: string
  brokerName: string
  ownerName: string
  sourceType: PipelineProperty['source']
  notes: string
}

// Mirrors the subset of fields upload-deal returns that we care about
interface ExtractionResult {
  facilityName?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  askingPrice?: number | null
  unitCount?: number | null
  totalUnits?: number | null
  capRate?: number | null
  noi?: number | null
  t12NOI?: number | null
  t12Revenue?: number | null
  currentOccupancy?: number | null
  occupancy?: number | null
  yearBuilt?: number | null
  sqft?: number | null
  totalSF?: number | null
  broker1Name?: string | null
  broker2Name?: string | null
  brokerPhone1?: string | null
  brokerPhone2?: string | null
  brokerEmail1?: string | null
  brokerEmail2?: string | null
  brokerageName?: string | null
  t12Payroll?: number | null
  t12ManagementFees?: number | null
  t12Marketing?: number | null
  t12Utilities?: number | null
  t12OfficeEmployee?: number | null
  t12Administrative?: number | null
  t12RepairsMaintenance?: number | null
  t12Tax?: number | null
  t12Insurance?: number | null
  t12OtherExpenses?: number | null
  t12TotalExpenses?: number | null
  currentAvgRentPerUnit?: number | null
  marketAvgRentPerUnit?: number | null
  monthsToStabilization?: number | null
  t3NOI?: number | null
  msaName?: string | null
  zipCode?: string | null
  sellerY1?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY2?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY3?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY4?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY5?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  highlights?: string[] | null
  operatingExpensesDetailAvailable?: boolean | null
  operatingExpenses?: Array<{
    label: string
    amount: number
    source?: string | null
    confidence?: number | null
  }> | null
}

// ── Dynamic expense line item ─────────────────────────────────────────────────

interface ExpenseLineItem {
  id:          string
  label:       string
  amount:      number
  source?:     string
  confidence?: number
}

const INITIAL: Form = {
  propertyName: '', address: '', city: '', state: '',
  unitCount: '', unitMix: '', occupancy: '', askingPrice: '',
  noi: '', grossRevenue: '', sqft: '', capRate: '',
  yearBuilt: '', brokerName: '', ownerName: '',
  sourceType: 'broker', notes: '',
}

const MAX_BINARY_FILE = 3_000_000
const MAX_PDF_FILE    = 10_000_000
const MAX_BATCH_B64   = 3_400_000

// ── File helpers (same pattern as upload-deal) ────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pages.push(tc.items.map((it: any) => it.str ?? '').join(' '))
  }
  return pages.join('\n\n')
}

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

function emptyDistress(): DistressSignals {
  return {
    taxDelinquency: false, fireCodeViolations: false,
    codeViolations: [], lisPendens: false,
    decliningOccupancy: false, deferredMaintenance: false,
    outOfStateOwner: false,
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Analyze() {
  const router = useRouter()

  // Form state
  const [form, setForm]           = useState<Form>(INITIAL)
  const set = (k: keyof Form, v: string) => setForm(p => ({ ...p, [k]: v }))

  // File extraction state
  const [files, setFiles]         = useState<UploadFile[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extracted, setExtracted] = useState(false)
  const [fullExtraction, setFullExtraction] = useState<ExtractionResult | null>(null)

  // Auto-score state
  const [autoScoring, setAutoScoring] = useState(false)
  const [autoScore, setAutoScore] = useState<{ inputs: DealScoreInputs; reasoning: string } | null>(null)

  // Analysis state
  const [loading, setLoading]     = useState(false)
  const [analysis, setAnalysis]   = useState('')
  const [error, setError]         = useState('')

  // Operating expense state
  const [operatingExpenses, setOperatingExpenses] = useState<ExpenseLineItem[]>([])

  // Save state
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [savedId, setSavedId]     = useState('')

  // ── File extraction ─────────────────────────────────────────────────────────

  async function handleExtract() {
    if (files.length === 0) return
    setExtracting(true)
    setExtractError('')
    setAutoScore(null)
    try {
      const oversized = files.filter(({ file, mime }) => {
        const limit = mime === 'application/pdf' ? MAX_PDF_FILE : MAX_BINARY_FILE
        return file.size > limit
      })
      if (oversized.length > 0) {
        const names = oversized.map(({ file }) =>
          `${file.name} (${(file.size / 1_000_000).toFixed(1)} MB)`
        ).join(', ')
        throw new Error(
          `${names} ${oversized.length === 1 ? 'is' : 'are'} too large. PDFs up to 10 MB; others up to 3 MB.`
        )
      }

      // Encode files
      const filePayloads = await Promise.all(
        files.map(async ({ file, mime }) => {
          if (mime === 'application/pdf' && file.size > MAX_BINARY_FILE) {
            const text = await extractPdfText(file)
            if (text.trim().length < 200) {
              throw new Error(
                `${file.name} appears to be a scanned PDF with no text layer. Please use a text-searchable PDF or compress below 3 MB.`
              )
            }
            return { fileName: file.name, mimeType: 'text/plain', data: textToBase64(text.slice(0, 80_000)) }
          }
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
          return { fileName: file.name, mimeType: mime, data: base64 }
        })
      )

      // Batch by size
      const batches: (typeof filePayloads)[] = []
      let batch: typeof filePayloads = []
      let batchSize = 0
      for (const fp of filePayloads) {
        if (batch.length > 0 && batchSize + fp.data.length > MAX_BATCH_B64) {
          batches.push(batch); batch = [fp]; batchSize = fp.data.length
        } else {
          batch.push(fp); batchSize += fp.data.length
        }
      }
      if (batch.length > 0) batches.push(batch)

      // Extract via /api/upload-deal (reuse existing extraction engine)
      const results: ExtractionResult[] = []
      for (const b of batches) {
        const res = await fetch('/api/upload-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: b }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string; detail?: string }
          throw new Error(`${err.error ?? `HTTP ${res.status}`}${err.detail ? ` — ${err.detail}` : ''}`)
        }
        results.push(await res.json() as ExtractionResult)
      }

      // Merge results (first non-null wins for each scalar field)
      const data: ExtractionResult = {}
      const scalarFields: (keyof ExtractionResult)[] = [
        'facilityName','address','city','state','zipCode','msaName',
        'askingPrice','unitCount','totalUnits','capRate','noi','t12NOI','t3NOI',
        't12Revenue','t12TotalExpenses','currentOccupancy','occupancy',
        'yearBuilt','sqft','totalSF','broker1Name','broker2Name',
        'brokerPhone1','brokerPhone2','brokerEmail1','brokerEmail2','brokerageName',
        'currentAvgRentPerUnit','marketAvgRentPerUnit','monthsToStabilization',
        't12Payroll','t12ManagementFees','t12Marketing','t12Utilities',
        't12OfficeEmployee','t12Administrative','t12RepairsMaintenance',
        't12Tax','t12Insurance','t12OtherExpenses',
        'sellerY1','sellerY2','sellerY3','sellerY4','sellerY5',
      ]
      for (const f of scalarFields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(data as any)[f] = results.map(r => r[f]).find(v => v != null) ?? null
      }
      const allHighlights = results.flatMap(r => Array.isArray(r.highlights) ? r.highlights as string[] : [])
data.highlights = Array.from(new Set(allHighlights)).slice(0, 5)

// Merge operatingExpenses arrays across all batch results.
// Cannot use first-non-null (scalarFields) because this is an array that must be
// concatenated — each batch may cover different documents with different expense rows.
const allExpenses = results.flatMap(r =>
  Array.isArray(r.operatingExpenses) ? r.operatingExpenses : []
)

// Deduplicate by label+amount
const seenExpenseKeys = new Set<string>()

data.operatingExpenses = allExpenses.length > 0
  ? allExpenses.filter(e => {
      const key = `${String(e.label).trim().toLowerCase()}|${e.amount}`
      if (seenExpenseKeys.has(key)) return false
      seenExpenseKeys.add(key)
      return true
    })
  : null

setFullExtraction(data)

      // Auto-fill form from extraction
      const occ = data.currentOccupancy ?? data.occupancy
      const capRaw = data.capRate
      setForm({
        propertyName: data.facilityName ?? '',
        address:      data.address ?? '',
        city:         data.city ?? '',
        state:        data.state ?? '',
        unitCount:    String(data.unitCount ?? data.totalUnits ?? ''),
        unitMix:      '',
        occupancy:    occ != null ? String(occ) : '',
        askingPrice:  data.askingPrice != null ? String(data.askingPrice) : '',
        noi:          (data.t12NOI ?? data.noi) != null ? String(data.t12NOI ?? data.noi) : '',
        grossRevenue: data.t12Revenue != null ? String(data.t12Revenue) : '',
        sqft:         (data.sqft ?? data.totalSF) != null ? String(data.sqft ?? data.totalSF) : '',
        capRate:      capRaw != null ? String((capRaw * 100).toFixed(2)) : '',
        yearBuilt:    data.yearBuilt != null ? String(data.yearBuilt) : '',
        brokerName:   [data.brokerageName, data.broker1Name].filter(Boolean).join(' — ') || '',
        ownerName:    '',
        sourceType:   'broker',
        notes:        '',
      })
      setExtracted(true)

      // Populate dynamic expense line items from extraction
      if (Array.isArray(data.operatingExpenses) && data.operatingExpenses.length > 0) {
        setOperatingExpenses(
          data.operatingExpenses.map((e, i) => ({
            id:         `extracted-${i}-${Date.now()}`,
            label:      e.label ?? '',
            amount:     Number(e.amount) || 0,
            source:     e.source ?? undefined,
            confidence: e.confidence ?? undefined,
          }))
        )
      } else {
        setOperatingExpenses([])
      }

      // Fire auto-score in background
      setAutoScoring(true)
      fetch('/api/auto-score-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityName: data.facilityName,
          address: data.address, city: data.city, state: data.state,
          askingPrice: data.askingPrice,
          noi: data.t12NOI ?? data.noi,
          capRate: capRaw != null ? (capRaw * 100).toFixed(2) : undefined,
          occupancy: occ,
          unitCount: data.unitCount ?? data.totalUnits,
          yearBuilt: data.yearBuilt,
          sqft: data.sqft ?? data.totalSF,
          highlights: Array.isArray(data.highlights) ? data.highlights : [],
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.inputs) setAutoScore({ inputs: d.inputs, reasoning: d.reasoning ?? '' }) })
        .catch(() => {})
        .finally(() => setAutoScoring(false))
    } catch (err) {
      setExtractError(String(err))
    } finally {
      setExtracting(false)
    }
  }

  // ── Generate analysis ───────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setAnalysis(''); setError(''); setSaved(false); setSavedId('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyName: form.propertyName,
          address:      form.address,
          city:         form.city,
          state:        form.state,
          unitCount:    form.unitCount,
          unitMix:      form.unitMix,
          occupancy:    form.occupancy,
          askingPrice:  form.askingPrice,
          noi:          form.noi,
          grossRevenue: form.grossRevenue,
          sqft:         form.sqft,
          capRate:      form.capRate,
          yearBuilt:    form.yearBuilt,
          brokerName:   form.brokerName,
          ownerName:    form.ownerName,
          sourceType:   form.sourceType,
          notes:             form.notes,
          operatingExpenses: operatingExpenses.length > 0 ? operatingExpenses : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error || 'Analysis failed')
      }
      const d = await res.json() as { analysis: string }
      setAnalysis(d.analysis)

      // Fire auto-score after manual entry if not already scored
      if (!autoScore && !autoScoring) {
        setAutoScoring(true)
        fetch('/api/auto-score-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityName: form.propertyName, address: form.address,
            city: form.city, state: form.state,
            askingPrice: form.askingPrice, noi: form.noi,
            capRate: form.capRate || undefined,
            occupancy: form.occupancy, unitCount: form.unitCount,
            yearBuilt: form.yearBuilt, sqft: form.sqft || undefined,
          }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.inputs) setAutoScore({ inputs: d.inputs, reasoning: d.reasoning ?? '' }) })
          .catch(() => {})
          .finally(() => setAutoScoring(false))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Save to Pipeline ────────────────────────────────────────────────────────

  const handleSaveToPipeline = async () => {
    setSaving(true)
    const occ         = parseFloat(form.occupancy) || 0
    const year        = parseInt(form.yearBuilt) || 0
    const askingNum   = parseFloat(form.askingPrice.replace(/[^0-9.]/g, '')) || 0
    const noiNum      = parseFloat(form.noi.replace(/[^0-9.]/g, '')) || 0
    const revenueNum  = form.grossRevenue ? parseFloat(form.grossRevenue.replace(/[^0-9.]/g, '')) : undefined
    const sfNum       = form.sqft ? parseFloat(form.sqft.replace(/[^0-9.]/g, '')) : undefined
    const capRateNum  = form.capRate ? parseFloat(form.capRate) / 100 : undefined
    const notesLower  = (form.notes || '').toLowerCase()
    const deferredMaintenance = notesLower.includes('deferred') || notesLower.includes('maintenance') || notesLower.includes('repair')

    const distressSignals: DistressSignals = {
      ...emptyDistress(),
      decliningOccupancy: occ < 75,
      occupancyTrend: occ < 75 ? occ - 85 : 0,
      deferredMaintenance,
      maintenanceIssues: deferredMaintenance ? ['Noted in analyzer input'] : undefined,
    }

    const noteParts: string[] = []
    if (analysis) noteParts.push(`AI Analysis:\n${analysis}`)
    if (form.notes) noteParts.push(`Notes: ${form.notes}`)
    if (form.capRate) noteParts.push(`Cap Rate: ${form.capRate}%`)
    if (form.brokerName) noteParts.push(`Broker: ${form.brokerName}`)

    const property: PipelineProperty = {
      id:                 `analyze-${Date.now()}`,
      facilityName:       form.propertyName || `${form.city} Self Storage`,
      address:            form.address || '',
      city:               form.city,
      state:              form.state,
      zipCode:            fullExtraction?.zipCode ?? '',
      unitCount:          parseInt(form.unitCount) || 0,
      unitMix:            form.unitMix,
      yearBuilt:          year || 0,
      landAcres:          0,
      climatePercent:     0,
      estimatedValue:     askingNum,
      askingPrice:        askingNum || undefined,
      noi:                noiNum || undefined,
      grossRevenue:       revenueNum,
      occupancy:          occ,
      ownerName:          form.ownerName || '',
      ownerEntity:        '',
      ownerEntityState:   form.state,
      ownerMailingAddress: '',
      distressSignals,
      motivationScore:    0,
      stage:              'researching',
      currentStatus:      'outreach-sent',
      priority:           'medium',
      source:             form.sourceType,
      addedDate:          new Date().toISOString().split('T')[0],
      notes:              noteParts.join('\n\n') || undefined,
    }

    // Store rentable SF if available
    if (sfNum) {
      // PipelineProperty doesn't have sqft — store in notes already handled above
      // but we set estimatedValue fields from form
    }

    // Apply deal score if available
    if (autoScore) {
      const scoreResult = computeDealScore(autoScore.inputs)
      property.dealScore         = scoreResult.total
      property.dealType          = autoScore.inputs.dealType as PipelineProperty['dealType']
      property.dealScoreBreakdown = scoreResult.breakdown
      property.dealScoreInputs   = autoScore.inputs as Record<string, string | number>
      property.dealScoredAt      = new Date().toISOString()
    }

    saveProperty(property)
    setSavedId(property.id)
    setSaved(true)
    setSaving(false)
  }

  // ── Route to Proforma ───────────────────────────────────────────────────────

  const handleBuildModel = () => {
    const ex = fullExtraction
    const proformaData = {
      propertyName:           form.propertyName || ex?.facilityName,
      address:                form.address || ex?.address,
      city:                   form.city || ex?.city,
      state:                  form.state || ex?.state,
      msaName:                ex?.msaName ?? '',
      totalUnits:             form.unitCount,
      totalSF:                form.sqft || (ex?.sqft ?? ex?.totalSF ?? ''),
      yearBuilt:              form.yearBuilt,
      currentOccupancy:       form.occupancy,
      currentAvgRent:         ex?.currentAvgRentPerUnit != null ? String(ex.currentAvgRentPerUnit) : '',
      marketAvgRent:          ex?.marketAvgRentPerUnit  != null ? String(ex.marketAvgRentPerUnit)  : '',
      monthsToStabilization:  ex?.monthsToStabilization != null ? String(ex.monthsToStabilization) : '24',
      t12NOI:                 form.noi,
      t3NOI:                  ex?.t3NOI != null ? String(ex.t3NOI) : '',
      t12Revenue:             form.grossRevenue,
      t12TotalExpenses:       ex?.t12TotalExpenses != null ? String(ex.t12TotalExpenses) : '',
      t12Payroll:             ex?.t12Payroll            != null ? String(ex.t12Payroll)            : '',
      t12ManagementFees:      ex?.t12ManagementFees     != null ? String(ex.t12ManagementFees)     : '',
      t12Marketing:           ex?.t12Marketing          != null ? String(ex.t12Marketing)          : '',
      t12Utilities:           ex?.t12Utilities          != null ? String(ex.t12Utilities)          : '',
      t12OfficeEmployee:      ex?.t12OfficeEmployee     != null ? String(ex.t12OfficeEmployee)     : '',
      t12Administrative:      ex?.t12Administrative     != null ? String(ex.t12Administrative)     : '',
      t12RepairsMaintenance:  ex?.t12RepairsMaintenance != null ? String(ex.t12RepairsMaintenance) : '',
      t12Tax:                 ex?.t12Tax                != null ? String(ex.t12Tax)                : '',
      t12Insurance:           ex?.t12Insurance          != null ? String(ex.t12Insurance)          : '',
      t12OtherExpenses:       ex?.t12OtherExpenses      != null ? String(ex.t12OtherExpenses)      : '',
      broker1Name:            form.brokerName.split(' — ')[1] || form.brokerName || '',
      brokerageName:          ex?.brokerageName ?? '',
      sellerY1:               ex?.sellerY1 ? { revenue: String(ex.sellerY1.revenue ?? ''), expenses: String(ex.sellerY1.expenses ?? ''), noi: String(ex.sellerY1.noi ?? '') } : undefined,
      sellerY2:               ex?.sellerY2 ? { revenue: String(ex.sellerY2.revenue ?? ''), expenses: String(ex.sellerY2.expenses ?? ''), noi: String(ex.sellerY2.noi ?? '') } : undefined,
      sellerY3:               ex?.sellerY3 ? { revenue: String(ex.sellerY3.revenue ?? ''), expenses: String(ex.sellerY3.expenses ?? ''), noi: String(ex.sellerY3.noi ?? '') } : undefined,
      sellerY4:               ex?.sellerY4 ? { revenue: String(ex.sellerY4.revenue ?? ''), expenses: String(ex.sellerY4.expenses ?? ''), noi: String(ex.sellerY4.noi ?? '') } : undefined,
      sellerY5:               ex?.sellerY5 ? { revenue: String(ex.sellerY5.revenue ?? ''), expenses: String(ex.sellerY5.expenses ?? ''), noi: String(ex.sellerY5.noi ?? '') } : undefined,
    }
    router.push(`/proforma?data=${encodeURIComponent(JSON.stringify(proformaData))}`)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Expense reconciliation (derived, not state)
  const totalOpEx   = operatingExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const grossRev    = form.grossRevenue ? parseFloat(form.grossRevenue.replace(/[^0-9.]/g, '')) : null
  const statedNOI   = form.noi         ? parseFloat(form.noi.replace(/[^0-9.]/g, ''))         : null
  const calcNOI     = (grossRev != null && operatingExpenses.length > 0) ? (grossRev - totalOpEx) : null
  const noiVariance = (calcNOI != null && statedNOI && statedNOI > 0)
    ? Math.abs(calcNOI - statedNOI) / statedNOI : null
  const noiMismatch = noiVariance != null && noiVariance > 0.02
  const expRatio    = (grossRev && grossRev > 0 && operatingExpenses.length > 0)
    ? (totalOpEx / grossRev * 100) : null

  function fmtDollar(n: number) {
    return '$' + Math.round(n).toLocaleString()
  }

  function addExpenseRow() {
    setOperatingExpenses(prev => [
      ...prev,
      { id: `manual-${Date.now()}`, label: '', amount: 0 }
    ])
  }

  function updateExpenseRow(id: string, field: 'label' | 'amount', value: string) {
    setOperatingExpenses(prev => prev.map(e =>
      e.id === id
        ? { ...e, [field]: field === 'amount' ? (parseFloat(value.replace(/[^0-9.]/g, '')) || 0) : value }
        : e
    ))
  }

  function deleteExpenseRow(id: string) {
    setOperatingExpenses(prev => prev.filter(e => e.id !== id))
  }

  const sections = analysis
    ? analysis.split(/\n(?=\*\*[^*]+\*\*)/).filter(Boolean)
    : []

  const scoreResult = autoScore ? computeDealScore(autoScore.inputs) : null

  return (
    <AuthGate>
    <>
      <Head>
        <title>AI Deal Analyzer — YEM Acquisitions</title>
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">AI Deal Analyzer</div>
        <h1 className="display-heading text-6xl md:text-8xl max-w-3xl mb-8">
          Fast triage.<br />
          <em className="text-gold">Go or no-go.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Drop deal documents or enter numbers manually for an institutional-grade acquisition verdict —
          cap rate context, market assessment, value-add upside, and a clear recommendation.
        </p>
      </section>

      <section className="py-16">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* ── LEFT COLUMN: File upload + Form ── */}
            <div className="space-y-6">

              {/* File drop zone */}
              <div>
                <div className="section-label mb-3">Documents (Optional)</div>
                <p className="text-dark-muted text-xs mb-3">
                  Drop an OM, T12, or rent roll to auto-fill the form below. You can review and edit all fields before generating.
                </p>
                <FileDropZone files={files} onChange={setFiles} disabled={extracting} />
                {extractError && (
                  <div className="mt-3 p-3 border border-red-400/40 bg-red-50 text-red-700 text-sm">{extractError}</div>
                )}
                {files.length > 0 && !extracted && (
                  <button
                    onClick={handleExtract}
                    disabled={extracting}
                    className="mt-3 btn-gold disabled:opacity-50"
                  >
                    {extracting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 border border-[#1a1a18] border-t-transparent rounded-full animate-spin" />
                        Extracting with Claude...
                      </span>
                    ) : 'Extract & Auto-Fill'}
                  </button>
                )}
                {extracted && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-green-700 text-xs font-medium">✓ Fields auto-filled — review below</span>
                    <button
                      onClick={() => {
                        setFiles([]); setExtracted(false); setFullExtraction(null)
                        setForm(INITIAL); setAutoScore(null); setExtractError('')
                        setOperatingExpenses([])
                      }}
                      className="text-dark-muted text-xs hover:text-[#1a1a18] transition-colors"
                    >
                      Clear & reset
                    </button>
                  </div>
                )}
              </div>

              {/* Deal score (shown after extraction or after manual analysis) */}
              {(autoScoring || autoScore) && (
                <div className="flex items-center gap-3 py-3 border-t border-b border-dark-border">
                  <span className="text-xs uppercase tracking-widest text-dark-muted flex-shrink-0">AI Score</span>
                  {autoScoring ? (
                    <div className="flex items-center gap-2 text-xs text-dark-muted">
                      <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />
                      Scoring deal...
                    </div>
                  ) : scoreResult && autoScore && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <DealScoreBadge
                        score={scoreResult.total}
                        dealType={autoScore.inputs.dealType as 'value-add' | 'stabilized' | 'distressed'}
                        size="sm"
                      />
                      {autoScore.reasoning && (
                        <p className="text-xs text-dark-muted leading-relaxed">{autoScore.reasoning}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Operating Expense Table ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="section-label mb-0">Operating Expenses</div>
                  <button
                    type="button"
                    onClick={addExpenseRow}
                    className="text-xs text-gold border border-gold/40 px-3 py-1 hover:bg-gold/10 transition-colors"
                  >
                    + Add Row
                  </button>
                </div>

                {operatingExpenses.length === 0 ? (
                  <p className="text-dark-muted text-xs py-3 border border-dashed border-dark-border text-center">
                    No expense line items — extract documents above or add rows manually
                  </p>
                ) : (
                  <div className="border border-dark-border overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-0 bg-dark-surface border-b border-dark-border px-3 py-1.5 text-xs text-dark-muted uppercase tracking-widest">
                      <span>Expense Label</span>
                      <span className="text-right pr-8">Annual $</span>
                      <span className="w-6" />
                    </div>
                    {/* Rows */}
                    {operatingExpenses.map((e, i) => (
                      <div
                        key={e.id}
                        className={`grid grid-cols-[1fr_auto_auto] gap-0 items-center ${i > 0 ? 'border-t border-dark-border' : ''}`}
                      >
                        <input
                          className="bg-transparent px-3 py-2 text-xs text-dark-primary border-r border-dark-border focus:outline-none focus:bg-dark-surface w-full"
                          value={e.label}
                          onChange={ev => updateExpenseRow(e.id, 'label', ev.target.value)}
                          placeholder="Expense label"
                        />
                        <input
                          className="bg-transparent px-3 py-2 text-xs text-dark-primary text-right border-r border-dark-border focus:outline-none focus:bg-dark-surface w-32"
                          value={e.amount === 0 && e.label === '' ? '' : String(e.amount)}
                          onChange={ev => updateExpenseRow(e.id, 'amount', ev.target.value)}
                          placeholder="0"
                          type="number"
                          min="0"
                          step="1"
                        />
                        <button
                          type="button"
                          onClick={() => deleteExpenseRow(e.id)}
                          className="px-3 py-2 text-dark-muted hover:text-red-500 transition-colors text-xs"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {/* Totals */}
                    <div className="border-t-2 border-dark-border bg-dark-surface px-3 py-2 grid grid-cols-[1fr_auto_auto] gap-0">
                      <span className="text-xs font-medium text-dark-primary uppercase tracking-wide">Total Operating Expenses</span>
                      <span className="text-xs font-medium text-dark-primary text-right pr-8 w-32">{fmtDollar(totalOpEx)}</span>
                      <span className="w-6" />
                    </div>
                    {expRatio != null && (
                      <div className="border-t border-dark-border px-3 py-1.5 grid grid-cols-[1fr_auto_auto] gap-0">
                        <span className="text-xs text-dark-muted">Expense Ratio{grossRev ? ` (of ${fmtDollar(grossRev)} revenue)` : ''}</span>
                        <span className="text-xs text-dark-muted text-right pr-8 w-32">{expRatio.toFixed(1)}%</span>
                        <span className="w-6" />
                      </div>
                    )}
                  </div>
                )}

                {/* NOI Reconciliation */}
                {calcNOI != null && statedNOI != null && (
                  <div className={`mt-2 px-3 py-2 border text-xs ${noiMismatch ? 'border-yellow-600/50 bg-yellow-900/10 text-yellow-600' : 'border-green-700/40 bg-green-900/5 text-green-700'}`}>
                    <div className="flex justify-between mb-0.5">
                      <span>Gross Revenue − Operating Expenses</span>
                      <span className="font-medium">{fmtDollar(calcNOI)}</span>
                    </div>
                    <div className="flex justify-between mb-0.5">
                      <span>Stated NOI</span>
                      <span className="font-medium">{fmtDollar(statedNOI)}</span>
                    </div>
                    {noiMismatch ? (
                      <div className="mt-1 font-medium">
                        ⚠ {(noiVariance! * 100).toFixed(1)}% variance — verify expense completeness before underwriting
                      </div>
                    ) : (
                      <div className="mt-1">✓ NOI reconciles within 2%</div>
                    )}
                  </div>
                )}
              </div>

              {/* Property form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="section-label">Property Details</div>

                <div>
                  <label className="label-text">Nickname / Reference</label>
                  <input className="input-field" value={form.propertyName} onChange={e => set('propertyName', e.target.value)} placeholder="Main Street Storage — Tucson" />
                </div>

                <div>
                  <label className="label-text">Property Address</label>
                  <input className="input-field" value={form.address} onChange={e => set('address', e.target.value)} placeholder="12331 E 11th St, Tulsa, OK 74128" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">City *</label>
                    <input className="input-field" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Tucson" required />
                  </div>
                  <div>
                    <label className="label-text">State *</label>
                    <input className="input-field" value={form.state} onChange={e => set('state', e.target.value)} placeholder="AZ" required maxLength={2} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Total Units *</label>
                    <input className="input-field" type="number" value={form.unitCount} onChange={e => set('unitCount', e.target.value)} placeholder="350" required />
                  </div>
                  <div>
                    <label className="label-text">Occupancy (%) *</label>
                    <input className="input-field" type="number" min="0" max="100" value={form.occupancy} onChange={e => set('occupancy', e.target.value)} placeholder="82" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Asking Price ($) *</label>
                    <input className="input-field" value={form.askingPrice} onChange={e => set('askingPrice', e.target.value)} placeholder="3,800,000" required />
                  </div>
                  <div>
                    <label className="label-text">Annual NOI ($) *</label>
                    <input className="input-field" value={form.noi} onChange={e => set('noi', e.target.value)} placeholder="260,000" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Gross Revenue ($)</label>
                    <input className="input-field" value={form.grossRevenue} onChange={e => set('grossRevenue', e.target.value)} placeholder="375,000" />
                  </div>
                  <div>
                    <label className="label-text">Rentable SF</label>
                    <input className="input-field" value={form.sqft} onChange={e => set('sqft', e.target.value)} placeholder="42,500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Cap Rate (%)</label>
                    <input className="input-field" type="number" step="0.01" value={form.capRate} onChange={e => set('capRate', e.target.value)} placeholder="6.85" />
                  </div>
                  <div>
                    <label className="label-text">Year Built</label>
                    <input className="input-field" type="number" value={form.yearBuilt} onChange={e => set('yearBuilt', e.target.value)} placeholder="2003" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Broker / Listing Agent</label>
                    <input className="input-field" value={form.brokerName} onChange={e => set('brokerName', e.target.value)} placeholder="Marcus & Millichap — John Smith" />
                  </div>
                  <div>
                    <label className="label-text">Owner / Seller</label>
                    <input className="input-field" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="ABC Storage LLC" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Unit Mix</label>
                    <input className="input-field" value={form.unitMix} onChange={e => set('unitMix', e.target.value)} placeholder="80× 5×10, 120× 10×10, 100× 10×20" />
                  </div>
                  <div>
                    <label className="label-text">Source</label>
                    <select className="input-field" value={form.sourceType} onChange={e => set('sourceType', e.target.value as PipelineProperty['source'])}>
                      <option value="broker">Broker / Marketed</option>
                      <option value="inbound">Inbound / Seller Direct</option>
                      <option value="county-records">County Records</option>
                      <option value="drive-by">Drive-By / Self-Sourced</option>
                      <option value="data-scrape">Data Scrape</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text">Additional Context</label>
                  <textarea
                    className="input-field resize-none" rows={3}
                    value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="Climate control %, expansion land, deferred maintenance, market notes, seller motivation..."
                  />
                </div>

                {error && (
                  <div className="border border-red-800 bg-red-900/10 text-red-400 text-sm px-4 py-3">{error}</div>
                )}

                <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-50">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border border-[#1a1a18] border-t-transparent rounded-full animate-spin" />
                      Analyzing...
                    </span>
                  ) : 'Generate Analysis'}
                </button>
                <p className="text-dark-muted text-xs leading-relaxed">
                  AI analysis is informational only. Results should be independently verified. Not investment advice.
                </p>
              </form>
            </div>

            {/* ── RIGHT COLUMN: Analysis output ── */}
            <div>
              {!analysis && !loading && (
                <div className="border border-dark-border bg-dark-surface p-16 text-center">
                  <div className="gold-divider mx-auto mb-6" />
                  <p className="font-serif text-2xl font-light text-dark-muted">Analysis appears here</p>
                  <p className="text-dark-muted text-xs mt-3">
                    {files.length > 0 && !extracted
                      ? 'Extract documents first, then generate analysis'
                      : 'Fill in property details and generate'}
                  </p>
                </div>
              )}

              {loading && (
                <div className="border border-dark-border bg-dark-surface p-16 text-center">
                  <div className="w-8 h-8 border border-gold border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                  <p className="font-serif text-xl font-light text-dark-muted">Analyzing property...</p>
                  <p className="text-dark-muted text-xs mt-2">Evaluating cap rates, market conditions, value-add potential</p>
                </div>
              )}

              {analysis && (
                <div className="space-y-5 fade-in">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="section-label mb-0">AI Analysis</div>
                    <div className="h-px flex-1 bg-dark-border" />
                  </div>

                  <div className="border border-dark-border bg-dark-surface">
                    {sections.length > 1 ? sections.map((section, i) => {
                      const lines = section.trim().split('\n')
                      const heading = lines[0].replace(/\*\*/g, '')
                      const body = lines.slice(1).join('\n').trim()
                      return (
                        <div key={i} className={`p-6 ${i > 0 ? 'border-t border-dark-border' : ''}`}>
                          <h3 className="font-serif text-xl font-light text-gold mb-3">{heading}</h3>
                          <p className="text-dark-muted text-sm leading-relaxed whitespace-pre-wrap">{body}</p>
                        </div>
                      )
                    }) : (
                      <div className="p-6">
                        <p className="text-dark-muted text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {saved ? (
                    <div className="border border-green-700/40 bg-green-700/5 p-4 flex items-center justify-between">
                      <div>
                        <span className="text-green-700 font-medium text-sm">Saved to pipeline.</span>
                        <span className="text-dark-muted text-xs ml-2">Analysis, score, and profile included.</span>
                      </div>
                      <Link href="/pipeline" className="text-gold text-xs uppercase tracking-widest hover:text-gold/80 transition-colors">
                        View in Pipeline →
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 flex-wrap">
                      <button
                        onClick={handleSaveToPipeline}
                        disabled={saving}
                        className="btn-gold disabled:opacity-50"
                      >
                        {saving ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border border-[#1a1a18] border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </span>
                        ) : 'Save to Pipeline'}
                      </button>
                      <button
                        onClick={handleBuildModel}
                        className="px-6 py-3 border border-gold text-gold text-sm uppercase tracking-widest hover:bg-gold/10 transition-colors"
                      >
                        Build Full Model →
                      </button>
                    </div>
                  )}

                  {saved && (
                    <button
                      onClick={handleBuildModel}
                      className="w-full px-6 py-3 border border-gold text-gold text-sm uppercase tracking-widest hover:bg-gold/10 transition-colors"
                    >
                      Build Full Model in Proforma →
                    </button>
                  )}

                  <div className="border border-gold/30 p-4 text-xs text-dark-muted leading-relaxed">
                    <span className="text-gold font-medium">Ready to underwrite?</span> Use{' '}
                    <Link href="/underwrite" className="text-gold underline hover:text-gold/80">Underwrite</Link>{' '}
                    for full document extraction and financial modeling, or{' '}
                    <Link href="/upload-deal" className="text-gold underline hover:text-gold/80">Import Deal</Link>{' '}
                    to create a complete pipeline profile.
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>
    </>
    </AuthGate>
  )
}
