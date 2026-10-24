import { describe, expect, it } from 'vitest'
import { flingTarget, resolveDirection, rotationFor, stampOpacity } from '@/features/deck/swipeMath'

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
