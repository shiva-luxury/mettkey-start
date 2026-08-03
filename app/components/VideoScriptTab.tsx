'use client'

import { useState } from 'react'
import {
  Card, Label, Button, Input, SingleSelectChips, CopyButton, ErrorBox, ComplianceWarning,
} from './ui'
import { callClaude, parseClaudeJSON } from '../lib/api'
import { COMPLIANCE_DISCLAIMER, NMLS, scanForComplianceRisks } from '../lib/constants'
import { getTodaysTopics } from '../lib/topics'

export type LengthId = '60s' | '3m' | '5m'
export type FormatId = 'talking-head' | 'text-overlay' | 'myth-busting' | 'qa'

const LENGTHS: { id: LengthId; label: string; sub: string }[] = [
  { id: '60s', label: '60 Seconds', sub: 'Short form — TikTok, Reels, YouTube Shorts' },
  { id: '3m', label: '3 Minutes', sub: 'Medium — YouTube, Facebook, LinkedIn video' },
  { id: '5m', label: '5 Minutes', sub: 'Long form — YouTube deep dive, needs a title + description' },
]

const FORMATS: { id: FormatId; label: string; description: string }[] = [
  { id: 'talking-head', label: 'Talking Head Explainer', description: 'Straight-to-camera explanation of a mortgage concept, punchy and direct.' },
  { id: 'text-overlay', label: 'Text Overlay Facts', description: 'No face, no voiceover — just short bold on-screen text facts over B-roll.' },
  { id: 'myth-busting', label: 'Myth Busting', description: 'Opens with "MYTH: ..." — a common mortgage misconception — then busts it with facts.' },
  { id: 'qa', label: 'Q&A', description: 'Opens with "You asked: ..." — a real borrower question — then answers it clearly.' },
]

function lengthMeta(id: LengthId) {
  return LENGTHS.find((l) => l.id === id)!
}
function formatMeta(id: FormatId) {
  return FORMATS.find((f) => f.id === id)!
}

type ScriptSegment = { timestamp: string; label: string; content: string }

type ScriptResult = {
  hook: string
  segments: ScriptSegment[]
  onScreenText: string[]
  ctas: { at: string; text: string }[]
  hashtags: string[]
  viewerQuestion: string
  mythStatement: string
  youtubeTitle: string
  youtubeDescription: string
}

type WinningResearch = {
  topHooks: { hook: string; source: string }[]
  winningFactors: { emotionalTrigger: string; pacing: string; structure: string }
  algorithmSignal: string
}

function buildResearchPrompt(length: LengthId, format: FormatId, topic: string): string {
  const { label } = lengthMeta(length)
  const { label: formatLabel } = formatMeta(format)
  return `Using live web search, research what is winning in mortgage/personal-finance short-form and long-form video content RIGHT NOW (this week) on TikTok, Instagram Reels, and YouTube.

Find:
1. The top 3 hooks currently winning in mortgage/finance education video content suited to a ${label} "${formatLabel}" style.
2. What makes those hooks and scripts work: emotional trigger, pacing, structure.
3. What the algorithm is currently rewarding for ${label} content in this style, for the topic "${topic}".

Return ONLY valid JSON, no prose before or after:
{
  "topHooks": [{"hook": string, "source": string}] (exactly 3),
  "winningFactors": {"emotionalTrigger": string, "pacing": string, "structure": string},
  "algorithmSignal": string
}`
}

function formatRequirements(format: FormatId): string {
  switch (format) {
    case 'talking-head':
      return `FORMAT: Talking Head Explainer — every segment is spoken directly to camera, conversational and direct, like a knowledgeable friend explaining something, never a corporate ad.`
    case 'text-overlay':
      return `FORMAT: Text Overlay Facts — no face, no voiceover. Every segment's "content" field is the EXACT text that appears on screen (not spoken dialogue), short and punchy, timed over generic B-roll (city skyline, keys, paperwork, calculator).`
    case 'myth-busting':
      return `FORMAT: Myth Busting — the hook MUST literally start with the word "MYTH:" followed by a common, realistic California mortgage misconception, then the rest of the script busts it with facts. Populate "mythStatement" with that exact myth statement.`
    case 'qa':
      return `FORMAT: Q&A — the hook MUST literally start with the words "You asked:" followed by a specific, realistic borrower question, then the rest of the script answers it clearly. Populate "viewerQuestion" with that exact question.`
  }
}

