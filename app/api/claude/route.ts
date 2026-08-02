import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { scanForComplianceRisks, COMPLIANCE_DISCLAIMER } from '../../lib/constants'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-5'

/**
 * Default system prompt for the Mettkey Content Engine — every generation call in this app
 * routes through this route, so this is the single place compliance rules are enforced.
 *
 * Mettkey is a California mortgage EDUCATION platform, not a lender or broker. Content
 * generated here must:
 *   1. Never guarantee a rate, loan approval, or specific loan terms to any reader.
 *   2. Always frame Mettkey as an educational resource — never as a lender, broker, or
 *      mortgage company, and never claim to originate, fund, or approve loans.
 *   3. Include the exact compliance disclaimer somewhere in the output (the app also
 *      appends it programmatically as a safety net — see withDisclaimer in lib/constants.ts).
 *   4. Self-review its own output before finalizing and flag anything that could read as a
 *      rate guarantee or loan commitment.
 */
const DEFAULT_SYSTEM = `You are the content engine for Mettkey, a California mortgage EDUCATION platform owned by Shiva T. Mettke (${'CA DRE #02251909'}, ${'NMLS #2779492'}). Mettkey is NOT a lender, NOT a broker, and NOT a mortgage company — it is an educational resource that helps Californians understand mortgages, rates, and loan programs. Never write content that implies Mettkey originates, funds, underwrites, or approves loans.

Rules for every piece of content you generate:
1. NEVER guarantee a specific rate, loan approval, or specific loan terms to a reader. Use language like "rates vary by lender and borrower" or "typical programs may include" instead of promises.
2. ALWAYS frame Mettkey as an educational resource. Do not use language that could be read as Mettkey acting as a lender or broker (e.g. avoid "we can get you approved," "we'll lock your rate," "apply with us for a loan").
3. Include the exact disclaimer text "${COMPLIANCE_DISCLAIMER}" in your output — either inline where natural (e.g. end of a caption or email footer) or clearly appended at the end.
4. Before finalizing your answer, review your own draft for any language that could be misread as a rate guarantee, loan approval promise, or specific commitment of terms. If you find any, either rewrite it to remove the implication, or note it explicitly.

This app is exclusively for mortgage EDUCATION content — never write real-estate-brokerage content, never mention DRE numbers, never suggest Mettkey lists or sells homes.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, systemPrompt, webSearch, maxTokens } = body as {
      prompt?: string
      systemPrompt?: string
      webSearch?: boolean
      maxTokens?: number
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
    const createParams: Anthropic.MessageCreateParams = {
      model: MODEL,
      max_tokens: maxTokens || 4096,
      system: systemPrompt || DEFAULT_SYSTEM,
      messages,
    }

    if (webSearch) {
      createParams.tools = [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 8,
        },
      ] as unknown as Anthropic.Tool[]
      createParams.system = `${createParams.system}\n\nIMPORTANT: After you finish researching with web search, your FINAL message must contain ONLY the JSON requested in the prompt — no summary, no commentary, no markdown fences, before or after it. Do not explain your research process in the final answer.`
    }

    const response = await client.messages.create(createParams)
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    const citations: { url: string; title: string }[] = []
    for (const block of response.content) {
      if (block.type === 'text' && (block as any).citations) {
        for (const c of (block as any).citations) {
          if (c.url && !citations.find((x) => x.url === c.url)) {
            citations.push({ url: c.url, title: c.title || c.url })
          }
        }
      }
    }

    // Compliance safety net: a keyword scan over the raw response text, independent of
    // whatever the model's own self-review step (instructed in DEFAULT_SYSTEM) produced.
    // The UI surfaces these prominently rather than silently dropping them.
    const complianceFlags = scanForComplianceRisks(text)

    return NextResponse.json({ text, citations, complianceFlags, updatedAt: new Date().toISOString() })
  } catch (err: unknown) {
    console.error('Claude API error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
