import { useState } from 'react'
import { PASS_META } from '@/domain/taxonomy'
import type { Direction, Pass } from '@/domain/types'
import { Button, IconButton, Sheet } from '@/ui'
import { KeyboardLegend, SKIP_HELP } from './KeyboardLegend'
import { IconArrowDown, IconArrowUp, IconCheck, IconX } from '@/ui/icons'

export const DECK_ACTIONS = [['left', IconX], ['down', IconArrowDown], ['up', IconArrowUp], ['right', IconCheck]] as const
export const SKIP_HINT = 'Comes back at the end; twice = Unsorted'

export function ActionBar({ pass, triggerSwipe, disabled, compact, keyboard }: {
  pass: Pass; triggerSwipe: (direction: Direction) => void; disabled?: boolean; compact?: boolean; keyboard?: boolean
}) {
  const [help, setHelp] = useState(false)
  const [skipHelp, setSkipHelp] = useState(false)
  return <div className={`deck-toolbar relative shrink-0 pt-1 ${compact ? 'deck-toolbar-compact' : ''}`} data-keyboard={keyboard || undefined}>
    <div className="deck-actions grid grid-cols-4 items-start gap-1" aria-label="Swipe actions">
      {DECK_ACTIONS.map(([direction, Icon]) => {
        const outcome = PASS_META[pass].swipes[direction]
        return <div key={direction} className="flex min-w-0 flex-col items-center gap-1">
          <IconButton className="deck-action-circle" label={outcome.label} size={56} disabled={disabled}
            title={direction === 'down' ? SKIP_HINT : outcome.label} aria-description={direction === 'down' ? SKIP_HINT : undefined}
            onClick={() => triggerSwipe(direction)}><Icon size={24} /></IconButton>
          {direction === 'down' ? <button type="button" aria-label="About Skip" className="deck-action-caption deck-skip-help hit-44 t-meta text-ink-2 underline underline-offset-4"
            onClick={() => setSkipHelp(true)}>Skip</button>
            : <span aria-hidden="true" className="deck-action-caption t-meta text-ink-2">{outcome.label}</span>}
        </div>
      })}
    </div>
    {!keyboard && <button className="deck-keyboard-help hit-44 t-meta text-ink-2" type="button" aria-expanded={help} onClick={() => setHelp(!help)}>Keyboard shortcuts</button>}
    {help && !keyboard && <div className="absolute inset-x-0 bottom-full z-30 rounded-xl border border-rule bg-paper-2 p-3 t-meta"><KeyboardLegend /></div>}
    <Sheet open={skipHelp} onClose={() => setSkipHelp(false)} title="About Skip" footer={<Button full onClick={() => setSkipHelp(false)}>Got it</Button>}>
      <p className="t-body">{SKIP_HELP}</p>
    </Sheet>
  </div>
}
