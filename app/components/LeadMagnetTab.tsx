'use client'

import { useState } from 'react'
import { Card, Label, Select, Button, CopyButton, ErrorBox, ComplianceWarning } from './ui'
import { callClaude, parseClaudeJSON } from '../lib/api'
import { withDisclaimer, COMPLIANCE_DISCLAIMER, OWNER_NAME, NMLS, scanForComplianceRisks } from '../lib/constants'

type LeadMagnetResult = {
  coverTitle: string
  toc: string[]
  sections: { title: string; content: string }[]
  backPageCTA: string
}

const MAGNET_TYPES = [
  'First-Time CA Buyer Guide',
  'Refinance Readiness Checklist',
  'DSCR Investor Calculator Guide',
  'Self-Employed Borrower Playbook',
  'CA Down Payment Assistance Guide',
]

export default function LeadMagnetTab() {
  const [type, setType] = useState(MAGNET_TYPES[0])
  const [magnet, setMagnet] = useState<LeadMagnetResult | null>(null)
  const [flags, setFlags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true)
    setError('')
    setFlags([])
    try {
      const prompt = `Write the complete content for a downloadable lead-magnet PDF titled type: "${type}" for Mettkey, a California mortgage EDUCATION platform owned by ${OWNER_NAME} (${NMLS}). Mettkey is NOT a lender or broker — never write as if Mettkey originates, funds, underwrites, or approves loans.

The content must be fully fleshed out and ready to hand to a designer or paste directly into a PDF layout tool — not an outline. Include real, useful, California-specific mortgage information appropriate to the magnet type (e.g. CA-specific programs, typical documentation, general steps — never a rate or approval promise).

Return ONLY valid JSON, no prose before or after, matching exactly this schema:
{
  "coverTitle": string (compelling cover page title),
  "toc": [string] (5-8 table of contents entries),
  "sections": [{"title": string, "content": string (several fully written paragraphs, not bullet fragments)}] (one per TOC entry, fully written),
  "backPageCTA": string (back page call-to-action pointing readers to mettkey.com to keep learning — never "apply with us" or any lender/broker language — ready to paste, must include the exact sentence "${COMPLIANCE_DISCLAIMER}")
}`
      const res = await callClaude(prompt, { maxTokens: 6000 })
      const parsed = parseClaudeJSON<LeadMagnetResult>(res.text)
      if (!parsed.backPageCTA.includes(COMPLIANCE_DISCLAIMER)) parsed.backPageCTA = withDisclaimer(parsed.backPageCTA)
      setMagnet(parsed)
      const allText = `${parsed.coverTitle} ${parsed.sections.map((s) => s.content).join(' ')} ${parsed.backPageCTA}`
      setFlags(Array.from(new Set([...res.complianceFlags, ...scanForComplianceRisks(allText)])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const fullText = magnet
    ? `${magnet.coverTitle}\n\nTABLE OF CONTENTS\n${magnet.toc.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n${magnet.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')}\n\n${magnet.backPageCTA}`
    : ''

  return (
    <div>
      <Card className="mb-6">
        <Label>Lead Magnet Type</Label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {MAGNET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <Button variant="primary" loading={loading} onClick={run}>{magnet ? 'Regenerate' : 'Generate Lead Magnet'}</Button>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={run} />}
      <ComplianceWarning flags={flags} />

      {magnet && (
        <div className="space-y-5">
          <div className="flex justify-end"><CopyButton text={fullText} label="Copy Entire Lead Magnet" /></div>
          <Card className="text-center bg-[var(--ink)] text-white py-10">
            <p className="text-[var(--teal-light)] text-xs uppercase tracking-widest mb-2">Cover Page</p>
            <p className="font-serif text-3xl">{magnet.coverTitle}</p>
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Table of Contents</h3>
            <ol className="text-sm list-decimal list-inside space-y-1">
              {magnet.toc.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </Card>
          {magnet.sections.map((s, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-serif text-lg">{s.title}</p>
                <CopyButton text={`${s.title}\n${s.content}`} />
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.content}</p>
            </Card>
          ))}
          <Card className="bg-[var(--surface)]">
            <h3 className="font-serif text-lg mb-2">Back Page CTA</h3>
            <p className="text-sm whitespace-pre-wrap">{magnet.backPageCTA}</p>
          </Card>
        </div>
      )}
    </div>
  )
}
