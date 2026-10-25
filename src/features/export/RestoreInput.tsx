import { useEffect, useId, useRef, useState } from 'react'
import type { RestoreMode } from '@/db/repo'
import { previewRestore, restoreJson, type RestorePreview } from '@/export/json'
import { readText } from '@/import/readFile'
import { Button, InlineNotice } from '@/ui'
import { useRestoreRecovery } from './useRestoreRecovery'

export default function RestoreInput({ label = 'Choose backup file' }: { label?: string }) {
  const { recovery, announce } = useRestoreRecovery()
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<RestoreMode>('replace')
  const [review, setReview] = useState<{ text: string; preview: RestorePreview } | null>(null)
  const locked = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const modeName = useId()
  useEffect(() => { if (review) heading.current?.focus() }, [review])

  async function commit() {
    if (!review || locked.current) return
    locked.current = true
    setBusy(true)
    setMessage('')
    setFailed(false)
    try {
      const fresh = await previewRestore(review.text)
      if (JSON.stringify(fresh) !== JSON.stringify(review.preview)) {
        setReview({ ...review, preview: fresh })
        setMessage('Your app data changed. Review the updated counts before restoring.')
        return
      }
      const result = await restoreJson(review.text, mode)
      setReview(null)
      await announce(result.restoreId)
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Could not restore this backup. Try again.') }
    finally { locked.current = false; setBusy(false) }
  }

  const preview = review?.preview
  const decisionRemovals = mode === 'replace' ? preview?.details.decisionRemovedIds.length ?? 0 : 0
  const changed = preview ? new Set([...preview.details.changedIds, ...(mode === 'replace' ? preview.details.decisionRemovedIds : [])]).size : 0
  return <div className="space-y-3">
    {recovery}
    {!review ? <>
      <p className="t-body text-ink-2">Choose a backup to review its contacts and saved decisions before restoring.</p>
      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-control px-5 focus-within:outline-2 focus-within:outline-offset-2">
        <span>{busy ? 'Reading backup…' : label}</span>
        <input aria-label={label} type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={async (event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file || locked.current) return
          locked.current = true
          setBusy(true)
          setMessage('')
          setFailed(false)
          try {
            const text = await readText(file)
            setReview({ text, preview: await previewRestore(text) })
          } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Could not read this backup. Choose the file again.') }
          finally { locked.current = false; setBusy(false) }
        }} />
      </label>
    </> : preview && <section aria-label="Backup preview" className="rounded-[20px] border border-rule bg-paper-2 p-4">
      <h3 ref={heading} tabIndex={-1} className="font-serif t-heading">Review backup</h3>
      <p className="mt-2 t-body">Backup from {new Date(preview.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} · {preview.contacts.toLocaleString()} contacts · {preview.decisions.toLocaleString()} decisions</p>
      <p className="mt-3 tabular t-body">+{preview.added} added · {changed} changed · {mode === 'replace' ? preview.removed : 0} removed</p>
      <fieldset disabled={busy} className="my-3">
        <legend className="t-body font-medium">Restore mode</legend>
        {(['replace', 'merge'] as const).map((value) => <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
          <input type="radio" name={modeName} value={value} checked={mode === value} className="accent-ink" onChange={() => setMode(value)} />
          <span className="t-body">{value === 'replace' ? 'Replace — match this backup' : 'Merge — keep other contacts and update matching ones'}</span>
        </label>)}
      </fieldset>
      <p className="mb-3 t-body text-ink-2">{mode === 'replace'
        ? `${preview.removed} contacts will be removed from this app.${decisionRemovals ? ` ${decisionRemovals} saved decisions on remaining contacts will be cleared.` : ''} You can undo this restore for 10 minutes.`
        : 'Matching contacts and decisions use the backup’s version, even if older. Other contacts and decisions stay here. You can undo this restore for 10 minutes.'}</p>
      <Button full loading={busy} onClick={() => void commit()}>{mode === 'replace' ? "Replace this app's data" : 'Merge backup'}</Button>
      {message && <InlineNotice tone={failed ? 'error' : 'info'}>{message}</InlineNotice>}
      <Button full variant="ghost" disabled={busy} onClick={() => { setReview(null); setMessage('') }}>Cancel restore</Button>
    </section>}
    {!review && message && <InlineNotice tone={failed ? 'error' : 'info'}>{message}</InlineNotice>}
  </div>
}
