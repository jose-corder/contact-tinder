import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Contact } from '@/domain/types'
import { sourceLabel } from '@/import/sourceLabel'
import { DECK_MOTION, useDeckReducedMotion } from './motion'
import { CardFront, formatContactDate } from './CardFront'
import { isDrag } from './swipeMath'
import { CardFields } from './CardFields'
import { useConstrainedViewport } from '@/ui'
import { useScrollFade } from '@/ui/useScrollFade'
import { useLandscapeDeck } from '@/hooks/useLandscapeDeck'
import './deck.css'
export { friendlyType } from './CardFields'

const faceClass = 'deck-face absolute inset-0 flex min-h-0 flex-col rounded-[20px] border border-rule bg-paper-2'

export const SwipeCard = memo(function SwipeCard({ contact, preview = false, onFlip, stageHeight = 640 }: { contact: Contact; preview?: boolean; onFlip?: (flipped: boolean) => void; stageHeight?: number }) {
  const [flipped, setFlipped] = useState(false)
  const [opened, setOpened] = useState(false)
  const reduced = useDeckReducedMotion()
  const { shortHeight, keyboardOpen, largeText } = useConstrainedViewport()
  const landscape = useLandscapeDeck()
  const constrained = (shortHeight && !landscape) || keyboardOpen || largeText
  const origin = useRef({ x: 0, y: 0 })
  const moved = useRef(false)
  const alive = useRef(true)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  useScrollFade(detailsRef, opened && !constrained)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  const flip = (next: boolean) => {
    if (preview || moved.current) return
    setOpened(true)
    setFlipped(next)
    onFlip?.(next)
    requestAnimationFrame(() => { if (alive.current) (next ? backRef : toggleRef).current?.focus({ preventScroll: true }) })
  }
  return <article
    aria-label={preview ? undefined : contact.displayName + ' contact card'}
    data-constrained={constrained} data-layout={stageHeight > 0 && stageHeight < 420 && window.innerWidth > window.innerHeight ? 'landscape' : constrained || stageHeight < 680 ? 'compact' : 'tall'} className="deck-card relative h-full min-h-0 text-ink select-none"
    onPointerDownCapture={(event) => { origin.current = { x: event.clientX, y: event.clientY }; moved.current = false }}
    onPointerMove={(event) => { if (isDrag(event.clientX - origin.current.x, event.clientY - origin.current.y)) moved.current = true }}
    onDragStart={(event) => event.preventDefault()}
    onKeyDownCapture={(event) => { if (event.key === 'Enter' || event.key === ' ') moved.current = false }}
    onPointerCancel={() => { moved.current = true }}
    onClickCapture={(event) => {
      // Capture also protects the detail button and tel links after a drag or long press.
      if (moved.current) { event.preventDefault(); event.stopPropagation() }
    }}
    onClick={() => { if (!flipped) flip(true) }}
  >
    <motion.div key={reduced ? 'fade' : 'flip'} className="relative h-full" style={{ transformStyle: 'preserve-3d' }}
      animate={{ rotateY: reduced ? 0 : flipped ? 180 : 0 }} transition={reduced ? DECK_MOTION.fade : DECK_MOTION.fling}>
      <motion.div data-active={!flipped} initial={false} className={faceClass + (stageHeight < 680 ? ' p-4' : ' p-5')} aria-hidden={flipped || preview} inert={flipped || preview}
        animate={{ opacity: reduced && flipped ? 0 : 1 }} transition={DECK_MOTION.fade}>
        <CardFront contact={contact} stageHeight={stageHeight} preview={preview} constrained={constrained} toggleRef={toggleRef} flip={() => flip(true)} />
      </motion.div>
      {!preview && <motion.div data-deck-details data-active={flipped} initial={false} className={faceClass + (stageHeight < 680 ? ' p-4' : ' p-5')} aria-hidden={!flipped} inert={!flipped}
        style={{ rotateY: reduced ? 0 : 180, pointerEvents: flipped ? 'auto' : 'none' }}
        animate={{ opacity: reduced ? (flipped ? 1 : 0) : 1 }} transition={DECK_MOTION.fade}>
        {opened && <>
          <div ref={detailsRef} className={`flex min-h-0 flex-1 flex-col gap-3 ${constrained ? '' : 'scroll-fade overflow-y-auto overscroll-contain'}`} style={{ touchAction: 'pan-y', ...(constrained ? { overflowY: 'visible' } : {}) }} tabIndex={0} aria-label="All contact fields">
            <h2 className="break-words font-serif t-title">{contact.displayName}</h2>
            <div className="hairline shrink-0" />
            <CardFields contact={contact} />
            <p className="t-meta text-ink-2">{sourceLabel(contact)} · Added {formatContactDate(contact.importedAt)}{formatContactDate(contact.rev) && ' · Updated ' + formatContactDate(contact.rev)}</p>
          </div>
          <button ref={backRef} type="button" className="hairline mt-3 min-h-11 min-w-11 shrink-0 pt-2 text-left t-meta text-ink-2" onClick={(event) => { event.stopPropagation(); flip(false) }}>Back</button>
        </>}
      </motion.div>}
    </motion.div>
  </article>
})
