// Recovery notices survive replacement and modal suppression.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMediaQuery } from './useMediaQuery'
import { motionProps } from './motion'

export type ToastTone = 'default' | 'delete' | 'work' | 'personal'
export interface ToastOptions {
  action?: { label: string; onClick: () => void }
  /** Default 2600 ms, or 4000 ms when there is an action. */
  duration?: number
  tone?: ToastTone
  /** Actions default to high priority; informational notices default to low. */
  priority?: 'low' | 'high'
}
interface ToastState extends ToastOptions { id: number; message: string; createdAt: number }
let current: ToastState | null = null
let queue: ToastState[] = []
let seq = 0
let manualSuppression = false
let dialogSuppression = false
const listeners = new Set<() => void>()
const isSuppressed = () => manualSuppression || dialogSuppression
function emit() { for (const listener of listeners) listener() }
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function toast(message: string, options: ToastOptions = {}) {
  const next = { id: ++seq, message, createdAt: Date.now(), ...options,
    priority: options.priority ?? (options.action ? 'high' : 'low') } satisfies ToastState
  if (current && (next.priority === 'high' || current.priority === 'high')) {
    // Keep every recovery, but only the latest waiting informational notice.
    if (next.priority === 'low') queue = queue.filter(item => item.priority === 'high')
    queue.push(next)
  } else current = next
  emit()
}
export function dismissToast() { current = queue.shift() ?? null; emit() }

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

/** Sheets call this until their exit completes; nested Sheets share one lock. */
export function setToastSuppressed(suppressed: boolean) {
  updateSuppression(suppressed, dialogSuppression)
}

const toneColor: Record<ToastTone, string> = {
  default: 'var(--ink)', delete: 'var(--stamp-delete)',
  work: 'var(--stamp-work)', personal: 'var(--stamp-personal)',
}

function ToastMessage({ state, paused = false }: { state: ToastState; paused?: boolean }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const remaining = useRef(state.duration ?? (state.action ? 4000 : 2600))
  useEffect(() => {
    if (paused || hovered || focused) return
    const started = Date.now()
    const timer = setTimeout(() => { if (current?.id === state.id) dismissToast() }, remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (Date.now() - started))
    }
  }, [state.id, paused, hovered, focused])
  return <motion.div
    {...motionProps(reduced, { initial: { opacity: 0, y: 12, scale: 0.98 },
      animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 8, scale: 0.98 },
      transition: { duration: 0.22, ease: 'easeOut' } })}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-control bg-paper-2 py-2 pr-2 pl-4 font-sans t-meta text-ink shadow-card">
    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: toneColor[state.tone ?? 'default'] }} aria-hidden="true" />
    <span className="min-w-0 break-words">{state.message}</span>
    {state.action && <button type="button" className="hit-44 shrink-0 rounded-full bg-ink px-3 text-paper"
      onClick={() => { dismissToast(); state.action?.onClick() }}>{state.action.label}</button>}
  </motion.div>
}

export function Toaster() {
  const state = useSyncExternalStore(subscribe, () => current, () => null)
  const suppressed = useSyncExternalStore(subscribe, isSuppressed, () => false)
  useEffect(() => {
    // Also honor dialogs owned by screens rather than the shared Sheet.
    const sync = () => updateSuppression(manualSuppression, !!document.querySelector('[role="dialog"][aria-modal="true"]'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal'] })
    return () => { observer.disconnect(); updateSuppression(manualSuppression, false) }
  }, [])
  return <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
    style={{ bottom: 'var(--toast-bottom, calc(env(safe-area-inset-bottom) + 88px))',
      paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))',
      visibility: suppressed ? 'hidden' : undefined,
    }} aria-hidden={suppressed || undefined} aria-live="polite" role="status">
    {suppressed ? state && <ToastMessage key={state.id} state={state} paused />
      : <AnimatePresence>{state && <ToastMessage key={state.id} state={state} />}</AnimatePresence>}
  </div>
}
