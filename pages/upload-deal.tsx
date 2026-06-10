import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import type { PipelineProperty, DistressSignals } from '@/lib/pipelineData'
import { FileDropZone, type UploadFile } from '@/components/FileChips'
import AuthGate from '@/components/AuthGate'
import { saveProperty } from '@/lib/pipelineStore'
import DealScoreBadge from '@/components/DealScoreBadge'
import { computeDealScore, type DealScoreInputs } from '@/lib/dealScore'

type FormState = {
  facilityName: string
  address: string
  city: string
  state: string
  zipCode: string
  askingPrice: string
  unitCount: string
  capRate: string
  noi: string
  occupancy: string
  yearBuilt: string
  sqft: string
  ownerName: string
  stage: PipelineProperty['stage']
  priority: PipelineProperty['priority']
  source: PipelineProperty['source']
  notes: string
}

const EMPTY_FORM: FormState = {
  facilityName: '', address: '', city: '', state: '', zipCode: '',
  askingPrice: '', unitCount: '', capRate: '', noi: '', occupancy: '',
  yearBuilt: '', sqft: '', ownerName: '',
  stage: 'identified', priority: 'medium', source: 'broker', notes: '',
}

function emptyDistress(): DistressSignals {
  return {
    taxDelinquency: false, fireCodeViolations: false, codeViolations: [],
    lisPendens: false, decliningOccupancy: false, deferredMaintenance: false, outOfStateOwner: false,
  }
}

