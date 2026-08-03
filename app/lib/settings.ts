'use client'

import { useEffect, useState } from 'react'

/**
 * Buffer connection settings — this app only needs the Buffer access token and profile
 * IDs (unlike shiva-lead-engine's settings.ts, which also stores webhook URLs and other
 * integrations this app doesn't use). Stored client-side in localStorage only; there is
 * no server-side env var for the Buffer token — it never leaves the browser except in
 * the POST body sent to our own /api/buffer route, which forwards it to Buffer's API.
 */
export type Settings = {
  bufferAccessToken: string
  bufferProfileIds: string
}

const DEFAULTS: Settings = {
  bufferAccessToken: '',
  bufferProfileIds: '',
}

const KEY = 'mettkey_settings_v1'

function load(): Settings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSettings(load())
    setLoaded(true)
  }, [])

  const update = (partial: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...partial }
      window.localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  return { settings, update, loaded }
}

/** Reads settings directly from localStorage (for use outside React components/hooks). */
export function getStoredSettings(): Settings {
  return load()
}
