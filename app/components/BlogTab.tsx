'use client'

import { useState, useEffect } from 'react'
import {
  Card, Label, Button, Input, SubTabs, CopyButton, ErrorBox, ComplianceWarning,
} from './ui'
import { callClaude, parseClaudeJSON } from '../lib/api'
import { withDisclaimer, COMPLIANCE_DISCLAIMER, scanForComplianceRisks } from '../lib/constants'
import { getTodaysTopics, TopicCategory } from '../lib/topics'
import { getImageUrl, pickImageForCategory } from '../lib/images'

const CATEGORIES: TopicCategory[] = ['Rates', 'First-Time Buyers', 'Investors', 'Self-Employed', 'Refinancing', 'CA Programs']

const POSTS_API_URL = 'https://mettkey.com/api/posts'

type LivePost = { slug: string; title: string; excerpt: string; date: string; category?: string }

type ResearchResult = {
  researchNotes: string
  keyFacts: string[]
}

type BlogWriteResult = {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  keyword: string
  excerpt: string
  category: TopicCategory
  body: string[] // array of paragraph strings, 500-800 words total
  internalLinks: string[]
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

export default function BlogTab() {
  const [subtab, setSubtab] = useState('write')

  return (
    <div>
      <SubTabs
        active={subtab}
        onChange={setSubtab}
        tabs={[
          { id: 'write', label: 'Research & Write' },
          { id: 'published', label: 'Published Posts' },
        ]}
      />
      {subtab === 'write' && <ResearchAndWriteTab />}
      {subtab === 'published' && <PublishedPostsTab />}
    </div>
  )
}

// ---------- Research & Write ----------

function ResearchAndWriteTab() {
  const todaysTopics = getTodaysTopics(6)
  const [topic, setTopic] = useState('')
  const [research, setResearch] = useState<ResearchResult | null>(null)
  const [researchCitations, setResearchCitations] = useState<{ url: string; title: string }[]>([])
  const [post, setPost] = useState<BlogWriteResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [stage, setStage] = useState<'idle' | 'researching' | 'writing' | 'done'>('idle')
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim()) {
      setError('Pick a topic or type your own first.')
      return
    }
    setError('')
    setPost(null)
    setResearch(null)
    setFlags([])
    try {
      setStage('researching')
      const researchPrompt = `Research the current state of "${topic}" for California homeowners and homebuyers using live web search. Look for current mortgage rates, loan limits, program details, and any recent (2025-2026) changes relevant to this topic in California specifically.

Return ONLY valid JSON, no prose before or after:
{"researchNotes": string (a few paragraphs summarizing what you found, factual, no opinions), "keyFacts": [string] (5-8 short factual bullet points, e.g. specific numbers, limits, program names, current rate ranges — cite ranges/estimates responsibly, never state a rate as fixed/guaranteed)}`
      const researchRes = await callClaude(researchPrompt, { webSearch: true, maxTokens: 2000 })
      const researchParsed = parseClaudeJSON<ResearchResult>(researchRes.text)
      setResearch(researchParsed)
      setResearchCitations(researchRes.citations)

      setStage('writing')
      const category = CATEGORIES.find((c) => topic.toLowerCase().includes(c.toLowerCase().split(' ')[0])) || undefined
      const writePrompt = `Using the research notes below as factual grounding ONLY (for accurate numbers, limits, and program names), write a genuinely ORIGINAL 500-800 word SEO blog post for Mettkey, a California mortgage EDUCATION platform, on the topic: "${topic}".

RESEARCH NOTES (factual reference only — do not quote or closely paraphrase any single source, write entirely in your own original wording and structure):
${researchParsed.researchNotes}

KEY FACTS:
${researchParsed.keyFacts.map((f) => `- ${f}`).join('\n')}

Requirements:
- 100% original wording and structure — this is not a summary or rewrite of any source.
- Educational tone throughout. Mettkey is NOT a lender or broker — never write as if Mettkey originates or approves loans.
- Never state a guaranteed rate, guaranteed approval, or guaranteed savings.
- Body must be 500-800 words total, broken into 4-6 paragraphs.
- Pick ONE category from exactly: Rates, First-Time Buyers, Investors, Self-Employed, Refinancing, CA Programs.
- End the body with the exact sentence: "${COMPLIANCE_DISCLAIMER}"

Return ONLY valid JSON, no prose before or after, matching exactly this schema:
{
  "title": string (compelling SEO headline),
  "metaTitle": string (under 60 characters),
  "metaDescription": string (under 160 characters),
  "keyword": string (target SEO keyword),
  "excerpt": string (1-2 sentence teaser),
  "category": string (one of: Rates, First-Time Buyers, Investors, Self-Employed, Refinancing, CA Programs),
  "body": [string] (4-6 paragraph strings, 500-800 words total, last paragraph ends with the disclaimer sentence above),
  "internalLinks": [string] (2-4 short suggested internal link labels to other mettkey.com education pages)
}`
      const writeRes = await callClaude(writePrompt, { maxTokens: 3000 })
      const parsed = parseClaudeJSON<Omit<BlogWriteResult, 'slug'>>(writeRes.text)
      const finalCategory = CATEGORIES.includes(parsed.category as TopicCategory) ? (parsed.category as TopicCategory) : (category || 'CA Programs')
      const bodyWithDisclaimer = [...parsed.body]
      const fullBodyText = bodyWithDisclaimer.join(' ')
      if (!fullBodyText.includes(COMPLIANCE_DISCLAIMER)) {
        bodyWithDisclaimer[bodyWithDisclaimer.length - 1] = withDisclaimer(bodyWithDisclaimer[bodyWithDisclaimer.length - 1])
      }
      const finalPost: BlogWriteResult = { ...parsed, category: finalCategory, body: bodyWithDisclaimer, slug: slugify(parsed.title) }
      setPost(finalPost)

      // Compliance flags: combine the API's own scan on both calls with a fresh scan over
      // the final assembled post text, surfaced prominently rather than silently.
      const combinedFlags = Array.from(new Set([
        ...researchRes.complianceFlags,
        ...writeRes.complianceFlags,
        ...scanForComplianceRisks(finalPost.title + ' ' + finalPost.excerpt + ' ' + finalPost.body.join(' ')),
      ]))
      setFlags(combinedFlags)
      setStage('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStage('idle')
    }
  }

  const image = post ? pickImageForCategory(post.category, post.slug) : null

  const blogPostsArrayEntry = post
    ? `{
  slug: '${post.slug}',
  title: ${JSON.stringify(post.title)},
  metaTitle: ${JSON.stringify(post.metaTitle)},
  metaDescription: ${JSON.stringify(post.metaDescription)},
  keyword: ${JSON.stringify(post.keyword)},
  date: '${new Date().toISOString().slice(0, 10)}',
  excerpt: ${JSON.stringify(post.excerpt)},
  category: ${JSON.stringify(post.category)},
  image: ${JSON.stringify(getImageUrl(image!.id))},
  body: [
${post.body.map((p) => `    ${JSON.stringify(p)}`).join(',\n')}
  ],
  internalLinks: [
${post.internalLinks.map((l) => `    ${JSON.stringify(l)}`).join(',\n')}
  ],
}`
    : ''

  return (
    <div>
      <Card className="mb-6">
        <Label>Today&apos;s Suggested Topics</Label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {todaysTopics.map((t) => (
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
              {t.title} <span className="opacity-60">· {t.category}</span>
            </button>
          ))}
        </div>
        <Label>Or type your own topic</Label>
        <div className="flex gap-2 mb-4">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How DSCR loans work for California rental property" />
        </div>
        <Button variant="primary" loading={stage === 'researching' || stage === 'writing'} onClick={run}>
          {stage === 'researching' ? 'Researching…' : stage === 'writing' ? 'Writing post…' : post ? 'Regenerate Post' : 'Research & Write'}
        </Button>
      </Card>

      {error && <ErrorBox message={error} onRetry={run} />}

      {research && (
        <Card className="mb-6 bg-[var(--surface)]">
          <p className="text-xs font-semibold text-[var(--teal-dark)] mb-2">Research Grounding</p>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap mb-3">{research.researchNotes}</p>
          <ul className="text-sm list-disc list-inside space-y-0.5 mb-2">
            {research.keyFacts.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          {researchCitations.length > 0 && (
            <div className="text-xs text-[var(--text-muted)] mt-2">
              Sources: {researchCitations.map((c, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">{c.title}</a>
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      <ComplianceWarning flags={flags} />

      {post && image && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <CopyButton text={blogPostsArrayEntry} label="Copy BLOG_POSTS Entry" />
          </div>

          <Card>
            <img src={getImageUrl(image.id)} alt={image.alt} className="w-full h-48 object-cover rounded-lg mb-4" />
            <span className="inline-block text-xs px-2 py-1 bg-[var(--surface)] rounded-full font-medium mb-2">{post.category}</span>
            <h3 className="font-serif text-2xl mb-2">{post.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] italic mb-1">{post.metaDescription}</p>
            <p className="text-xs text-[var(--text-muted)]">Keyword: {post.keyword} · Slug: /{post.slug}</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[var(--text-muted)]">Body ({post.body.join(' ').split(/\s+/).length} words)</p>
              <CopyButton text={post.body.join('\n\n')} />
            </div>
            <div className="space-y-3 text-sm leading-relaxed">
              {post.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Suggested Internal Links</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              {post.internalLinks.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

// ---------- Published Posts (read-only reference panel) ----------

function PublishedPostsTab() {
  const [posts, setPosts] = useState<LivePost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)

  const run = async () => {
    setLoading(true)
    setError('')
    setAttempted(true)
    try {
      const res = await fetch(POSTS_API_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`mettkey.com returned an error (${res.status}).`)
      const data = await res.json() as { posts: LivePost[] }
      setPosts(data.posts || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach mettkey.com/api/posts — this endpoint may not exist yet.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Already-published posts on mettkey.com, for reference and repurposing context.
        </p>
        <Button variant="primary" loading={loading} onClick={run}>Refresh</Button>
      </Card>

      {error && <ErrorBox message={error} onRetry={run} />}

      {posts.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {posts.map((p) => (
            <Card key={p.slug}>
              <p className="text-xs text-[var(--text-muted)] mb-1">{p.date ? new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
              <p className="font-serif text-base mb-2">{p.title}</p>
              <p className="text-sm text-[var(--text-secondary)] line-clamp-3">{p.excerpt}</p>
            </Card>
          ))}
        </div>
      )}

      {attempted && !loading && posts.length === 0 && !error && (
        <Card className="text-center text-sm text-[var(--text-muted)] py-10">
          No published posts found yet.
        </Card>
      )}
    </div>
  )
}
