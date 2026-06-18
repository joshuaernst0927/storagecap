/**
 * /api/pipeline-save
 *
 * POST { property: PipelineProperty } — upsert one property into
 *   public/data/pipeline.json in the GitHub repo.
 *
 * The client never sees GITHUB_TOKEN — all GitHub access is server-side.
 * localStorage is still the primary cache; this provides durable backup.
 *
 * Protected: requires valid session cookie (requireAuth).
 * Public routes (/submit-deal) are NOT affected by this change.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/serverAuth'
import type { PipelineProperty } from '@/lib/pipelineData'

const REPO_OWNER = 'joshuaernst0927'
const REPO_NAME  = 'storagecap'
const FILE_PATH  = 'public/data/pipeline.json'
const GH_API     = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`

async function readGitHub(token: string): Promise<{ properties: PipelineProperty[]; sha: string }> {
  const res = await fetch(GH_API, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })
  if (res.status === 404) {
    return { properties: [], sha: '' }
  }
  if (!res.ok) {
    throw new Error(`GitHub GET failed: ${res.status}`)
  }
  const file = await res.json()
  const decoded = Buffer.from(file.content as string, 'base64').toString('utf-8')
  return { properties: JSON.parse(decoded) as PipelineProperty[], sha: file.sha as string }
}

async function writeGitHub(
  token: string,
  properties: PipelineProperty[],
  sha: string,
  message: string,
): Promise<void> {
  const content = Buffer.from(JSON.stringify(properties, null, 2)).toString('base64')
  const body: Record<string, string> = { message, content }
  if (sha) body.sha = sha

  const res = await fetch(GH_API, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub PUT failed: ${res.status} — ${err}`)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    // Degrade gracefully — localStorage is still the fallback
    console.warn('pipeline-save: GITHUB_TOKEN not set, skipping durable save')
    return res.status(200).json({ ok: true, skipped: true })
  }

  const { property } = req.body as { property: PipelineProperty }
  if (!property?.id) {
    return res.status(400).json({ error: 'Missing property or property.id' })
  }

  try {
    const { properties, sha } = await readGitHub(token)

    // Upsert: replace existing entry with same id, or prepend new
    const idx = properties.findIndex(p => p.id === property.id)
    if (idx >= 0) {
      properties[idx] = { ...properties[idx], ...property }
    } else {
      properties.unshift(property)
    }

    const facilityName = property.facilityName ?? property.id
    await writeGitHub(token, properties, sha, `Pipeline: update ${facilityName}`)

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('pipeline-save error:', err)
    // Return 200 so the client doesn't treat a GitHub failure as a hard error
    return res.status(200).json({ ok: false, error: String(err) })
  }
}
