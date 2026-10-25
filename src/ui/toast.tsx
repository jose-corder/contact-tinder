import { motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from './useMediaQuery'
import { motionProps } from './motion'
import { LabelDot } from './feedback'
import { setToastHeight, useToastDock } from './ToastDock'
import { dismissToast, getToast, isSuppressed, setDialogSuppressed, subscribeToast, updateToast, type ToastState } from './toastStore'
export { toast, dismissToast, setToastBottom, setToastSuppressed } from './toastStore'
export type { ToastHandle, ToastOptions, ToastTone } from './toastStore'
export { ToastDock, useToastHeight } from './ToastDock'

function ToastMessage({ state, paused }: { state: ToastState; paused: boolean }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (paused || hovered || focused) return
    const started = Date.now()
    const timer = setTimeout(() => dismissToast(state.id), state.remaining)
    return () => {
      clearTimeout(timer)
      state.remaining = Math.max(0, state.remaining - (Date.now() - started))
    }
  }, [state, paused, hovered, focused])
  return <motion.div
    {...motionProps(reduced, { initial: { opacity: 0, y: 12, scale: 0.98 },
      animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 8, scale: 0.98 },
      transition: { duration: 0.22, ease: 'easeOut' } })}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    className="pointer-events-auto flex min-w-0 max-w-full items-center gap-3 rounded-full border border-control bg-paper-2 py-2 pr-2 pl-4 font-sans t-meta text-ink shadow-card">
    <LabelDot tone={state.tone ?? 'default'} size={8} />
    <span className="toast-text min-w-0">{state.message}</span>
    {state.action && <button type="button" className="hit-44 shrink-0 whitespace-nowrap rounded-full bg-ink px-3 text-paper"
      onClick={() => {
        if (getToast()?.id !== state.id) return
        let valid = true
        try { valid = state.validUntil?.() ?? true } catch { valid = false }
        if (!valid) {
          updateToast(state.id, 'This can no longer be undone', { action: undefined, validUntil: undefined, duration: 4000 })
          return
        }
        dismissToast(state.id)
        state.action?.onClick()
      }}>{state.action.label}</button>}
  </motion.div>
}

export function Toaster() {
  const state = useSyncExternalStore(subscribeToast, getToast, () => null)
  const suppressed = useSyncExternalStore(subscribeToast, isSuppressed, () => false)
  const dock = useToastDock()
  const region = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = region.current!
    const measure = () => setToastHeight(state && !suppressed ? node.getBoundingClientRect().height : 0)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); setToastHeight(0) }
  }, [state, suppressed, dock])
  useEffect(() => {
    const sync = () => setDialogSuppressed(!!document.querySelector('[role="dialog"][aria-modal="true"]'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal'] })
    return () => { observer.disconnect(); setDialogSuppressed(false) }
  }, [])
  const content = <div ref={region} className={`pointer-events-none flex justify-center ${dock ? 'w-full' : 'fixed inset-x-0 z-[60]'}`}
    style={{ ...(dock ? {} : { bottom: 'var(--toast-bottom, calc(env(safe-area-inset-bottom) + 88px))',
      paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }),
      visibility: suppressed ? 'hidden' : undefined,
    }} aria-hidden={suppressed || undefined} aria-live="polite" aria-atomic="true" role="status">
    {state && <ToastMessage key={`${state.id}:${state.version}`} state={state} paused={suppressed} />}
  </div>
  return dock ? createPortal(content, dock) : content
}
