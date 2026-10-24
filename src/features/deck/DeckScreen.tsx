import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { PASS_META } from '@/domain/taxonomy'
import type { Direction, Pass } from '@/domain/types'
import { Frame, TopBar, Empty } from '@/ui'
import { useDeck } from '@/hooks/useDeck'
import { useSwipe } from '@/hooks/useSwipe'
import { useKeyboard } from '@/hooks/useKeyboard'
import { ActionBar } from './ActionBar'
import { ChipRow } from './ChipRow'
import { DeckEnd } from './DeckEnd'
import { NextCard } from './NextCard'
import { Stamp } from './Stamp'
import { SwipeCard } from './SwipeCard'
import { FollowUpSheet, type FollowUpTarget } from './FollowUpSheet'
import { followUpEnabled } from '@/ui/theme'

export default function DeckScreen({ pass }: { pass: Pass }) {
  return <DeckSession key={pass} pass={pass} />
}

function DeckSession({ pass }: { pass: Pass }) {
  const deck = useDeck(pass)
  // After a Work/Personal swipe in triage, offer status/type right away (see FollowUpSheet).
  const [followUp, setFollowUp] = useState<FollowUpTarget>()
  const undo = () => { setFollowUp(undefined); void deck.undo() }
  const onSwipe = async (direction: Direction) => {
    const result = await deck.swipe(direction)
    if (pass === 'triage' && result && followUpEnabled() && (result.decision.bucket === 'work' || result.decision.bucket === 'personal')) {
      setFollowUp({ contact: result.item.contact, decision: result.decision })
    }
  }
  useKeyboard({ swipe: () => {}, toggleChip: () => {}, focusTag: () => {}, undo, disabled: !!deck.top || deck.pending || !!followUp })
  return <Frame className="h-dvh overflow-hidden">
    <TopBar title={PASS_META[pass].title} backTo="/" right={<span aria-live="polite">{deck.done} / {deck.total}</span>} progress={deck.progress} />
    {deck.error && <p role="alert" className="mb-2 text-sm text-ink-2">{deck.error}</p>}
    {deck.loading ? <div role="status" aria-label="Loading contacts" className="flex-1 rounded-[20px] border border-rule bg-paper-2" />
      : deck.empty ? <Empty title="No contacts yet."><Link className="underline underline-offset-4" to="/import">Import contacts</Link></Empty>
        : deck.top && deck.draft ? <ActiveDeck key={`${deck.top.contact.id}-${deck.top.decision.updatedAt}`} pass={pass} deck={deck} onSwipe={onSwipe} undo={undo} locked={!!followUp} />
          : <>{deck.finished && <DeckEnd pass={pass} />}{deck.canUndo && <button className="h-10 self-start text-sm text-ink-2" onClick={undo}>undo</button>}</>}
    <FollowUpSheet target={followUp} onClose={() => setFollowUp(undefined)} />
  </Frame>
}

function ActiveDeck({ pass, deck, onSwipe, undo, locked }: {
  pass: Pass; deck: ReturnType<typeof useDeck>; onSwipe: (direction: Direction) => Promise<void>; undo: () => void; locked: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tagOpen, setTagOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const swipe = useSwipe({ onCommit: (direction) => { void onSwipe(direction) }, disabled: deck.pending || locked,
    returnDirection: deck.returning?.id === deck.top?.contact.id ? deck.returning.direction : undefined })
  const disabled = deck.pending || !!swipe.committing || locked
  const meta = PASS_META[pass]
  useKeyboard({
    swipe: (direction) => { void swipe.triggerSwipe(direction) }, undo, disabled,
    toggleChip: (index) => {
      const chip = meta.chips[index]
      if (chip) deck.toggleChip(chip.key)
      else { const tag = deck.draft?.customTags[index - meta.chips.length]; if (tag) deck.toggleTag(tag) }
    },
    focusTag: () => { setTagOpen(true); inputRef.current?.focus() },
  })
  if (!deck.top || !deck.draft) return null
  return <>
    <div className="relative min-h-0 flex-1">
      {deck.next && <NextCard contact={deck.next.contact} advancing={!!swipe.committing} />}
      <motion.div ref={swipe.cardRef} className="absolute inset-0 z-10" style={{ x: swipe.x, y: swipe.y, rotate: swipe.rotate, opacity: swipe.opacity, touchAction: detailsOpen ? 'pan-y' : 'none' }}
        drag={swipe.drag && !detailsOpen} dragMomentum={false} onDragEnd={swipe.onDragEnd}>
        <SwipeCard contact={deck.top.contact} onFlip={setDetailsOpen} />
        {(Object.keys(meta.swipes) as Direction[]).map((direction) => <Stamp key={direction} direction={direction} label={meta.swipes[direction].label} color={meta.swipes[direction].color} opacity={swipe.committing === direction ? 1 : swipe.committing ? 0 : swipe.stamps[direction]} />)}
      </motion.div>
    </div>
    <motion.div className="relative z-20 shrink-0" style={{ x: swipe.x, y: swipe.y, opacity: swipe.opacity }}>
      <ChipRow pass={pass} draft={deck.draft} toggleChip={deck.toggleChip} toggleTag={deck.toggleTag} inputRef={inputRef} open={tagOpen} setOpen={setTagOpen} disabled={disabled} />
    </motion.div>
    <ActionBar pass={pass} canUndo={deck.canUndo} undo={undo} triggerSwipe={(direction) => { void swipe.triggerSwipe(direction) }} disabled={disabled} />
  </>
}
