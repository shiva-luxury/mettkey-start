'use client'

import { useState } from 'react'
import {
  Card, Label, Button, Input, Textarea, CopyButton, BufferPostButton, Expandable, ErrorBox, ComplianceWarning,
} from './ui'
import { callClaude, parseClaudeJSON } from '../lib/api'
import { withDisclaimer, COMPLIANCE_DISCLAIMER, NMLS, scanForComplianceRisks } from '../lib/constants'
import { getTodaysTopics } from '../lib/topics'

type Batch1 = {
  instagramCaption: { caption: string; hashtags: string[] }
  instagramCarousel: { slides: { headline: string; body: string }[]; caption: string }
  tiktokScript: { hook: string; script: string; onScreenText: string[] }
  linkedinPost: string
  xPost: string
}

type Batch2 = {
  facebookPost: string
  youtubeShorts: { hook: string; script: string; onScreenText: string[] }
  emailNewsletter: { subject: string; bodyHtml: string }
  smsMessage: string
  blogSeoSummary: { title: string; metaDescription: string; focusKeyword: string; internalLinks: string[] }
}

type AllResult = Batch1 & Batch2

function context(topic: string, source: string): string {
  return `TOPIC: ${topic}${source ? `\n\nSOURCE CONTENT / NOTES:\n${source}` : ''}`
}

function buildBatch1Prompt(topic: string, source: string): string {
  return `Repurpose the following California mortgage education topic into platform-native pieces for Mettkey, a California mortgage EDUCATION platform (never a lender or broker, never claims to originate/approve loans).

${context(topic, source)}

Generate exactly these 5 pieces:
1. instagramCaption: an Instagram caption (100-150 words) plus 10-15 hashtags.
2. instagramCarousel: a 6-8 slide carousel, each slide with a headline and 1-2 sentence body, plus a caption for the post.
3. tiktokScript: a 30-45 second TikTok script — hook, full spoken script (no license numbers, no disclaimer spoken), 3-5 on-screen text overlays.
4. linkedinPost: a professional, educational LinkedIn post (150-250 words).
5. xPost: one punchy post under 280 characters.

Never guarantee a rate or approval. Educational tone throughout.

Return ONLY valid JSON, no prose before or after, matching exactly this schema:
{
  "instagramCaption": {"caption": string, "hashtags": [string]},
  "instagramCarousel": {"slides": [{"headline": string, "body": string}] (6-8 items), "caption": string},
  "tiktokScript": {"hook": string, "script": string, "onScreenText": [string]},
  "linkedinPost": string,
  "xPost": string
}`
}

function buildBatch2Prompt(topic: string, source: string): string {
  return `Repurpose the following California mortgage education topic into the remaining formats for Mettkey, a California mortgage EDUCATION platform (never a lender or broker, never claims to originate/approve loans).

${context(topic, source)}

Generate exactly these 5 pieces:
1. facebookPost: a conversational, community-focused Facebook post.
2. youtubeShorts: a 60-second vertical YouTube Shorts script — hook, full script, 3-5 on-screen text overlays.
3. emailNewsletter: a subject line and full HTML email body (~250 words, semantic HTML only, no external stylesheets/scripts) ready to paste into an email tool. The body must include, in a <p> tag, the exact sentence "${COMPLIANCE_DISCLAIMER}"
4. smsMessage: a friendly SMS under 160 characters linking to mettkey.com.
5. blogSeoSummary: a meta title, meta description, focus keyword, and 3 suggested internal link topics for a blog post on this subject.

Never guarantee a rate or approval. Educational tone throughout.

Return ONLY valid JSON, no prose before or after, matching exactly this schema:
{
  "facebookPost": string,
  "youtubeShorts": {"hook": string, "script": string, "onScreenText": [string]},
  "emailNewsletter": {"subject": string, "bodyHtml": string},
  "smsMessage": string,
  "blogSeoSummary": {"title": string, "metaDescription": string, "focusKeyword": string, "internalLinks": [string] (exactly 3)}
}`
}

