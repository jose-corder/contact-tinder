import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from './useMediaQuery'

interface SheetProps { open: boolean; onClose: () => void; title?: string; children: ReactNode }
const sheets: HTMLElement[] = []
let unlockBody: (() => void) | undefined

function lockBody() {
  const { style } = document.body
  const original = { overflow: style.overflow, position: style.position, top: style.top, width: style.width }
  const scrollY = window.scrollY
  Object.assign(style, { overflow: 'hidden', position: 'fixed', top: `-${scrollY}px`, width: '100%' })
  return () => {
    Object.assign(style, original)
    window.scrollTo({ top: scrollY, behavior: 'instant' })
  }
}

function SheetContent({ onClose, title, children }: Omit<SheetProps, 'open'>) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose }, [onClose])
  const titleId = useId()
  const drag = useDragControls()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    const dialog = panel.current!
    const previous = document.activeElement as HTMLElement | null
    if (!sheets.length) unlockBody = lockBody()
    sheets.push(dialog)
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]',
    )].filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')
    const focusFirst = () => (focusable()[0] ?? dialog).focus()
    focusFirst()
    const keydown = (event: KeyboardEvent) => {
      if (sheets.at(-1) !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close.current()
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0] ?? dialog
      const last = items.at(-1) ?? dialog
      if (!items.length || !dialog.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    const containFocus = (event: FocusEvent) => {
      if (sheets.at(-1) === dialog && !dialog.contains(event.target as Node)) focusFirst()
    }
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', containFocus)
      sheets.splice(sheets.indexOf(dialog), 1)
      if (!sheets.length) { unlockBody?.(); unlockBody = undefined }
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  return <>
    <motion.div aria-hidden="true" className="fixed inset-0 z-40 bg-ink/30"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.16 }} onClick={onClose} />
    <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className="sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[20px] border border-rule bg-paper-2 px-5 shadow-card"
      style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      initial={reduced ? { opacity: 0 } : { y: '100%' }} animate={{ y: 0, opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { y: '100%' }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 40 }}
      drag="y" dragListener={false} dragControls={drag} dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }} dragSnapToOrigin
      onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}>
      <button type="button" aria-label="Close sheet" className="flex h-11 shrink-0 touch-none items-center justify-center"
        onPointerDown={(event) => drag.start(event)} onClick={onClose}>
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-rule" />
      </button>
      <h2 id={titleId} className={title ? 'eyebrow mb-3 shrink-0' : 'sr-only'}>{title ?? 'Options'}</h2>
      <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
    </motion.div>
  </>
}

export function Sheet({ open, ...props }: SheetProps) {
  return createPortal(<AnimatePresence>{open && <SheetContent key="sheet" {...props} />}</AnimatePresence>, document.body)
}
