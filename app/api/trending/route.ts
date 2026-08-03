import { NextResponse } from 'next/server'
import { getTodaysTopics } from '../../lib/topics'

export type Headline = { title: string; link: string; source: string; pubDate: string }

/**
 * Public RSS feeds for mortgage/housing news. No API keys needed. Bankrate does not publish
 * a clean mortgage-specific RSS feed, so it's skipped rather than pulled in unfiltered.
 */
const FEEDS: { url: string; source: string }[] = [
  { url: 'https://www.mortgagenewsdaily.com/rss', source: 'Mortgage News Daily' },
  { url: 'https://www.housingwire.com/feed/', source: 'HousingWire' },
  { url: 'https://themortgagereports.com/feed', source: 'The Mortgage Reports' },
]

const FEED_TIMEOUT_MS = 6000

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MettkeyContentEngine/1.0)' },
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timer)
  }
}

/** Minimal, tolerant <item> extractor — no XML library, matches the small-internal-tool style used elsewhere in this app. */
function parseRssItems(xml: string, source: string): Headline[] {
  const items: Headline[] = []
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || []
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title')
    const link = extractLink(block)
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'pubdate') || ''
    if (!title) continue
    items.push({ title: decodeEntities(title), link, source, pubDate })
  }
  return items
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = block.match(re)
  if (!match) return ''
  let value = match[1].trim()
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
  if (cdata) value = cdata[1].trim()
  return value
}

function extractLink(block: string): string {
  // Most feeds: <link>https://...</link>. Some (Atom-ish): <link href="..."/>
  const simple = extractTag(block, 'link')
  if (simple && !simple.includes('<')) return simple.trim()
  const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i)
  if (hrefMatch) return hrefMatch[1]
  return ''
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .trim()
}

function fallbackHeadlines(): Headline[] {
  const now = new Date().toISOString()
  return getTodaysTopics(10).map((t) => ({
    title: t.title,
    link: '',
    source: 'Suggested',
    pubDate: now,
  }))
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetchWithTimeout(feed.url, FEED_TIMEOUT_MS)
      if (!res.ok) throw new Error(`${feed.source} returned ${res.status}`)
      const xml = await res.text()
      return parseRssItems(xml, feed.source)
    })
  )

  let combined: Headline[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') combined = combined.concat(r.value)
  }

  if (combined.length === 0) {
    return NextResponse.json({ headlines: fallbackHeadlines(), fetchedAt: new Date().toISOString() })
  }

  combined.sort((a, b) => {
    const aTime = Date.parse(a.pubDate)
    const bTime = Date.parse(b.pubDate)
    const aValid = !isNaN(aTime)
    const bValid = !isNaN(bTime)
    if (aValid && bValid) return bTime - aTime
    if (aValid) return -1
    if (bValid) return 1
    return 0
  })

  return NextResponse.json({ headlines: combined.slice(0, 10), fetchedAt: new Date().toISOString() })
}
