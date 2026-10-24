import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Contact } from '@/domain/types'
import { Avatar } from '@/ui'
import { toast } from '@/ui/toast'
import { prefersReducedMotion } from '@/ui/theme'
import { isDrag } from './swipeMath'
import { CardFields } from './CardFields'
import './deck.css'
export { friendlyType } from './CardFields'

const sources = { vcf: 'iCloud', csv: 'Google', picker: 'Phone', demo: 'Demo' }
function year(value: string | number) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.getFullYear()
}
const faceClass = 'deck-face absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-[20px] border border-rule bg-paper-2 p-5'

export const SwipeCard = memo(function SwipeCard({ contact, preview = false, onFlip }: { contact: Contact; preview?: boolean; onFlip?: (flipped: boolean) => void }) {
  const [flipped, setFlipped] = useState(false)
  const [opened, setOpened] = useState(false)
  const reduced = prefersReducedMotion()
  const origin = useRef({ x: 0, y: 0 })
  const moved = useRef(false)
  const copied = useRef(false)
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alive = useRef(true)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const cancel = () => clearTimeout(press.current)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; clearTimeout(press.current) }
  }, [])
  const copy = async (value: string) => {
    copied.current = true
    try { await navigator.clipboard.writeText(value); if (alive.current) toast('Number copied') }
    catch { if (alive.current) toast('Could not copy number') }
  }
  const hold = (value: string) => {
    if (preview) return
    cancel()
    press.current = setTimeout(() => void copy(value), 500)
  }
  const flip = (next: boolean) => {
    if (preview || moved.current || copied.current) return
    setOpened(true)
    setFlipped(next)
    onFlip?.(next)
    requestAnimationFrame(() => { if (alive.current) (next ? backRef : toggleRef).current?.focus({ preventScroll: true }) })
  }
  const edited = contact.rev ? year(contact.rev) : undefined
  return <article
    aria-label={preview ? undefined : contact.displayName + ' contact card'}
    className="deck-card relative h-full min-h-0 text-ink select-none"
    onPointerDownCapture={(event) => { origin.current = { x: event.clientX, y: event.clientY }; moved.current = false; copied.current = false }}
    onPointerMove={(event) => { if (isDrag(event.clientX - origin.current.x, event.clientY - origin.current.y)) { moved.current = true; cancel() } }}
    onDragStart={(event) => event.preventDefault()}
    onKeyDownCapture={(event) => { if (event.key === 'Enter' || event.key === ' ') { moved.current = false; copied.current = false } }}
    onPointerUp={cancel} onPointerCancel={() => { moved.current = true; cancel() }} onPointerLeave={cancel}
    onClickCapture={(event) => {
      // Capture also protects the detail button and tel links after a drag or long press.
      if (moved.current || copied.current) { event.preventDefault(); event.stopPropagation() }
    }}
    onClick={() => { if (!flipped) flip(true) }}
  >
    <motion.div className="relative h-full" style={{ transformStyle: 'preserve-3d' }}
      animate={{ rotateY: reduced ? 0 : flipped ? 180 : 0 }} transition={{ duration: reduced ? 0.12 : 0.32, ease: 'easeOut' }}>
      <motion.div initial={false} className={faceClass} aria-hidden={flipped || preview} inert={flipped || preview}
        animate={{ opacity: reduced && flipped ? 0 : 1 }} transition={{ duration: 0.12 }}>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <Avatar name={contact.displayName} photo={contact.photo} size={72} />
          <h2 className="line-clamp-2 shrink-0 break-words font-serif text-[34px] leading-[38px] tracking-tight">{contact.displayName}</h2>
          <p className="truncate text-[15px] text-ink-2">{[contact.title, contact.org].filter(Boolean).join(' · ') || ' '}</p>
          <div className="hairline shrink-0" />
          <CardFields contact={contact} hold={hold} />
        </div>
        <div className="hairline mt-3 shrink-0 pt-3">
          <div className="flex flex-wrap gap-x-3 text-[12px] tracking-wide text-ink-2 uppercase">
            <span>{sources[contact.source]}</span><span>added {year(contact.importedAt)}</span>{edited && <span>edited {edited}</span>}
          </div>
          {!preview && <button ref={toggleRef} type="button" className="mt-2 min-h-8 text-xs text-ink-2" onClick={(event) => { event.stopPropagation(); flip(true) }}>View all fields</button>}
        </div>
      </motion.div>
      {!preview && <motion.div initial={false} className={faceClass} aria-hidden={!flipped} inert={!flipped}
        style={{ rotateY: reduced ? 0 : 180, pointerEvents: flipped ? 'auto' : 'none' }}
        animate={{ opacity: reduced ? (flipped ? 1 : 0) : 1 }} transition={{ duration: 0.12 }}>
        {opened && <>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }} tabIndex={0} aria-label="All contact fields">
            <h2 className="break-words font-serif text-[28px] leading-tight">{contact.displayName}</h2>
            <div className="hairline shrink-0" />
            <CardFields contact={contact} full hold={hold} />
            <p className="text-xs text-ink-2">{sources[contact.source]} · added {new Date(contact.importedAt).toLocaleDateString()}{contact.rev && ' · last edited ' + contact.rev}</p>
          </div>
          <button ref={backRef} type="button" className="hairline mt-3 min-h-10 shrink-0 pt-2 text-left text-xs text-ink-2" onClick={(event) => { event.stopPropagation(); flip(false) }}>Back</button>
        </>}
      </motion.div>}
    </motion.div>
  </article>
})
