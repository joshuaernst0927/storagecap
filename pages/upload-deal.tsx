import Head from 'next/head'
import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/router'
import type { PipelineProperty, DistressSignals } from '@/lib/pipelineData'

const ACCEPTED = '.pdf,.xlsx,.docx,.pptx,.png,.jpg,.jpeg'
const ACCEPT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
]

function mimeForFile(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  }
  return map[ext ?? ''] ?? file.type
}

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
  facilityName: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  askingPrice: '',
  unitCount: '',
  capRate: '',
  noi: '',
  occupancy: '',
  yearBuilt: '',
  sqft: '',
  ownerName: '',
  stage: 'identified',
  priority: 'medium',
  source: 'broker',
  notes: '',
}

function emptyDistress(): DistressSignals {
  return {
    taxDelinquency: false,
    fireCodeViolations: false,
    codeViolations: [],
    lisPendens: false,
    decliningOccupancy: false,
    deferredMaintenance: false,
    outOfStateOwner: false,
  }
}

export default function UploadDeal() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [highlights, setHighlights] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [extracted, setExtracted] = useState(false)

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }))

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) acceptFile(f)
  }

  function acceptFile(f: File) {
    const mime = mimeForFile(f)
    if (!ACCEPT_MIME.includes(mime)) {
      setExtractError(`Unsupported file type: ${f.name}. Upload PDF, Excel, Word, PowerPoint, or image.`)
      return
    }
    setFile(f)
    setExtractError('')
    setExtracted(false)
  }

  async function handleExtract() {
    if (!file) return
    setExtracting(true)
    setExtractError('')
    try {
      const mime = mimeForFile(file)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/upload-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: mime, data: base64 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()

      setForm({
        facilityName: data.facilityName ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        state: data.state ?? '',
        zipCode: data.zipCode ?? '',
        askingPrice: data.askingPrice != null ? String(data.askingPrice) : '',
        unitCount: data.unitCount != null ? String(data.unitCount) : '',
        capRate: data.capRate != null ? String((data.capRate * 100).toFixed(2)) : '',
        noi: data.noi != null ? String(data.noi) : '',
        occupancy: data.occupancy != null ? String(data.occupancy) : '',
        yearBuilt: data.yearBuilt != null ? String(data.yearBuilt) : '',
        sqft: data.sqft != null ? String(data.sqft) : '',
        ownerName: '',
        stage: 'identified',
        priority: 'medium',
        source: 'broker',
        notes: '',
      })
      setHighlights(Array.isArray(data.highlights) ? data.highlights : [])
      setExtracted(true)
    } catch (err) {
      setExtractError(String(err))
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const capRateNum = form.capRate ? parseFloat(form.capRate) / 100 : undefined
      const property: PipelineProperty = {
        id: `upload-${Date.now()}`,
        facilityName: form.facilityName || 'Unnamed Facility',
        address: form.address,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        unitCount: form.unitCount ? parseInt(form.unitCount) : 0,
        unitMix: '',
        yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : 0,
        landAcres: 0,
        climatePercent: 0,
        estimatedValue: form.askingPrice ? parseFloat(form.askingPrice) : 0,
        askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
        noi: form.noi ? parseFloat(form.noi) : undefined,
        occupancy: form.occupancy ? parseFloat(form.occupancy) : 0,
        ownerName: form.ownerName || '',
        ownerEntity: '',
        ownerEntityState: form.state,
        ownerMailingAddress: '',
        distressSignals: emptyDistress(),
        motivationScore: 0,
        stage: form.stage,
        currentStatus: 'outreach-sent',
        priority: form.priority,
        source: form.source,
        addedDate: new Date().toISOString().split('T')[0],
        notes: [
          form.notes,
          highlights.length ? `Highlights:\n${highlights.map(h => `• ${h}`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n') || undefined,
      }

      if (capRateNum) {
        // Store cap rate in notes if no dedicated field
        const capNote = `Cap Rate: ${(capRateNum * 100).toFixed(2)}%`
        property.notes = property.notes ? `${property.notes}\n${capNote}` : capNote
      }

      const res = await fetch('/api/pipeline-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([property]),
      })
      if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`)
      router.push('/pipeline')
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const hasFile = file !== null

  return (
    <>
      <Head>
        <title>Upload Deal — YEM Acquisitions</title>
        <meta name="description" content="Upload a deal document and extract property details with Claude AI." />
      </Head>

      {/* Hero */}
      <section className="page-hero border-b border-dark-border">
        <div className="section-label">Upload Deal</div>
        <h1 className="display-heading text-5xl md:text-7xl max-w-3xl mb-6">
          Drop a doc.<br />
          <em className="text-gold">Claude extracts the deal.</em>
        </h1>
        <p className="text-dark-muted text-lg max-w-xl leading-relaxed">
          Upload any deal document — PDF, Excel, Word, PowerPoint, or image — and Claude will
          extract the key metrics automatically. Review, edit, and save to your pipeline.
        </p>
      </section>

      <section className="py-16">
        <div className="section-container max-w-3xl">

          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed cursor-pointer transition-colors duration-200 p-12 text-center mb-6
              ${dragging ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/50 bg-dark-surface'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div>
                <div className="font-serif text-xl font-light text-[#1B2B5E] mb-1">{file.name}</div>
                <div className="text-dark-muted text-sm">{(file.size / 1024).toFixed(0)} KB · Click to change</div>
              </div>
            ) : (
              <div>
                <div className="w-10 h-10 border border-dark-border flex items-center justify-center mx-auto mb-4 text-dark-muted">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="font-serif text-xl font-light text-[#1B2B5E] mb-1">Drop a file here or click to browse</p>
                <p className="text-dark-muted text-sm">PDF, Excel (.xlsx), Word (.docx), PowerPoint (.pptx), PNG, JPG</p>
              </div>
            )}
          </div>

          {extractError && (
            <div className="mb-6 p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">
              {extractError}
            </div>
          )}

          {hasFile && !extracted && (
            <div className="mb-8 text-center">
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="btn-gold disabled:opacity-60"
              >
                {extracting ? 'Extracting with Claude...' : 'Extract with Claude'}
              </button>
            </div>
          )}

          {/* Editable Form */}
          {extracted && (
            <div className="border border-dark-border bg-dark-surface">
              <div className="border-b border-dark-border px-7 py-5">
                <div className="section-label-sm mb-0.5">Extracted Data</div>
                <p className="text-dark-muted text-sm">Review and edit before saving to your pipeline.</p>
              </div>

              <div className="p-7 space-y-6">

                {/* Identity */}
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

                {/* Financials */}
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

                {/* Property Details */}
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

                {/* Deal Highlights */}
                {highlights.length > 0 && (
                  <div>
                    <div className="section-label-sm mb-3">Deal Highlights</div>
                    <div className="space-y-2">
                      {highlights.map((h, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-gold mt-2.5 flex-shrink-0">·</span>
                          <input
                            className="input-field flex-1"
                            value={h}
                            onChange={e => {
                              const updated = [...highlights]
                              updated[i] = e.target.value
                              setHighlights(updated)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setHighlights(highlights.filter((_, j) => j !== i))}
                            className="text-dark-muted hover:text-red-600 transition-colors mt-2.5 flex-shrink-0 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setHighlights([...highlights, ''])}
                      className="mt-2 text-gold text-xs uppercase tracking-widest hover:text-gold/70"
                    >
                      + Add highlight
                    </button>
                  </div>
                )}

                {/* Pipeline Meta */}
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

                {saveError && (
                  <div className="p-4 border border-red-400/40 bg-red-50 text-red-700 text-sm">
                    {saveError}
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-gold disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save to Pipeline'}
                  </button>
                  <button
                    onClick={() => { setExtracted(false); setFile(null); setForm(EMPTY_FORM); setHighlights([]) }}
                    className="text-dark-muted text-sm hover:text-[#1a1a18] transition-colors"
                  >
                    Start over
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
