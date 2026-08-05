/**
 * Shared data model + GitHub-backed storage for the daily content-drafts pipeline.
 *
 * Every day's generated batch (blog + videos + socials + newsletter + carousel +
 * controversial ideas) is stored as a single JSON file in the SAME GitHub repo the
 * existing /api/publish route already writes to (shiva-luxury/mettkey-site), just under
 * a different path (drafts/{date}.json) — reusing the exact GET-sha-then-PUT Contents API
 * pattern from app/api/publish/route.ts. A drafts/index.json file tracks which dates exist.
 */

export type DraftStatus = 'pending' | 'approved' | 'skipped'
export type ComplianceFlags = string[]

export type BlogDraft = {
  type: 'blog'
  status: DraftStatus
  complianceFlags: ComplianceFlags
  data: {
    slug: string
    title: string
    metaTitle: string
    metaDescription: string
    keyword: string
    category: string
    excerpt: string
    image: string
    body: string[]
    internalLinks: { label: string; href: string }[]
  }
}

export type VideoScriptSegment = { timestamp: string; label: string; content: string }

export type VideoScriptDraft = {
  type: 'video'
  status: DraftStatus
  complianceFlags: ComplianceFlags
  data: {
    topic: string
    hooks: string[] // 5 hook options
    chosenHookIndex: number
    format: string
    segments: VideoScriptSegment[]
    onScreenText: string[]
    /** Honest label: a described audio vibe/genre, NOT a real trending-audio lookup. */
    audioStyleSuggestion: string
    brollShotList: string[]
    cta: string
    /** Plain, paste-ready first-person monologue — no camera directions or on-screen-text notation. */
    heygenScript: string
    /** Compact [timestamp] — on-screen text / caption cue list, formatted for fast CapCut entry. */
    capcutNotes: string
  }
}

export type SocialPlatform = 'Instagram' | 'LinkedIn' | 'Facebook'

export type SocialCaptionDraft = {
  type: 'social'
  status: DraftStatus
  complianceFlags: ComplianceFlags
  data: {
    platform: SocialPlatform
    caption: string
    hashtags: string[]
  }
}

export type NewsletterDraft = {
  type: 'newsletter'
  status: DraftStatus
  complianceFlags: ComplianceFlags
  data: {
    subjectLines: string[]
    preheader: string
    bodyHtml: string
  }
}

export type CarouselDraft = {
  type: 'carousel'
  status: DraftStatus
  complianceFlags: ComplianceFlags
  data: {
    slides: { headline: string; body: string }[] // 5-7 slides
    caption: string
  }
}

export type ControversialIdeaDraft = {
  type: 'controversial'
  status: DraftStatus
  complianceFlags: ComplianceFlags
  data: {
    hook: string
    body: string
  }
}

export type DraftPiece =
  | BlogDraft
  | VideoScriptDraft
  | SocialCaptionDraft
  | NewsletterDraft
  | CarouselDraft
  | ControversialIdeaDraft

export type DailyBatch = {
  date: string // YYYY-MM-DD
  topic: string // the trending topic used as the seed for this batch
  generatedAt: string // ISO
  blog: BlogDraft
  videos: VideoScriptDraft[]
  socials: SocialCaptionDraft[]
  newsletter: NewsletterDraft
  carousel: CarouselDraft
  controversial: ControversialIdeaDraft[]
}

export type DraftsIndexEntry = { date: string; topic: string }

// ---------- GitHub Contents API storage (same repo/auth as app/api/publish/route.ts) ----------

const REPO = 'shiva-luxury/mettkey-site'
const BRANCH = 'main'
const INDEX_PATH = 'drafts/index.json'

function draftPath(date: string): string {
  return `drafts/${date}.json`
}

function ghHeaders(token: string) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'mettkey-content-engine',
  }
}

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set. Add it in Vercel Project Settings → Environment Variables, then redeploy.')
  }
  return token
}

/** GET a file's content + sha from the repo. Returns null on 404 (file doesn't exist yet). */
async function ghGetFile(path: string): Promise<{ sha: string; content: string } | null> {
  const token = requireToken()
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`
  const res = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API error fetching ${path} (${res.status}): ${body.slice(0, 300)}`)
  }
  const json = (await res.json()) as { sha: string; content: string; encoding: string }
  return { sha: json.sha, content: Buffer.from(json.content, 'base64').toString('utf-8') }
}

