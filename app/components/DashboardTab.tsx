'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Label, Button, CopyButton, ErrorBox } from './ui'
import { callClaude, parseClaudeJSON } from '../lib/api'
import type { DailyBatch, DraftsIndexEntry, SocialCaptionDraft, VideoScriptDraft } from '../lib/drafts'

type Headline = { title: string; link: string; source: string; pubDate: string }

const CANVA_SOCIAL_URL = 'https://www.canva.com/create/instagram-posts/'
const CANVA_VIDEO_URL = 'https://www.canva.com/create/instagram-reels/'
const PLATFORM_URLS: Record<string, string> = {
  Instagram: 'https://www.instagram.com/',
  LinkedIn: 'https://www.linkedin.com/feed/?shareActive=true',
  Facebook: 'https://www.facebook.com/mettkey/',
}

function copyAndOpen(text: string, url: string) {
  navigator.clipboard.writeText(text).catch(() => {})
  window.open(url, '_blank', 'noopener,noreferrer')
}

// ---------- Today's trending topics ----------

function TrendingTopicsSection() {
  const [headlines, setHeadlines] = useState<Headline[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/trending', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Trending feed request failed (${res.status}).`)
      const data = (await res.json()) as { headlines: Headline[] }
      setHeadlines(data.headlines || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load trending topics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { run() }, [run])

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">Today&apos;s Trending Topics</h3>
        <Button variant="ghost" loading={loading} onClick={run} className="!px-2 !py-1 text-xs">Refresh</Button>
      </div>
      {error && <ErrorBox message={error} onRetry={run} />}
      {!error && loading && headlines.length === 0 && <p className="text-sm text-[var(--text-muted)]">Loading live headlines…</p>}
      {headlines.length > 0 && (
        <ul className="text-sm space-y-1.5">
          {headlines.slice(0, 8).map((h, i) => (
            <li key={i} className="border-b border-[var(--border)] last:border-0 pb-1.5 last:pb-0">
              {h.link ? (
                <a href={h.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{h.title}</a>
              ) : h.title}
              <span className="text-xs text-[var(--text-muted)]"> · {h.source}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---------- Viral examples to study ----------

type ViralExample = { title: string; platform: string; whyItsWorking: string }

function ViralExamplesSection() {
  const [examples, setExamples] = useState<ViralExample[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const prompt = `Using live web search, research 5 currently-notable pieces of mortgage/real-estate content performing well right now on TikTok, Instagram, or YouTube. For each, give the title/topic, the platform, and a short explanation of why it's working (hook style, format, angle).

Return ONLY valid JSON, no prose before or after:
{"examples": [{"title": string, "platform": string, "whyItsWorking": string}] (exactly 5)}`
      const res = await callClaude(prompt, { webSearch: true, maxTokens: 1800 })
      const parsed = parseClaudeJSON<{ examples: ViralExample[] }>(res.text)
      setExamples(parsed.examples)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not research viral examples this time.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { run() }, [run])

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-lg">5 Viral Content Examples to Study Today</h3>
        <Button variant="ghost" loading={loading} onClick={run} className="!px-2 !py-1 text-xs">Refresh</Button>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-3">AI-researched suggestions — verify current performance yourself.</p>
      {error && <ErrorBox message={error} onRetry={run} />}
      {!error && loading && !examples && <p className="text-sm text-[var(--text-muted)]">Researching what&apos;s performing well right now…</p>}
      {examples && (
        <ul className="space-y-3">
          {examples.map((ex, i) => (
            <li key={i} className="border-b border-[var(--border)] last:border-0 pb-2.5 last:pb-0">
              <p className="text-sm font-medium">{ex.title} <span className="text-xs text-[var(--text-muted)] font-normal">· {ex.platform}</span></p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{ex.whyItsWorking}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---------- Accounts to engage with ----------

type SuggestedAccount = { name: string; platform: string; reason: string }

function AccountsSection() {
  const [accounts, setAccounts] = useState<SuggestedAccount[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const prompt = `Using live web search, suggest 20 real, named accounts active in the California mortgage / real estate / personal-finance-creator niche worth engaging with — a mix of larger and smaller accounts, across platforms (Instagram, TikTok, LinkedIn, YouTube). For each, give a one-line reason to engage.

Return ONLY valid JSON, no prose before or after:
{"accounts": [{"name": string, "platform": string, "reason": string}] (exactly 20)}`
      const res = await callClaude(prompt, { webSearch: true, maxTokens: 3000 })
      const parsed = parseClaudeJSON<{ accounts: SuggestedAccount[] }>(res.text)
      setAccounts(parsed.accounts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not research accounts this time.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { run() }, [run])

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-lg">20 Accounts to Consider Engaging With Today</h3>
        <Button variant="ghost" loading={loading} onClick={run} className="!px-2 !py-1 text-xs">Refresh</Button>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-3">AI-suggested starting points — confirm these accounts are still active and relevant before engaging.</p>
      {error && <ErrorBox message={error} onRetry={run} />}
      {!error && loading && !accounts && <p className="text-sm text-[var(--text-muted)]">Researching active accounts in the niche…</p>}
      {accounts && (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {accounts.map((a, i) => (
            <div key={i} className="border border-[var(--border)] rounded-lg p-2.5">
              <p className="text-sm font-medium">{a.name} <span className="text-xs text-[var(--text-muted)] font-normal">· {a.platform}</span></p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{a.reason}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---------- Ready-to-post piece ----------

function findReadyPiece(batch: DailyBatch): { kind: 'social'; piece: SocialCaptionDraft } | { kind: 'video'; piece: VideoScriptDraft } | null {
  const social = batch.socials.find((s) => s.status === 'approved')
  if (social) return { kind: 'social', piece: social }
  const video = batch.videos.find((v) => v.status === 'approved')
  if (video) return { kind: 'video', piece: video }
  return null
}

function ReadyToPostSection({ batch }: { batch: DailyBatch | null }) {
  if (!batch) return null
  const ready = findReadyPiece(batch)
  if (!ready) {
    return (
      <Card>
        <h3 className="font-serif text-lg mb-2">Today&apos;s Ready-to-Post Piece</h3>
        <p className="text-sm text-[var(--text-muted)]">No approved social or video piece yet in the most recent batch ({batch.date}). Approve one in the Drafts Queue tab and it will show up here.</p>
      </Card>
    )
  }

  if (ready.kind === 'social') {
    const s = ready.piece
    const fullText = s.data.hashtags.length ? `${s.data.caption}\n\n${s.data.hashtags.join(' ')}` : s.data.caption
    const platformUrl = PLATFORM_URLS[s.data.platform] || 'https://www.google.com'
    return (
      <Card>
        <h3 className="font-serif text-lg mb-1">Today&apos;s Ready-to-Post Piece</h3>
        <p className="text-xs text-[var(--text-muted)] mb-3">{s.data.platform} caption, approved from the {batch.date} batch.</p>
        <p className="text-sm whitespace-pre-wrap mb-2">{s.data.caption}</p>
        {s.data.hashtags.length > 0 && <p className="text-sm text-[var(--teal-dark)] mb-3">{s.data.hashtags.join(' ')}</p>}
        <div className="flex flex-wrap gap-2">
          <CopyButton text={fullText} />
          <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(fullText, CANVA_SOCIAL_URL)}>Copy Caption + Open Canva</Button>
          <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(fullText, platformUrl)}>Copy + Open {s.data.platform}</Button>
        </div>
      </Card>
    )
  }

  const v = ready.piece
  const hook = v.data.hooks[v.data.chosenHookIndex] || v.data.hooks[0]
  const fullScript = `Hook: ${hook}\n\n${v.data.segments.map((seg) => `[${seg.timestamp}] ${seg.content}`).join('\n\n')}\n\nCTA: ${v.data.cta}`
  return (
    <Card>
      <h3 className="font-serif text-lg mb-1">Today&apos;s Ready-to-Post Piece</h3>
      <p className="text-xs text-[var(--text-muted)] mb-3">Video script ({v.data.format}), approved from the {batch.date} batch.</p>
      <p className="text-sm font-medium mb-2">{hook}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={fullScript} />
        <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(fullScript, CANVA_VIDEO_URL)}>Copy Caption + Open Canva</Button>
        <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(hook, 'https://www.tiktok.com/upload')}>Copy + Open TikTok</Button>
      </div>
    </Card>
  )
}

// ---------- Main dashboard ----------

export default function DashboardTab() {
  const [index, setIndex] = useState<DraftsIndexEntry[] | null>(null)
  const [batch, setBatch] = useState<DailyBatch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/drafts', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load drafts.')
      const sorted = [...(data.index as DraftsIndexEntry[])].sort((a, b) => (a.date < b.date ? 1 : -1))
      setIndex(sorted)
      if (sorted.length > 0) {
        const batchRes = await fetch(`/api/drafts?date=${sorted[0].date}`, { cache: 'no-store' })
        const batchData = await batchRes.json()
        if (batchRes.ok) setBatch(batchData.batch as DailyBatch)
      } else {
        setBatch(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load drafts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const generateNow = async () => {
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('/api/drafts/generate-now', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed.')
      await load()
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Something went wrong generating today\'s content.')
    } finally {
      setGenerating(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const hasTodaysBatch = index?.some((e) => e.date === today)

  return (
    <div className="space-y-5">
      <Card>
        <Label>Today</Label>
        <h2 className="font-serif text-xl mb-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
        {loading && <p className="text-sm text-[var(--text-muted)] mt-2">Loading today&apos;s content…</p>}
        {error && <ErrorBox message={error} onRetry={load} />}
        {!loading && !error && !hasTodaysBatch && (
          <div className="mt-3 border border-dashed border-[var(--border)] rounded-lg p-5 text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-3">No content generated yet for today.</p>
            <Button variant="primary" loading={generating} onClick={generateNow}>
              {generating ? 'Generating…' : 'Generate Today\'s Content Now'}
            </Button>
            {generateError && <div className="mt-3"><ErrorBox message={generateError} onRetry={generateNow} /></div>}
          </div>
        )}
        {!loading && !error && hasTodaysBatch && batch && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Today&apos;s batch is ready — seed topic: <span className="font-medium text-[var(--text-primary)]">{batch.topic}</span>. See the Drafts Queue tab to review every piece.
          </p>
        )}
      </Card>

      <ReadyToPostSection batch={batch} />

      <div className="grid lg:grid-cols-2 gap-5">
        <TrendingTopicsSection />
        <ViralExamplesSection />
      </div>

      <AccountsSection />
    </div>
  )
}
