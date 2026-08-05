'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Label, Button, CopyButton, ErrorBox, ComplianceWarning, Expandable } from './ui'
import { COMPLIANCE_DISCLAIMER } from '../lib/constants'
import type {
  DailyBatch,
  DraftStatus,
  DraftsIndexEntry,
  BlogDraft,
  VideoScriptDraft,
  SocialCaptionDraft,
  NewsletterDraft,
  CarouselDraft,
  ControversialIdeaDraft,
} from '../lib/drafts'

const CANVA_SOCIAL_URL = 'https://www.canva.com/create/instagram-posts/'
const CANVA_VIDEO_URL = 'https://www.canva.com/create/instagram-reels/'

function copyAndOpen(text: string, url: string) {
  navigator.clipboard.writeText(text).catch(() => {})
  window.open(url, '_blank', 'noopener,noreferrer')
}

// ---------- status update hook ----------

function useStatusUpdater(date: string, onUpdated: (batch: DailyBatch) => void) {
  const [pending, setPending] = useState<string | null>(null) // key of the piece currently updating
  const [error, setError] = useState('')

  const update = useCallback(
    async (pieceType: string, pieceIndex: number | null, status: DraftStatus) => {
      const key = `${pieceType}-${pieceIndex ?? 'x'}`
      setPending(key)
      setError('')
      try {
        const res = await fetch('/api/drafts/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, pieceType, pieceIndex, status }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update status.')
        onUpdated(data.batch as DailyBatch)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong updating status.')
      } finally {
        setPending(null)
      }
    },
    [date, onUpdated]
  )

  return { update, pending, error }
}

// ---------- Approve/Skip control bar ----------

function ApproveSkipBar({
  status,
  flagged,
  busy,
  onApprove,
  onSkip,
}: {
  status: DraftStatus
  flagged: boolean
  busy: boolean
  onApprove: () => void
  onSkip: () => void
}) {
  const [confirmArmed, setConfirmArmed] = useState(false)

  if (status === 'approved') {
    return <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium">Approved</span>
  }
  if (status === 'skipped') {
    return <span className="text-xs px-2.5 py-1 rounded-md bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] font-medium">Skipped</span>
  }

  const handleApproveClick = () => {
    if (flagged && !confirmArmed) {
      setConfirmArmed(true)
      return
    }
    setConfirmArmed(false)
    onApprove()
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" loading={busy} onClick={onSkip} className="!py-1 !px-2.5 text-xs">
        Skip
      </Button>
      <Button
        variant={flagged ? 'outline' : 'primary'}
        loading={busy}
        onClick={handleApproveClick}
        className={`!py-1 !px-2.5 text-xs ${flagged ? 'border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100' : ''}`}
      >
        {flagged ? (confirmArmed ? 'Click again to confirm ⚠' : 'Approve Anyway ⚠') : 'Approve'}
      </Button>
    </div>
  )
}

// ---------- Blog card ----------

