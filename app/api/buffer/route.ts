import { NextRequest, NextResponse } from 'next/server'

type BufferPost = { text: string; scheduledAt: string }

/**
 * Buffer create-update proxy — same pattern as shiva-lead-engine's app/api/buffer/route.ts.
 * The Buffer access token and profile IDs are supplied by the client (stored in
 * localStorage via app/lib/settings.ts) with every request; there is no server-side
 * Buffer env var to configure.
 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, profileIds, posts } = (await req.json()) as {
      accessToken: string
      profileIds: string[]
      posts: BufferPost[]
    }

    if (!accessToken || !profileIds?.length) {
      return NextResponse.json({ error: 'Buffer access token and at least one profile ID are required. Add them in Settings.' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      posts.map(async (post) => {
        const body = new URLSearchParams()
        body.append('access_token', accessToken)
        profileIds.forEach((id) => body.append('profile_ids[]', id))
        body.append('text', post.text)
        body.append('scheduled_at', String(Math.floor(new Date(post.scheduledAt).getTime() / 1000)))
        body.append('now', 'false')

        const res = await fetch('https://api.bufferapp.com/1/updates/create.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
        if (!res.ok) throw new Error(`Buffer API error: ${res.status}`)
        return res.json()
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded

    return NextResponse.json({ succeeded, failed, total: results.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Buffer scheduling failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
