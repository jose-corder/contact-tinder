import { useId, useState } from 'react'
import type { RestoreMode } from '@/db/repo'
import { restoreJson } from '@/export/json'
import { toast } from '@/ui/toast'

const MODE_HELP: Record<RestoreMode, string> = {
  replace: 'Replace makes this device match the backup exactly. Contacts and decisions missing from the backup are removed.',
  merge: 'Merge keeps what is already here and adds or updates what the backup contains.',
}

export default function RestoreInput({ label = 'Restore backup' }: { label?: string }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<RestoreMode>('replace')
  const modeName = useId()
  return <div className="space-y-2">
    <fieldset disabled={busy} className="space-y-1">
      <legend className="eyebrow text-ink-2">Restore mode</legend>
      <div className="flex gap-2">
        {(['replace', 'merge'] as const).map((value) =>
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 pr-4">
            <input type="radio" name={modeName} value={value} checked={mode === value} className="accent-ink"
              onChange={() => { setMode(value); setMessage('') }} />
            <span className="text-sm">{value === 'replace' ? 'Replace' : 'Merge'}</span>
          </label>)}
      </div>
      <p className="text-xs text-ink-2">{MODE_HELP[mode]}</p>
    </fieldset>
    <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-rule px-5 focus-within:outline-2 focus-within:outline-offset-2">
      <span>{busy ? 'Restoring…' : label}</span>
      <input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={async (event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (!file) return
        setBusy(true)
        setMessage('')
        try {
          const result = await restoreJson(await file.text(), mode)
          setMessage(`Restored ${result.contacts} contacts and ${result.decisions} decisions (${mode}).`)
          toast(mode === 'replace' ? 'Backup restored' : 'Backup merged')
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not restore this backup.') }
        finally { setBusy(false) }
      }} />
    </label>
    {message && <p role="status" className="text-sm text-ink-2">{message}</p>}
  </div>
}
