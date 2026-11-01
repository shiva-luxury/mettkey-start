/**
 * Shared, forgiving parser for JSON that comes back from Claude.
 *
 * Claude usually returns valid JSON, but three things break it regularly:
 *   1. Raw newlines / tabs inside string values (the model writes multi-paragraph copy).
 *   2. Invalid backslash escapes such as \' or \$ inside strings.
 *   3. Trailing commas before } or ].
 * It also sometimes wraps the JSON in markdown fences or adds a sentence before/after it.
 *
 * parseModelJSON() handles all of those. If the JSON is still unparseable it throws a
 * ModelJSONError whose message includes the start of the raw text, so the UI can show what
 * Claude actually said instead of a bare SyntaxError.
 */

const RAW_EXCERPT_CHARS = 1200

export class ModelJSONError extends Error {
  raw: string
  constructor(reason: string, raw: string) {
    const excerpt = raw.slice(0, RAW_EXCERPT_CHARS)
    const more = raw.length > RAW_EXCERPT_CHARS ? '\n…(truncated)' : ''
    super(
      `Couldn't read Claude's response as structured data (${reason}). Raw output below — click Retry to regenerate.\n\n${excerpt}${more}`
    )
    this.name = 'ModelJSONError'
    this.raw = raw
  }
}

/** Returns the outermost {…} or […] in the text, or the whole body if no closing bracket is found. */
export function extractJSONValue(text: string): string {
  const withoutBom = text.replace(/^﻿/, '')
  const fence = withoutBom.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : withoutBom

  const start = body.search(/[{[]/)
  if (start === -1) return body.trim()

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < body.length; i++) {
    const ch = body[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return body.slice(start, i + 1)
    }
  }
  // No matching close bracket (usually truncation) — return what we have so the error shows it.
  return body.slice(start)
}

/**
 * Repairs the three common Claude JSON faults in one pass, tracking whether we're inside a
 * string literal so that only structural characters get changed.
 */
export function repairJSON(input: string): string {
  const VALID_ESCAPES = '"\\/bfnrtu'
  let out = ''
  let inString = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inString) {
      if (ch === '\\') {
        const next = input[i + 1]
        if (next === "'") {
          // \' is a common stray escape for an apostrophe — just emit the apostrophe.
          out += "'"
          i++
        } else if (next !== undefined && VALID_ESCAPES.includes(next)) {
          out += ch + next
          i++
        } else {
          // Invalid escape like \' — keep the backslash as a literal backslash.
          out += '\\\\'
        }
      } else if (ch === '"') {
        inString = false
        out += ch
      } else if (ch === '\n') {
        out += '\\n'
      } else if (ch === '\r') {
        // drop bare carriage returns; \n carries the line break
      } else if (ch === '\t') {
        out += '\\t'
      } else if (ch.charCodeAt(0) < 0x20) {
        // other raw control characters are not allowed in JSON strings — drop them
      } else {
        out += ch
      }
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }

    if (ch === ',') {
      // Skip a trailing comma: the next non-whitespace character is } or ]
      let j = i + 1
      while (j < input.length && /\s/.test(input[j])) j++
      if (input[j] === '}' || input[j] === ']') continue
    }

    out += ch
  }

  return out
}

/**
 * Parses Claude's JSON output. Tries the candidate as-is first, then with repairs.
 * Throws ModelJSONError (with the raw text) if it still can't be parsed.
 */
export function parseModelJSON<T>(text: string): T {
  const candidate = extractJSONValue(text)

  try {
    return JSON.parse(candidate) as T
  } catch {
    // fall through to repair
  }

  try {
    return JSON.parse(repairJSON(candidate)) as T
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown parse error'
    throw new ModelJSONError(reason, text)
  }
}