async function extractPdfTextClient(file: File): Promise<string> {
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

type ExtractionResult = {
  facilityName?: string | null; address?: string | null; city?: string | null
  state?: string | null; zipCode?: string | null; msaName?: string | null
  askingPrice?: number | null; unitCount?: number | null; totalUnits?: number | null
  capRate?: number | null; noi?: number | null; t12NOI?: number | null
  t3NOI?: number | null; t12Revenue?: number | null; t12TotalExpenses?: number | null
  t12Payroll?: number | null; t12ManagementFees?: number | null; t12Marketing?: number | null
  t12Utilities?: number | null; t12OfficeEmployee?: number | null; t12Administrative?: number | null
  t12RepairsMaintenance?: number | null; t12Tax?: number | null; t12Insurance?: number | null
  t12OtherExpenses?: number | null; occupancy?: number | null; currentOccupancy?: number | null
  targetOccupancy?: number | null; currentAvgRentPerUnit?: number | null
  marketAvgRentPerUnit?: number | null; monthsToStabilization?: number | null
  yearBuilt?: number | null; sqft?: number | null; totalSF?: number | null
  broker1Name?: string | null; broker2Name?: string | null; brokerPhone1?: string | null
  brokerPhone2?: string | null; brokerEmail1?: string | null; brokerEmail2?: string | null
  brokerageName?: string | null
  sellerY1?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY2?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY3?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY4?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  sellerY5?: { revenue?: number | null; expenses?: number | null; noi?: number | null } | null
  highlights?: string[] | null
}

export default function UploadDeal() {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fullExtraction, setFullExtraction] = useState<ExtractionResult | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [extracted, setExtracted] = useState(false)
  const [autoScoring, setAutoScoring] = useState(false)
  const [autoScore, setAutoScore] = useState<{ inputs: DealScoreInputs; reasoning: string } | null>(null)

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }))

  const MAX_BINARY_FILE = 3_000_000
  const MAX_PDF_FILE = 10_000_000
  const MAX_BATCH_BASE64 = 3_400_000

  async function extractPayload(filePayloads: { fileName: string; mimeType: string; data: string }[]) {
    const res = await fetch('/api/upload-deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: filePayloads }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const detail = err.detail ? ` — ${err.detail}` : ''
      throw new Error(`${err.error ?? `HTTP ${res.status}`}${detail}`)
    }
    return res.json()
  }

  function mergeExtractionResults(results: ExtractionResult[]): ExtractionResult {
    if (results.length === 1) return results[0]
    const scalars: (keyof ExtractionResult)[] = [
      'facilityName','address','city','state','zipCode','msaName','askingPrice',
      'unitCount','totalUnits','capRate','noi','t12NOI','t3NOI','t12Revenue',
      't12TotalExpenses','t12Payroll','t12ManagementFees','t12Marketing','t12Utilities',
      't12OfficeEmployee','t12Administrative','t12RepairsMaintenance','t12Tax','t12Insurance',
      't12OtherExpenses','occupancy','currentOccupancy','targetOccupancy',
      'currentAvgRentPerUnit','marketAvgRentPerUnit','monthsToStabilization',
      'yearBuilt','sqft','totalSF','broker1Name','broker2Name','brokerPhone1',
      'brokerPhone2','brokerEmail1','brokerEmail2','brokerageName',
      'sellerY1','sellerY2','sellerY3','sellerY4','sellerY5',
    ]
    const merged: ExtractionResult = {}
    for (const f of scalars) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(merged as any)[f] = results.map(r => r[f]).find(v => v != null) ?? null
    }
    const allHighlights = results.flatMap(r => Array.isArray(r.highlights) ? r.highlights as string[] : [])
    merged.highlights = Array.from(new Set(allHighlights)).slice(0, 5)
    return merged
  }

  async function handleExtract() {
    if (files.length === 0) return
    setExtracting(true)
    setExtractError('')
    try {
      const oversized = files.filter(({ file, mime }) => {
        const limit = mime === 'application/pdf' ? MAX_PDF_FILE : MAX_BINARY_FILE
        return file.size > limit
      })
      if (oversized.length > 0) {
        const names = oversized.map(({ file }) => `${file.name} (${(file.size / 1_000_000).toFixed(1)} MB)`).join(', ')
        throw new Error(`${names} ${oversized.length === 1 ? 'is' : 'are'} too large. PDFs support up to 10 MB; images and spreadsheets support up to 3 MB.`)
      }

      const filePayloads = await Promise.all(
        files.map(async ({ file, mime }) => {
          if (mime === 'application/pdf' && file.size > MAX_BINARY_FILE) {
            const text = await extractPdfTextClient(file)
            if (text.trim().length < 200) {
              throw new Error(`${file.name} appears to be a scanned or image-only PDF with no text layer. Please compress it to under 3 MB or use a text-searchable PDF.`)
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

      const batches: (typeof filePayloads)[] = []
      let batch: typeof filePayloads = []
      let batchSize = 0
      for (const fp of filePayloads) {
        if (batch.length > 0 && batchSize + fp.data.length > MAX_BATCH_BASE64) {
          batches.push(batch); batch = [fp]; batchSize = fp.data.length
        } else {
          batch.push(fp); batchSize += fp.data.length
        }
      }
      if (batch.length > 0) batches.push(batch)

      const results: ExtractionResult[] = []
      for (const b of batches) results.push(await extractPayload(b) as ExtractionResult)
      const data = mergeExtractionResults(results)

      setFullExtraction(data)
      setForm({
        facilityName: data.facilityName ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        state: data.state ?? '',
        zipCode: data.zipCode ?? '',
        askingPrice: data.askingPrice != null ? String(data.askingPrice) : '',
        unitCount: (data.unitCount ?? data.totalUnits) != null ? String(data.unitCount ?? data.totalUnits) : '',
        capRate: data.capRate != null ? String((data.capRate * 100).toFixed(2)) : '',
        noi: (data.t12NOI ?? data.noi) != null ? String(data.t12NOI ?? data.noi) : '',
        occupancy: (data.currentOccupancy ?? data.occupancy) != null ? String(data.currentOccupancy ?? data.occupancy) : '',
        yearBuilt: data.yearBuilt != null ? String(data.yearBuilt) : '',
        sqft: (data.sqft ?? data.totalSF) != null ? String(data.sqft ?? data.totalSF) : '',
        ownerName: '',
        stage: 'identified', priority: 'medium', source: 'broker', notes: '',
      })
      setHighlights(Array.isArray(data.highlights) ? data.highlights : [])
      setExtracted(true)

      setAutoScoring(true)
      fetch('/api/auto-score-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityName: data.facilityName, address: data.address, city: data.city,
          state: data.state, askingPrice: data.askingPrice, noi: data.t12NOI ?? data.noi,
          capRate: data.capRate != null ? (data.capRate * 100).toFixed(2) : undefined,
          occupancy: data.currentOccupancy ?? data.occupancy,
          unitCount: data.unitCount ?? data.totalUnits,
          yearBuilt: data.yearBuilt, sqft: data.sqft ?? data.totalSF,
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

  function handleUnderwrite() {
    if (!fullExtraction) return
    const data = fullExtraction

    // Parse city/state from address as fallback
    let city = data.city ?? form.city ?? ''
    let state = data.state ?? form.state ?? ''
    if ((!city || !state) && form.address) {
      const parts = form.address.split(',').map(s => s.trim())
      if (parts.length >= 3 && !city) city = parts[parts.length - 2] ?? ''
      if (parts.length >= 3 && !state) {
        const lastPart = parts[parts.length - 1] ?? ''
        state = lastPart.split(' ').find(s => /^[A-Z]{2}$/.test(s)) ?? ''
      }
    }

    const proformaData = {
      propertyName: data.facilityName ?? form.facilityName,
      address: data.address ?? form.address,
      city,
      state,
      msaName: data.msaName ?? '',
      totalUnits: String(data.unitCount ?? data.totalUnits ?? form.unitCount ?? ''),
      totalSF: String(data.sqft ?? data.totalSF ?? form.sqft ?? ''),
      yearBuilt: String(data.yearBuilt ?? form.yearBuilt ?? ''),
      currentOccupancy: String(data.currentOccupancy ?? data.occupancy ?? form.occupancy ?? ''),
      currentAvgRent: data.currentAvgRentPerUnit != null ? String(data.currentAvgRentPerUnit) : '',
      marketAvgRent: data.marketAvgRentPerUnit != null ? String(data.marketAvgRentPerUnit) : '',
      monthsToStabilization: data.monthsToStabilization != null ? String(data.monthsToStabilization) : '24',
      t12NOI: String(data.t12NOI ?? data.noi ?? form.noi ?? ''),
      t3NOI: data.t3NOI != null ? String(data.t3NOI) : '',
      t12Revenue: data.t12Revenue != null ? String(data.t12Revenue) : '',
      t12TotalExpenses: data.t12TotalExpenses != null ? String(data.t12TotalExpenses) : '',
      t12Payroll: data.t12Payroll != null ? String(data.t12Payroll) : '',
      t12ManagementFees: data.t12ManagementFees != null ? String(data.t12ManagementFees) : '',
      t12Marketing: data.t12Marketing != null ? String(data.t12Marketing) : '',
      t12Utilities: data.t12Utilities != null ? String(data.t12Utilities) : '',
      t12OfficeEmployee: data.t12OfficeEmployee != null ? String(data.t12OfficeEmployee) : '',
      t12Administrative: data.t12Administrative != null ? String(data.t12Administrative) : '',
      t12RepairsMaintenance: data.t12RepairsMaintenance != null ? String(data.t12RepairsMaintenance) : '',
      t12Tax: data.t12Tax != null ? String(data.t12Tax) : '',
      t12Insurance: data.t12Insurance != null ? String(data.t12Insurance) : '',
      t12OtherExpenses: data.t12OtherExpenses != null ? String(data.t12OtherExpenses) : '',
      broker1Name: data.broker1Name ?? '',
      broker2Name: data.broker2Name ?? '',
      brokerPhone1: data.brokerPhone1 ?? '',
      brokerPhone2: data.brokerPhone2 ?? '',
      brokerEmail1: data.brokerEmail1 ?? '',
      brokerEmail2: data.brokerEmail2 ?? '',
      brokerageName: data.brokerageName ?? '',
      sellerY1: data.sellerY1 ? { revenue: String(data.sellerY1.revenue ?? ''), expenses: String(data.sellerY1.expenses ?? ''), noi: String(data.sellerY1.noi ?? '') } : undefined,
      sellerY2: data.sellerY2 ? { revenue: String(data.sellerY2.revenue ?? ''), expenses: String(data.sellerY2.expenses ?? ''), noi: String(data.sellerY2.noi ?? '') } : undefined,
      sellerY3: data.sellerY3 ? { revenue: String(data.sellerY3.revenue ?? ''), expenses: String(data.sellerY3.expenses ?? ''), noi: String(data.sellerY3.noi ?? '') } : undefined,
      sellerY4: data.sellerY4 ? { revenue: String(data.sellerY4.revenue ?? ''), expenses: String(data.sellerY4.expenses ?? ''), noi: String(data.sellerY4.noi ?? '') } : undefined,
      sellerY5: data.sellerY5 ? { revenue: String(data.sellerY5.revenue ?? ''), expenses: String(data.sellerY5.expenses ?? ''), noi: String(data.sellerY5.noi ?? '') } : undefined,
    }
    router.push(`/proforma?data=${encodeURIComponent(JSON.stringify(proformaData))}`)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const capRateNum = form.capRate ? parseFloat(form.capRate) / 100 : undefined
      const property: PipelineProperty = {
        id: `upload-${Date.now()}`,
        facilityName: form.facilityName || 'Unnamed Facility',
        address: form.address, city: form.city, state: form.state, zipCode: form.zipCode,
        unitCount: form.unitCount ? parseInt(form.unitCount) : 0,
        unitMix: '',
        yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : 0,
        landAcres: 0, climatePercent: 0,
        estimatedValue: form.askingPrice ? parseFloat(form.askingPrice) : 0,
        askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
        noi: form.noi ? parseFloat(form.noi) : undefined,
        occupancy: form.occupancy ? parseFloat(form.occupancy) : 0,
        ownerName: form.ownerName || '',
        ownerEntity: '', ownerEntityState: form.state, ownerMailingAddress: '',
        distressSignals: emptyDistress(),
        motivationScore: 0,
        stage: form.stage, currentStatus: 'outreach-sent', priority: form.priority,
        source: form.source,
        addedDate: new Date().toISOString().split('T')[0],
        notes: [
          form.notes,
          highlights.length ? `Highlights:\n${highlights.map(h => `• ${h}`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n') || undefined,
      }
      if (capRateNum) {
        const capNote = `Cap Rate: ${(capRateNum * 100).toFixed(2)}%`
        property.notes = property.notes ? `${property.notes}\n${capNote}` : capNote
      }
      if (autoScore) {
        const scoreResult = computeDealScore(autoScore.inputs)
        property.dealScore = scoreResult.total
        property.dealType = autoScore.inputs.dealType as PipelineProperty['dealType']
        property.dealScoreBreakdown = scoreResult.breakdown
        property.dealScoreInputs = autoScore.inputs as Record<string, string | number>
        property.dealScoredAt = new Date().toISOString()
      }
      saveProperty(property)
      fetch('/api/pipeline-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([property]),
      }).catch(() => {})
      router.push('/pipeline')
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  function handleStartOver() {
    setExtracted(false); setFiles([]); setForm(EMPTY_FORM)
    setHighlights([]); setExtractError(''); setAutoScore(null)
    setAutoScoring(false); setFullExtraction(null)
  }

  return (
    <AuthGate>
    <>
      <Head>
        <title>Import Deal — YEM Acquisitions</title>
        <meta name="description" content="Upload deal documents and extract property details with Claude AI." />
      </Head>

      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Import Deal</div>
        <h1 className="display-heading text-5xl md:text-7xl max-w-3xl mb-6">
          Drop your docs.<br />
          <em className="text-gold">Claude extracts the deal.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Upload any combination of documents — offering memo, rent roll, T12, photos, broker package.
          Claude reads all files together and merges the extracted data into one complete deal profile.
        </p>
      </section>

      <section className="py-16">
        <div className="section-container max-w-3xl">

          {!extracted && (
            <>
              <FileDropZone files={files} onChange={setFiles} disabled={extracting} />
              {extractError && (
                <div className="mt-4 p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">{extractError}</div>
              )}
              {files.length > 0 && (
                <div className="mt-6 text-center">
                  <button onClick={handleExtract} disabled={extracting} className="btn-gold disabled:opacity-60">
                    {extracting ? `Extracting ${files.length} file${files.length !== 1 ? 's' : ''} with Claude...` : `Extract with Claude`}
                  </button>
                </div>
              )}
            </>
          )}

          {extracted && (
            <div className="border border-dark-border bg-dark-surface">
              <div className="border-b border-dark-border px-7 py-5">
                <div className="section-label-sm mb-0.5">Extracted Data</div>
                <p className="text-dark-muted text-sm">Merged from {files.length} file{files.length !== 1 ? 's' : ''}. Review and edit before saving.</p>
              </div>

              <div className="p-7 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label-text">Facility Name</label>
                    <input className="input-field" value={form.facilityName} onChange={e => set('facilityName', e.target.value)} placeholder="e.g. Sunshine Mini Storage" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label-text">Street Address</label>
                    <input className="input-field" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
                  </div>
                  <div>
                    <label className="label-text">City</label>
                    <input className="input-field" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Tampa" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">State</label>
                      <input className="input-field" value={form.state} onChange={e => set('state', e.target.value)} placeholder="FL" maxLength={2} />
                    </div>
                    <div>
                      <label className="label-text">ZIP</label>
                      <input className="input-field" value={form.zipCode} onChange={e => set('zipCode', e.target.value)} placeholder="33601" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="section-label-sm mb-3">Financials</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label-text">Asking Price ($)</label>
                      <input className="input-field" type="number" value={form.askingPrice} onChange={e => set('askingPrice', e.target.value)} placeholder="3500000" />
                    </div>
                    <div>
                      <label className="label-text">NOI ($)</label>
                      <input className="input-field" type="number" value={form.noi} onChange={e => set('noi', e.target.value)} placeholder="220000" />
                    </div>
                    <div>
                      <label className="label-text">Cap Rate (%)</label>
                      <input className="input-field" type="number" step="0.01" value={form.capRate} onChange={e => set('capRate', e.target.value)} placeholder="6.5" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="section-label-sm mb-3">Property Details</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="label-text">Unit Count</label>
                      <input className="input-field" type="number" value={form.unitCount} onChange={e => set('unitCount', e.target.value)} placeholder="280" />
                    </div>
                    <div>
                      <label className="label-text">Occupancy (%)</label>
                      <input className="input-field" type="number" value={form.occupancy} onChange={e => set('occupancy', e.target.value)} placeholder="82" />
                    </div>
                    <div>
                      <label className="label-text">Year Built</label>
                      <input className="input-field" type="number" value={form.yearBuilt} onChange={e => set('yearBuilt', e.target.value)} placeholder="2001" />
                    </div>
                    <div>
                      <label className="label-text">Sq Ft</label>
                      <input className="input-field" type="number" value={form.sqft} onChange={e => set('sqft', e.target.value)} placeholder="32000" />
                    </div>
                  </div>
                </div>

                {highlights.length > 0 && (
                  <div>
                    <div className="section-label-sm mb-3">Deal Highlights</div>
                    <div className="space-y-2">
                      {highlights.map((h, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-gold mt-2.5 flex-shrink-0">·</span>
                          <input className="input-field flex-1" value={h} onChange={e => { const u = [...highlights]; u[i] = e.target.value; setHighlights(u) }} />
                          <button type="button" onClick={() => setHighlights(highlights.filter((_, j) => j !== i))} className="text-dark-muted hover:text-red-600 transition-colors mt-2.5 flex-shrink-0 text-sm">✕</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setHighlights([...highlights, ''])} className="mt-2 text-gold text-xs uppercase tracking-widest hover:text-gold/70">+ Add highlight</button>
                  </div>
                )}

                <div>
                  <div className="section-label-sm mb-3">Pipeline</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label-text">Owner Name</label>
                      <input className="input-field" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="John Smith" />
                    </div>
                    <div>
                      <label className="label-text">Stage</label>
                      <select className="input-field" value={form.stage} onChange={e => set('stage', e.target.value as PipelineProperty['stage'])}>
                        <option value="identified">Identified</option>
                        <option value="researching">Researching</option>
                        <option value="outreach">Outreach</option>
                        <option value="conversation">In Conversation</option>
                        <option value="loi">LOI Sent</option>
                        <option value="dd">Under DD</option>
                        <option value="closed">Closed</option>
                        <option value="dead">Dead</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-text">Priority</label>
                      <select className="input-field" value={form.priority} onChange={e => set('priority', e.target.value as PipelineProperty['priority'])}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-text">Source</label>
                      <select className="input-field" value={form.source} onChange={e => set('source', e.target.value as PipelineProperty['source'])}>
                        <option value="broker">Broker</option>
                        <option value="county-records">County Records</option>
                        <option value="data-scrape">Data Scrape</option>
                        <option value="drive-by">Drive-By</option>
                        <option value="inbound">Inbound</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label-text">Notes</label>
                      <textarea className="input-field resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional context, observations, next steps..." />
                    </div>
                  </div>
                </div>

                {saveError && <div className="p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">{saveError}</div>}

                {(autoScoring || autoScore) && (
                  <div className="flex items-center gap-3 py-3 border-t border-dark-border">
                    <span className="text-xs uppercase tracking-widest text-dark-muted flex-shrink-0">AI Score</span>
                    {autoScoring ? (
                      <div className="flex items-center gap-2 text-xs text-dark-muted">
                        <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />
                        Analyzing deal...
                      </div>
                    ) : autoScore && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <DealScoreBadge score={computeDealScore(autoScore.inputs).total} dealType={autoScore.inputs.dealType as 'value-add' | 'stabilized' | 'distressed'} size="sm" />
                        {autoScore.reasoning && <p className="text-xs text-dark-muted leading-relaxed">{autoScore.reasoning}</p>}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 flex-wrap">
                  <button onClick={handleSave} disabled={saving} className="btn-gold disabled:opacity-60">
                    {saving ? 'Saving...' : 'Save to Pipeline'}
                  </button>
                  <button onClick={handleUnderwrite} className="px-8 py-3 border border-gold text-gold text-sm uppercase tracking-widest hover:bg-gold/10 transition-colors">
                    Underwrite This Deal →
                  </button>
                  <button onClick={handleStartOver} className="text-dark-muted text-sm hover:text-[#1a1a18] transition-colors">
                    Start over
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </section>
    </>
    </AuthGate>
  )
}
