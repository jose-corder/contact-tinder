export type ToastTone = 'default' | 'delete' | 'work' | 'personal'
export interface ToastOptions {
  action?: { label: string; onClick: () => void }
  /** Default 2600 ms, or 4000 ms with an action; counted only while visible. */
  duration?: number
  tone?: ToastTone
  priority?: 'low' | 'high'
  /** Checked immediately before invoking the action. */
  validUntil?: () => boolean
}
export interface ToastHandle {
  id: number
  dismiss(): void
  /** Merge options, retain identity, and restart the visible duration. */
  update(message: string, options?: ToastOptions): void
}
export interface ToastState extends ToastOptions {
  id: number; message: string; createdAt: number; remaining: number; version: number
}
let current: ToastState | null = null
let queue: ToastState[] = []
let seq = 0
let manualSuppression = false
let dialogSuppression = false
const listeners = new Set<() => void>()
export const isSuppressed = () => manualSuppression || dialogSuppression
export const getToast = () => current
function emit() { for (const listener of listeners) listener() }
export function subscribeToast(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const durationOf = (options: ToastOptions) => options.duration ?? (options.action ? 4000 : 2600)

export function toast(message: string, options: ToastOptions = {}): ToastHandle {
  const next: ToastState = { ...options, id: ++seq, message, createdAt: Date.now(),
    remaining: durationOf(options), version: 0, priority: options.priority ?? (options.action ? 'high' : 'low') }
  if (!current) current = next
  else if (next.priority === 'high') { queue.unshift(current); current = next }
  else queue.push(next)
  emit()
  return { id: next.id, dismiss: () => dismissToast(next.id), update: (message, options) => updateToast(next.id, message, options) }
}

/** With no id, dismiss the active notice (legacy behavior). */
export function dismissToast(id?: number) {
  if (id === undefined || current?.id === id) current = queue.shift() ?? null
  else queue = queue.filter(item => item.id !== id)
  emit()
}

export function updateToast(id: number, message: string, options: ToastOptions = {}) {
  const previous = current?.id === id ? current : queue.find(item => item.id === id)
  if (!previous) return
  const updated = { ...previous, ...options, message, createdAt: Date.now(), version: previous.version + 1 }
  updated.remaining = durationOf(updated)
  if (current?.id === id) current = updated
  else queue = queue.map(item => item.id === id ? updated : item)
  emit()
}

/** Toolbar top clearance in CSS pixels; null restores the safe-area default. */
export function setToastBottom(px: number | null) {
  if (px === null) document.documentElement.style.removeProperty('--toast-bottom')
  else document.documentElement.style.setProperty('--toast-bottom', `${px}px`)
}

function updateSuppression(manual: boolean, dialogs: boolean) {
  const wasSuppressed = isSuppressed()
  manualSuppression = manual
  dialogSuppression = dialogs
  if (wasSuppressed && !isSuppressed()) {
    const fresh = (item: ToastState) => item.priority === 'high' || Date.now() - item.createdAt < 6000
    queue = queue.filter(fresh)
    if (current && !fresh(current)) current = queue.shift() ?? null
  }
  emit()
}
export function setToastSuppressed(suppressed: boolean) { updateSuppression(suppressed, dialogSuppression) }
export function setDialogSuppressed(suppressed: boolean) { updateSuppression(manualSuppression, suppressed) }
