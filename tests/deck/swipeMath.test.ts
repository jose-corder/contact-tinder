// Audit #32: the stamp reaches full opacity exactly at the commit threshold.
import { describe, expect, it } from 'vitest'
import { flingTarget, isDrag, lockAxis, resistDown, resolveDirection, rotationFor, stampOpacity } from '@/features/deck/swipeMath'
import { DECK_MOTION } from '@/features/deck/motion'

describe('swipe math', () => {
  it.each([
    [139, 0, 0, 0, null], [140, 0, 0, 0, 'right'], [-140, 20, 0, 0, 'left'],
    [20, -140, 0, 0, 'up'], [20, 140, 0, 0, 'down'], [100, 139, 900, 0, null],
    [1, 0, 500, 0, null], [1, 0, 501, 0, 'right'], [-1, 0, -501, 0, 'left'],
    [0, -1, 0, -501, 'up'], [0, 1, 0, 501, 'down'], [0, 0, 0, -600, 'up'],
    [0, 0, 0, 0, null], [40, 1, -600, 0, 'left'],
  ])('resolves (%s, %s), velocity (%s, %s) to %s', (dx, dy, vx, vy, expected) => {
    expect(resolveDirection(dx as number, dy as number, vx as number, vy as number, 400)).toBe(expected)
  })
  it('uses only the dominant stamp and clamps its opacity', () => {
    expect(stampOpacity(70, 30, 400)).toEqual({ left: 0, right: 0.5, up: 0, down: 0 })
    expect(stampOpacity(20, -280, 400)).toEqual({ left: 0, right: 0, up: 1, down: 0 })
    expect(stampOpacity(0, 0, 0)).toEqual({ left: 0, right: 0, up: 0, down: 0 })
  })
  it('clamps rotation to fifteen degrees', () => {
    expect(rotationFor(100)).toBe(5)
    expect(rotationFor(1000)).toBe(15)
    expect(rotationFor(-1000)).toBe(-15)
  })
  it('flings off screen along the drag vector', () => {
    const target = flingTarget('right', 200, 100, 390, 844)
    expect(target.x).toBeGreaterThan(390)
    expect(target.y / target.x).toBe(0.5)
    expect(flingTarget('up', 0, 0, 390, 844).y).toBeLessThan(-844)
    expect(flingTarget('left', 0, 0, 390, 844).x).toBeLessThan(-390)
    expect(flingTarget('down', 0, 0, 390, 844).y).toBeGreaterThan(844)
  })
})


it('ignores sub-six-pixel movement and locks the dominant axis at twelve pixels', () => {
  expect(isDrag(3, 4)).toBe(false)
  expect(isDrag(6, 0)).toBe(true)
  expect(lockAxis(11, 0, null)).toBeNull()
  expect(lockAxis(12, 0, null)).toBe('x')
  expect(lockAxis(0, -12, null)).toBe('y')
  expect(lockAxis(20, 200, 'x')).toBe('x')
  expect(stampOpacity(70, 120, 400, 'x')).toEqual({ left: 0, right: 0.5, up: 0, down: 0 })
  expect(resolveDirection(20, 200, 0, 800, 400, 'x')).toBeNull()
})

it('applies 0.55 resistance only past forty percent of the downward threshold', () => {
  expect(resistDown(-200, 400)).toBe(-200)
  expect(resistDown(56, 400)).toBe(56)
  expect(resistDown(156, 400)).toBe(111)
  expect(resolveDirection(0, resistDown(140, 400), 0, 0, 400)).toBeNull()
  expect(resolveDirection(0, resistDown(210, 400), 0, 0, 400)).toBe('down')
})

it('continues an already distant drag at a minimum average speed of 1200 px/s', () => {
  const target = flingTarget('right', 800, 400, 390, 844)
  expect((target.x - 800) / 0.32).toBeGreaterThanOrEqual(1200)
  expect(target.y / target.x).toBe(0.5)
})

it.each(['left', 'right', 'up', 'down'] as const)('#32 a solid %s stamp equals the distance release threshold', direction => {
  const distance = 320 * DECK_MOTION.commitThreshold
  const x = direction === 'left' ? -distance : direction === 'right' ? distance : 0
  const y = direction === 'up' ? -distance : direction === 'down' ? distance : 0
  expect(stampOpacity(x, y, 320)[direction]).toBe(1)
  expect(resolveDirection(x, y, 0, 0, 320)).toBe(direction)
  expect(stampOpacity(x * .999, y * .999, 320)[direction]).toBeLessThan(1)
  expect(resolveDirection(x * .999, y * .999, 0, 0, 320)).toBeNull()
})
