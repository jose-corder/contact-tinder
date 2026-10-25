import { useCallback, useEffect, useRef } from 'react'
import { dismissToast, toast, type ToastHandle, type ToastOptions } from '@/ui/toast'

/** A deck owner can replace or clear only the notice it created (#5/#57). */
export function useDeckToast() {
  const handle = useRef<ToastHandle | undefined>(undefined)
  const dismiss = useCallback(() => {
    if (handle.current) dismissToast(handle.current.id)
    handle.current = undefined
  }, [])
  const notify = useCallback((message: string, options?: ToastOptions) => {
    dismiss()
    handle.current = options ? toast(message, options) : toast(message)
  }, [dismiss])
  useEffect(() => dismiss, [dismiss])
  return { notify, dismiss }
}
