import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { getMeta, resetAll, setMeta } from '@/db/repo'
import { db } from '@/db/schema'
import { backupJson } from '@/export/json'
import { downloadText } from '@/export/share'
import RestoreInput from '@/features/export/RestoreInput'
import RestoreAvailability from './RestoreAvailability'
import { Button, Frame, InlineNotice, RadioGroup, Sheet, SheetFooterActions, Skeleton, TopBar, formatDate } from '@/ui'
import { toast } from '@/ui/toast'
import { getThemePref, setThemePref, hapticsEnabled, setHapticsEnabled, followUpEnabled, setFollowUpEnabled, type ThemePref } from '@/ui/theme'

export default function SettingsScreen() {
  const [theme, setTheme] = useState(getThemePref)
  const [haptics, setHaptics] = useState(hapticsEnabled)
  const [followUp, setFollowUp] = useState(followUpEnabled)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [backupError, setBackupError] = useState('')
  const [coachError, setCoachError] = useState('')
  const data = useLiveQuery(async () => {
    try {
      const [contacts, decisions, tags, lastBackupAt] = await Promise.all([db.contacts.count(), db.decisions.count(), db.tags.count(), getMeta<string | null>('lastBackupAt', null)])
      return { lastBackupAt, eraseCounts: contacts + ' contact' + (contacts === 1 ? '' : 's') + ', ' + decisions + ' sorting decision' + (decisions === 1 ? '' : 's') + ', and ' + tags + ' tag' + (tags === 1 ? '' : 's'), error: '' }
    } catch { return { lastBackupAt: null, eraseCounts: '', error: 'Could not load app data. Try again.' } }
  }, [retry])
  const lastBackupAt = data?.lastBackupAt
  const eraseCounts = data?.eraseCounts
  const navigate = useNavigate()
  return <Frame>
    <h1 className="sr-only">Settings</h1>
    <TopBar title="Settings" backTo="/" />
    <section className="border-b border-rule py-5">
      <h2 className="eyebrow mb-3">Appearance</h2>
      <RadioGroup<ThemePref> label="Appearance" options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
        value={theme} onChange={(value) => { setThemePref(value); setTheme(value) }} />
    </section>
    <section className="flex items-center justify-between border-b border-rule py-5">
      <h2 className="eyebrow">Haptics</h2>
      <Button variant="outline" disabled={typeof navigator.vibrate !== 'function'} role="switch" aria-label="Haptics" aria-checked={typeof navigator.vibrate === 'function' && haptics} onClick={() => {
        setHapticsEnabled(!haptics); setHaptics(!haptics)
      }}>{typeof navigator.vibrate !== 'function' ? 'Unavailable' : haptics ? 'On' : 'Off'}</Button>
    </section>
    <section className="flex items-center justify-between gap-4 border-b border-rule py-5">
      <div>
        <h2 className="eyebrow">Ask for type after swipe</h2>
        <p className="mt-1 t-meta text-ink-2">Choose details after moving a contact to Work or Personal.</p>
      </div>
      <Button variant="outline" role="switch" aria-label="Ask for type after swipe" aria-checked={followUp} onClick={() => {
        setFollowUpEnabled(!followUp); setFollowUp(!followUp)
      }}>{followUp ? 'On' : 'Off'}</Button>
    </section>
    <section className="space-y-3 border-b border-rule py-5">
      <h2 className="eyebrow">Sorting tips</h2>
      <Button full variant="outline" onClick={() => {
        try {
          const storage = window.localStorage
          const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
          keys.forEach((key) => { if (key?.startsWith('ct.coach.')) storage.removeItem(key) })
          setCoachError(''); toast('Tips will show next time you sort')
        } catch { setCoachError('Could not enable tips. Please try again.') }
      }}>Show tips next time</Button>
      {coachError && <InlineNotice tone="error">{coachError}</InlineNotice>}
    </section>
    <section className="space-y-3 border-b border-rule py-5">
      <h2 className="eyebrow mb-3">Data</h2>
      <Button full variant="outline" loading={busy} onClick={async () => {
        setBusy(true); setBackupError('')
        try {
          downloadText('contacts-backup.json', await backupJson(), 'application/json')
          await setMeta('lastBackupAt', new Date().toISOString())
          toast('Backup exported')
        }
        catch { setBackupError('Could not create a backup. Please try again.') }
        finally { setBusy(false) }
      }}>Back up app data</Button>
      {backupError && <InlineNotice tone="error">{backupError}</InlineNotice>}
      {!data ? <Skeleton className="h-5 w-48" /> : data.error ? <InlineNotice tone="error">{data.error}<Button variant="ghost" onClick={() => setRetry(value => value + 1)}>Retry</Button></InlineNotice> :
        <p className="t-meta text-ink-2">{lastBackupAt ? 'Last backup: ' + formatDate(lastBackupAt) : 'No backup exported yet.'}</p>}
      <p className="t-meta text-ink-2">Restore replaces or merges this device's data.</p>
      <RestoreAvailability />
      <RestoreInput />
    </section>
    <section className="border-b border-rule py-5">
      <h2 className="eyebrow mb-3">Reset app</h2>
      {eraseCounts ? <p className="t-body text-ink-2">Reset will erase {eraseCounts}, and saved progress.</p> : !data ? <div role="status" aria-label="Counting data"><Skeleton className="h-10" /></div> : <p className="t-meta text-ink-2">Counts unavailable. Retry loading app data above.</p>}
      <Button variant="ghost" className="px-0" disabled={!eraseCounts || busy} onClick={() => { setError(''); setConfirm(true) }}>Reset app</Button>
    </section>
    <section className="space-y-3 py-5 t-meta text-ink-2">
      <h2 className="eyebrow text-ink">About</h2>
      <p>Everything is stored in this browser. Nothing is uploaded.</p>
      <p>Version: {import.meta.env.VITE_APP_VERSION ?? 'dev'}</p>
    </section>
    <Sheet open={confirm} onClose={() => { if (!busy) setConfirm(false) }} title="Reset app?" footer={<SheetFooterActions secondary={{ label: 'Cancel', disabled: busy, onClick: () => setConfirm(false) }}
      primary={{ label: 'Yes, reset app', loading: busy, disabled: !eraseCounts, onClick: async () => {
        setBusy(true); setError('')
        try { await resetAll(); navigate('/') }
        catch { setError('Could not reset data. Please try again.') }
        finally { setBusy(false) }
      } }} />} >
      <p className="mb-5 text-ink-2">This removes all contacts, sorting decisions, and tags from this browser. This cannot be undone. Export a backup first if you want to keep them.</p>
      <p className="mb-5 text-ink-2">{eraseCounts ? `Will erase ${eraseCounts}, and saved progress.` : 'Counting data…'}</p>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}

    </Sheet>
  </Frame>
}
