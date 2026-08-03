'use client'

import { useState } from 'react'
import { Card, Label, Input, Button } from './ui'
import { useSettings } from '../lib/settings'

export default function SettingsPanel() {
  const { settings, update, loaded } = useSettings()
  const [saved, setSaved] = useState(false)

  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (!loaded) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-serif text-2xl">Settings</h1>

      <Card>
        <h2 className="font-serif text-lg mb-3">Buffer Connection</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Every &quot;Post via Buffer&quot; button across this app uses the token and profile IDs below to schedule that piece of
          content through Buffer&apos;s publish API. Buffer&apos;s API is authenticated with a personal access token, not a full
          OAuth app here — create yours at <span className="font-mono">buffer.com/developers/apps</span>, then paste it below
          along with the Profile IDs for the accounts you want to post to (find these via the Buffer API &quot;profiles&quot;
          endpoint, documented at <span className="font-mono">buffer.com/developers/api/profiles</span>).
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Buffer Access Token</Label>
            <Input
              type="password"
              value={settings.bufferAccessToken}
              onChange={(e) => update({ bufferAccessToken: e.target.value })}
              placeholder="1/xxxxxxxxxxxxxxxx"
            />
          </div>
          <div>
            <Label>Buffer Profile IDs (comma separated)</Label>
            <Input
              value={settings.bufferProfileIds}
              onChange={(e) => update({ bufferProfileIds: e.target.value })}
              placeholder="5f2a...,5f2b...,5f2c..."
            />
          </div>
        </div>
        <Button variant="primary" onClick={flash}>{saved ? 'Saved!' : 'Save Buffer Settings'}</Button>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Nothing here is sent to our server except when you click a &quot;Post via Buffer&quot; button — the token stays in
          this browser&apos;s local storage and is only forwarded, per request, to our own /api/buffer route, which relays it
          to Buffer.
        </p>
      </Card>
    </div>
  )
}
