import Anthropic from '@anthropic-ai/sdk'
import { scanForComplianceRisks, COMPLIANCE_DISCLAIMER, withDisclaimer, OWNER_NAME, NMLS } from './constants'
import { getTodaysTopics } from './topics'
import { pickImageForCategory, getImageUrl } from './images'
import type {
  DailyBatch,
  BlogDraft,
  VideoScriptDraft,
  SocialCaptionDraft,
  NewsletterDraft,
  CarouselDraft,
  ControversialIdeaDraft,
  SocialPlatform,
} from './drafts'

/**
 * This runs server-side inside a cron API route, not the browser, so it cannot use
 * app/lib/api.ts's callClaude (which does `fetch('/api/claude')` — a relative browser URL).
 * Instead it calls the Anthropic SDK directly, using the EXACT same client setup, model, and
 * request shape as app/api/claude/route.ts, so there is only one way this app talks to
 * Claude. Do not introduce a second SDK version or a raw-HTTP path here.
 */
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-5'

const SYSTEM = `You are the content engine for Mettkey, a California mortgage EDUCATION platform owned by ${OWNER_NAME} (${NMLS}). Mettkey is NOT a lender, NOT a broker, and NOT a mortgage company — it is an educational resource that helps Californians understand mortgages, rates, and loan programs. Never write content that implies Mettkey originates, funds, underwrites, or approves loans.

Rules for every piece of content you generate:
1. NEVER guarantee a specific rate, loan approval, or specific loan terms to a reader. Use language like "rates vary by lender and borrower" or "typical programs may include" instead of promises.
2. ALWAYS frame Mettkey as an educational resource. Do not use language that could be read as Mettkey acting as a lender or broker (e.g. avoid "we can get you approved," "we'll lock your rate," "apply with us for a loan").
3. Include the exact disclaimer text "${COMPLIANCE_DISCLAIMER}" in your output where the schema calls for it.
4. Before finalizing your answer, review your own draft for any language that could be misread as a rate guarantee, loan approval promise, or specific commitment of terms. If you find any, either rewrite it to remove the implication, or note it explicitly.

This app is exclusively for mortgage EDUCATION content — never write real-estate-brokerage content, never mention DRE numbers, never suggest Mettkey lists or sells homes.`

type ClaudeCallResult = { text: string; complianceFlags: string[] }

/** Mirrors app/api/claude/route.ts's request shape exactly — same model, same tool, same JSON-only instruction. */
async function callClaudeServer(
  prompt: string,
  opts: { webSearch?: boolean; maxTokens?: number } = {}
): Promise<ClaudeCallResult> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  const createParams: Anthropic.MessageCreateParams = {
    model: MODEL,
    max_tokens: opts.maxTokens || 4096,
    system: SYSTEM,
    messages,
  }

  if (opts.webSearch) {
    createParams.tools = [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 8 },
    ] as unknown as Anthropic.Tool[]
    createParams.system = `${createParams.system}\n\nIMPORTANT: After you finish researching with web search, your FINAL message must contain ONLY the JSON requested in the prompt — no summary, no commentary, no markdown fences, before or after it. Do not explain your research process in the final answer.`
  }

  const response = await client.messages.create(createParams)
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')

  return { text, complianceFlags: scanForComplianceRisks(text) }
}

/** Same extraction strategy as app/lib/api.ts's parseClaudeJSON, duplicated for server-side use. */
function parseJSON<T>(text: string): T {
  let cleaned = text.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const firstObj = cleaned.indexOf('{')
    const firstArr = cleaned.indexOf('[')
    let start = -1
    let closeChar = '}'
    if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
      start = firstArr
      closeChar = ']'
    } else {
      start = firstObj
      closeChar = '}'
    }
    if (start === -1) throw new Error('Claude did not return parseable JSON for a daily-batch piece.')
    const end = cleaned.lastIndexOf(closeChar)
    if (end === -1 || end <= start) throw new Error('Claude did not return parseable JSON for a daily-batch piece.')
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

const CATEGORIES = ['Rates', 'First-Time Buyers', 'Investors', 'Self-Employed', 'Refinancing', 'CA Programs'] as const

// ---------- Research ----------

type ResearchResult = { researchNotes: string; keyFacts: string[] }

