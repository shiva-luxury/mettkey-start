export const OWNER_NAME = 'Shiva T. Mettke'
export const DRE = 'CA DRE #02251909'
export const NMLS = 'NMLS #2779492'
export const BRAND = 'Mettkey'
export const DOMAIN = 'mettkey.com'
export const APP_NAME = 'Mettkey Content Engine'

/**
 * The exact required compliance disclaimer. Mettkey is a mortgage EDUCATION platform —
 * never a lender, broker, or mortgage company. This line must appear on every piece of
 * generated content (blog posts, social captions, newsletters).
 */
export const COMPLIANCE_DISCLAIMER =
  'Educational purposes only. Mettkey is not a lender or broker. NMLS #2779492 | Shiva T. Mettke.'

/** Appends the compliance disclaimer to a piece of generated content, unless it's already present. */
export function withDisclaimer(text: string, disclaimer: string = COMPLIANCE_DISCLAIMER): string {
  if (!text) return disclaimer
  if (text.includes(disclaimer)) return text
  return `${text.trim()}\n\n${disclaimer}`
}

/**
 * Keyword scan used as a client-side safety net in addition to the model's own self-review.
 * Flags language that could read as a rate guarantee or loan commitment — never absolute
 * financial promises to end users of generated content.
 */
export const RISKY_PHRASES: string[] = [
  'guaranteed rate',
  'guarantee a rate',
  'guaranteed approval',
  'guarantee approval',
  'you qualify',
  "you're approved",
  'you are approved',
  'guaranteed to qualify',
  'guaranteed loan',
  'promise a rate',
  'lock in this rate',
  'we will approve',
  'instant approval',
  'no credit check needed',
  'guaranteed savings',
  'guaranteed to save',
  '100% approval',
  'we can get you approved',
]

/** Simple keyword scan fallback — the model is also asked to self-review, but this catches misses. */
export function scanForComplianceRisks(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const phrase of RISKY_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      found.push(`Contains phrase that may read as a rate/approval guarantee: "${phrase}"`)
    }
  }
  return found
}
