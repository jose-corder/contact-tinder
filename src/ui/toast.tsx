// Tiny global toast. Mount <Toaster /> once (App.tsx) and call toast(...) from anywhere.
// Non-blocking, one visible at a time, bottom-centered above the safe area, role=status.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useSyncExternalStore } from 'react'
import { prefersReducedMotion } from './theme'

export type ToastTone = 'default' | 'delete' | 'work' | 'personal'

export interface ToastOptions {
  /** Optional inline action, e.g. { label: 'Undo', onClick } */
  action?: { label: string; onClick: () => void }
  /** Milliseconds before auto-dismiss. Default 2600, or 4000 when there is an action. */
  duration?: number
  tone?: ToastTone
}

interface ToastState extends ToastOptions {
  id: number
  message: string
}

let current: ToastState | null = null
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function toast(message: string, options: ToastOptions = {}) {
  current = { id: ++seq, message, ...options }
  emit()
}

export function dismissToast() {
  if (!current) return
  current = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const toneColor: Record<ToastTone, string> = {
  default: 'var(--ink)',
  delete: 'var(--stamp-delete)',
  work: 'var(--stamp-work)',
  personal: 'var(--stamp-personal)',
}

export function Toaster() {
  const state = useSyncExternalStore(subscribe, () => current, () => null)
  useEffect(() => {
    if (!state) return
    const ms = state.duration ?? (state.action ? 4000 : 2600)
    const t = setTimeout(() => {
      if (current?.id === state.id) dismissToast()
    }, ms)
    return () => clearTimeout(t)
  }, [state])
  const reduced = prefersReducedMotion()
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-5"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
      aria-live="polite"
      role="status"
    >
      <AnimatePresence>
        {state && (
          <motion.div
            key={state.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduced ? 0.12 : 0.22, ease: 'easeOut' }}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-rule bg-paper-2 py-2 pr-2 pl-4 font-sans text-[13px] text-ink shadow-card"
          >
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: toneColor[state.tone ?? 'default'] }} aria-hidden="true" />
            <span className="min-w-0 break-words">{state.message}</span>
            {state.action && (
              <button
                type="button"
                className="h-8 shrink-0 rounded-full bg-ink px-3 text-paper"
                onClick={() => {
                  dismissToast()
                  state.action?.onClick()
                }}
              >
                {state.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
