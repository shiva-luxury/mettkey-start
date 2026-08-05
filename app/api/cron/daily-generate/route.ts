import { NextRequest, NextResponse } from 'next/server'
import { generateDailyBatch, fallbackTopic } from '../../../lib/generateDailyBatch'
import { getDraftBatch, saveDraftBatch } from '../../../lib/drafts'

export const maxDuration = 300 // generation makes several Claude calls; give it room on Vercel

type TrendingResponse = { headlines: { title: string }[] }

/** Picks today's seed topic from /api/trending's top headline, falling back to getTodaysTopics(). */
async function pickTodaysTopic(req: NextRequest): Promise<string> {
  try {
    const origin = req.nextUrl.origin
    const res = await fetch(`${origin}/api/trending`, { cache: 'no-store' })
    if (res.ok) {
      const data = (await res.json()) as TrendingResponse
      const top = data.headlines?.[0]?.title
      if (top) return top
    }
  } catch {
    // fall through to the local fallback below — same philosophy as /api/trending's own
    // fallbackHeadlines(): never fail outright just because the live feed is unreachable.
  }
  return fallbackTopic()
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('CRON_SECRET is not set — skipping auth check on /api/cron/daily-generate. Set it in Vercel for production.')
  }

  try {
    const today = new Date().toISOString().slice(0, 10)

    const existing = await getDraftBatch(today)
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyExisted: true,
        date: today,
        topic: existing.topic,
        message: `Today's batch (${today}) already exists — skipped to avoid double-generating.`,
      })
    }

    const topic = await pickTodaysTopic(req)
    const batch = await generateDailyBatch(topic)
    await saveDraftBatch(batch)

    return NextResponse.json({
      ok: true,
      alreadyExisted: false,
      date: batch.date,
      topic: batch.topic,
      pieces: {
        blog: 1,
        videos: batch.videos.length,
        socials: batch.socials.length,
        newsletter: 1,
        carousel: 1,
        controversial: batch.controversial.length,
      },
    })
  } catch (err: unknown) {
    console.error('Daily generate cron error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Allow GET too — Vercel Cron Jobs send GET requests by default; POST stays available for manual/testing calls.
export async function GET(req: NextRequest) {
  return POST(req)
}
