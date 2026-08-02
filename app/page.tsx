'use client'

import { useState } from 'react'
import BlogTab from './components/BlogTab'
import SocialTab from './components/SocialTab'
import NewsletterTab from './components/NewsletterTab'
import { APP_NAME, BRAND, NMLS } from './lib/constants'

const TABS = [
  { id: 'blog', label: 'Blog', emoji: '📝' },
  { id: 'social', label: 'Social', emoji: '📣' },
  { id: 'newsletter', label: 'Newsletter', emoji: '✉️' },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState('blog')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[var(--ink)] text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[var(--teal-light)] text-xs font-medium tracking-widest uppercase mb-0.5">{BRAND}</p>
            <h1 className="font-serif text-xl font-medium">{APP_NAME}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-white/50">
            <span>Mortgage education content, generate-then-copy · {NMLS}</span>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto pb-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-[var(--teal)] text-[var(--teal-light)]'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {tab.emoji} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {activeTab === 'blog' && <BlogTab />}
        {activeTab === 'social' && <SocialTab />}
        {activeTab === 'newsletter' && <NewsletterTab />}
      </main>

      <footer className="border-t border-[var(--border)] py-5 px-6 text-center text-xs text-[var(--text-muted)]">
        {BRAND} · Educational purposes only, not a lender or broker · {NMLS}
      </footer>
    </div>
  )
}
