import type { Direction } from '@/domain/types'
import { DECK_MOTION } from './motion'

export type Axis = 'x' | 'y'
export const DRAG_SLOP = 6
export function isDrag(dx: number, dy: number) { return Math.hypot(dx, dy) >= DRAG_SLOP }

/** Once chosen, the axis stays fixed until release; the card still follows both coordinates. */
export function lockAxis(dx: number, dy: number, locked: Axis | null): Axis | null {
  return locked ?? (Math.hypot(dx, dy) >= 12 ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : null)
}

export function resistDown(dy: number, cardWidth: number): number {
  const start = Math.max(1, cardWidth * 0.35) * 0.4
  return dy > start ? start + (dy - start) * 0.55 : dy
}

function dominant(dx: number, dy: number, axis?: Axis | null): Direction {
  return (axis ? axis === 'x' : Math.abs(dx) >= Math.abs(dy)) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
}

export function resolveDirection(dx: number, dy: number, vx: number, vy: number, cardWidth: number, axis?: Axis | null): Direction | null {
  const direction = dominant(dx || dy ? dx : vx, dx || dy ? dy : vy, axis)
  const horizontal = direction === 'left' || direction === 'right'
  const distance = horizontal ? dx : dy
  const velocity = horizontal ? vx : vy
  if (Math.abs(distance) >= Math.max(1, cardWidth * 0.35)) return direction
  if (Math.abs(velocity) > 500) return horizontal ? (velocity < 0 ? 'left' : 'right') : (velocity < 0 ? 'up' : 'down')
  return null
}

export function stampOpacity(dx: number, dy: number, cardWidth: number, axis?: Axis | null): Record<Direction, number> {
  const result = { left: 0, right: 0, up: 0, down: 0 }
  const direction = dominant(dx, dy, axis)
  const distance = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy)
  result[direction] = Math.min(1, distance / Math.max(1, cardWidth * 0.35 * DECK_MOTION.stampThreshold))
  return result
}

export function rotationFor(dx: number): number {
  return Math.max(-15, Math.min(15, dx / 20))
}

export function flingTarget(direction: Direction, dx: number, dy: number, cardWidth: number, cardHeight: number) {
  const horizontal = direction === 'left' || direction === 'right'
  const sign = direction === 'left' || direction === 'up' ? -1 : 1
  const primary = horizontal ? dx : dy
  const secondary = horizontal ? dy : dx
  // Travel at least 1200 px/s over 320 ms, even from an already distant drag.
  const distance = Math.max(Math.abs(primary) + 1200 * DECK_MOTION.fling.duration, (horizontal ? cardWidth : cardHeight) + 32)
  const cross = Math.abs(primary) > 1 ? secondary / Math.abs(primary) * distance : 0
  return horizontal ? { x: sign * distance, y: cross } : { x: cross, y: sign * distance }
}
