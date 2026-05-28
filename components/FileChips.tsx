import { useEffect, useState, DragEvent, ChangeEvent, useRef } from 'react'

export type UploadFile = { file: File; mime: string }

const ACCEPT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
]

const TYPE_META: Record<string, { label: string; bg: string; fg: string }> = {
  'application/pdf': { label: 'PDF', bg: '#FEE2E2', fg: '#B91C1C' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'XLS', bg: '#DCFCE7', fg: '#15803D' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'DOC', bg: '#DBEAFE', fg: '#1D4ED8' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { label: 'PPT', bg: '#FFEDD5', fg: '#C2410C' },
}

export function mimeForFile(file: File): string {
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
  return map[ext ?? ''] ?? ''
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Chip({ uf, onRemove }: { uf: UploadFile; onRemove: () => void }) {
  const [preview, setPreview] = useState('')
  const isImage = uf.mime.startsWith('image/')
  const meta = TYPE_META[uf.mime]
  const shortName = uf.file.name.length > 20 ? uf.file.name.slice(0, 17) + '…' : uf.file.name

  useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(uf.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [uf.file, isImage])

  return (
    <div className="relative w-32 flex-shrink-0 border border-dark-border bg-dark-bg group">
      {/* Thumbnail / type badge */}
      <div className="h-20 flex items-center justify-center overflow-hidden bg-dark-surface">
        {isImage && preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={uf.file.name} className="h-full w-full object-cover" />
        ) : meta ? (
          <span
            className="px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-widest rounded"
            style={{ backgroundColor: meta.bg, color: meta.fg }}
          >
            {meta.label}
          </span>
        ) : (
          <span className="text-dark-muted text-xs uppercase tracking-widest">FILE</span>
        )}
      </div>

      {/* Name + size */}
      <div className="px-2 pt-2 pb-2.5 border-t border-dark-border">
        <p className="text-xs text-[#1a1a18] truncate leading-tight" title={uf.file.name}>{shortName}</p>
        <p className="text-[0.65rem] text-dark-muted mt-0.5">{formatSize(uf.file.size)}</p>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-sm text-[0.6rem] leading-none
          bg-dark-border text-dark-muted opacity-0 group-hover:opacity-100
          hover:!bg-red-500 hover:!text-white transition-all"
        title="Remove"
      >
        ✕
      </button>
    </div>
  )
}

/** Drop zone + chip strip.  Parent owns the `files` array. */
export function FileDropZone({
  files,
  onChange,
  disabled = false,
}: {
  files: UploadFile[]
  onChange: (files: UploadFile[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function addRaw(raw: File[]) {
    const incoming: UploadFile[] = []
    const existingNames = new Set(files.map(f => f.file.name))
    for (const f of raw) {
      const mime = mimeForFile(f)
      if (!ACCEPT_MIME.includes(mime)) continue
      if (existingNames.has(f.name)) continue
      incoming.push({ file: f, mime })
    }
    if (incoming.length) onChange([...files, ...incoming])
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    addRaw(Array.from(e.dataTransfer.files))
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    addRaw(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function removeAt(i: number) {
    onChange(files.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      {/* Drop area */}
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed transition-colors duration-150 p-10 text-center
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${dragging ? 'border-gold bg-gold/5' : 'border-dark-border hover:border-gold/50 bg-dark-surface'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.docx,.pptx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
        <div className="w-8 h-8 border border-dark-border flex items-center justify-center mx-auto mb-3 text-dark-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        {files.length === 0 ? (
          <>
            <p className="font-serif text-lg font-light text-[#1B2B5E] mb-1">Drop files here or click to browse</p>
            <p className="text-dark-muted text-sm">PDF, Excel, Word, PPT, PNG, JPG — multiple files supported</p>
          </>
        ) : (
          <p className="text-dark-muted text-sm">Drop more files or click to add</p>
        )}
      </div>

      {/* Chips */}
      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-widest text-dark-muted mb-3">
            {files.length} file{files.length !== 1 ? 's' : ''} queued
          </p>
          <div className="flex gap-3 flex-wrap">
            {files.map((uf, i) => (
              <Chip key={`${uf.file.name}-${i}`} uf={uf} onRemove={() => removeAt(i)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
