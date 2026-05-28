import type { PipelineProperty } from './pipelineData'

const STORAGE_KEY = 'yem_pipeline_saved'

export function loadSavedProperties(): PipelineProperty[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PipelineProperty[]) : []
  } catch {
    return []
  }
}

export function saveProperty(p: PipelineProperty): void {
  if (typeof window === 'undefined') return
  try {
    const existing = loadSavedProperties()
    const deduped = existing.filter(e => e.id !== p.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([p, ...deduped]))
  } catch {}
}
