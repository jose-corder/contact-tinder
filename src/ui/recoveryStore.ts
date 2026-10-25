import { useSyncExternalStore } from 'react'

export interface RecoveryEntry {
  kind?: 'merge'
  /** Advisory state used to retain callback identity across equivalent repository reads. */
  revision?: string
  id: string
  label: string
  /** Unix timestamp in milliseconds. */
  at: number
  onUndo: () => void | boolean | Promise<void | boolean>
  onDismiss: () => void | Promise<void>
  canUndo?: () => Promise<boolean>
  /** Counted from at, not from mounting the bar. Defaults to ten minutes. */
  ttlMs?: number
}
export interface StoredRecoveryEntry extends RecoveryEntry { available: boolean; ttlMs: number }
type Metadata = Pick<StoredRecoveryEntry, 'id' | 'label' | 'at' | 'ttlMs' | 'kind'>
const KEY = 'ct.recoveries.v1'
const DEFAULT_TTL = 10 * 60 * 1000
const listeners = new Set<() => void>()
let entries: StoredRecoveryEntry[] = []
let loaded = false
let timer: ReturnType<typeof setTimeout> | undefined
const emit = () => listeners.forEach(listener => listener())

function persist() {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(entries.filter(entry => !entry.id.startsWith('review-'))
      .map(({ id, label, at, ttlMs, kind }) => ({ id, label, at, ttlMs, kind }))))
  } catch { /* Keep recoveries usable in memory when storage is unavailable. */ }
}
function schedule() {
  clearTimeout(timer)
  if (!entries.length) return
  const next = Math.min(...entries.map(entry => entry.at + entry.ttlMs))
  timer = setTimeout(prune, Math.min(2 ** 31 - 1, Math.max(0, next - Date.now())))
}
function prune() {
  const retained = entries.filter(entry => entry.at + entry.ttlMs > Date.now())
  if (retained.length !== entries.length) { entries = retained; persist(); emit() }
  schedule()
}
function load() {
  if (loaded) return
  loaded = true
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]')
    if (Array.isArray(saved)) entries = saved.filter((item): item is Metadata => !!item &&
      typeof item.id === 'string' && !item.id.startsWith('review-') && typeof item.label === 'string' && Number.isFinite(item.at) &&
      Number.isFinite(item.ttlMs) && item.ttlMs > 0 && item.at + item.ttlMs > Date.now())
      .map(item => ({ id: item.id, label: item.label, at: item.at, ttlMs: item.ttlMs, available: false,
        kind: item.kind ?? (item.label.startsWith('Merged ') ? 'merge' : undefined),
        onUndo: () => false, onDismiss: () => remove(item.id) }))
  } catch { /* Corrupt or unavailable tab storage starts empty. */ }
  persist(); schedule()
}
function add(entry: RecoveryEntry) {
  load()
  if (!Number.isFinite(entry.at)) throw new Error('Recovery at must be a timestamp')
  const previous = entries.find(item => item.id === entry.id)
  const ttlMs = previous?.ttlMs ?? entry.ttlMs ?? DEFAULT_TTL
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('Recovery ttlMs must be positive')
  // Rebinding a persisted ID cannot extend its original expiry.
  const next = { ...entry, at: previous?.at ?? entry.at, ttlMs, available: true }
  entries = entries.filter(item => item.id !== entry.id && item.at + item.ttlMs > Date.now())
  if (next.at + ttlMs > Date.now()) entries = [...entries, next]
  persist(); schedule(); emit()
}
function remove(id: string) {
  load()
  entries = entries.filter(entry => entry.id !== id)
  persist(); schedule(); emit()
}
function list(): readonly StoredRecoveryEntry[] { load(); prune(); return entries }
/** #65: repository merge entries replace their runtime mirrors, preserving move actions. */
function hydrate(incoming: readonly RecoveryEntry[]) {
  load()
  entries = [...entries.filter(entry => entry.kind !== 'merge' && !incoming.some(item => item.id === entry.id)),
    ...incoming.map(entry => {
      const ttlMs = entry.ttlMs ?? DEFAULT_TTL
      const previous = entries.find(item => item.id === entry.id)
      // A remount must not replace a callback while its Undo is already in flight.
      if (previous?.available && previous.kind === 'merge' && previous.revision === entry.revision
        && previous.at === entry.at && previous.ttlMs === ttlMs && previous.label === entry.label) return previous
      return { ...entry, kind: 'merge' as const, ttlMs, available: true }
    })]
    .filter(entry => entry.at + entry.ttlMs > Date.now())
  persist(); schedule(); emit()
}
function subscribe(listener: () => void) {
  load(); prune(); listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const snapshot = () => { load(); return entries }

/** Metadata survives reload; consumers must re-add matching IDs with live callbacks.
 * Snapshots and atomic content guards remain owned by the repository/consumer.
 * Callbacks themselves cannot be serialized into sessionStorage.
 */
export const recoveryStore = { add, remove, hydrate, list }
export function useRecoveryStore() {
  useSyncExternalStore(subscribe, snapshot, snapshot)
  return recoveryStore
}
