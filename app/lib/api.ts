import { parseModelJSON } from './parseModelJSON'

export type ClaudeResult = {
  text: string
  citations: { url: string; title: string }[]
  complianceFlags: string[]
  updatedAt: string
}

export class ClaudeApiError extends Error {}

export async function callClaude(
  prompt: string,
  opts: { systemPrompt?: string; webSearch?: boolean; maxTokens?: number } = {}
): Promise<ClaudeResult> {
  let res: Response
  try {
    res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        systemPrompt: opts.systemPrompt,
        webSearch: opts.webSearch,
        maxTokens: opts.maxTokens,
      }),
    })
  } catch {
    throw new ClaudeApiError('Could not reach the server. Check your connection and try again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    const message: string = err.error || 'Request failed'
    if (/api[_-]?key|authentication/i.test(message)) {
      throw new ClaudeApiError('The Anthropic API key is missing or invalid. In Vercel, go to Project Settings → Environment Variables and set ANTHROPIC_API_KEY, then redeploy.')
    }
    throw new ClaudeApiError(message)
  }
  return res.json()
}

/** Thrown when Claude\'s response doesn\'t contain the structured JSON a caller expected. Carries the raw text. */
export class ClaudeJSONError extends Error {
  raw: string
  constructor(message: string, raw: string) {
    super(message)
    this.name = 'ClaudeJSONError'
    this.raw = raw
  }
}

/**
 * Parses Claude\'s JSON output via the shared repairing parser. On failure throws a
 * ClaudeJSONError whose message includes the raw response, so the UI shows it instead of crashing.
 */
export function parseClaudeJSON<T>(text: string): T {
  try {
    return parseModelJSON<T>(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read the response.'
    throw new ClaudeJSONError(message, text)
  }
}
