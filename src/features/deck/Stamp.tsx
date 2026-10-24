import { motion, type MotionValue } from 'framer-motion'
import type { Direction } from '@/domain/types'

const positions: Record<Direction, string> = {
  left: 'left-6 top-8', right: 'right-6 top-8', up: 'left-1/2 top-8 -translate-x-1/2', down: 'bottom-8 left-1/2 -translate-x-1/2',
}

export function Stamp({ label, color, opacity, direction }: {
  label: string; color: string; opacity: number | MotionValue<number>; direction: Direction
}) {
  return <motion.div aria-hidden="true" className={`pointer-events-none absolute z-10 ${positions[direction]}`} style={{ opacity, color }}><span className="stamp inline-block">{label}</span></motion.div>
}
