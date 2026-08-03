import { NextRequest, NextResponse } from 'next/server'

const REPO = 'shiva-luxury/mettkey-site'
const FILE_PATH = 'lib/blog.ts'
const BRANCH = 'main'
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`

type PublishPost = {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  keyword: string
  date: string
  excerpt: string
  category: string
  image?: string
  body: string[]
  internalLinks: { label: string; href: string }[] | string[]
}

function jsStringLiteral(value: unknown): string {
  return JSON.stringify(value)
}

/** Renders a post object as a TS object literal, matching the formatting already used in lib/blog.ts. */
function renderPostEntry(post: PublishPost): string {
  const internalLinks = (post.internalLinks || []).map((l) => {
    if (typeof l === 'string') {
      // Fallback shape from the generator UI (label-only) — give it a best-effort href.
      return `    { label: ${jsStringLiteral(l)}, href: '/#guides' }`
    }
    return `    { label: ${jsStringLiteral(l.label)}, href: ${jsStringLiteral(l.href)} }`
  })

  const lines = [
    `  {`,
    `    slug: '${post.slug}',`,
    `    title: ${jsStringLiteral(post.title)},`,
    `    metaTitle: ${jsStringLiteral(post.metaTitle)},`,
    `    metaDescription: ${jsStringLiteral(post.metaDescription)},`,
    `    keyword: ${jsStringLiteral(post.keyword)},`,
    `    date: '${post.date}',`,
    `    category: ${jsStringLiteral(post.category)},`,
    `    excerpt: ${jsStringLiteral(post.excerpt)},`,
    `    internalLinks: [`,
    internalLinks.join(',\n'),
    `    ],`,
    `    body: [`,
    post.body.map((p) => `      ${jsStringLiteral(p)}`).join(',\n'),
    `    ],`,
    `  },`,
  ]
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN is not set. Add it in Vercel Project Settings → Environment Variables, then redeploy.' },
      { status: 500 }
    )
  }

  let post: PublishPost
  try {
    post = (await req.json()) as PublishPost
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!post || !post.slug || !post.title || !Array.isArray(post.body)) {
    return NextResponse.json({ error: 'Post is missing required fields (slug, title, body).' }, { status: 400 })
  }
  if (!post.date) post.date = new Date().toISOString().slice(0, 10)

  const ghHeaders = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'mettkey-content-engine',
  }

  // 1. Fetch current file content + sha
  let currentSha: string
  let currentContent: string
  try {
    const getRes = await fetch(`${GITHUB_API}?ref=${BRANCH}`, { headers: ghHeaders, cache: 'no-store' })
    if (!getRes.ok) {
      const body = await getRes.text().catch(() => '')
      return NextResponse.json(
        { error: `GitHub API error fetching lib/blog.ts (${getRes.status}): ${body.slice(0, 300)}` },
        { status: 502 }
      )
    }
    const getJson = (await getRes.json()) as { sha: string; content: string; encoding: string }
    currentSha = getJson.sha
    currentContent = Buffer.from(getJson.content, 'base64').toString('utf-8')
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach GitHub to fetch the current file: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  if (currentContent.includes(`slug: '${post.slug}'`)) {
    return NextResponse.json(
      { error: `A post with slug "${post.slug}" already exists in lib/blog.ts. Change the slug/title and try again.` },
      { status: 409 }
    )
  }

  const arrayMatch = currentContent.match(/export const BLOG_POSTS: BlogPost\[\] = \[/)
  if (!arrayMatch || arrayMatch.index === undefined) {
    return NextResponse.json(
      { error: 'Could not locate the BLOG_POSTS array in lib/blog.ts — the file format may have changed.' },
      { status: 500 }
    )
  }

  const insertAt = arrayMatch.index + arrayMatch[0].length
  const newEntry = `\n${renderPostEntry(post)}`
  const newContent =
    currentContent.slice(0, insertAt) + newEntry + currentContent.slice(insertAt)

  // 2. PUT the updated file back
  try {
    const putRes = await fetch(GITHUB_API, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add blog post: ${post.title}`,
        content: Buffer.from(newContent, 'utf-8').toString('base64'),
        sha: currentSha,
        branch: BRANCH,
      }),
    })

    if (!putRes.ok) {
      const body = await putRes.text().catch(() => '')
      return NextResponse.json(
        { error: `GitHub API error committing lib/blog.ts (${putRes.status}): ${body.slice(0, 300)}` },
        { status: 502 }
      )
    }

    const putJson = (await putRes.json()) as { commit?: { html_url?: string; sha?: string }; content?: { html_url?: string } }
    return NextResponse.json({
      ok: true,
      commitUrl: putJson.commit?.html_url || null,
      fileUrl: putJson.content?.html_url || null,
      slug: post.slug,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach GitHub to commit the change: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }
}
