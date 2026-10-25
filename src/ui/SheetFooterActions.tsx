import { Button } from './index'
import type { Ref } from 'react'

interface Action { label: string; onClick: () => void; disabled?: boolean; ref?: Ref<HTMLButtonElement> }
export interface SheetFooterActionsProps {
  /** Render as the last row of Sheet children, within the body scroller. */
  inline?: boolean
  secondary?: Action
  primary: Action & { loading?: boolean }
}

/** Pass as Sheet.footer to keep completion actions outside the body scroller. */
export function SheetFooterActions({ secondary, primary, inline = false }: SheetFooterActionsProps) {
  return <div className={`sheet-actions flex flex-wrap items-center gap-3${inline ? ' sheet-actions-inline border-t border-rule pt-4' : ''}`}>
    {secondary && <Button ref={secondary.ref} type="button" variant="ghost" disabled={secondary.disabled} onClick={secondary.onClick}>{secondary.label}</Button>}
    <Button type="button" className="flex-1" disabled={primary.disabled} loading={primary.loading} onClick={primary.onClick}>{primary.label}</Button>
  </div>
}