async function researchTopic(topic: string): Promise<{ research: ResearchResult; flags: string[] }> {
  const prompt = `Research the current state of "${topic}" for California homeowners and homebuyers using live web search. Look for current mortgage rates, loan limits, program details, and any recent changes relevant to this topic in California specifically.

Return ONLY valid JSON, no prose before or after:
{"researchNotes": string (a few paragraphs summarizing what you found, factual, no opinions), "keyFacts": [string] (5-8 short factual bullet points, e.g. specific numbers, limits, program names, current rate ranges — cite ranges/estimates responsibly, never state a rate as fixed/guaranteed)}`
  try {
    const res = await callClaudeServer(prompt, { webSearch: true, maxTokens: 2000 })
    return { research: parseJSON<ResearchResult>(res.text), flags: res.complianceFlags }
  } catch {
    // Fall back to no live grounding rather than failing the whole batch.
    return {
      research: { researchNotes: `No live research available for "${topic}" today — generated from general knowledge.`, keyFacts: [] },
      flags: [],
    }
  }
}

// ---------- Blog ----------

type BlogWriteResult = Omit<BlogDraft['data'], 'slug' | 'image'>

async function generateBlog(topic: string, research: ResearchResult): Promise<BlogDraft> {
  const prompt = `Using the research notes below as factual grounding ONLY (for accurate numbers, limits, and program names), write a genuinely ORIGINAL 500-800 word SEO blog post for Mettkey, a California mortgage EDUCATION platform, on the topic: "${topic}".

RESEARCH NOTES (factual reference only — do not quote or closely paraphrase any single source, write entirely in your own original wording and structure):
${research.researchNotes}

KEY FACTS:
${research.keyFacts.map((f) => `- ${f}`).join('\n')}

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
  "internalLinks": [{"label": string, "href": string}] (2-4 suggested internal links to mettkey.com education pages; use "/#guides" as href if unsure)
}`
  const res = await callClaudeServer(prompt, { maxTokens: 3000 })
  const parsed = parseJSON<BlogWriteResult>(res.text)
  const category = CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number])
    ? parsed.category
    : 'CA Programs'
  const body = [...parsed.body]
  if (!body.join(' ').includes(COMPLIANCE_DISCLAIMER)) {
    body[body.length - 1] = withDisclaimer(body[body.length - 1])
  }
  const image = pickImageForCategory(category as (typeof CATEGORIES)[number], topic)
  const flagText = `${parsed.title} ${parsed.excerpt} ${body.join(' ')}`
  return {
    type: 'blog',
    status: 'pending',
    complianceFlags: Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(flagText)])),
    data: {
      slug: slugify(parsed.title),
      title: parsed.title,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      keyword: parsed.keyword,
      category,
      excerpt: parsed.excerpt,
      image: getImageUrl(image.id),
      body,
      internalLinks: parsed.internalLinks,
    },
  }
}

// ---------- Video scripts ----------

type VideoWriteResult = {
  hooks: string[]
  format: string
  segments: { timestamp: string; label: string; content: string }[]
  onScreenText: string[]
  audioStyleSuggestion: string
  brollShotList: string[]
  cta: string
  heygenScript: string
  capcutNotes: string
}