/** PUT (create or update) a file in the repo. Pass `sha` when updating an existing file. */
async function ghPutFile(path: string, content: string, sha: string | undefined, message: string): Promise<void> {
  const token = requireToken()
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha,
      branch: BRANCH,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API error committing ${path} (${res.status}): ${body.slice(0, 300)}`)
  }
}

/** Reads drafts/index.json — an array of {date, topic} for every batch that exists. Returns [] if missing. */
export async function getDraftsIndex(): Promise<DraftsIndexEntry[]> {
  const file = await ghGetFile(INDEX_PATH)
  if (!file) return []
  try {
    const parsed = JSON.parse(file.content)
    return Array.isArray(parsed) ? (parsed as DraftsIndexEntry[]) : []
  } catch {
    return []
  }
}

/** Reads drafts/{date}.json, returns the parsed DailyBatch or null if missing. */
export async function getDraftBatch(date: string): Promise<DailyBatch | null> {
  const file = await ghGetFile(draftPath(date))
  if (!file) return null
  try {
    return JSON.parse(file.content) as DailyBatch
  } catch {
    return null
  }
}

/**
 * Writes drafts/{date}.json via the GitHub Contents API (GET current sha if it exists, then
 * PUT), AND updates drafts/index.json to include this date if not already present (also
 * GET-then-PUT).
 */
export async function saveDraftBatch(batch: DailyBatch): Promise<void> {
  const path = draftPath(batch.date)
  const existing = await ghGetFile(path)
  await ghPutFile(
    path,
    JSON.stringify(batch, null, 2),
    existing?.sha,
    `Add daily content batch: ${batch.date}`
  )

  const indexFile = await ghGetFile(INDEX_PATH)
  let index: DraftsIndexEntry[] = []
  if (indexFile) {
    try {
      const parsed = JSON.parse(indexFile.content)
      index = Array.isArray(parsed) ? parsed : []
    } catch {
      index = []
    }
  }
  if (!index.find((e) => e.date === batch.date)) {
    index.push({ date: batch.date, topic: batch.topic })
    index.sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
    await ghPutFile(
      INDEX_PATH,
      JSON.stringify(index, null, 2),
      indexFile?.sha,
      `Add daily content batch: ${batch.date}`
    )
  }
}

/**
 * Reads the batch for `date`, updates the status field on the right piece (pieceIndex is
 * null for singular pieces like blog/newsletter/carousel, an array index for
 * videos/socials/controversial), writes it back via the same GET-sha-then-PUT pattern.
 */
export async function updateDraftStatus(
  date: string,
  pieceType: string,
  pieceIndex: number | null,
  status: DraftStatus
): Promise<DailyBatch> {
  const path = draftPath(date)
  const file = await ghGetFile(path)
  if (!file) throw new Error(`No draft batch found for ${date}.`)
  const batch = JSON.parse(file.content) as DailyBatch

  switch (pieceType) {
    case 'blog':
      batch.blog.status = status
      break
    case 'newsletter':
      batch.newsletter.status = status
      break
    case 'carousel':
      batch.carousel.status = status
      break
    case 'video':
      if (pieceIndex === null || !batch.videos[pieceIndex]) throw new Error('Invalid video piece index.')
      batch.videos[pieceIndex].status = status
      break
    case 'social':
      if (pieceIndex === null || !batch.socials[pieceIndex]) throw new Error('Invalid social piece index.')
      batch.socials[pieceIndex].status = status
      break
    case 'controversial':
      if (pieceIndex === null || !batch.controversial[pieceIndex]) throw new Error('Invalid controversial piece index.')
      batch.controversial[pieceIndex].status = status
      break
    default:
      throw new Error(`Unknown piece type: ${pieceType}`)
  }

  await ghPutFile(
    path,
    JSON.stringify(batch, null, 2),
    file.sha,
    `Update draft status: ${date} ${pieceType}`
  )
  return batch
}
