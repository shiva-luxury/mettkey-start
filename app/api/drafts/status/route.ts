import { NextRequest, NextResponse } from 'next/server'
import { updateDraftStatus, DraftStatus } from '../../../lib/drafts'

export async function POST(req: NextRequest) {
  try {
    const { date, pieceType, pieceIndex, status } = (await req.json()) as {
      date: string
      pieceType: string
      pieceIndex: number | null
      status: DraftStatus
    }

    if (!date || !pieceType || !status) {
      return NextResponse.json({ error: 'date, pieceType, and status are required.' }, { status: 400 })
    }
    if (!['pending', 'approved', 'skipped'].includes(status)) {
      return NextResponse.json({ error: 'status must be one of pending, approved, skipped.' }, { status: 400 })
    }

    const batch = await updateDraftStatus(date, pieceType, pieceIndex ?? null, status)
    return NextResponse.json({ ok: true, batch })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