function BlogCard({ blog, date, update, pending }: { blog: BlogDraft; date: string; update: ReturnType<typeof useStatusUpdater>['update']; pending: string | null }) {
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle')
  const [publishError, setPublishError] = useState('')
  const [publishResult, setPublishResult] = useState<{ commitUrl: string | null; fileUrl: string | null } | null>(null)
  const wordCount = blog.data.body.join(' ').split(/\s+/).filter(Boolean).length
  const fullText = `${blog.data.title}\n\n${blog.data.body.join('\n\n')}`

  const publish = async () => {
    setPublishState('publishing')
    setPublishError('')
    setPublishResult(null)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: blog.data.slug,
          title: blog.data.title,
          metaTitle: blog.data.metaTitle,
          metaDescription: blog.data.metaDescription,
          keyword: blog.data.keyword,
          date,
          excerpt: blog.data.excerpt,
          category: blog.data.category,
          image: blog.data.image,
          body: blog.data.body,
          internalLinks: blog.data.internalLinks,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Publish failed (${res.status}).`)
      setPublishResult({ commitUrl: data.commitUrl, fileUrl: data.fileUrl })
      setPublishState('done')
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Something went wrong publishing.')
      setPublishState('error')
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-[var(--teal-dark)] uppercase tracking-wide mb-1">Blog Post</p>
          <h3 className="font-serif text-xl">{blog.data.title}</h3>
        </div>
        <ApproveSkipBar
          status={blog.status}
          flagged={blog.complianceFlags.length > 0}
          busy={pending === 'blog-x'}
          onApprove={() => update('blog', null, 'approved')}
          onSkip={() => update('blog', null, 'skipped')}
        />
      </div>
      <ComplianceWarning flags={blog.complianceFlags} />
      <p className="text-sm text-[var(--text-secondary)] italic mb-2">{blog.data.excerpt}</p>
      <p className="text-xs text-[var(--text-muted)] mb-3">{wordCount} words · {blog.data.category} · Keyword: {blog.data.keyword}</p>
      <Expandable title="Full body" copyText={fullText}>
        <div className="pt-3 space-y-3 text-sm leading-relaxed">
          {blog.data.body.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </Expandable>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <CopyButton text={fullText} />
        {blog.status === 'approved' && (
          <Button variant="primary" loading={publishState === 'publishing'} onClick={publish} className="!py-1 !px-2.5 text-xs">
            {publishState === 'publishing' ? 'Publishing…' : publishState === 'done' ? 'Published — Publish Again' : 'Publish to mettkey.com'}
          </Button>
        )}
      </div>
      {publishState === 'error' && <div className="mt-2"><ErrorBox message={publishError} onRetry={publish} /></div>}
      {publishState === 'done' && publishResult && (
        <div className="mt-2 border-2 border-emerald-400 bg-emerald-50 text-emerald-900 text-sm rounded-lg px-4 py-3">
          <p className="font-semibold mb-1">Published to mettkey-site.</p>
          <div className="flex gap-3 mt-1">
            {publishResult.commitUrl && <a href={publishResult.commitUrl} target="_blank" rel="noopener noreferrer" className="underline">View commit</a>}
            {publishResult.fileUrl && <a href={publishResult.fileUrl} target="_blank" rel="noopener noreferrer" className="underline">View file</a>}
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------- Video card ----------

function VideoCard({ video, index, update, pending }: { video: VideoScriptDraft; index: number; update: ReturnType<typeof useStatusUpdater>['update']; pending: string | null }) {
  const [hookIndex, setHookIndex] = useState(video.data.chosenHookIndex)
  const chosenHook = video.data.hooks[hookIndex] || video.data.hooks[0]
  const fullScript = `Hook: ${chosenHook}\n\n${video.data.segments.map((s) => `[${s.timestamp}] ${s.label}\n${s.content}`).join('\n\n')}\n\nOn-screen text:\n${video.data.onScreenText.join('\n')}\n\nCTA: ${video.data.cta}`

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-[var(--teal-dark)] uppercase tracking-wide mb-1">Video Script · {video.data.format}</p>
          <h3 className="font-serif text-lg">{chosenHook}</h3>
        </div>
        <ApproveSkipBar
          status={video.status}
          flagged={video.complianceFlags.length > 0}
          busy={pending === `video-${index}`}
          onApprove={() => update('video', index, 'approved')}
          onSkip={() => update('video', index, 'skipped')}
        />
      </div>
      <ComplianceWarning flags={video.complianceFlags} />

      <Label>Hook options — pick one</Label>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {video.data.hooks.map((h, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setHookIndex(i)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all max-w-full text-left ${
              hookIndex === i ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--ink-light)]'
            }`}
          >
            {h}
          </button>
        ))}
      </div>

      <Expandable title="Full script" copyText={fullScript} defaultOpen>
        <div className="pt-3 space-y-3">
          {video.data.segments.map((s, i) => (
            <div key={i} className="border-l-2 border-[var(--teal)] pl-3">
              <p className="text-xs font-semibold text-[var(--teal-dark)] mb-1">{s.timestamp} — {s.label}</p>
              <p className="text-sm whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">On-screen text</p>
            <ul className="text-sm list-disc list-inside">{video.data.onScreenText.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          <p className="text-sm"><span className="font-semibold">CTA:</span> {video.data.cta}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <p className="text-xs bg-[var(--surface)] rounded-lg p-3"><span className="font-semibold block mb-1">B-roll shot list</span>{video.data.brollShotList.join(' · ')}</p>
            <p className="text-xs bg-[var(--surface)] rounded-lg p-3"><span className="font-semibold block mb-1">Audio style suggestion (AI-suggested vibe, not a live trending-audio lookup)</span>{video.data.audioStyleSuggestion}</p>
          </div>
        </div>
      </Expandable>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Card className="bg-[var(--surface)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[var(--text-muted)]">HeyGen script (plain monologue)</p>
            <div className="flex gap-1.5">
              <CopyButton text={video.data.heygenScript} label="Copy for HeyGen" />
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap mb-2">{video.data.heygenScript}</p>
          <a href="https://www.heygen.com" target="_blank" rel="noopener noreferrer" className="text-xs underline text-[var(--teal-dark)]">Open HeyGen</a>
        </Card>
        <Card className="bg-[var(--surface)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[var(--text-muted)]">CapCut notes (timing + on-screen text cues)</p>
            <CopyButton text={video.data.capcutNotes} label="Copy for CapCut" />
          </div>
          <p className="text-sm whitespace-pre-wrap mb-2">{video.data.capcutNotes}</p>
          <a href="https://www.capcut.com" target="_blank" rel="noopener noreferrer" className="text-xs underline text-[var(--teal-dark)]">Open CapCut</a>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(fullScript, CANVA_VIDEO_URL)}>
          Copy Caption + Open Canva
        </Button>
        <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(chosenHook + '\n\n' + video.data.cta, 'https://www.tiktok.com/upload')}>
          Copy + Open TikTok
        </Button>
      </div>
    </Card>
  )
}

