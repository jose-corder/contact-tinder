import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { PASS_META } from '@/domain/taxonomy'
import type { Direction, Pass } from '@/domain/types'
import { Frame, TopBar, Empty, InlineNotice, VisuallyHidden } from '@/ui'
import { useDeck } from '@/hooks/useDeck'
import { useSwipe } from '@/hooks/useSwipe'
import { useKeyboard } from '@/hooks/useKeyboard'
import { useElementSize } from '@/hooks/useElementSize'
import { ActionBar } from './ActionBar'
import { ChipRow } from './ChipRow'
import { DeckEnd } from './DeckEnd'
import { NextCard } from './NextCard'
import { Stamp } from './Stamp'
import { SwipeCard } from './SwipeCard'
import { FollowUpSheet, type FollowUpTarget } from './FollowUpSheet'
import { followUpEnabled } from '@/ui/theme'
import { dismissToast, toast } from '@/ui/toast'
import { useCoach } from '@/hooks/useCoach'
import { DeckCoach, PASS_SUBTITLE } from './DeckCoach'
import { useDeckReducedMotion } from './motion'

export default function DeckScreen({ pass }: { pass: Pass }) {
  const location = useLocation()
  return <DeckSession key={`${pass}-${location.key}`} pass={pass} />
}

function DeckSession({ pass }: { pass: Pass }) {
  const deck = useDeck(pass)
  const coach = useCoach(pass)
  const navigate = useNavigate()
  const [followUp, setFollowUp] = useState<FollowUpTarget>()
  const followUpBusy = useRef(false)
  const latestUndo = useRef(deck.undo)
  useLayoutEffect(() => { latestUndo.current = deck.undo }, [deck.undo])
  const undo = useCallback(() => {
    if (followUpBusy.current) return
    dismissToast(); setFollowUp(undefined); void latestUndo.current()
  }, [])
  const onSwipe = async (direction: Direction) => {
    coach.dismiss(); dismissToast()
    const result = await deck.swipe(direction)
    if (!result) return
    if (pass === 'triage' && followUpEnabled() && (result.decision.bucket === 'work' || result.decision.bucket === 'personal')) {
      dismissToast()
      setFollowUp({ contact: result.item.contact, decision: result.decision })
    } else {
      const outcome = PASS_META[pass].swipes[direction]
      const firstName = result.item.contact.givenName?.trim().split(/\s+/)[0] || result.item.contact.displayName.trim().split(/\s+/)[0] || 'Contact'
      const tone = outcome.kind === 'skip' ? 'default' : outcome.kind === 'bucket' ? outcome.value : pass === 'work' ? 'work' : 'personal'
      toast(firstName + ' → ' + outcome.label, { tone, action: { label: 'Undo', onClick: undo } })
    }
  }
  useKeyboard({ swipe: () => {}, toggleChip: () => {}, focusTag: () => {}, undo, disabled: !!deck.top || deck.pending || !!followUp })
  const card = deck.top?.contact
  return <Frame className="deck-screen h-dvh overflow-hidden">
    <TopBar title={PASS_META[pass].title + (deck.scopeLabel ? ` · ${deck.scopeLabel}` : '')} backTo="/" right={<span className="flex items-center gap-2">
      <span>{deck.done} / {deck.total}</span>
      {deck.canUndo && <button type="button" className="hit-44 h-11 min-w-11 t-meta" disabled={!!followUp || deck.pending} onClick={undo}>Undo</button>}
    </span>} progress={deck.progress} />
    <p className="deck-subtitle mb-2 shrink-0 text-ink-2">{PASS_SUBTITLE[pass]}</p>
    <VisuallyHidden aria-live="polite" aria-atomic="true">{card ? `Card ${deck.sessionDone + 1} of ${deck.sessionTotal}: ${card.displayName}${card.org ? ', ' + card.org : ''}` : ''}</VisuallyHidden>
    {deck.error && <InlineNotice tone="error">{deck.error}</InlineNotice>}
    {deck.loading ? <div role="status" aria-label="Loading contacts" className="flex-1 rounded-[20px] border border-rule bg-paper-2" />
      : deck.empty ? <Empty title="No contacts yet."><Link className="hit-44 inline-flex items-center underline" to="/import">Import contacts</Link></Empty>
        : deck.top && deck.draft ? <ActiveDeck pass={pass} deck={deck} coach={coach} onSwipe={onSwipe} undo={undo} locked={!!followUp} />
          : deck.finished && <DeckEnd pass={pass} sessionDone={deck.sessionDone} sessionTotal={deck.sessionTotal} scoped={deck.scoped} />}
    <FollowUpSheet target={followUp} onUndo={undo} onSettings={() => navigate('/settings')} onBusyChange={(busy) => { followUpBusy.current = busy }} onClose={(saved) => {
      if (saved && followUp) deck.amendUndo(saved, followUp.decision.updatedAt)
      setFollowUp(undefined)
    }} />
  </Frame>
}

