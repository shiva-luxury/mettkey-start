'use client'

import { useState } from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-[var(--border)] rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-[var(--text-secondary)] mb-1.5 font-medium">{children}</label>
}

export function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-sm px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--ink-light)] transition-colors placeholder:text-[var(--text-muted)]"
    />
  )
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full text-sm px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--ink-light)] transition-colors"
    >
      {children}
    </select>
  )
}

export function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full text-sm px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--ink-light)] transition-colors placeholder:text-[var(--text-muted)] resize-y min-h-[72px]"
    />
  )
}

export function Button({
  children,
  variant = 'outline',
  loading = false,
  className = '',
  ...props
}: {
  children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost'
  loading?: boolean
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[var(--ink)] text-white hover:bg-[var(--ink-light)] border border-[var(--ink)]',
    outline: 'border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface)] bg-white',
    ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]',
  }
  return (
    <button {...props} className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  )
}

export function ChipGroup({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (val: string[]) => void
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1 text-xs rounded-full border transition-all ${
            selected.includes(opt)
              ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--ink-light)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function SingleSelectChips({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string
  onChange: (val: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1 text-xs rounded-full border transition-all ${
            selected === opt
              ? 'bg-[var(--teal)] text-white border-[var(--teal)] font-semibold'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--teal)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function Output({ text, empty = 'Output will appear here' }: { text: string; empty?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="relative">
      {text && (
        <button
          onClick={copy}
          className="absolute top-3 right-3 text-xs px-2.5 py-1 border border-[var(--border)] rounded-md bg-white hover:bg-[var(--surface)] transition-all"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
      <div className={`bg-white border border-[var(--border)] rounded-xl p-5 min-h-[140px] max-h-[520px] overflow-y-auto output-box ${!text ? 'flex items-center justify-center text-[var(--text-muted)] text-sm italic' : 'fade-in'}`}>
        {text || empty}
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      type="button"
      className="text-xs px-2.5 py-1 border border-[var(--border)] rounded-md bg-white hover:bg-[var(--surface)] transition-all whitespace-nowrap shrink-0"
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

export function Expandable({
  title,
  subtitle,
  copyText,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  copyText?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[var(--border)] rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className={`inline-block transition-transform text-xs text-[var(--text-muted)] ${open ? 'rotate-90' : ''}`}>▶</span>
          <span>
            <span className="text-sm font-medium">{title}</span>
            {subtitle && <span className="block text-xs text-[var(--text-muted)]">{subtitle}</span>}
          </span>
        </button>
        {copyText !== undefined && <CopyButton text={copyText} />}
      </div>
      {open && <div className="px-4 pb-4 pt-0 border-t border-[var(--border)]">{children}</div>}
    </div>
  )
}

export function ModuleBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-4 ${color}`}>
      {label}
    </span>
  )
}

export function SubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 mb-6 border-b border-[var(--border)] overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all ${
            active === t.id
              ? 'border-[var(--ink)] text-[var(--ink)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function LastUpdated({ timestamp }: { timestamp: string | null }) {
  if (!timestamp) return null
  const d = new Date(timestamp)
  return (
    <p className="text-xs text-[var(--text-muted)] mb-4">
      Last updated {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
      {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
    </p>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-2.5 py-1 border border-red-300 rounded-md bg-white hover:bg-red-100 transition-all whitespace-nowrap"
        >
          Retry
        </button>
      )}
    </div>
  )
}

/**
 * Prominent, visible warning area for compliance flags surfaced from the API's
 * complianceFlags array — never silently dropped. Shown above generated content
 * whenever the model's self-review or the keyword-scan safety net catches anything
 * that could read as a rate guarantee or loan commitment.
 */
export function ComplianceWarning({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null
  return (
    <div className="border-2 border-amber-400 bg-amber-50 text-amber-900 text-sm rounded-lg px-4 py-3 mb-4">
      <p className="font-semibold mb-1 flex items-center gap-2">
        <span aria-hidden>⚠️</span> Compliance review needed before publishing
      </p>
      <ul className="list-disc list-inside space-y-0.5">
        {flags.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
    </div>
  )
}
