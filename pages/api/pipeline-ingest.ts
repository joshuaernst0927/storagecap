/**
 * Pipeline ingest API — receives and stores PipelineProperty objects.
 *
 * POST /api/pipeline-ingest  — accepts array of PipelineProperty objects
 * GET  /api/pipeline-ingest  — returns all ingested properties
 */

import fs from 'fs'
import path from 'path'
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import type { PipelineProperty } from '@/lib/pipelineData'

// Vercel's project root is read-only; /tmp is the only writable path in prod.
const DATA_FILE = process.env.VERCEL
  ? '/tmp/pipeline-ingest.json'
  : path.join(process.cwd(), 'data', 'pipeline-ingest.json')

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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
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
    const idToIndex = new Map(existing.map((p, i) => [p.id, i]))

    // Upsert by id: merge into the existing record (existing first, incoming
    // second, so fields the incoming partial object doesn't mention survive)
    // when the id is already present; otherwise append as a new record.
    const merged = [...existing]
    let added = 0
    let updated = 0
    for (const prop of incoming) {
      if (!prop.id || !prop.facilityName) continue
      const idx = idToIndex.get(prop.id)
      if (idx !== undefined) {
        merged[idx] = { ...merged[idx], ...prop }
        updated++
      } else {
        merged.push(prop)
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
