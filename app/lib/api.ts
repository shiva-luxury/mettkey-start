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

/** Thrown when Claude's response doesn't contain the structured JSON a caller expected. */
export class ClaudeJSONError extends Error {}

const FRIENDLY_JSON_ERROR = 'Claude didn\'t return structured data that time — this can happen with live web search. Click Retry.'

/** Extracts and parses a JSON object/array from a Claude text response, stripping markdown fences and stray prose. */
export function parseClaudeJSON<T>(text: string): T {
  let cleaned = text.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fall back to slicing between the first { or [ and the matching last } or ]
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
    if (start === -1) throw new ClaudeJSONError(FRIENDLY_JSON_ERROR)
    const end = cleaned.lastIndexOf(closeChar)
    if (end === -1 || end <= start) throw new ClaudeJSONError(FRIENDLY_JSON_ERROR)
    const slice = cleaned.slice(start, end + 1)
    try {
      return JSON.parse(slice) as T
    } catch {
      throw new ClaudeJSONError(FRIENDLY_JSON_ERROR)
    }
  }
}
