import { motion, type MotionValue } from 'framer-motion'
import type { Direction } from '@/domain/types'
import { DECK_MOTION, useDeckReducedMotion } from './motion'

const positions: Record<Direction, string> = {
  left: 'left-6 top-8', right: 'right-6 top-8', up: 'left-1/2 top-8 -translate-x-1/2', down: 'bottom-8 left-1/2 -translate-x-1/2',
}

export function Stamp({ label, color, opacity, direction, committed = false }: {
  label: string; color: string; opacity: number | MotionValue<number>; direction: Direction; committed?: boolean
}) {
  const reduced = useDeckReducedMotion()
  return <motion.div aria-hidden="true" className={`pointer-events-none absolute z-10 ${positions[direction]}`} style={{ opacity, color }}>
    <motion.span className="stamp inline-block" animate={{ opacity: committed && !reduced ? [1, 1, 0] : 1 }}
      transition={reduced ? DECK_MOTION.fade : { duration: DECK_MOTION.fling.duration, times: [0, DECK_MOTION.stampHold / DECK_MOTION.fling.duration, 1] }}>{label}</motion.span>
  </motion.div>
}
