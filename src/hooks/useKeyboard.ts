import { useEffect } from 'react'
import type { Direction } from '@/domain/types'

interface Shortcuts {
  swipe: (direction: Direction) => void
  undo: () => void
  toggleChip: (index: number) => void
  focusTag: () => void
  disabled?: boolean
}

export function useKeyboard({ swipe, undo, toggleChip, focusTag, disabled }: Shortcuts) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target
      if (disabled || event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"], [data-deck-details]')) return
      const directions: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
      const direction = directions[event.key]
      if (direction) { event.preventDefault(); swipe(direction) }
      else if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo() }
      else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); toggleChip(Number(event.key) - 1) }
      else if (event.key.toLowerCase() === 't') { event.preventDefault(); focusTag() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [swipe, undo, toggleChip, focusTag, disabled])
}
