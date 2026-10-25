import type { MotionProps } from 'framer-motion'

/** Reactive reduced-motion policy: 120ms opacity only, including mid-animation changes. */
export function motionProps(reduced: boolean, normal: MotionProps = {}): MotionProps {
  const fade: MotionProps = {
    initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 },
    transition: { duration: reduced ? 0.12 : 0.15, ease: 'easeOut' },
  }
  return reduced ? { ...fade, transformTemplate: () => 'none' } : { ...fade, ...normal }
}
