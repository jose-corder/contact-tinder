import { useMediaQuery } from '@/ui'

/** One motion vocabulary for the deck; durations are seconds. */
export const DECK_MOTION = {
  fade: { duration: 0.12, ease: 'easeOut' as const },
  fling: { duration: 0.32, ease: 'easeOut' as const },
  undo: { duration: 0.26, ease: 'easeOut' as const },
  cancel: { type: 'spring' as const, stiffness: 500, damping: 35 },
  next: { type: 'spring' as const, stiffness: 300, damping: 30 },
  settle: { duration: 0.2, ease: 'easeOut' as const },
  stampHold: 0.12,
  commitThreshold: 0.35, // #32: stamp saturation and release use the same distance.
  tickMs: 600,
}

export const useDeckReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