function ActiveDeck({ pass, deck, coach, onSwipe, undo, locked }: {
  coach: ReturnType<typeof useCoach>; pass: Pass; deck: ReturnType<typeof useDeck>; onSwipe: (direction: Direction) => Promise<void>; undo: () => void; locked: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tagOpen, setTagOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const stage = useElementSize<HTMLDivElement>()
  const reduced = useDeckReducedMotion()
  const cardKey = `${deck.top?.contact.id}-${deck.top?.decision.updatedAt}`
  useEffect(() => { setDetailsOpen(false); setTagOpen(false) }, [cardKey])
  const swipe = useSwipe({ cardKey, onDragStart: coach.dismiss, onCommit: (direction) => { void onSwipe(direction) }, disabled: deck.pending || locked,
    returnDirection: deck.returning?.id === deck.top?.contact.id ? deck.returning.direction : undefined })
  const disabled = deck.pending || !!swipe.committing || locked
  const meta = PASS_META[pass]
  const triggerSwipe = (direction: Direction) => { coach.dismiss(); void swipe.triggerSwipe(direction) }
  useKeyboard({
    swipe: triggerSwipe, undo, disabled: disabled || detailsOpen,
    toggleChip: (index) => {
      coach.dismiss()
      const chip = meta.chips[index]
      if (chip) deck.toggleChip(chip.key)
      else { const tag = deck.draft?.customTags[index - meta.chips.length]; if (tag) deck.toggleTag(tag) }
    },
    focusTag: () => { coach.dismiss(); setTagOpen(true); inputRef.current?.focus() },
  })
  if (!deck.top || !deck.draft) return null
  return <>
    <div ref={stage.ref} data-deck-stage className="relative mb-2 min-h-0 flex-1">
      {deck.next && <NextCard contact={deck.next.contact} stageHeight={stage.height} advancing={!!swipe.committing} />}
      <motion.div ref={swipe.cardRef} className="absolute inset-0 z-10" style={{ x: reduced ? 0 : swipe.x, y: reduced ? 0 : swipe.y, rotate: reduced ? 0 : swipe.rotate, opacity: swipe.opacity, touchAction: detailsOpen || stage.height < 240 ? 'pan-y' : 'none' }}
        onPointerDown={swipe.onPointerDown} onPan={swipe.drag && !detailsOpen ? swipe.onDrag : undefined}
        onPanEnd={!detailsOpen ? swipe.onDragEnd : undefined} onPointerCancel={detailsOpen ? undefined : swipe.cancel}>
        <SwipeCard key={cardKey} contact={deck.top.contact} stageHeight={stage.height} onFlip={setDetailsOpen} />
        {(Object.keys(meta.swipes) as Direction[]).map((direction) => <Stamp key={direction} direction={direction} label={meta.swipes[direction].label}
          color={meta.swipes[direction].color} committed={swipe.committing === direction}
          opacity={swipe.committing === direction ? 1 : swipe.committing ? 0 : swipe.stamps[direction]} />)}
      </motion.div>
      {coach.visible && <DeckCoach pass={pass} dismiss={coach.dismiss} />}
    </div>
    <div className="relative z-20 shrink-0" onClickCapture={coach.dismiss}>
      <ChipRow pass={pass} draft={deck.draft} toggleChip={deck.toggleChip} toggleTag={deck.toggleTag} inputRef={inputRef} open={tagOpen} setOpen={setTagOpen} disabled={disabled}
        setRelation={pass === 'personal' ? deck.setRelation : undefined} completePersonal={pass === 'personal' ? () => { dismissToast(); void deck.completePersonal() } : undefined} />
    </div>
    <ActionBar pass={pass} triggerSwipe={triggerSwipe} disabled={disabled} />
  </>
}