// ---------- Social card ----------

const PLATFORM_URLS: Record<string, string> = {
  Instagram: 'https://www.instagram.com/',
  LinkedIn: 'https://www.linkedin.com/feed/?shareActive=true',
  Facebook: 'https://www.facebook.com/mettkey/',
}

function SocialCard({ social, index, update, pending }: { social: SocialCaptionDraft; index: number; update: ReturnType<typeof useStatusUpdater>['update']; pending: string | null }) {
  const fullText = social.data.hashtags.length ? `${social.data.caption}\n\n${social.data.hashtags.join(' ')}` : social.data.caption
  const platformUrl = PLATFORM_URLS[social.data.platform] || 'https://www.google.com'

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <p className="text-xs font-semibold text-[var(--teal-dark)] uppercase tracking-wide">{social.data.platform} Caption</p>
        <ApproveSkipBar
          status={social.status}
          flagged={social.complianceFlags.length > 0}
          busy={pending === `social-${index}`}
          onApprove={() => update('social', index, 'approved')}
          onSkip={() => update('social', index, 'skipped')}
        />
      </div>
      <ComplianceWarning flags={social.complianceFlags} />
      <p className="text-sm whitespace-pre-wrap mb-2">{social.data.caption}</p>
      {social.data.hashtags.length > 0 && <p className="text-sm text-[var(--teal-dark)] mb-3">{social.data.hashtags.join(' ')}</p>}
      <div className="flex flex-wrap gap-2">
        <CopyButton text={fullText} />
        <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(fullText, CANVA_SOCIAL_URL)}>
          Copy Caption + Open Canva
        </Button>
        <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(fullText, platformUrl)}>
          Copy + Open {social.data.platform}
        </Button>
      </div>
    </Card>
  )
}

// ---------- Newsletter card ----------

