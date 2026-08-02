'use client'

import { useState } from 'react'
import {
  Card, Label, Button, SubTabs, CopyButton, ErrorBox, ComplianceWarning,
} from './ui'
import { callClaude, parseClaudeJSON } from '../lib/api'
import { withDisclaimer, COMPLIANCE_DISCLAIMER, scanForComplianceRisks } from '../lib/constants'

type NewsletterResult = {
  subjectLines: string[]
  preheader: string
  bodyHtml: string
}

type NewsletterType = 'rate-update' | 'ca-program' | 'educational'

const NEWSLETTER_TYPES: { id: NewsletterType; label: string; description: string; promptTopic: string }[] = [
  {
    id: 'rate-update',
    label: 'Weekly Rate Update',
    description: 'A weekly email summarizing current CA mortgage rate trends — educational framing, no rate promises.',
    promptTopic: 'a weekly California mortgage rate update — general trends in rates this week, what tends to move rates, and how readers can stay informed',
  },
  {
    id: 'ca-program',
    label: 'CA Program Announcement',
    description: 'An email highlighting a California mortgage assistance program or loan option.',
    promptTopic: 'an announcement-style email about a current California mortgage program (e.g. CalHFA, FHA, DSCR, down payment assistance) explaining who it might help and how it generally works',
  },
  {
    id: 'educational',
    label: 'General Educational Content',
    description: 'A general educational email — a mortgage concept explained simply for CA readers.',
    promptTopic: 'a general educational email explaining a mortgage concept (e.g. how amortization works, what affects your rate, how to prepare for pre-approval) for California readers',
  },
]

export default function NewsletterTab() {
  const [subtab, setSubtab] = useState<NewsletterType>('rate-update')
  return (
    <div>
      <SubTabs
        active={subtab}
        onChange={(id) => setSubtab(id as NewsletterType)}
        tabs={NEWSLETTER_TYPES.map((t) => ({ id: t.id, label: t.label }))}
      />
      {NEWSLETTER_TYPES.map((t) => subtab === t.id && <NewsletterGenerator key={t.id} config={t} />)}
    </div>
  )
}

function NewsletterGenerator({ config }: { config: (typeof NEWSLETTER_TYPES)[number] }) {
  const [result, setResult] = useState<NewsletterResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true); setError(''); setResult(null); setFlags([])
    try {
      const prompt = `Write ${config.promptTopic} for Mettkey, a California mortgage EDUCATION platform owned by Shiva T. Mettke. This email is ready to paste directly into Brevo (an email marketing tool) as HTML.

Rules:
- Educational tone throughout. Mettkey is NOT a lender or broker — never write as if Mettkey originates, funds, or approves loans.
- Never guarantee a specific rate, approval, or savings.
- Body should be simple, semantic HTML suitable for an email client: use <p>, <h2>, <ul>/<li>, no external stylesheets, no <script>. Keep it plain and readable, not a JSON dump.
- The email footer (inside the HTML, in a <p> tag) must include the exact sentence: "${COMPLIANCE_DISCLAIMER}"

Return ONLY valid JSON, no prose before or after:
{"subjectLines": [string] (3 subject line options), "preheader": string (preview text, under 100 characters), "bodyHtml": string (the full HTML email body including the footer disclaimer paragraph)}`
      const res = await callClaude(prompt, { maxTokens: 2000 })
      const parsed = parseClaudeJSON<NewsletterResult>(res.text)
      if (!parsed.bodyHtml.includes(COMPLIANCE_DISCLAIMER)) {
        parsed.bodyHtml = `${parsed.bodyHtml}\n<p>${COMPLIANCE_DISCLAIMER}</p>`
      }
      setResult(parsed)
      setFlags(Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(parsed.subjectLines.join(' ') + ' ' + parsed.bodyHtml)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const fullCopyText = result
    ? `Subject line options:\n${result.subjectLines.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nPreheader: ${result.preheader}\n\n---\n\n${result.bodyHtml}`
    : ''

  return (
    <div>
      <Card className="mb-6">
        <p className="text-sm text-[var(--text-secondary)] mb-4">{config.description}</p>
        <Button variant="primary" loading={loading} onClick={run}>{result ? 'Regenerate' : 'Generate Newsletter'}</Button>
      </Card>

      {error && <ErrorBox message={error} onRetry={run} />}
      <ComplianceWarning flags={flags} />

      {result && (
        <div className="space-y-4">
          <div className="flex justify-end"><CopyButton text={fullCopyText} label="Copy Everything" /></div>

          <Card>
            <Label>Subject Line Options</Label>
            <ul className="text-sm space-y-1.5">
              {result.subjectLines.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-b border-[var(--border)] last:border-0 pb-1.5 last:pb-0">
                  <span>{s}</span>
                  <CopyButton text={s} />
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-muted)] mt-3">Preheader: {result.preheader}</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <Label>Email Body (ready to paste into Brevo)</Label>
              <CopyButton text={result.bodyHtml} />
            </div>
            <div className="bg-[var(--surface)] rounded-lg p-4 text-sm" dangerouslySetInnerHTML={{ __html: result.bodyHtml }} />
          </Card>
        </div>
      )}
    </div>
  )
}