async function generateVideos(topic: string, research: ResearchResult): Promise<VideoScriptDraft[]> {
  const prompt = `Using the research below as factual grounding, write THREE distinct short-form video scripts (45-75 seconds each) for Mettkey, a California mortgage EDUCATION platform (never a lender or broker), on the topic: "${topic}". Vary the three scripts' angle/format so they don't feel repetitive (e.g. one myth-busting, one Q&A, one straight explainer) — pick formats that fit the topic.

RESEARCH NOTES:
${research.researchNotes}
KEY FACTS:
${research.keyFacts.map((f) => `- ${f}`).join('\n')}

For EACH of the 3 scripts:
- "hooks": exactly 5 distinct hook options for the first 3 seconds, grounded in the research above and written fresh for this topic — punchy, specific, scroll-stopping. NEVER open a hook with "Hi guys today I want to talk about" or any equivalent throat-clearing intro (e.g. "In this video I'll explain...", "Hey everyone..."). Start with the stakes, the myth, the number, or the question.
- "format": a short label for the script's angle (e.g. "Myth Busting", "Q&A", "Explainer").
- "segments": shot-by-shot breakdown as [{"timestamp": "0:00-0:05", "label": string, "content": string}], covering the whole script duration, each "content" being the spoken words AND visual direction combined in a natural production-note style (e.g. "[Close on hands holding paperwork] Most people think...").
- "onScreenText": 3-5 short on-screen text overlays with rough timing baked into the string (e.g. "0:04 — 'FICO isn't the whole story'").
- "audioStyleSuggestion": a text description of an audio vibe/genre that would suit this script (e.g. "upbeat lo-fi hip hop, no vocals, builds at the reveal") — this is a style suggestion only, NOT a real trending-audio lookup, since there is no live data source for that.
- "brollShotList": 4-6 concrete B-roll shot ideas fitting the California-real-estate visual brief (California homes, luxury properties, city shots, paperwork/calculator close-ups, etc).
- "cta": a strong closing call-to-action driving viewers to mettkey.com to learn more — never implying Mettkey originates, approves, or funds loans.
- "heygenScript": a CLEAN, plain first-person monologue version of the chosen script (use hooks[0] as the opening line) — ONLY the words to be spoken, no camera directions, no on-screen-text notation, no timestamps, no bracketed notes. Ready to paste directly into HeyGen.
- "capcutNotes": a compact multi-line string of "[timestamp] — on-screen text / caption cue" entries pulled from the segments and onScreenText above, formatted for fast manual entry into CapCut.

Never state a guaranteed rate, guaranteed approval, or guaranteed savings anywhere. Do not include Mettkey's NMLS number or any disclaimer in the spoken script or on-screen text — that belongs in the video description only, added separately by the app, never spoken or shown on screen.

Return ONLY valid JSON, no prose before or after, matching exactly this schema:
{"videos": [
  {"hooks": [string,string,string,string,string], "format": string, "segments": [{"timestamp": string, "label": string, "content": string}], "onScreenText": [string], "audioStyleSuggestion": string, "brollShotList": [string], "cta": string, "heygenScript": string, "capcutNotes": string},
  ... (exactly 3 objects total)
]}`
  const res = await callClaudeServer(prompt, { maxTokens: 6000 })
  const parsed = parseJSON<{ videos: VideoWriteResult[] }>(res.text)
  return parsed.videos.slice(0, 3).map((v) => {
    const flagText = `${v.hooks.join(' ')} ${v.segments.map((s) => s.content).join(' ')} ${v.heygenScript}`
    return {
      type: 'video' as const,
      status: 'pending' as const,
      complianceFlags: Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(flagText)])),
      data: {
        topic,
        hooks: v.hooks,
        chosenHookIndex: 0,
        format: v.format,
        segments: v.segments,
        onScreenText: v.onScreenText,
        audioStyleSuggestion: v.audioStyleSuggestion,
        brollShotList: v.brollShotList,
        cta: v.cta,
        heygenScript: v.heygenScript,
        capcutNotes: v.capcutNotes,
      },
    }
  })
}

// ---------- Social captions ----------

async function generateSocials(topic: string, research: ResearchResult): Promise<SocialCaptionDraft[]> {
  const prompt = `Using the research below as grounding, write THREE platform-native social captions for Mettkey, a California mortgage EDUCATION platform, on the topic: "${topic}" — one each for Instagram, LinkedIn, and Facebook, each in that platform's own tone and length convention (Instagram: 100-150 words, conversational, hashtag-heavy; LinkedIn: 150-250 words, professional/educational; Facebook: conversational, community-focused, shorter). Each ends with the exact sentence: "${COMPLIANCE_DISCLAIMER}"

RESEARCH NOTES:
${research.researchNotes}
KEY FACTS:
${research.keyFacts.map((f) => `- ${f}`).join('\n')}

Never guarantee a rate or approval.

Return ONLY valid JSON: {"socials": [
  {"platform": "Instagram", "caption": string, "hashtags": [string] (10-15 hashtags)},
  {"platform": "LinkedIn", "caption": string, "hashtags": [string] (3-5 hashtags)},
  {"platform": "Facebook", "caption": string, "hashtags": [string] (0-5 hashtags)}
]}`
  const res = await callClaudeServer(prompt, { maxTokens: 2500 })
  const parsed = parseJSON<{ socials: { platform: SocialPlatform; caption: string; hashtags: string[] }[] }>(res.text)
  return parsed.socials.map((s) => {
    const caption = s.caption.includes(COMPLIANCE_DISCLAIMER) ? s.caption : withDisclaimer(s.caption)
    return {
      type: 'social' as const,
      status: 'pending' as const,
      complianceFlags: Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(caption)])),
      data: { platform: s.platform, caption, hashtags: s.hashtags || [] },
    }
  })
}

// ---------- Newsletter ----------

