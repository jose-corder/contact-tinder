import type { Direction } from '@/domain/types'

function dominant(dx: number, dy: number): Direction {
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
}

export function resolveDirection(dx: number, dy: number, vx: number, vy: number, cardWidth: number): Direction | null {
  // A stationary flick uses velocity to choose its axis; otherwise distance wins.
  const direction = dominant(dx || dy ? dx : vx, dx || dy ? dy : vy)
  const horizontal = direction === 'left' || direction === 'right'
  const distance = horizontal ? dx : dy
  const velocity = horizontal ? vx : vy
  if (Math.abs(distance) >= Math.max(1, cardWidth * 0.35)) return direction
  if (Math.abs(velocity) > 500) return horizontal ? (velocity < 0 ? 'left' : 'right') : (velocity < 0 ? 'up' : 'down')
  return null
}

export function stampOpacity(dx: number, dy: number, cardWidth: number): Record<Direction, number> {
  const result = { left: 0, right: 0, up: 0, down: 0 }
  result[dominant(dx, dy)] = Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(1, cardWidth * 0.35))
  return result
}

export function rotationFor(dx: number): number {
  return Math.max(-15, Math.min(15, dx / 20))
}

export function flingTarget(direction: Direction, dx: number, dy: number, viewportW: number, viewportH: number) {
  const horizontal = direction === 'left' || direction === 'right'
  const sign = direction === 'left' || direction === 'up' ? -1 : 1
  // Preserve the drag slope, but always exit on the committed side (including reversed flicks).
  const primary = horizontal ? dx : dy
  const secondary = horizontal ? dy : dx
  const distance = Math.max(384, horizontal ? viewportW : viewportH) * 1.5
  const cross = Math.abs(primary) > 1 ? secondary / Math.abs(primary) * distance : 0
  return horizontal ? { x: sign * distance, y: cross } : { x: cross, y: sign * distance }
}
