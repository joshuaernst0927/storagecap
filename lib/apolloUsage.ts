import { neon } from '@neondatabase/serverless'

// Server-only. Tracks how many credit-consuming Apollo calls have been made in
// the current calendar month, so repeated runs cannot exceed the cap.
//
// NOTE: Apollo's own billing cycle for this account runs 2nd-to-2nd, not
// 1st-to-1st, so this calendar-month counter is deliberately more conservative
// than Apollo's window rather than exactly aligned to it.

const sql = neon(process.env.DATABASE_URL as string)

export const APOLLO_MONTHLY_CAP = Number(process.env.APOLLO_MONTHLY_CAP || 70)

export function currentPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface UsageStatus {
  period: string
  used: number
  cap: number
  remaining: number
  capReached: boolean
}

export async function getUsage(period = currentPeriod()): Promise<UsageStatus> {
  const rows = await sql.query(
    'SELECT credits_used FROM apollo_usage WHERE period = $1',
    [period]
  )
  const used = rows.length ? Number(rows[0].credits_used) : 0
  const cap = APOLLO_MONTHLY_CAP
  return {
    period,
    used,
    cap,
    remaining: Math.max(0, cap - used),
    capReached: used >= cap,
  }
}

/** Atomically record one consumed credit and return the new running total. */
export async function recordCredit(period = currentPeriod()): Promise<number> {
  const rows = await sql.query(
    `INSERT INTO apollo_usage (period, credits_used, updated_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (period) DO UPDATE
       SET credits_used = apollo_usage.credits_used + 1,
           updated_at   = NOW()
     RETURNING credits_used`,
    [period]
  )
  return Number(rows[0].credits_used)
}
