import type { HTMLAttributes } from 'react'
import { useConstrainedViewport } from './useConstrainedViewport'

export interface ScrollFallbackProps extends HTMLAttributes<HTMLDivElement> { when?: boolean }
/** Wrap the fixed-height screen; mark an absolutely positioned stage with data-scroll-stage. */
export function ScrollFallback({ when, className = '', children, ...props }: ScrollFallbackProps) {
  const { shortHeight, keyboardOpen, largeText } = useConstrainedViewport()
  const constrained = when ?? (shortHeight || keyboardOpen || largeText)
  return <div {...props} data-constrained={constrained} className={`scroll-fallback ${className}`}>{children}</div>
}
