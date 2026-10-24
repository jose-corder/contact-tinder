import { animate, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Direction } from '@/domain/types'
import { haptic, prefersReducedMotion } from '@/ui/theme'
import { flingTarget, isDrag, lockAxis, resistDown, resolveDirection, rotationFor, stampOpacity, type Axis } from '@/features/deck/swipeMath'

export function useSwipe({ onCommit, onDragStart, disabled, returnDirection }: {
  onCommit: (direction: Direction) => void
  onDragStart?: () => void
  disabled?: boolean
  returnDirection?: Direction
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const opacity = useMotionValue(1)
  const width = useMotionValue(350)
  const axis = useMotionValue<Axis | null>(null)
  const dragged = useRef(false)
  const reduced = prefersReducedMotion()
  const rotate = useTransform(x, (value) => reduced ? 0 : rotationFor(value))
  const stamp = (direction: Direction) => () => stampOpacity(x.get(), y.get(), width.get(), axis.get())[direction]
  const left = useTransform(stamp('left'))
  const right = useTransform(stamp('right'))
  const up = useTransform(stamp('up'))
  const down = useTransform(stamp('down'))
  const [committing, setCommitting] = useState<Direction>()
  const locked = useRef(false)
  const mounted = useRef(true)
  const controls = useRef<Array<{ stop: () => void }>>([])
  const stop = () => controls.current.forEach((control) => control.stop())

  useEffect(() => {
    mounted.current = true
    const node = cardRef.current
    const measure = () => width.set(node?.getBoundingClientRect().width || 350)
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined
    if (node) observer?.observe(node)
    return () => { mounted.current = false; observer?.disconnect(); controls.current.forEach((control) => control.stop()) }
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
    stop()
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
    x.set(0); y.set(0); opacity.set(1); axis.set(null)
    setCommitting(undefined)
    locked.current = false
  }
  const cancel = () => {
    if (locked.current) return
    stop()
    const transition = reduced ? { duration: 0.12 } : { type: 'spring' as const, stiffness: 500, damping: 35 }
    if (reduced) { x.set(0); y.set(0); opacity.set(0); controls.current = [animate(opacity, 1, transition)] }
    else controls.current = [animate(x, 0, transition), animate(y, 0, transition)]
    dragged.current = false
    // Keep the stamp axis through the return spring, reset at the next pointer down.
  }
  const onDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || locked.current || !isDrag(info.offset.x, info.offset.y) && !dragged.current) return
    if (!dragged.current) { stop(); dragged.current = true; onDragStart?.() }
    axis.set(lockAxis(info.offset.x, info.offset.y, axis.get()))
    x.set(info.offset.x)
    y.set(resistDown(info.offset.y, width.get()))
  }
  const onDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (locked.current) return
    if (!dragged.current && !isDrag(info.offset.x, info.offset.y)) return
    if (event.type === 'pointercancel' || disabled) { cancel(); return }
    axis.set(lockAxis(info.offset.x, info.offset.y, axis.get()))
    const direction = resolveDirection(info.offset.x, resistDown(info.offset.y, width.get()), info.velocity.x, info.velocity.y, width.get(), axis.get())
    dragged.current = false
    if (direction) { x.set(info.offset.x); y.set(resistDown(info.offset.y, width.get())); void triggerSwipe(direction) }
    else cancel()
  }
  return { cardRef, x, y, rotate, opacity, stamps: { left, right, up, down }, committing,
    triggerSwipe, onDrag, onDragEnd, cancel,
    onPointerDown: () => { if (!locked.current) { axis.set(null); dragged.current = false } },
    drag: !disabled && !committing }
}
