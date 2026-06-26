/**
 * lib/pipelineStore.ts
 *
 * Two-layer persistence:
 *   1. localStorage — immediate, synchronous, browser-only cache
 *   2. GitHub JSON via /api/pipeline-save — durable, async, server-side
 *
 * saveProperty() writes to localStorage first (instant), then fires
 * a background POST to /api/pipeline-save. If GitHub write fails, the
 * deal is still safe in localStorage — no data loss.
 *
 * loadSavedProperties() reads from localStorage synchronously, exactly
 * as before. pipeline.tsx also fetches /data/pipeline.json on mount
 * to recover deals that were saved from another device or browser.
 */

import type { PipelineProperty } from './pipelineData'

const STORAGE_KEY = 'yem_pipeline_saved'

// ── localStorage helpers ──────────────────────────────────────────────────────

export function loadSavedProperties(): PipelineProperty[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PipelineProperty[]) : []
  } catch {
    return []
  }
}

function saveToLocalStorage(p: PipelineProperty): void {
  if (typeof window === 'undefined') return
  try {
    const existing = loadSavedProperties()
    const match = existing.find(e => e.id === p.id)
    const merged = match ? { ...match, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) } : p
    const deduped = existing.filter(e => e.id !== p.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([merged, ...deduped]))
  } catch {}
}

// ── GitHub durable save (background, fire-and-forget) ────────────────────────

function saveToGitHub(p: PipelineProperty): void {
  if (typeof window === 'undefined') return
  // Fire and forget — localStorage is already updated, this is best-effort
  fetch('/api/pipeline-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ property: p }),
  }).catch(err => {
    console.warn('pipeline-save background write failed (non-fatal):', err)
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a property to localStorage immediately, then write to GitHub in the
 * background. Callers do not need to await — localStorage is updated
 * synchronously before this function returns.
 */
export function saveProperty(p: PipelineProperty): void {
  saveToLocalStorage(p)
  saveToGitHub(p)
}

/**
 * Migrate deals from localStorage to GitHub.
 * Called once on pipeline load. Writes any localStorage deals that are
 * missing from the GitHub file, so they survive across devices/browsers.
 * Silent — never throws, never blocks the UI.
 */
export async function migrateLocalStorageToGitHub(
  githubIds: Set<string>,
): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const local = loadSavedProperties()
    const missing = local.filter(p => !githubIds.has(p.id))
    if (missing.length === 0) return

    // Write each missing deal individually to preserve existing GitHub data
    for (const p of missing) {
      await fetch('/api/pipeline-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ property: p }),
      })
    }
    console.log(`pipeline: migrated ${missing.length} deal(s) from localStorage → GitHub`)
  } catch (err) {
    console.warn('pipeline migration failed (non-fatal):', err)
  }
}
