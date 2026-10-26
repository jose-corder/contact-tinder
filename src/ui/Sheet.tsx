import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from './useMediaQuery'
import { motionProps } from './motion'
import { setToastSuppressed } from './toast'
import { useSheetLayout } from './useSheetLayout'
import { useLastInputModality } from './useLastInputModality'
import { useScrollFade } from './useScrollFade'

export interface SheetProps {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode
  /** Preferred keyboard target (or group containing it). Pointer opens focus the heading. */
  initialFocus?: RefObject<HTMLElement | null>
}
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

function SheetContent({ onClose, title, children, footer, initialFocus }: Omit<SheetProps, 'open'>) {
  const panel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const openedWith = useRef(useLastInputModality()).current
  useScrollFade(body)
  const [footerHost] = useState(() => {
    const node = document.createElement('div')
    node.className = 'sheet-footer shrink-0 border-t border-rule pt-4'
    node.style.paddingBottom = '16px'
    return node
  })
  useLayoutEffect(() => {
    panel.current?.append(footerHost)
    return () => footerHost.remove()
  }, [footerHost])
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose }, [onClose])
  const titleId = useId()
  const drag = useDragControls()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const viewport = useSheetLayout(panel, body, header, footerHost)
  useLayoutEffect(() => {
    footerHost.className = 'sheet-footer shrink-0 border-t border-rule pt-4'
    footerHost.hidden = !footer
    footerHost.style.paddingBottom = '16px'
    footerHost.style.position = viewport.constrained && viewport.sticky ? 'sticky' : 'static'
    footerHost.style.bottom = '0px'
    const parent = viewport.constrained ? body.current : panel.current
    if (parent && parent.lastElementChild !== footerHost) {
      const focused = document.activeElement as HTMLElement | null
      const restoreFocus = focused && footerHost.contains(focused)
      parent.append(footerHost)
      if (restoreFocus) focused.focus({ preventScroll: true })
    }
  }, [footerHost, footer, children, viewport.constrained, viewport.sticky])

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
    const preferred = initialFocus?.current
    const keyboardTarget = focusable().find(el => preferred ? preferred === el || preferred.contains(el) : body.current?.contains(el))
    ;(openedWith === 'keyboard' ? keyboardTarget ?? focusable()[0] ?? dialog : heading.current ?? dialog).focus({ preventScroll: true })
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
        (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) ||
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
      data-constrained={viewport.constrained}
      className="sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[20px] border border-control bg-paper-2 shadow-card"
      style={{ bottom: viewport.bottom + viewport.safeBottom,
        maxHeight: viewport.constrained ? Math.max(0, viewport.height - viewport.safeTop - viewport.safeBottom)
          : `min(var(--sheet-max-height, 85vh), ${Math.max(0, viewport.height - Math.max(24, viewport.safeTop) - viewport.safeBottom)}px)`,
        paddingLeft: 'max(20px, var(--sheet-safe-left, env(safe-area-inset-left)))',
        paddingRight: 'max(20px, var(--sheet-safe-right, env(safe-area-inset-right)))',
      } as CSSProperties}
      {...motionProps(reduced, { initial: { y: '100%' }, animate: { y: 0, opacity: 1 },
        exit: { y: '100%' }, transition: { type: 'spring', stiffness: 400, damping: 40 } })}
      drag={reduced ? false : 'y'} dragListener={false} dragControls={drag} dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }} dragSnapToOrigin
      onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}>
      <div ref={header} className="sheet-header shrink-0">
        <button type="button" aria-label="Close sheet" className="sheet-handle flex w-full shrink-0 touch-none items-center justify-center"
          onPointerDown={(event) => { if (!reduced) drag.start(event) }} onClick={onClose}>
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-rule" />
        </button>
        <div className={title ? 'sheet-title' : undefined}>
          <h2 ref={heading} tabIndex={-1} id={titleId} className={title ? 'eyebrow t-eyebrow' : 'sr-only'}>{title ?? 'Options'}</h2>
        </div>
      </div>
      <div ref={body} className="sheet-body scroll-fade min-h-0 overflow-y-auto overscroll-contain"
        // The footer is always in normal flow (a sibling below the body, or a sticky last child of the
        // body when constrained), so content never sits under it and no footer-sized padding is
        // needed. Only a sticky footer overlaps focused fields while scrolling, so only then does
        // scroll-padding reserve its height.
        style={{ scrollPaddingBottom: viewport.constrained && viewport.sticky ? viewport.footerHeight + 16 : 16,
          paddingBottom: footer ? 16 : 'max(16px, env(safe-area-inset-bottom))' }}>{children}</div>
      {createPortal(footer, footerHost)}
    </motion.div>
  </>
}

export function Sheet({ open, ...props }: SheetProps) {
  return createPortal(<AnimatePresence>{open && <SheetContent key="sheet" {...props} />}</AnimatePresence>, document.body)
}