function NewsletterCard({ newsletter, update, pending }: { newsletter: NewsletterDraft; update: ReturnType<typeof useStatusUpdater>['update']; pending: string | null }) {
  const fullText = `Subject line options:\n${newsletter.data.subjectLines.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nPreheader: ${newsletter.data.preheader}\n\n---\n\n${newsletter.data.bodyHtml}`
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <p className="text-xs font-semibold text-[var(--teal-dark)] uppercase tracking-wide">Newsletter</p>
        <ApproveSkipBar
          status={newsletter.status}
          flagged={newsletter.complianceFlags.length > 0}
          busy={pending === 'newsletter-x'}
          onApprove={() => update('newsletter', null, 'approved')}
          onSkip={() => update('newsletter', null, 'skipped')}
        />
      </div>
      <ComplianceWarning flags={newsletter.complianceFlags} />
      <Label>Subject line options</Label>
      <ul className="text-sm space-y-1 mb-2">
        {newsletter.data.subjectLines.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2 border-b border-[var(--border)] last:border-0 pb-1 last:pb-0">
            <span>{s}</span>
            <CopyButton text={s} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-muted)] mb-3">Preheader: {newsletter.data.preheader}</p>
      <Expandable title="Email body preview" copyText={newsletter.data.bodyHtml}>
        <div className="pt-3 bg-[var(--surface)] rounded-lg p-4 text-sm" dangerouslySetInnerHTML={{ __html: newsletter.data.bodyHtml }} />
      </Expandable>
      <div className="mt-3"><CopyButton text={fullText} label="Copy Everything" /></div>
    </Card>
  )
}

// ---------- Carousel card ----------

