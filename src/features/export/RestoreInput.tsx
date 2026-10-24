import { useState } from 'react'
import { restoreJson } from '@/export/json'

export default function RestoreInput({ label = 'Restore backup' }: { label?: string }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <div className="space-y-2">
    <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-rule px-5 focus-within:outline-2 focus-within:outline-offset-2">
      <span>{busy ? 'Restoring…' : label}</span>
      <input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={async (event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (!file) return
        setBusy(true)
        setMessage('')
        try {
          const result = await restoreJson(await file.text())
          setMessage(`Restored ${result.contacts} contacts and ${result.decisions} decisions.`)
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not restore this backup.') }
        finally { setBusy(false) }
      }} />
    </label>
    {message && <p role="status" className="text-sm text-ink-2">{message}</p>}
  </div>
}
