import { PASS_META } from '@/domain/taxonomy'
import type { Pass } from '@/domain/types'
import { Button } from '@/ui'
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp } from '@/ui/icons'
import './deck.css'

export function DeckCoach({ pass, dismiss }: { pass: Pass; dismiss: () => void }) {
  const meta = PASS_META[pass]
  return <aside className="deck-coach pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 rounded-[20px] border border-rule p-5 text-center" aria-label="Swipe guide">
    <h2 className="font-serif text-[22px]">A little direction.</h2>
    <div className="grid w-full grid-cols-3 items-center gap-x-2 gap-y-4 text-[13px]">
      <div className="col-start-2 flex flex-col items-center gap-2"><IconArrowUp />{meta.swipes.up.label}</div>
      <div className="col-start-1 flex flex-col items-center gap-2"><IconArrowLeft />{meta.swipes.left.label}</div>
      <div className="col-start-3 flex flex-col items-center gap-2"><IconArrowRight />{meta.swipes.right.label}</div>
      <div className="col-start-2 flex flex-col items-center gap-2"><IconArrowDown />{meta.swipes.down.label}</div>
    </div>
    <p className="max-w-[280px] font-sans text-[13px] text-ink-2">Swipe, or use the buttons below. Tap a chip first to add a type.</p>
    <Button variant="outline" className="pointer-events-auto" onClick={dismiss}>Got it</Button>
  </aside>
}