export default function GenerateAllTab() {
  const todaysTopics = getTodaysTopics(6)
  const [topic, setTopic] = useState('')
  const [source, setSource] = useState('')
  const [result, setResult] = useState<AllResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim()) { setError('Enter a topic first.'); return }
    setLoading(true)
    setError('')
    setResult(null)
    setFlags([])
    try {
      const [res1, res2] = await Promise.all([
        callClaude(buildBatch1Prompt(topic, source), { maxTokens: 4000 }),
        callClaude(buildBatch2Prompt(topic, source), { maxTokens: 3000 }),
      ])
      const b1 = parseClaudeJSON<Batch1>(res1.text)
      const b2 = parseClaudeJSON<Batch2>(res2.text)

      if (!b2.emailNewsletter.bodyHtml.includes(COMPLIANCE_DISCLAIMER)) {
        b2.emailNewsletter.bodyHtml = `${b2.emailNewsletter.bodyHtml}\n<p>${COMPLIANCE_DISCLAIMER}</p>`
      }

      const merged = { ...b1, ...b2 }
      setResult(merged)

      const allText = [
        b1.instagramCaption.caption, b1.instagramCarousel.caption, b1.tiktokScript.script,
        b1.linkedinPost, b1.xPost, b2.facebookPost, b2.youtubeShorts.script, b2.emailNewsletter.bodyHtml, b2.smsMessage,
      ].join(' ')
      setFlags(Array.from(new Set([...res1.complianceFlags, ...res2.complianceFlags, ...scanForComplianceRisks(allText)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const linkedinFull = result ? withDisclaimer(result.linkedinPost) : ''
  const facebookFull = result ? withDisclaimer(result.facebookPost) : ''
  const instagramFull = result ? `${withDisclaimer(result.instagramCaption.caption)}\n\n${result.instagramCaption.hashtags.join(' ')}` : ''
  const xFull = result ? result.xPost : ''
  const scriptDescriptionNote = `${COMPLIANCE_DISCLAIMER}\n(Add to video description — not spoken. ${NMLS})`

  const pieces = result
    ? [
        { title: 'Instagram Caption + Hashtags', text: instagramFull },
        { title: 'Instagram Carousel', text: `${result.instagramCarousel.slides.map((s, i) => `Slide ${i + 1}: ${s.headline}\n${s.body}`).join('\n\n')}\n\nCaption:\n${withDisclaimer(result.instagramCarousel.caption)}` },
        { title: 'TikTok Script', text: `Hook: ${result.tiktokScript.hook}\n\n${result.tiktokScript.script}\n\nOn-screen text:\n${result.tiktokScript.onScreenText.join('\n')}\n\n${scriptDescriptionNote}` },
        { title: 'LinkedIn Post', text: linkedinFull },
        { title: 'X / Twitter Post', text: xFull },
        { title: 'Facebook Post', text: facebookFull },
        { title: 'YouTube Shorts Script', text: `Hook: ${result.youtubeShorts.hook}\n\n${result.youtubeShorts.script}\n\nOn-screen text:\n${result.youtubeShorts.onScreenText.join('\n')}\n\n${scriptDescriptionNote}` },
        { title: 'Email Newsletter', text: `Subject: ${result.emailNewsletter.subject}\n\n${result.emailNewsletter.bodyHtml}` },
        { title: 'SMS Message', text: result.smsMessage },
        { title: 'Blog SEO Summary', text: `Title: ${result.blogSeoSummary.title}\nMeta description: ${result.blogSeoSummary.metaDescription}\nFocus keyword: ${result.blogSeoSummary.focusKeyword}\nInternal link topics: ${result.blogSeoSummary.internalLinks.join(', ')}` },
      ]
    : null

  const exportAll = () => (pieces ? pieces.map((p) => `${p.title}\n${p.text}`).join('\n\n---\n\n') : '')

  return (
    <div>
      <Card className="mb-6">
        <h2 className="font-serif text-lg mb-1">Generate All — 10 Pieces From One Topic</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">One topic, one click, a full spread of mortgage-education content across every platform — all compliance-checked, ready to copy or post.</p>

        <Label>Today&apos;s Suggested Topics</Label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {todaysTopics.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => setTopic(t.title)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${topic === t.title ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--ink-light)]'}`}
            >
              {t.title}
            </button>
          ))}
        </div>

        <Label>Topic *</Label>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. CalHFA MyHome Assistance Program explained" className="mb-4" />

        <Label>Source Content (optional — paste a title + body to repurpose instead)</Label>
        <Textarea value={source} onChange={(e) => setSource(e.target.value)} className="mb-4 min-h-[100px]" placeholder="Optional — paste blog content or notes to repurpose from." />

        <Button variant="primary" loading={loading} onClick={run}>{result ? 'Regenerate All 10 Pieces' : 'Generate All 10 Pieces'}</Button>
      </Card>

      {error && <ErrorBox message={error} onRetry={run} />}
      <ComplianceWarning flags={flags} />

      {pieces && (
        <div className="space-y-4">
          <div className="flex justify-end"><CopyButton text={exportAll()} label="Copy Everything" /></div>

          <Expandable title="1. Instagram Caption + Hashtags" copyText={instagramFull} defaultOpen>
            <div className="pt-3 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{instagramFull}</p>
              <BufferPostButton text={instagramFull} />
            </div>
          </Expandable>

          <Expandable title="2. Instagram Carousel" copyText={pieces[1].text}>
            <div className="pt-3 space-y-2 text-sm whitespace-pre-wrap">{pieces[1].text}</div>
          </Expandable>

          <Expandable title="3. TikTok Script" copyText={pieces[2].text}>
            <div className="pt-3 text-sm whitespace-pre-wrap">{pieces[2].text}</div>
          </Expandable>

          <Expandable title="4. LinkedIn Post" copyText={linkedinFull}>
            <div className="pt-3 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{linkedinFull}</p>
              <BufferPostButton text={linkedinFull} />
            </div>
          </Expandable>

          <Expandable title="5. X / Twitter Post" copyText={xFull}>
            <div className="pt-3 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{xFull}</p>
              <BufferPostButton text={xFull} />
            </div>
          </Expandable>

          <Expandable title="6. Facebook Post" copyText={facebookFull}>
            <div className="pt-3 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{facebookFull}</p>
              <BufferPostButton text={facebookFull} />
            </div>
          </Expandable>

          <Expandable title="7. YouTube Shorts Script" copyText={pieces[6].text}>
            <div className="pt-3 text-sm whitespace-pre-wrap">{pieces[6].text}</div>
          </Expandable>

          <Expandable title="8. Email Newsletter" copyText={pieces[7].text}>
            <div className="pt-3 text-sm whitespace-pre-wrap">{pieces[7].text}</div>
          </Expandable>

          <Expandable title="9. SMS Message" copyText={pieces[8].text}>
            <div className="pt-3 text-sm whitespace-pre-wrap">{pieces[8].text}</div>
          </Expandable>

          <Expandable title="10. Blog SEO Summary" copyText={pieces[9].text}>
            <div className="pt-3 text-sm whitespace-pre-wrap">{pieces[9].text}</div>
          </Expandable>
        </div>
      )}
    </div>
  )
}
