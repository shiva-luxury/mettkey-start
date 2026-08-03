'use client'

import { useState } from 'react'
import {
  Card, Label, Button, Input, SubTabs, CopyButton, BufferPostButton, ErrorBox, ComplianceWarning,
} from './ui'
import { callClaude, parseClaudeJSON } from '../lib/api'
import { withDisclaimer, COMPLIANCE_DISCLAIMER, NMLS, scanForComplianceRisks } from '../lib/constants'
import { getTodaysTopics } from '../lib/topics'

type InstagramResult = { caption: string; hashtags: string[] }
type CarouselResult = { slides: { headline: string; body: string }[]; caption: string }
type TikTokResult = { hook: string; script: string; onScreenText: string[] }
type LinkedInResult = { post: string }

function TopicPicker({ topic, setTopic }: { topic: string; setTopic: (t: string) => void }) {
  const topics = getTodaysTopics(6)
  return (
    <>
      <Label>Today&apos;s Suggested Topics</Label>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {topics.map((t) => (
          <button
            key={t.title}
            type="button"
            onClick={() => setTopic(t.title)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
              topic === t.title
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--ink-light)]'
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>
      <Label>Or type your own topic</Label>
      <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. CalHFA down payment assistance" className="mb-4" />
    </>
  )
}

export default function SocialTab() {
  const [subtab, setSubtab] = useState('instagram')
  return (
    <div>
      <SubTabs
        active={subtab}
        onChange={setSubtab}
        tabs={[
          { id: 'instagram', label: 'Instagram Caption' },
          { id: 'carousel', label: 'Carousel' },
          { id: 'tiktok', label: 'TikTok Script' },
          { id: 'linkedin', label: 'LinkedIn Post' },
        ]}
      />
      {subtab === 'instagram' && <InstagramTab />}
      {subtab === 'carousel' && <CarouselTab />}
      {subtab === 'tiktok' && <TikTokTab />}
      {subtab === 'linkedin' && <LinkedInTab />}
    </div>
  )
}

function InstagramTab() {
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState<InstagramResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim()) { setError('Pick or type a topic first.'); return }
    setLoading(true); setError(''); setResult(null); setFlags([])
    try {
      const prompt = `Write an Instagram caption for Mettkey, a California mortgage EDUCATION platform, on the topic: "${topic}".

Educational tone, not a sales pitch. Mettkey is not a lender or broker. Never guarantee a rate or approval. End the caption with the exact sentence: "${COMPLIANCE_DISCLAIMER}"

Return ONLY valid JSON: {"caption": string (100-150 words, includes the disclaimer sentence at the end), "hashtags": [string] (10-15 relevant CA mortgage/real estate education hashtags, each starting with #)}`
      const res = await callClaude(prompt, { maxTokens: 1200 })
      const parsed = parseClaudeJSON<InstagramResult>(res.text)
      if (!parsed.caption.includes(COMPLIANCE_DISCLAIMER)) parsed.caption = withDisclaimer(parsed.caption)
      setResult(parsed)
      setFlags(Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(parsed.caption)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const fullText = result ? `${result.caption}\n\n${result.hashtags.join(' ')}` : ''

  return (
    <div>
      <Card className="mb-6">
        <TopicPicker topic={topic} setTopic={setTopic} />
        <Button variant="primary" loading={loading} onClick={run}>{result ? 'Regenerate' : 'Generate Caption'}</Button>
      </Card>
      {error && <ErrorBox message={error} onRetry={run} />}
      <ComplianceWarning flags={flags} />
      {result && (
        <Card>
          <div className="flex justify-end gap-2 mb-2">
            <BufferPostButton text={fullText} />
            <CopyButton text={fullText} label="Copy Caption + Hashtags" />
          </div>
          <p className="text-sm whitespace-pre-wrap mb-3">{result.caption}</p>
          <p className="text-sm text-[var(--teal-dark)]">{result.hashtags.join(' ')}</p>
        </Card>
      )}
    </div>
  )
}

function CarouselTab() {
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState<CarouselResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim()) { setError('Pick or type a topic first.'); return }
    setLoading(true); setError(''); setResult(null); setFlags([])
    try {
      const prompt = `Write a 6-8 slide Instagram/LinkedIn carousel for Mettkey, a California mortgage EDUCATION platform, on the topic: "${topic}".

Each slide should be short (headline + 1-2 sentence body) and build on the last, ending with a slide that reinforces Mettkey as an educational resource (not a lender). Also write a caption for the carousel post that ends with the exact sentence: "${COMPLIANCE_DISCLAIMER}"

Return ONLY valid JSON: {"slides": [{"headline": string, "body": string}] (6-8 items), "caption": string}`
      const res = await callClaude(prompt, { maxTokens: 1800 })
      const parsed = parseClaudeJSON<CarouselResult>(res.text)
      if (!parsed.caption.includes(COMPLIANCE_DISCLAIMER)) parsed.caption = withDisclaimer(parsed.caption)
      setResult(parsed)
      const allText = parsed.slides.map((s) => `${s.headline} ${s.body}`).join(' ') + ' ' + parsed.caption
      setFlags(Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(allText)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const fullText = result
    ? `${result.slides.map((s, i) => `Slide ${i + 1}: ${s.headline}\n${s.body}`).join('\n\n')}\n\nCaption:\n${result.caption}`
    : ''

  return (
    <div>
      <Card className="mb-6">
        <TopicPicker topic={topic} setTopic={setTopic} />
        <Button variant="primary" loading={loading} onClick={run}>{result ? 'Regenerate' : 'Generate Carousel'}</Button>
      </Card>
      {error && <ErrorBox message={error} onRetry={run} />}
      <ComplianceWarning flags={flags} />
      {result && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <BufferPostButton text={result.caption} label="Post Caption via Buffer" />
            <CopyButton text={fullText} label="Copy Entire Carousel" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {result.slides.map((s, i) => (
              <Card key={i}>
                <p className="text-xs text-[var(--text-muted)] mb-1">Slide {i + 1}</p>
                <p className="font-serif text-lg mb-1">{s.headline}</p>
                <p className="text-sm text-[var(--text-secondary)]">{s.body}</p>
              </Card>
            ))}
          </div>
          <Card className="bg-[var(--surface)]">
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Caption</p>
            <p className="text-sm whitespace-pre-wrap">{result.caption}</p>
          </Card>
        </div>
      )}
    </div>
  )
}

function TikTokTab() {
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState<TikTokResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim()) { setError('Pick or type a topic first.'); return }
    setLoading(true); setError(''); setResult(null); setFlags([])
    try {
      const prompt = `Write a 30-45 second TikTok script for Mettkey, a California mortgage EDUCATION platform, on the topic: "${topic}".

The spoken script should NOT include license numbers or legal disclaimers — keep those out of the spoken words, exactly like keeping a DRE number out of a spoken real estate script. Educational, punchy, hook-first. Never state a guaranteed rate or guaranteed approval.

Return ONLY valid JSON: {"hook": string (first 3 seconds, attention-grabbing), "script": string (the full spoken script, no license numbers, no disclaimer), "onScreenText": [string] (3-5 short on-screen text overlays)}`
      const res = await callClaude(prompt, { maxTokens: 1200 })
      const parsed = parseClaudeJSON<TikTokResult>(res.text)
      setResult(parsed)
      setFlags(Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(parsed.hook + ' ' + parsed.script)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const descriptionNote = `${COMPLIANCE_DISCLAIMER}\n(Add to video description — not spoken. ${NMLS})`
  const fullScript = result ? `Hook: ${result.hook}\n\n${result.script}\n\nOn-screen text:\n${result.onScreenText.join('\n')}` : ''

  return (
    <div>
      <Card className="mb-6">
        <TopicPicker topic={topic} setTopic={setTopic} />
        <Button variant="primary" loading={loading} onClick={run}>{result ? 'Regenerate' : 'Generate Script'}</Button>
      </Card>
      {error && <ErrorBox message={error} onRetry={run} />}
      <ComplianceWarning flags={flags} />
      {result && (
        <div className="space-y-3">
          <div className="flex justify-end"><CopyButton text={fullScript} label="Copy Script" /></div>
          <Card>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Hook</p>
            <p className="text-sm mb-4 font-medium">{result.hook}</p>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Script (spoken)</p>
            <p className="text-sm whitespace-pre-wrap mb-4">{result.script}</p>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">On-screen text</p>
            <ul className="text-sm list-disc list-inside">
              {result.onScreenText.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Card>
          <Card className="bg-amber-50 border-amber-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-900 mb-1">Add to video description (not spoken)</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{descriptionNote}</p>
              </div>
              <CopyButton text={descriptionNote} label="Copy" />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function LinkedInTab() {
  const [topic, setTopic] = useState('')
  const [result, setResult] = useState<LinkedInResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim()) { setError('Pick or type a topic first.'); return }
    setLoading(true); setError(''); setResult(null); setFlags([])
    try {
      const prompt = `Write a LinkedIn post for Mettkey, a California mortgage EDUCATION platform owned by Shiva T. Mettke, on the topic: "${topic}".

Professional, educational tone aimed at CA homebuyers and industry peers. Mettkey is not a lender or broker. Never guarantee a rate or approval. End the post with the exact sentence: "${COMPLIANCE_DISCLAIMER}"

Return ONLY valid JSON: {"post": string (150-250 words, ends with the disclaimer sentence)}`
      const res = await callClaude(prompt, { maxTokens: 1200 })
      const parsed = parseClaudeJSON<LinkedInResult>(res.text)
      if (!parsed.post.includes(COMPLIANCE_DISCLAIMER)) parsed.post = withDisclaimer(parsed.post)
      setResult(parsed)
      setFlags(Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(parsed.post)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Card className="mb-6">
        <TopicPicker topic={topic} setTopic={setTopic} />
        <Button variant="primary" loading={loading} onClick={run}>{result ? 'Regenerate' : 'Generate Post'}</Button>
      </Card>
      {error && <ErrorBox message={error} onRetry={run} />}
      <ComplianceWarning flags={flags} />
      {result && (
        <Card>
          <div className="flex justify-end gap-2 mb-2">
            <BufferPostButton text={result.post} />
            <CopyButton text={result.post} />
          </div>
          <p className="text-sm whitespace-pre-wrap">{result.post}</p>
        </Card>
      )}
    </div>
  )
}
