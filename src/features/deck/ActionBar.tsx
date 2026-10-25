import { useLayoutEffect, useRef, useState } from 'react'
import { PASS_META } from '@/domain/taxonomy'
import type { Direction, Pass } from '@/domain/types'
import { IconButton } from '@/ui'
import { setToastBottom } from '@/ui/toast'
import { IconArrowDown, IconArrowUp, IconCheck, IconX } from '@/ui/icons'

export const DECK_ACTIONS = [['left', IconX], ['down', IconArrowDown], ['up', IconArrowUp], ['right', IconCheck]] as const
export const SKIP_HINT = 'Comes back at the end; twice = Unsorted'

export function ActionBar({ pass, triggerSwipe, disabled }: {
  pass: Pass; triggerSwipe: (direction: Direction) => void; disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [help, setHelp] = useState(false)
  useLayoutEffect(() => {
    const node = ref.current!
    const measure = () => {
      const bounds = node.getBoundingClientRect()
      // Include the bottom safe-area/gutter in the measured toolbar clearance.
      const bottom = Math.max(0, window.innerHeight - bounds.bottom)
      setToastBottom(bounds.height + bottom + 12)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); setToastBottom(null) }
  }, [])
  return <div ref={ref} className="deck-toolbar relative shrink-0 pt-1">
    <div className="deck-actions grid grid-cols-4 items-start gap-1" aria-label="Swipe actions">
      {DECK_ACTIONS.map(([direction, Icon]) => {
        const outcome = PASS_META[pass].swipes[direction]
        return <div key={direction} className="flex min-w-0 flex-col items-center gap-1">
          <IconButton className="deck-action-circle" label={outcome.label} size={56} disabled={disabled}
            title={direction === 'down' ? SKIP_HINT : outcome.label} aria-description={direction === 'down' ? SKIP_HINT : undefined}
            onClick={() => triggerSwipe(direction)}><Icon size={24} /></IconButton>
          <span aria-hidden="true" className="deck-action-caption text-ink-2">{outcome.label}</span>
        </div>
      })}
    </div>
    <button className="deck-keyboard-help hit-44 t-meta text-ink-2" type="button" aria-expanded={help} onClick={() => setHelp(!help)}>Keyboard shortcuts</button>
    {help && <div className="absolute inset-x-0 bottom-full z-30 rounded-xl border border-rule bg-paper-2 p-3 t-meta">← → ↑ ↓ swipe · Z undo · 1–9 types · T tag</div>}
  </div>
}
