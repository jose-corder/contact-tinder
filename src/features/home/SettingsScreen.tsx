import { useState } from 'react'
import { useNavigate } from 'react-router'
import { resetAll } from '@/db/repo'
import { backupJson } from '@/export/json'
import { downloadText } from '@/export/share'
import RestoreInput from '@/features/export/RestoreInput'
import { Button, Frame, Segmented, Sheet, TopBar } from '@/ui'
import { getThemePref, setThemePref, hapticsEnabled, setHapticsEnabled, type ThemePref } from '@/ui/theme'

export default function SettingsScreen() {
  const [theme, setTheme] = useState(getThemePref)
  const [haptics, setHaptics] = useState(hapticsEnabled)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  return <Frame>
    <TopBar title="Settings" backTo="/" />
    <section className="border-b border-rule py-5">
      <h2 className="eyebrow mb-3">Appearance</h2>
      <Segmented<ThemePref> options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        value={theme} onChange={(value) => { setThemePref(value); setTheme(value) }} />
    </section>
    <section className="flex items-center justify-between border-b border-rule py-5">
      <h2 className="eyebrow">Haptics</h2>
      <Button variant="outline" role="switch" aria-label="Haptics" aria-checked={haptics} onClick={() => {
        setHapticsEnabled(!haptics); setHaptics(!haptics)
      }}>{haptics ? 'On' : 'Off'}</Button>
    </section>
    <section className="space-y-3 border-b border-rule py-5">
      <h2 className="eyebrow mb-3">Data</h2>
      <Button full variant="outline" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try { downloadText('contacts-backup.json', await backupJson(), 'application/json') }
        catch { setError('Could not create a backup. Please try again.') }
        finally { setBusy(false) }
      }}>Back up (.json)</Button>
      <RestoreInput label="Restore" />
      <p className="text-xs text-ink-2">Backups include contacts and sorting decisions. Photos are omitted.</p>
      <Button variant="ghost" className="text-stamp-delete" onClick={() => { setError(''); setConfirm(true) }}>Reset all data</Button>
    </section>
    <section className="space-y-3 py-5 text-sm text-ink-2">
      <h2 className="eyebrow text-ink">About</h2>
      <p>Everything is stored in this browser. Nothing is uploaded.</p>
      <p>Version: {import.meta.env.MODE}</p>
    </section>
    {!confirm && error && <p role="alert">{error}</p>}
    <Sheet open={confirm} onClose={() => { if (!busy) setConfirm(false) }} title="Reset all data?">
      <p className="mb-5 text-ink-2">This removes all contacts, sorting decisions, and tags from this browser. This cannot be undone. Export a backup first if you want to keep them.</p>
      {error && <p role="alert" className="mb-3">{error}</p>}
      <Button full disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try { await resetAll(); navigate('/') }
        catch { setError('Could not reset data. Please try again.') }
        finally { setBusy(false) }
      }}>{busy ? 'Resetting…' : 'Yes, reset all data'}</Button>
      <Button full variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button>
    </Sheet>
  </Frame>
}
