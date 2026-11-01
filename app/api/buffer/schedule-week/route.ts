import { NextRequest, NextResponse } from 'next/server'
import { batchesFromLastDays, jobsFromBatch, scheduleJobs } from '../../../lib/bufferScheduling'

export const dynamic = 'force-dynamic'

export const maxDuration = 120

/**
 * Schedules every APPROVED social caption and carousel from the last 7 daily batches in one go,
 * spacing each job across the optimal Pacific-time slots.
 * Body: { dryRun?: boolean }. dryRun returns the plan without creating anything in Buffer.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean }
    const dryRun = body.dryRun === true

    const batches = await batchesFromLastDays(7)
    const jobs = batches.flatMap((b) => jobsFromBatch(b))
    if (jobs.length === 0) {
      return NextResponse.json({ ok: true, results: [], message: 'Nothing approved this week yet.' })
    }

    const results = await scheduleJobs(jobs, dryRun)
    return NextResponse.json({ ok: results.every((r) => r.status !== 'failed'), dryRun, results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Buffer scheduling failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
