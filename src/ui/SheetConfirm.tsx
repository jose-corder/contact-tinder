import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Button } from './index'
import { useMediaQuery } from './useMediaQuery'

export interface SheetConfirmProps {
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel: string
  tone?: 'default' | 'danger' | 'delete'
  onConfirm: () => void
  onCancel: () => void
  initialFocus?: 'heading' | 'cancel'
  returnFocusTo?: RefObject<HTMLElement | null>
}

/** Render in Sheet children, before inline final actions; never opens another dialog. */
export function SheetConfirm({ title, body, confirmLabel, cancelLabel, tone = 'default', onConfirm, onCancel,
  initialFocus = 'cancel', returnFocusTo }: SheetConfirmProps) {
  const titleId = useId()
  const bodyId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const activated = useRef(false)
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    const target = initialFocus === 'heading' ? heading.current : cancel.current
    target?.focus({ preventScroll: true })
    if (activated.current) return
    activated.current = true
    // Reveal the focused control even when the confirmation is taller than the sheet body.
    target?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    setAnnouncement(title)
  }, [initialFocus, reduced, title])
  function cancelConfirmation() {
    onCancel()
    // Wait for the parent to re-enable its trigger after removing the confirmation.
    queueMicrotask(() => { if (returnFocusTo?.current?.isConnected) returnFocusTo.current.focus({ preventScroll: true }) })
  }
  return <section className="sheet-confirm my-3 space-y-3 border-t border-rule pt-3"
    role="group" aria-labelledby={titleId} aria-describedby={bodyId}>
    <h3 ref={heading} tabIndex={-1} id={titleId} className="t-heading">{title}</h3>
    <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
    <div id={bodyId} className="t-body text-ink-2">{body}</div>
    <div className="sheet-actions flex flex-wrap gap-3">
      <Button ref={cancel} type="button" variant="ghost" onClick={cancelConfirmation}>{cancelLabel}</Button>
      <Button type="button" onClick={onConfirm}
        style={tone === 'default' ? undefined : { background: 'var(--stamp-delete)', color: 'var(--on-delete)' }}>{confirmLabel}</Button>
    </div>
  </section>
}
