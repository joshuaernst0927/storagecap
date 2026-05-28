/**
 * Pipeline ingest API — receives PipelineProperty objects.
 *
 * POST /api/pipeline-ingest  — accepts array of PipelineProperty objects
 * GET  /api/pipeline-ingest  — returns all ingested properties
 *
 * Runs the scorer on every incoming deal to ensure breakdown + explanation
 * are always populated regardless of source.
 */

import fs from 'fs'
import path from 'path'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { PipelineProperty } from '@/lib/pipelineData'
import { scoreProperty } from '@/lib/scorer'

const DATA_FILE = path.join(process.cwd(), 'data', 'pipeline-ingest.json')

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readStored(): PipelineProperty[] {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as PipelineProperty[]
  } catch {
    return []
  }
}

function writeStored(properties: PipelineProperty[]) {
  ensureDataDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(properties, null, 2), 'utf-8')
}

function applyScore(prop: PipelineProperty): PipelineProperty {
  const result = scoreProperty(prop)
  const now = new Date().toISOString()
  const entry = { score: result.total, date: now }
  return {
    ...prop,
    motivationScore: result.total,
    scoreBreakdown: result.breakdown,
    scoreExplanation: result.explanation,
    lastScored: now,
    scoreHistory: [...(prop.scoreHistory ?? []).slice(-19), entry],
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.NEXTJS_API_SECRET
  if (secret && req.headers['x-api-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    return res.status(200).json(readStored())
  }

  if (req.method === 'POST') {
    const body = req.body
    const incoming: PipelineProperty[] = Array.isArray(body) ? body : [body]

    if (incoming.length === 0) {
      return res.status(400).json({ error: 'Empty payload' })
    }

    const existing = readStored()
    const existingIds = new Set(existing.map((p) => p.id))

    const merged = [...existing]
    let added = 0
    for (const prop of incoming) {
      if (!prop.id || !prop.facilityName) continue
      if (!existingIds.has(prop.id)) {
        merged.push(applyScore(prop))
        added++
      }
    }

    writeStored(merged)
    return res.status(200).json({ success: true, added, total: merged.length })
  }

  if (req.method === 'DELETE') {
    writeStored([])
    return res.status(200).json({ success: true, message: 'All ingested properties cleared.' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
