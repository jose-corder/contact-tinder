import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** Shared clipboard state for buttons and gestures; never emits a global toast. */
export function useCopyFeedback(value: string, onCopied?: () => void) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const attempt = useRef(0)
  const pending = useRef(false)
  const callback = useRef(onCopied)
  useLayoutEffect(() => { callback.current = onCopied }, [onCopied])
  useLayoutEffect(() => {
    setResult(''); setBusy(false); pending.current = false
    return () => { clearTimeout(timer.current); attempt.current++ }
  }, [value])
  const copy = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    const request = ++attempt.current
    clearTimeout(timer.current); setResult(''); setBusy(true)
    try {
      await navigator.clipboard.writeText(value)
      if (request !== attempt.current) return
      setResult('Copied')
      timer.current = setTimeout(() => setResult(''), 1500)
    } catch {
      if (request === attempt.current) setResult('Copy failed')
      return
    } finally {
      if (request === attempt.current) { pending.current = false; setBusy(false) }
    }
    callback.current?.()
  }, [value])
  const status = <span role="status" aria-live="polite" aria-atomic="true">{result}</span>
  const fallback = result === 'Copy failed'
    ? <span className="min-w-0 break-all t-meta" style={{ userSelect: 'all' }}>{value}</span> : null
  return { busy, result, copy, status, fallback }
}
