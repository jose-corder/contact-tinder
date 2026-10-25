import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from './useMediaQuery'
import { motionProps } from './motion'
import { setToastSuppressed } from './toast'

export interface SheetProps { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }
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

function SheetContent({ onClose, title, children, footer }: Omit<SheetProps, 'open'>) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose }, [onClose])
  const titleId = useId()
  const drag = useDragControls()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [viewport, setViewport] = useState({ height: window.visualViewport?.height ?? window.innerHeight, bottom: 0 })

  useLayoutEffect(() => {
    const visual = window.visualViewport
    const resize = () => setViewport({
      height: visual?.height ?? window.innerHeight,
      bottom: visual ? Math.max(0, window.innerHeight - visual.height - visual.offsetTop) : 0,
    })
    resize()
    visual?.addEventListener('resize', resize)
    visual?.addEventListener('scroll', resize)
    window.addEventListener('resize', resize)
    return () => {
      visual?.removeEventListener('resize', resize)
      visual?.removeEventListener('scroll', resize)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useLayoutEffect(() => {
    const dialog = panel.current!
    const previous = document.activeElement as HTMLElement | null
    if (!sheets.length) unlockBody = lockBody()
    sheets.push(dialog)
    setToastSuppressed(true)
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
      if (!sheets.length) { unlockBody?.(); unlockBody = undefined; setToastSuppressed(false) }
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  return <>
    <motion.div aria-hidden="true" className="fixed inset-0 z-40 bg-ink/30"
      {...motionProps(reduced, { transition: { duration: 0.16 } })} onClick={onClose} />
    <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className="sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[20px] border border-control bg-paper-2 shadow-card"
      style={{ bottom: viewport.bottom,
        maxHeight: `min(var(--sheet-max-height, 85vh), ${Math.max(0, viewport.height - 24)}px)`,
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
      } as CSSProperties}
      {...motionProps(reduced, { initial: { y: '100%' }, animate: { y: 0, opacity: 1 },
        exit: { y: '100%' }, transition: { type: 'spring', stiffness: 400, damping: 40 } })}
      drag={reduced ? false : 'y'} dragListener={false} dragControls={drag} dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }} dragSnapToOrigin
      onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}>
      <button type="button" aria-label="Close sheet" className="flex h-11 shrink-0 touch-none items-center justify-center"
        onPointerDown={(event) => { if (!reduced) drag.start(event) }} onClick={onClose}>
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-rule" />
      </button>
      <h2 id={titleId} className={title ? 'eyebrow t-eyebrow mb-3 shrink-0' : 'sr-only'}>{title ?? 'Options'}</h2>
      <div className="sheet-body min-h-0 overflow-y-auto overscroll-contain"
        style={{ scrollPaddingBottom: 96, paddingBottom: footer ? 16 : 'max(16px, env(safe-area-inset-bottom))' }}>{children}</div>
      {footer && <div className="sheet-footer shrink-0 border-t border-rule pt-4"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>{footer}</div>}
    </motion.div>
  </>
}

export function Sheet({ open, ...props }: SheetProps) {
  return createPortal(<AnimatePresence>{open && <SheetContent key="sheet" {...props} />}</AnimatePresence>, document.body)
}
