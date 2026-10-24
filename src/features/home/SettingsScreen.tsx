import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { getMeta, resetAll, setMeta } from '@/db/repo'
import { db } from '@/db/schema'
import { backupJson } from '@/export/json'
import { downloadText } from '@/export/share'
import RestoreInput from '@/features/export/RestoreInput'
import { Button, Frame, Segmented, Sheet, TopBar } from '@/ui'
import { toast } from '@/ui/toast'
import { getThemePref, setThemePref, hapticsEnabled, setHapticsEnabled, followUpEnabled, setFollowUpEnabled, type ThemePref } from '@/ui/theme'

export default function SettingsScreen() {
  const [theme, setTheme] = useState(getThemePref)
  const [haptics, setHaptics] = useState(hapticsEnabled)
  const [followUp, setFollowUp] = useState(followUpEnabled)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lastBackupAt = useLiveQuery(() => getMeta<string | null>('lastBackupAt', null), [])
  const eraseCounts = useLiveQuery(async () => {
    const [contacts, decisions, tags] = await Promise.all([db.contacts.count(), db.decisions.count(), db.tags.count()])
    return `${contacts} contact${contacts === 1 ? '' : 's'}, ${decisions} sorting decision${decisions === 1 ? '' : 's'}, and ${tags} tag${tags === 1 ? '' : 's'}`
  }, [])
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
    <section className="flex items-center justify-between gap-4 border-b border-rule py-5">
      <div>
        <h2 className="eyebrow">Ask for type after swipe</h2>
        <p className="mt-1 text-sm text-ink-2">Show status and type chips right after a Work or Personal swipe in triage.</p>
      </div>
      <Button variant="outline" role="switch" aria-label="Ask for type after swipe" aria-checked={followUp} onClick={() => {
        setFollowUpEnabled(!followUp); setFollowUp(!followUp)
      }}>{followUp ? 'On' : 'Off'}</Button>
    </section>
    <section className="space-y-3 border-b border-rule py-5">
      <h2 className="eyebrow">Gesture coach</h2>
      <Button full variant="outline" onClick={() => {
        try {
          const storage = window.localStorage
          const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
          keys.forEach((key) => { if (key?.startsWith('ct.coach.')) storage.removeItem(key) })
          toast('Coach will show on the next deck')
        } catch { toast('Could not reset the coach. Please try again.') }
      }}>Replay gesture coach</Button>
    </section>
    <section className="space-y-3 border-b border-rule py-5">
      <h2 className="eyebrow mb-3">Data</h2>
      <p className="text-sm text-ink-2">Export a backup to keep a copy of your sorting decisions.</p>
      <p className="text-xs text-ink-2">{lastBackupAt ? `Last backup: ${new Date(lastBackupAt).toLocaleDateString()}` : 'No backup exported yet.'}</p>
      <Button full variant="outline" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try {
          downloadText('contacts-backup.json', await backupJson(), 'application/json')
          await setMeta('lastBackupAt', new Date().toISOString())
          toast('Backup exported')
        }
        catch { setError('Could not create a backup. Please try again.') }
        finally { setBusy(false) }
      }}>Back up (.json)</Button>
      <RestoreInput label="Restore" />
      <p className="text-sm text-ink-2">Replace makes this device match the backup exactly; Merge keeps what is already here.</p>
      <p className="text-xs text-ink-2">Backups include contacts, sorting decisions, and original vCard fields, which may contain photos. Separate photo thumbnails are omitted; existing thumbnails are kept for restored contacts.</p>
    </section>
    <section className="border-b border-rule py-5">
      <h2 className="eyebrow mb-3">Danger zone</h2>
      <p className="text-sm text-ink-2">{eraseCounts ? `Reset will erase ${eraseCounts}, plus app session metadata.` : 'Counting data…'}</p>
      <Button variant="ghost" className="px-0" onClick={() => { setError(''); setConfirm(true) }}>Reset all data</Button>
    </section>
    <section className="space-y-3 py-5 text-sm text-ink-2">
      <h2 className="eyebrow text-ink">About</h2>
      <p>Everything is stored in this browser. Nothing is uploaded.</p>
      <p>Version: {import.meta.env.VITE_APP_VERSION ?? 'dev'}</p>
    </section>
    {!confirm && error && <p role="alert">{error}</p>}
    <Sheet open={confirm} onClose={() => { if (!busy) setConfirm(false) }} title="Reset all data?">
      <p className="mb-5 text-ink-2">This removes all contacts, sorting decisions, and tags from this browser. This cannot be undone. Export a backup first if you want to keep them.</p>
      <p className="mb-5 text-ink-2">{eraseCounts ? `Will erase ${eraseCounts}, plus app session metadata.` : 'Counting data…'}</p>
      {error && <p role="alert" className="mb-3">{error}</p>}
      <Button full disabled={busy || !eraseCounts} onClick={async () => {
        setBusy(true); setError('')
        try { await resetAll(); navigate('/') }
        catch { setError('Could not reset data. Please try again.') }
        finally { setBusy(false) }
      }}>{busy ? 'Resetting…' : 'Yes, reset all data'}</Button>
      <Button full variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button>
    </Sheet>
  </Frame>
}
