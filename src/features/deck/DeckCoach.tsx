import { motion } from 'framer-motion'
import { PASS_META } from '@/domain/taxonomy'
import type { Pass } from '@/domain/types'
import { Button } from '@/ui'
import { DECK_ACTIONS } from './ActionBar'
import { DECK_MOTION } from './motion'
import './deck.css'

export const COACH_COPY = {
  triage: 'Swipe or use the buttons. Add tags any time.',
  work: 'Tap any types, then choose a status.',
  personal: 'Tap any types, then choose a relation.',
}
export const PASS_SUBTITLE = {
  triage: 'Work, Personal or Delete. Details now or later.',
  work: 'Choose a status; types are optional.',
  personal: 'Choose a relation; types are optional.',
}
export function DeckCoach({ pass, dismiss }: { pass: Pass; dismiss: () => void }) {
  return <motion.aside initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={DECK_MOTION.fade}
    className="deck-coach absolute inset-x-0 bottom-0 z-30 flex max-h-[200px] flex-col items-center gap-2 rounded-[20px] border border-rule bg-paper-2 p-3 text-center" aria-label="Swipe guide">
    <p className="t-body">{COACH_COPY[pass]}</p>
    <div className="grid w-full grid-cols-4 gap-1 t-meta text-ink-2">
      {DECK_ACTIONS.map(([direction, Icon]) => <div key={direction} className="flex flex-col items-center gap-1"><Icon />{PASS_META[pass].swipes[direction].label}</div>)}
    </div>
    <Button variant="outline" onClick={dismiss}>Got it</Button>
  </motion.aside>
}
