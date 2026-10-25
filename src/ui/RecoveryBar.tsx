import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './index'
import { InlineNotice } from './feedback'
import { useRecoveryStore, type RecoveryEntry, type StoredRecoveryEntry } from './recoveryStore'

export interface RecoveryBarProps { entries?: readonly RecoveryEntry[] }
function relativeTime(at: number, now: number) {
  const minutes = Math.floor(Math.max(0, now - at) / 60000)
  if (!minutes) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} hr ago`
}

function RecoveryRow({ entry, now, remove }: { entry: RecoveryEntry; now: number; remove?: (id: string) => void }) {
  const labelId = useId()
  const [state, setState] = useState<'checking' | 'ready' | 'changed' | 'busy'>('checking')
  const [error, setError] = useState('')
  const locked = useRef(false)
  const generation = useRef(0)
  const available = (entry as Partial<StoredRecoveryEntry>).available !== false
  useEffect(() => {
    generation.current++
    locked.current = false
    setError('')
    const check = async () => {
      if (locked.current) return
      const request = ++generation.current
      setState('checking')
      try {
        const allowed = !entry.canUndo || await entry.canUndo()
        if (request === generation.current) setState(allowed ? 'ready' : 'changed')
      } catch {
        if (request === generation.current) { setState('ready'); setError('Could not check recovery. Try Undo again.') }
      }
    }
    void check()
    const refresh = () => { if (document.visibilityState !== 'hidden') void check() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      generation.current++
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [entry])
  const run = async (undo: boolean) => {
    if (locked.current) return
    locked.current = true
    const request = ++generation.current
    setState('busy'); setError('')
    try {
      // This check is advisory. onUndo must also compare expected state atomically.
      if (undo && entry.canUndo && !await entry.canUndo()) {
        if (request === generation.current) setState('changed')
        return
      }
      if (request !== generation.current) return
      const result = await (undo ? entry.onUndo() : entry.onDismiss())
      if (result !== false) remove?.(entry.id)
      if (request === generation.current) setState('ready')
    } catch {
      if (request === generation.current) {
        setError(undo ? 'Could not undo. Please try again.' : 'Could not dismiss. Please try again.')
        setState('ready')
      }
    } finally { if (request === generation.current) locked.current = false }
  }
  return <li className="recovery-row space-y-2 border-b border-rule py-3" aria-labelledby={labelId}>
    <div id={labelId} className="t-body">{entry.label}</div>
    <time className="t-meta text-ink-2" dateTime={new Date(entry.at).toISOString()}>{relativeTime(entry.at, now)}</time>
    <div className="sheet-actions flex flex-wrap gap-2">
      <Button type="button" disabled={!available || state === 'changed' || state === 'checking' || state === 'busy'}
        aria-busy={state === 'busy' || state === 'checking' || undefined} onClick={() => void run(true)}>
        {!available ? 'Undo unavailable' : state === 'changed' ? 'Changed since' : 'Undo'}
      </Button>
      <Button type="button" variant="ghost" disabled={state === 'busy'} onClick={() => void run(false)}>Dismiss</Button>
    </div>
    {error && <InlineNotice tone="error">{error}</InlineNotice>}
  </li>
}

/** Persistent, in-flow recovery. Omit entries to subscribe to the shared tab store. */
export function RecoveryBar({ entries }: RecoveryBarProps = {}) {
  const store = useRecoveryStore()
  const rows = entries ?? store.list()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!rows.length) return
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [rows.length])
  if (!rows.length) return null
  return <section aria-label="Pending recoveries" className="recovery-bar min-w-0">
    <ul aria-label="Pending recoveries" className="m-0 list-none p-0">
      {rows.map(entry => <RecoveryRow key={entry.id} entry={entry} now={now} remove={entries ? undefined : id => {
        // A completed operation survives navigation, but cannot remove a replacement entry.
        if (store.list().find(item => item.id === id) === entry) store.remove(id)
      }} />)}
    </ul>
  </section>
}
