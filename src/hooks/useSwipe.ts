import { animate, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Direction } from '@/domain/types'
import { haptic, prefersReducedMotion } from '@/ui/theme'
import { flingTarget, resolveDirection, rotationFor, stampOpacity } from '@/features/deck/swipeMath'

export function useSwipe({ onCommit, disabled, returnDirection }: {
  onCommit: (direction: Direction) => void
  disabled?: boolean
  returnDirection?: Direction
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const opacity = useMotionValue(1)
  const width = useMotionValue(350)
  const reduced = prefersReducedMotion()
  const rotate = useTransform(x, (value) => reduced ? 0 : rotationFor(value))
  const stamp = (direction: Direction) => () => stampOpacity(x.get(), y.get(), width.get())[direction]
  const left = useTransform(stamp('left'))
  const right = useTransform(stamp('right'))
  const up = useTransform(stamp('up'))
  const down = useTransform(stamp('down'))
  const [committing, setCommitting] = useState<Direction>()
  const locked = useRef(false)
  const mounted = useRef(true)
  const controls = useRef<Array<{ stop: () => void }>>([])

  useEffect(() => {
    mounted.current = true
    const node = cardRef.current
    const measure = () => width.set(node?.getBoundingClientRect().width || 350)
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined
    if (node) observer?.observe(node)
    return () => {
      mounted.current = false
      observer?.disconnect()
      controls.current.forEach((control) => control.stop())
    }
  }, [width])

  useEffect(() => {
    if (!returnDirection) return
    if (reduced) {
      opacity.set(0)
      controls.current = [animate(opacity, 1, { duration: 0.12 })]
    } else {
      const start = flingTarget(returnDirection, 0, 0, window.innerWidth, window.innerHeight)
      x.set(start.x)
      y.set(start.y)
      controls.current = [animate(x, 0, { duration: 0.26, ease: 'easeOut' }), animate(y, 0, { duration: 0.26, ease: 'easeOut' })]
    }
  }, [returnDirection, reduced, x, y, opacity])

  const triggerSwipe = async (direction: Direction) => {
    if (disabled || locked.current) return
    locked.current = true
    controls.current.forEach((control) => control.stop())
    setCommitting(direction)
    haptic(10)
    if (reduced) controls.current = [animate(opacity, 0, { duration: 0.12, ease: 'easeOut' })]
    else {
      const target = flingTarget(direction, x.get(), y.get(), window.innerWidth, window.innerHeight)
      controls.current = [animate(x, target.x, { duration: 0.32, ease: 'easeOut' }), animate(y, target.y, { duration: 0.32, ease: 'easeOut' })]
    }
    await Promise.all(controls.current)
    if (!mounted.current) return
    onCommit(direction)
    // The only card can return to itself after its first skip.
    x.set(0)
    y.set(0)
    opacity.set(1)
    setCommitting(undefined)
    locked.current = false
  }
  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const direction = resolveDirection(info.offset.x, info.offset.y, info.velocity.x, info.velocity.y, width.get())
    if (direction && !disabled) void triggerSwipe(direction)
    else controls.current = [animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 }), animate(y, 0, { type: 'spring', stiffness: 500, damping: 35 })]
  }
  return { cardRef, x, y, rotate, opacity, stamps: { left, right, up, down }, committing,
    triggerSwipe, onDragEnd, drag: !disabled && !committing }
}
