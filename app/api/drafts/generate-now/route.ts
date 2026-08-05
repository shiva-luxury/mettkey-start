import { NextRequest, NextResponse } from 'next/server'
import { generateDailyBatch, fallbackTopic } from '../../../lib/generateDailyBatch'
import { saveDraftBatch } from '../../../lib/drafts'

export const maxDuration = 300

type TrendingResponse = { headlines: { title: string }[] }

/**
 * Manual-trigger route for the Drafts Queue / Dashboard UI's "Generate Today's Content Now"
 * button. No auth check — this is only reachable from the already-authenticated dashboard
 * itself, not a public endpoint. Kept separate from /api/cron/daily-generate so the browser
 * doesn't have to fight that route's CRON_SECRET check.
 */
export async function POST(req: NextRequest) {
  try {
    let topic = fallbackTopic()
    try {
      const res = await fetch(`${req.nextUrl.origin}/api/trending`, { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as TrendingResponse
        topic = data.headlines?.[0]?.title || topic
      }
    } catch {
      // Same fallback philosophy as /api/trending's own fallbackHeadlines(): never fail
      // outright just because the live feed is unreachable — use the deterministic topic.
    }

    const batch = await generateDailyBatch(topic)
    await saveDraftBatch(batch)
    return NextResponse.json({ ok: true, date: batch.date, topic: batch.topic })
  } catch (err: unknown) {
    console.error('Manual generate-now error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
