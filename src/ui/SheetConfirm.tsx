import { useId, type ReactNode } from 'react'
import { Button } from './index'

export interface SheetConfirmProps {
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel: string
  tone?: 'default' | 'danger' | 'delete'
  onConfirm: () => void
  onCancel: () => void
}

/** Render in Sheet children, before inline final actions; never opens another dialog. */
export function SheetConfirm({ title, body, confirmLabel, cancelLabel, tone = 'default', onConfirm, onCancel }: SheetConfirmProps) {
  const titleId = useId()
  const bodyId = useId()
  return <section className="sheet-confirm my-3 space-y-3 border-t border-rule pt-3"
    role="group" aria-labelledby={titleId} aria-describedby={bodyId}>
    <h3 id={titleId} className="t-heading">{title}</h3>
    <div id={bodyId} className="t-body text-ink-2">{body}</div>
    <div className="sheet-actions flex flex-wrap gap-3">
      <Button type="button" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
      <Button type="button" onClick={onConfirm}
        style={tone === 'default' ? undefined : { background: 'var(--stamp-delete)', color: 'var(--on-delete)' }}>{confirmLabel}</Button>
    </div>
  </section>
}
