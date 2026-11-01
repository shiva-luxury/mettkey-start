import { NextResponse } from 'next/server'
import { getOrganizationId, getChannels, getUpcomingPosts } from '../../../lib/buffer'

export const dynamic = 'force-dynamic'

export const maxDuration = 30

/** Read-only view of what's queued in Buffer, for the dashboard's Buffer Queue panel. */
export async function GET() {
  try {
    const orgId = await getOrganizationId()
    const [channels, posts] = await Promise.all([getChannels(orgId), getUpcomingPosts(orgId)])
    const nameById = new Map(channels.map((c) => [c.id, `${c.service} · ${c.displayName || c.name}`]))

    const queue = posts
      .filter((p) => p.dueAt)
      .sort((a, b) => new Date(a.dueAt as string).getTime() - new Date(b.dueAt as string).getTime())
      .map((p) => ({
        id: p.id,
        channel: nameById.get(p.channelId) || 'Unknown channel',
        dueAt: p.dueAt as string,
        text: p.text,
      }))

    return NextResponse.json({ channels: channels.map((c) => ({ id: c.id, service: c.service, name: c.displayName || c.name })), queue })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not load the Buffer queue.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