async function generateNewsletter(topic: string, research: ResearchResult): Promise<NewsletterDraft> {
  const prompt = `Write a newsletter email about "${topic}" for Mettkey, a California mortgage EDUCATION platform owned by ${OWNER_NAME}. This email is ready to paste directly into Brevo (an email marketing tool) as HTML.

RESEARCH NOTES:
${research.researchNotes}

Rules:
- Educational tone throughout. Mettkey is NOT a lender or broker — never write as if Mettkey originates, funds, or approves loans.
- Never guarantee a specific rate, approval, or savings.
- Body should be simple, semantic HTML suitable for an email client: use <p>, <h2>, <ul>/<li>, no external stylesheets, no <script>.
- The email footer (inside the HTML, in a <p> tag) must include the exact sentence: "${COMPLIANCE_DISCLAIMER}"

Return ONLY valid JSON, no prose before or after:
{"subjectLines": [string] (3 subject line options), "preheader": string (preview text, under 100 characters), "bodyHtml": string (the full HTML email body including the footer disclaimer paragraph)}`
  const res = await callClaudeServer(prompt, { maxTokens: 2000 })
  const parsed = parseJSON<NewsletterDraft['data']>(res.text)
  if (!parsed.bodyHtml.includes(COMPLIANCE_DISCLAIMER)) {
    parsed.bodyHtml = `${parsed.bodyHtml}\n<p>${COMPLIANCE_DISCLAIMER}</p>`
  }
  return {
    type: 'newsletter',
    status: 'pending',
    complianceFlags: Array.from(new Set([
      ...res.complianceFlags,
      ...scanForComplianceRisks(parsed.subjectLines.join(' ') + ' ' + parsed.bodyHtml),
    ])),
    data: parsed,
  }
}

// ---------- Carousel ----------

async function generateCarousel(topic: string, research: ResearchResult): Promise<CarouselDraft> {
  const prompt = `Write a 5-7 slide Instagram/LinkedIn carousel for Mettkey, a California mortgage EDUCATION platform, on the topic: "${topic}".

RESEARCH NOTES:
${research.researchNotes}

Each slide should be short (headline + 1-2 sentence body) and build on the last, ending with a slide that reinforces Mettkey as an educational resource (not a lender). Also write a caption for the carousel post that ends with the exact sentence: "${COMPLIANCE_DISCLAIMER}"

Return ONLY valid JSON: {"slides": [{"headline": string, "body": string}] (5-7 items), "caption": string}`
  const res = await callClaudeServer(prompt, { maxTokens: 1800 })
  const parsed = parseJSON<CarouselDraft['data']>(res.text)
  if (!parsed.caption.includes(COMPLIANCE_DISCLAIMER)) parsed.caption = withDisclaimer(parsed.caption)
  const allText = parsed.slides.map((s) => `${s.headline} ${s.body}`).join(' ') + ' ' + parsed.caption
  return {
    type: 'carousel',
    status: 'pending',
    complianceFlags: Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(allText)])),
    data: parsed,
  }
}

// ---------- Controversial-but-true ideas ----------

async function generateControversial(topic: string, research: ResearchResult): Promise<ControversialIdeaDraft[]> {
  const prompt = `Write THREE "controversial but true" mortgage myth-busting post ideas for Mettkey, a California mortgage EDUCATION platform, loosely inspired by the topic "${topic}" (they don't need to be narrowly about it — draw on genuinely defensible, factual reframes of common mortgage/real-estate misconceptions, e.g. down payment myths, DTI misconceptions, credit score myths, renting-vs-buying myths).

RESEARCH NOTES (for grounding, if relevant):
${research.researchNotes}

Rules — these are strict:
- Ground every claim in genuinely defensible facts, never speculation stated as fact.
- NEVER write anything that could read as a rate guarantee, a loan commitment, or that discourages someone from working with a licensed mortgage professional.
- Educational myth-busting tone, not clickbait falsehoods.

Return ONLY valid JSON: {"ideas": [{"hook": string (the myth-busting hook/headline), "body": string (2-4 sentence factual reframe)}] (exactly 3 items)}`
  const res = await callClaudeServer(prompt, { maxTokens: 1500 })
  const parsed = parseJSON<{ ideas: { hook: string; body: string }[] }>(res.text)
  return parsed.ideas.slice(0, 3).map((idea) => ({
    type: 'controversial' as const,
    status: 'pending' as const,
    complianceFlags: Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(`${idea.hook} ${idea.body}`)])),
    data: idea,
  }))
}

// ---------- Orchestration ----------

/** Picks a fallback topic the same way BlogTab/SocialTab do when no live trending data is available. */
export function fallbackTopic(): string {
  return getTodaysTopics(1)[0]?.title || 'CA mortgage rates today'
}

export async function generateDailyBatch(topic: string): Promise<DailyBatch> {
  const { research } = await researchTopic(topic)

  const [blog, videos, socials, newsletter, carousel, controversial] = await Promise.all([
    generateBlog(topic, research),
    generateVideos(topic, research),
    generateSocials(topic, research),
    generateNewsletter(topic, research),
    generateCarousel(topic, research),
    generateControversial(topic, research),
  ])

  const now = new Date()
  return {
    date: now.toISOString().slice(0, 10),
    topic,
    generatedAt: now.toISOString(),
    blog,
    videos,
    socials,
    newsletter,
    carousel,
    controversial,
  }
}
