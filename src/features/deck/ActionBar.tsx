import { PASS_META } from '@/domain/taxonomy'
import type { Direction, Pass } from '@/domain/types'
import { IconButton } from '@/ui'
import { IconArrowDown, IconArrowUp, IconCheck, IconX } from '@/ui/icons'

const actions = [ ['left', IconX], ['down', IconArrowDown], ['up', IconArrowUp], ['right', IconCheck] ] as const

export function ActionBar({ pass, canUndo, undo, triggerSwipe, disabled }: {
  pass: Pass; canUndo: boolean; undo: () => void; triggerSwipe: (direction: Direction) => void; disabled?: boolean
}) {
  return <>
  <div className="flex shrink-0 items-start justify-between gap-1 pt-1" aria-label="Swipe actions">
    <div className="flex h-14 w-10 shrink-0 items-center">
      {canUndo && <button type="button" onClick={undo} disabled={disabled} className="h-10 w-10 text-[13px] text-ink-2 disabled:opacity-40">undo</button>}
    </div>
    {actions.map(([direction, Icon]) => {
      const outcome = PASS_META[pass].swipes[direction]
      return <div key={direction} className="flex min-w-0 flex-col items-center gap-2">
        <IconButton label={outcome.label} size={56} disabled={disabled} onClick={() => triggerSwipe(direction)}><Icon size={24} /></IconButton>
        <span aria-hidden="true" className="eyebrow max-w-full truncate text-[11px] tracking-[0.06em] text-ink-2">{outcome.label}</span>
      </div>
    })}
  </div>
  <p className="deck-keyboard eyebrow hairline mt-3 shrink-0 pt-2 text-center text-[11px] tracking-[0.025em] text-ink-2">← → ↑ ↓ swipe · Z undo · 1–9 chips · T tag</p>
  </>
}