function buildScriptPrompt(length: LengthId, format: FormatId, topic: string, research: WinningResearch | null): string {
  const { label } = lengthMeta(length)
  const researchBlock = research
    ? `\nRESEARCH ON WHAT'S WINNING RIGHT NOW — model the hook and structure on this:\n- Top hooks: ${research.topHooks.map((h) => `"${h.hook}" (${h.source})`).join('; ')}\n- Winning factors: emotional trigger = ${research.winningFactors.emotionalTrigger}; pacing = ${research.winningFactors.pacing}; structure = ${research.winningFactors.structure}\n- Algorithm signal: ${research.algorithmSignal}\n`
    : `\nNo live research was available this time — fall back to best general knowledge of what performs well in short-form mortgage education content.\n`

  const header = `Write a complete ${label} video script for Mettkey, a California mortgage EDUCATION platform (never a lender or broker), on the topic: "${topic}".
${researchBlock}
${formatRequirements(format)}

Open with a hook modeled on what is actually stopping the scroll right now, per the research above. Conversational, direct tone. Be specific to California mortgages where relevant (rates, CalHFA, DSCR, FHA, etc.) without ever guaranteeing a rate or approval.

IMPORTANT: Do NOT include Mettkey's name, NMLS number, or any disclaimer anywhere in the spoken script or on-screen text — that goes in the video description only, added separately, never spoken or shown on screen. The CTA should drive viewers to mettkey.com to learn more — never imply Mettkey originates, approves, or funds loans.`

  if (length === '60s') {
    return `${header}

Segments: "Hook" (0:00-0:05), "Main Point" (0:05-0:45), "CTA" (0:45-1:00).

Return ONLY valid JSON, no prose before or after:
{
  "hook": string,
  "segments": [{"timestamp": "0:00-0:05", "label": "Hook", "content": string}, {"timestamp": "0:05-0:45", "label": "Main Point", "content": string}, {"timestamp": "0:45-1:00", "label": "CTA", "content": string}],
  "onScreenText": [string] (exactly 3, matching segments, 5 words max each),
  "ctas": [{"at": "0:45", "text": string}],
  "hashtags": [string] (8-12 mortgage/finance education hashtags),
  "viewerQuestion": string (only for Q&A format, else ""),
  "mythStatement": string (only for Myth Busting format, else ""),
  "youtubeTitle": "",
  "youtubeDescription": ""
}`
  }

  if (length === '3m') {
    return `${header}

Segments: "Hook" (0:00-0:15), "Intro" (0:15-0:30), "Main Point 1" and "Main Point 2" splitting 0:30-2:40 naturally, "CTA" (2:40-3:00).

Return ONLY valid JSON, no prose before or after:
{
  "hook": string,
  "segments": [{"timestamp": "0:00-0:15", "label": "Hook", "content": string}, {"timestamp": "0:15-0:30", "label": "Intro", "content": string}, {"timestamp": string, "label": "Main Point 1", "content": string}, {"timestamp": string, "label": "Main Point 2", "content": string}, {"timestamp": "2:40-3:00", "label": "CTA", "content": string}],
  "onScreenText": [],
  "ctas": [{"at": "2:40", "text": string}],
  "hashtags": [string] (8-12 mortgage/finance education hashtags),
  "viewerQuestion": string (only for Q&A format, else ""),
  "mythStatement": string (only for Myth Busting format, else ""),
  "youtubeTitle": "",
  "youtubeDescription": ""
}`
  }

  // 5m — long form, needs YouTube title + description
  return `${header}

Segments: "Hook" (0:00-0:20), "Intro" (0:20-0:45), three "Main Point" segments spanning roughly 0:45-4:30, "CTA" (4:30-5:00).
Also write a YouTube title (SEO optimized, under 60 characters) and a ~200 word YouTube description.

Return ONLY valid JSON, no prose before or after:
{
  "hook": string,
  "segments": [{"timestamp": "0:00-0:20", "label": "Hook", "content": string}, {"timestamp": "0:20-0:45", "label": "Intro", "content": string}, {"timestamp": string, "label": "Main Point 1", "content": string}, {"timestamp": string, "label": "Main Point 2", "content": string}, {"timestamp": string, "label": "Main Point 3", "content": string}, {"timestamp": "4:30-5:00", "label": "CTA", "content": string}],
  "onScreenText": [],
  "ctas": [{"at": "4:30", "text": string}],
  "hashtags": [string] (8-12 mortgage/finance education hashtags),
  "viewerQuestion": string (only for Q&A format, else ""),
  "mythStatement": string (only for Myth Busting format, else ""),
  "youtubeTitle": string,
  "youtubeDescription": string (~200 words, SEO optimized, mortgage education framed)
}`
}

