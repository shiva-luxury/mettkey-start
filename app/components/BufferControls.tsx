'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Button, ErrorBox } from './ui'

type ScheduleResult = {
  key: string
  platform: string
  status: 'scheduled' | 'skipped' | 'failed'
  when?: string
  message?: string
}

function summarize(results: ScheduleResult[]): string {
  const ok = results.filter((r) => r.status === 'scheduled')
  const skipped = results.filter((r) => r.status === 'skipped')
  const failed = results.filter((r) => r.status === 'failed')
  const parts: string[] = []
  if (ok.length) parts.push(`Scheduled ${ok.length}: ${ok.map((r) => `${r.platform} ${r.when}`).join(' · ')}`)
  if (skipped.length) parts.push(`Skipped ${skipped.length} already in Buffer`)
  if (failed.length) parts.push(`Failed ${failed.length}: ${failed.map((r) => r.message).join(' / ')}`)
  return parts.join('\n') || 'Nothing to schedule.'
}

/** "Schedule in Buffer" for one approved social caption or carousel. */
export function ScheduleInBufferButton({
  date,
  pieceType,
  pieceIndex,
  approved,
}: {
  date: string
  pieceType: 'social' | 'carousel'
  pieceIndex: number | null
  approved: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!approved) return null

  const run = async () => {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/buffer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, pieceType, pieceIndex }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Buffer scheduling failed.')
      setMessage(summarize(data.results as ScheduleResult[]))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buffer scheduling failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full">
      <Button variant="primary" loading={busy} onClick={run} className="!py-1 !px-2.5 text-xs">
        Schedule in Buffer
      </Button>
      {message && <p className="text-xs text-emerald-800 whitespace-pre-wrap mt-2">{message}</p>}
      {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    </div>
  )
}

/** Plans the whole week first (dry run), shows the plan, and only schedules after you confirm. */
export function ScheduleFullWeekButton({ onScheduled }: { onScheduled?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const post = async (dryRun: boolean) => {
    const res = await fetch('/api/buffer/schedule-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Buffer scheduling failed.')
    return data as { results: ScheduleResult[]; message?: string }
  }

  const run = async () => {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const plan = await post(true)
      const toSchedule = plan.results.filter((r) => r.status === 'scheduled')
      if (toSchedule.length === 0) {
        setMessage(plan.message || summarize(plan.results))
        return
      }
      const preview = plan.results.map((r) => `• ${r.platform} — ${r.when ?? r.message}`).join('\n')
      const ok = window.confirm(`Schedule ${toSchedule.length} posts in Buffer?\n\n${preview}`)
      if (!ok) {
        setMessage('Cancelled — nothing was scheduled.')
        return
      }
      const real = await post(false)
      setMessage(summarize(real.results))
      onScheduled?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buffer scheduling failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium">Schedule this week in Buffer</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Every approved social caption and carousel from the last 7 days, each in its own optimal Pacific-time slot. You confirm before anything is sent.
          </p>
        </div>
        <Button variant="primary" loading={busy} onClick={run}>Schedule Full Week</Button>
      </div>
      {message && <p className="text-xs text-emerald-800 whitespace-pre-wrap mt-3">{message}</p>}
      {error && <div className="mt-3"><ErrorBox message={error} onRetry={run} /></div>}
    </Card>
  )
}

type QueueItem = { id: string; channel: string; dueAt: string; text: string }

/** Read-only list of what's scheduled in Buffer, so you can see the week without leaving the dashboard. */
export function BufferQueuePanel() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/buffer/queue', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load the Buffer queue.')
      setItems(data.queue as QueueItem[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the Buffer queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium">Buffer queue</p>
          <p className="text-xs text-[var(--text-secondary)]">What&apos;s scheduled in Buffer, soonest first.</p>
        </div>
        <div className="flex gap-2">
          {open && <Button variant="ghost" loading={loading} onClick={load} className="!py-1 !px-2.5 text-xs">Refresh</Button>}
          <Button variant="outline" onClick={() => setOpen((v) => !v)} className="!py-1 !px-2.5 text-xs">{open ? 'Hide' : 'Show queue'}</Button>
        </div>
      </div>
      {open && error && <div className="mt-3"><ErrorBox message={error} onRetry={load} /></div>}
      {open && !error && !loading && items.length === 0 && <p className="text-xs text-[var(--text-muted)] mt-3">Nothing scheduled in Buffer yet.</p>}
      {open && items.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {items.map((item) => (
            <li key={item.id} className="py-2 text-sm">
              <p className="text-xs text-[var(--teal-dark)] font-medium">
                {new Date(item.dueAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} PT · {item.channel}
              </p>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 whitespace-pre-wrap">{item.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
