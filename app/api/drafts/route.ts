import { NextRequest, NextResponse } from 'next/server'
import { getDraftsIndex, getDraftBatch } from '../../lib/drafts'

/**
 * GET /api/drafts            -> the drafts index (list of {date, topic})
 * GET /api/drafts?date=YYYY-MM-DD -> that date's full DailyBatch
 */
export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date')
    if (date) {
      const batch = await getDraftBatch(date)
      if (!batch) return NextResponse.json({ error: `No draft batch found for ${date}.` }, { status: 404 })
      return NextResponse.json({ batch })
    }
    const index = await getDraftsIndex()
    return NextResponse.json({ index })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