function CarouselCard({ carousel, update, pending }: { carousel: CarouselDraft; update: ReturnType<typeof useStatusUpdater>['update']; pending: string | null }) {
  const fullText = `${carousel.data.slides.map((s, i) => `Slide ${i + 1}: ${s.headline}\n${s.body}`).join('\n\n')}\n\nCaption:\n${carousel.data.caption}`
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <p className="text-xs font-semibold text-[var(--teal-dark)] uppercase tracking-wide">Carousel</p>
        <ApproveSkipBar
          status={carousel.status}
          flagged={carousel.complianceFlags.length > 0}
          busy={pending === 'carousel-x'}
          onApprove={() => update('carousel', null, 'approved')}
          onSkip={() => update('carousel', null, 'skipped')}
        />
      </div>
      <ComplianceWarning flags={carousel.complianceFlags} />
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        {carousel.data.slides.map((s, i) => (
          <div key={i} className="border border-[var(--border)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">Slide {i + 1}</p>
            <p className="font-serif text-base mb-1">{s.headline}</p>
            <p className="text-sm text-[var(--text-secondary)]">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">Caption</p>
      <p className="text-sm whitespace-pre-wrap mb-3">{carousel.data.caption}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={fullText} label="Copy Everything" />
        <Button variant="outline" className="!py-1 !px-2.5 text-xs" onClick={() => copyAndOpen(carousel.data.caption, CANVA_SOCIAL_URL)}>
          Copy Caption + Open Canva
        </Button>
      </div>
    </Card>
  )
}

// ---------- Controversial idea card ----------

function ControversialCard({ idea, index, update, pending }: { idea: ControversialIdeaDraft; index: number; update: ReturnType<typeof useStatusUpdater>['update']; pending: string | null }) {
  const fullText = `${idea.data.hook}\n\n${idea.data.body}`
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <p className="text-xs font-semibold text-[var(--teal-dark)] uppercase tracking-wide">Controversial-but-True Idea</p>
        <ApproveSkipBar
          status={idea.status}
          flagged={idea.complianceFlags.length > 0}
          busy={pending === `controversial-${index}`}
          onApprove={() => update('controversial', index, 'approved')}
          onSkip={() => update('controversial', index, 'skipped')}
        />
      </div>
      <ComplianceWarning flags={idea.complianceFlags} />
      <p className="font-serif text-lg mb-1">{idea.data.hook}</p>
      <p className="text-sm text-[var(--text-secondary)] mb-3">{idea.data.body}</p>
      <CopyButton text={fullText} />
    </Card>
  )
}

// ---------- CSV export ----------

type ApprovedPiece = { platform: string; content: string; hashtags: string }

function collectApprovedPieces(batches: DailyBatch[]): ApprovedPiece[] {
  const pieces: ApprovedPiece[] = []
  for (const batch of batches) {
    for (const s of batch.socials) {
      if (s.status === 'approved') pieces.push({ platform: s.data.platform, content: s.data.caption, hashtags: s.data.hashtags.join(' ') })
    }
    for (const v of batch.videos) {
      if (v.status === 'approved') {
        const hook = v.data.hooks[v.data.chosenHookIndex] || v.data.hooks[0]
        pieces.push({ platform: 'Video', content: `${hook} — ${v.data.cta}`, hashtags: '' })
      }
    }
    if (batch.carousel.status === 'approved') {
      pieces.push({ platform: 'Carousel', content: batch.carousel.data.caption, hashtags: '' })
    }
  }
  return pieces
}

/** Tue/Wed/Thu at 7am, 12pm, 6pm PST, cycling through approved pieces in order. */
function buildSchedule(count: number): { date: string; time: string }[] {
  const days = ['Tue', 'Wed', 'Thu']
  const times = ['7:00 AM', '12:00 PM', '6:00 PM']
  const slots: { date: string; time: string }[] = []
  // Find the next upcoming Tue/Wed/Thu (or today if it qualifies) to anchor the rotation.
  const today = new Date()
  let cursor = new Date(today)
  const dayIndexMap: Record<number, string> = { 2: 'Tue', 3: 'Wed', 4: 'Thu' }
  let weekOffset = 0
  while (slots.length < count) {
    const d = new Date(cursor)
    d.setDate(cursor.getDate() + weekOffset)
    const label = dayIndexMap[d.getDay()]
    if (label) {
      for (const t of times) {
        if (slots.length >= count) break
        slots.push({ date: d.toISOString().slice(0, 10), time: `${t} PST` })
      }
    }
    weekOffset++
  }
  void days
  return slots
}

function downloadCSV(pieces: ApprovedPiece[]) {
  const schedule = buildSchedule(pieces.length)
  const header = ['Platform', 'Content', 'Hashtags', 'Scheduled Date', 'Scheduled Time']
  const rows = pieces.map((p, i) => [
    p.platform,
    p.content.replace(/"/g, '""'),
    p.hashtags.replace(/"/g, '""'),
    schedule[i]?.date || '',
    schedule[i]?.time || '',
  ])
  const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mettkey-buffer-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function ExportWeekButton({ index }: { index: DraftsIndexEntry[] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const last7 = [...index].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7)
      const batches: DailyBatch[] = []
      for (const entry of last7) {
        const res = await fetch(`/api/drafts?date=${entry.date}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.batch) batches.push(data.batch as DailyBatch)
        }
      }
      const pieces = collectApprovedPieces(batches)
      if (pieces.length === 0) {
        setError('No approved social/video/carousel pieces found in the last 7 available batches yet.')
        return
      }
      downloadCSV(pieces)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong building the export.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6">
      <Button variant="outline" loading={loading} onClick={run}>Export This Week to Buffer CSV</Button>
      <p className="text-xs text-[var(--text-muted)] mt-1.5">
        Column headers may need adjusting to match your current Buffer import template — verify against Buffer&apos;s bulk-upload format before importing.
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ---------- Main tab ----------

export default function DraftsQueueTab() {
  const [index, setIndex] = useState<DraftsIndexEntry[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [batch, setBatch] = useState<DailyBatch | null>(null)
  const [loadingIndex, setLoadingIndex] = useState(false)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const loadIndex = useCallback(async () => {
    setLoadingIndex(true)
    setError('')
    try {
      const res = await fetch('/api/drafts', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load drafts index.')
      const sorted = [...(data.index as DraftsIndexEntry[])].sort((a, b) => (a.date < b.date ? 1 : -1))
      setIndex(sorted)
      if (sorted.length > 0) setSelectedDate((prev) => prev || sorted[0].date)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load drafts index.')
    } finally {
      setLoadingIndex(false)
    }
  }, [])

  const loadBatch = useCallback(async (date: string) => {
    if (!date) return
    setLoadingBatch(true)
    setError('')
    try {
      const res = await fetch(`/api/drafts?date=${date}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to load draft batch for ${date}.`)
      setBatch(data.batch as DailyBatch)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load draft batch.')
      setBatch(null)
    } finally {
      setLoadingBatch(false)
    }
  }, [])

  useEffect(() => {
    loadIndex()
  }, [loadIndex])

  useEffect(() => {
    if (selectedDate) loadBatch(selectedDate)
  }, [selectedDate, loadBatch])

  const { update, pending, error: updateError } = useStatusUpdater(selectedDate, setBatch)

  const generateNow = async () => {
    setGenerating(true)
    setGenerateError('')
    try {
      const res = await fetch('/api/drafts/generate-now', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed.')
      await loadIndex()
      setSelectedDate(data.date)
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Something went wrong generating today\'s batch.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-serif text-lg mb-1">Drafts Queue</h2>
            <p className="text-sm text-[var(--text-secondary)]">Review each day&apos;s auto-generated batch, approve or skip pieces, then copy or publish.</p>
          </div>
          <Button variant="primary" loading={generating} onClick={generateNow}>
            {generating ? 'Generating…' : 'Generate Now'}
          </Button>
        </div>
        {generateError && <ErrorBox message={generateError} onRetry={generateNow} />}
        {loadingIndex && index.length === 0 && <p className="text-sm text-[var(--text-muted)]">Loading available dates…</p>}
        {index.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {index.map((entry) => (
              <button
                key={entry.date}
                type="button"
                onClick={() => setSelectedDate(entry.date)}
                title={entry.topic}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                  selectedDate === entry.date ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--ink-light)]'
                }`}
              >
                {entry.date}
              </button>
            ))}
          </div>
        )}
        {!loadingIndex && index.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No batches generated yet — click &quot;Generate Now&quot; to create today&apos;s.</p>
        )}
      </Card>

      {error && <ErrorBox message={error} onRetry={() => loadBatch(selectedDate)} />}
      {updateError && <ErrorBox message={updateError} />}

      {index.length > 0 && <ExportWeekButton index={index} />}

      {loadingBatch && <p className="text-sm text-[var(--text-muted)]">Loading {selectedDate}…</p>}

      {batch && !loadingBatch && (
        <div className="space-y-5">
          <Card className="bg-[var(--surface)]">
            <p className="text-xs text-[var(--text-muted)]">Batch for {batch.date} · Seed topic: <span className="font-medium text-[var(--text-primary)]">{batch.topic}</span> · Generated {new Date(batch.generatedAt).toLocaleString('en-US')}</p>
          </Card>

          <BlogCard blog={batch.blog} date={batch.date} update={update} pending={pending} />

          {batch.videos.map((v, i) => (
            <VideoCard key={i} video={v} index={i} update={update} pending={pending} />
          ))}

          <div className="grid md:grid-cols-3 gap-4">
            {batch.socials.map((s, i) => (
              <SocialCard key={i} social={s} index={i} update={update} pending={pending} />
            ))}
          </div>

          <NewsletterCard newsletter={batch.newsletter} update={update} pending={pending} />

          <CarouselCard carousel={batch.carousel} update={update} pending={pending} />

          <div className="grid md:grid-cols-3 gap-4">
            {batch.controversial.map((c, i) => (
              <ControversialCard key={i} idea={c} index={i} update={update} pending={pending} />
            ))}
          </div>

          <p className="text-xs text-[var(--text-muted)]">{COMPLIANCE_DISCLAIMER}</p>
        </div>
      )}
    </div>
  )
}
