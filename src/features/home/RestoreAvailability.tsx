import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { RESTORE_UNDO_MS, restoreHistory } from '@/export/json'

/** #41: only promise recovery while an unexpired entry actually exists. */
export default function RestoreAvailability() {
  const entries = useLiveQuery(restoreHistory)
  const [now, setNow] = useState(Date.now)
  const available = (entries ?? []).filter(entry => now - entry.at < RESTORE_UNDO_MS)
  useEffect(() => { setNow(Date.now()) }, [entries])
  useEffect(() => {
    const expiry = (entries ?? []).map(entry => entry.at + RESTORE_UNDO_MS).filter(at => at > Date.now())
    if (!expiry.length) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(...expiry) - Date.now()))
    return () => clearTimeout(timer)
  }, [entries, now])
  return available.length ? <p className="t-meta text-ink-2">You can undo a restore for 10 minutes</p> : null
}