export default function VideoScriptTab() {
  const todaysTopics = getTodaysTopics(6)
  const [topic, setTopic] = useState('')
  const [length, setLength] = useState<LengthId>('60s')
  const [format, setFormat] = useState<FormatId>('talking-head')
  const [research, setResearch] = useState<WinningResearch | null>(null)
  const [researchError, setResearchError] = useState('')
  const [script, setScript] = useState<ScriptResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loadingResearch, setLoadingResearch] = useState(false)
  const [loadingScript, setLoadingScript] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim()) { setError('Pick or type a topic first.'); return }
    setError('')
    setResearchError('')
    setScript(null)
    setFlags([])

    setLoadingResearch(true)
    let winningResearch: WinningResearch | null = null
    try {
      const res = await callClaude(buildResearchPrompt(length, format, topic), { webSearch: true, maxTokens: 2000 })
      winningResearch = parseClaudeJSON<WinningResearch>(res.text)
      setResearch(winningResearch)
    } catch (e) {
      setResearch(null)
      setResearchError(e instanceof Error ? e.message : 'Could not complete research this time — writing the script from general best practices instead.')
    } finally {
      setLoadingResearch(false)
    }

    setLoadingScript(true)
    try {
      const res = await callClaude(buildScriptPrompt(length, format, topic, winningResearch), { maxTokens: 4000 })
      const parsed = parseClaudeJSON<ScriptResult>(res.text)
      setScript(parsed)
      const allText = `${parsed.hook} ${parsed.segments.map((s) => s.content).join(' ')}`
      setFlags(Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(allText)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoadingScript(false)
    }
  }

  const descriptionNote = `${COMPLIANCE_DISCLAIMER}\n(Add to video description and end card — not spoken, not shown on screen. ${NMLS})`
  const fullScript = script
    ? `Hook: ${script.hook}\n\n${script.segments.map((s) => `[${s.timestamp}] ${s.label}\n${s.content}`).join('\n\n')}${script.onScreenText.length ? `\n\nOn-screen text:\n${script.onScreenText.join('\n')}` : ''}`
    : ''

  return (
    <div>
      <Card className="mb-6">
        <Label>Video Length</Label>
        <div className="grid sm:grid-cols-3 gap-2 mb-4">
          {LENGTHS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLength(l.id)}
              className={`text-left p-3 rounded-lg border transition-all ${length === l.id ? 'border-[var(--teal)] bg-[var(--surface)] ring-1 ring-[var(--teal)]' : 'border-[var(--border)] hover:border-[var(--ink-light)]'}`}
            >
              <p className="font-serif text-sm">{l.label}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{l.sub}</p>
            </button>
          ))}
        </div>

        <Label>Format</Label>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`text-left p-3 rounded-lg border transition-all ${format === f.id ? 'border-[var(--teal)] bg-[var(--surface)] ring-1 ring-[var(--teal)]' : 'border-[var(--border)] hover:border-[var(--ink-light)]'}`}
            >
              <p className="font-serif text-sm">{f.label}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{f.description}</p>
            </button>
          ))}
        </div>

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
        <Label>Or type your own topic</Label>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Why did my rate quote change overnight" className="mb-4" />

        <Button variant="primary" loading={loadingResearch || loadingScript} onClick={run}>
          {loadingResearch ? "Researching what's winning..." : script ? 'Regenerate Script' : 'Research & Generate Script'}
        </Button>
      </Card>

      {error && <ErrorBox message={error} onRetry={run} />}

      {(loadingResearch || research || researchError) && (
        <Card className="mb-6">
          <h3 className="font-serif text-lg mb-1">Step 1 — What&apos;s Winning Right Now</h3>
          <p className="text-xs text-[var(--text-secondary)] mb-4">Live research on top-performing mortgage/finance video content, used to model this script&apos;s hook and structure.</p>
          {loadingResearch && <p className="text-sm text-[var(--text-muted)]">Searching TikTok, Reels, and YouTube for what&apos;s winning right now…</p>}
          {researchError && <ErrorBox message={researchError} />}
          {research && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] mb-1.5">Top hooks winning right now</p>
                <ul className="text-sm space-y-1.5">
                  {research.topHooks.map((h, i) => (
                    <li key={i}>&ldquo;{h.hook}&rdquo; <span className="text-xs text-[var(--text-muted)]">— {h.source}</span></li>
                  ))}
                </ul>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <p><span className="font-semibold">Emotional trigger:</span> {research.winningFactors.emotionalTrigger}</p>
                <p><span className="font-semibold">Pacing:</span> {research.winningFactors.pacing}</p>
                <p><span className="font-semibold">Structure:</span> {research.winningFactors.structure}</p>
              </div>
              <p className="text-sm bg-[var(--surface)] rounded-lg p-3"><span className="font-semibold">What the algorithm is rewarding right now:</span> {research.algorithmSignal}</p>
            </div>
          )}
        </Card>
      )}

      <ComplianceWarning flags={flags} />

      {script && (
        <div className="space-y-5">
          <h3 className="font-serif text-lg">Step 2 — Script Modeled on the Winners Above</h3>

          {script.viewerQuestion && (
            <Card className="bg-[var(--surface)]"><p className="text-sm"><span className="font-semibold">Question being answered:</span> {script.viewerQuestion}</p></Card>
          )}
          {script.mythStatement && (
            <Card className="bg-[var(--surface)]"><p className="text-sm"><span className="font-semibold">Myth being busted:</span> {script.mythStatement}</p></Card>
          )}

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg">Full Script — {lengthMeta(length).label} · {formatMeta(format).label}</h3>
              <CopyButton text={fullScript} label="Copy Full Script" />
            </div>
            <div className="space-y-4">
              {script.segments.map((seg, i) => (
                <div key={i} className="border-l-2 border-[var(--teal)] pl-4">
                  <p className="text-xs font-semibold text-[var(--teal-dark)] mb-1">{seg.timestamp} — {seg.label}</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{seg.content}</p>
                  {script.onScreenText[i] && (
                    <p className="text-xs mt-1.5 text-[var(--text-muted)]"><span className="font-semibold">On-screen text:</span> {script.onScreenText[i]}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <h3 className="font-serif text-lg mb-3">CTAs</h3>
              {script.ctas.map((c, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">At {c.at}</p>
                  <p className="text-sm">{c.text}</p>
                </div>
              ))}
            </Card>
            {script.hashtags?.length > 0 && (
              <Card>
                <h3 className="font-serif text-lg mb-3">Hashtags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {script.hashtags.map((t, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-full">{t}</span>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {script.youtubeTitle && (
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-lg">YouTube Title</h3>
                <CopyButton text={script.youtubeTitle} />
              </div>
              <p className="text-sm">{script.youtubeTitle}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{script.youtubeTitle.length} characters</p>
            </Card>
          )}

          {script.youtubeDescription && (
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif text-lg">YouTube Description</h3>
                <CopyButton text={`${script.youtubeDescription}\n\n${descriptionNote}`} />
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{script.youtubeDescription}</p>
            </Card>
          )}

          <Card className="bg-amber-50 border-amber-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-900 mb-1">Add to video description (not spoken, not on screen)</p>
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
