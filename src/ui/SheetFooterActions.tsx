import { Button } from './index'

interface Action { label: string; onClick: () => void; disabled?: boolean }
export interface SheetFooterActionsProps {
  secondary?: Action
  primary: Action & { loading?: boolean }
}

/** Pass as Sheet.footer to keep completion actions outside the body scroller. */
export function SheetFooterActions({ secondary, primary }: SheetFooterActionsProps) {
  return <div className="flex items-center gap-3">
    {secondary && <Button type="button" variant="ghost" disabled={secondary.disabled} onClick={secondary.onClick}>{secondary.label}</Button>}
    <Button type="button" className="flex-1" disabled={primary.disabled} loading={primary.loading} onClick={primary.onClick}>{primary.label}</Button>
  </div>
}
