import { useLayoutEffect, useRef, useSyncExternalStore, type HTMLAttributes } from 'react'

const docks: HTMLElement[] = []
const listeners = new Set<() => void>()
let height = 0
const emit = () => { for (const listener of listeners) listener() }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useToastDock() { return useSyncExternalStore(subscribe, () => docks.at(-1) ?? null, () => null) }
/** Active visible toast height in CSS pixels; zero when empty or suppressed. */
export function useToastHeight() { return useSyncExternalStore(subscribe, () => height, () => 0) }
export function setToastHeight(next: number) { if (next !== height) { height = next; emit() } }

/** Latest mounted dock owns the portal. Its 44px minimum grows naturally with content. */
export function ToastDock({ className = '', style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = ref.current!
    docks.push(node); emit()
    return () => { docks.splice(docks.indexOf(node), 1); emit() }
  }, [])
  return <div {...props} ref={ref} className={`toast-dock ${className}`}
    style={{ ...style, minHeight: 44, height: 'auto', flexShrink: 0 }} />
}
