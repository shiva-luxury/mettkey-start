import { NextRequest, NextResponse } from 'next/server'
import { getDraftBatch } from '../../../lib/drafts'
import { jobsFromBatch, scheduleJobs } from '../../../lib/bufferScheduling'

export const dynamic = 'force-dynamic'

export const maxDuration = 60

/**
 * Schedules ONE approved social caption or carousel in Buffer at the next optimal slot.
 * Body: { date: "YYYY-MM-DD", pieceType: "social" | "carousel", pieceIndex: number | null }
 */
export async function POST(req: NextRequest) {
  try {
    const { date, pieceType, pieceIndex } = (await req.json()) as {
      date: string
      pieceType: 'social' | 'carousel'
      pieceIndex: number | null
    }
    if (!date || !pieceType) {
      return NextResponse.json({ error: 'date and pieceType are required.' }, { status: 400 })
    }

    const batch = await getDraftBatch(date)
    if (!batch) return NextResponse.json({ error: `No draft batch found for ${date}.` }, { status: 404 })

    const wanted = pieceType === 'social' ? `${date}:social:${pieceIndex}` : `${date}:carousel:`
    const jobs = jobsFromBatch(batch).filter((j) => (pieceType === 'social' ? j.key === wanted : j.key.startsWith(wanted)))
    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Approve this piece first — only approved content can be scheduled in Buffer.' }, { status: 409 })
    }

    const results = await scheduleJobs(jobs, false)
    return NextResponse.json({ ok: results.every((r) => r.status !== 'failed'), results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Buffer scheduling failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
