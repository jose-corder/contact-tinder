import { memo, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { saveDecision, type ContactWithDecision } from '@/db/repo'
import { BUCKET_META, WORK_STATUS_META, PERSONAL_RELATION_META, setBucket } from '@/domain/taxonomy'
import type { Bucket } from '@/domain/types'
import { Avatar, IconButton } from '@/ui'
import { IconTrash } from '@/ui/icons'
import { haptic } from '@/ui/theme'
import { toast } from '@/ui/toast'

interface Props {
  row: ContactWithDecision
  selecting: boolean
  selected: boolean
  onOpen: (id: string) => void
  onToggle: (id: string) => void
  onLongPress: (id: string) => void
}

function BucketGlyph({ bucket }: { bucket: Bucket }) {
  if (bucket === 'delete') return <IconTrash size={18} />
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {bucket === 'work' ? <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3M3 12h18m-9-2v5" /></> :
      <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
  </svg>
}

export default memo(function ReviewRow({ row: { contact, decision }, selecting, selected, onOpen, onToggle, onLongPress }: Props) {
  const timer = useRef<number | undefined>(undefined)
  const pressed = useRef(false)
  const dragged = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const x = useMotionValue(0)
  const reduced = useReducedMotion()
  const cancel = () => window.clearTimeout(timer.current)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (selecting) { setRevealed(false); x.set(0) }
  }, [selecting, x])
  const reveal = (open: boolean) => {
    setRevealed(open)
    animate(x, open ? -80 : 0, { duration: reduced ? 0 : 0.18 })
  }
  const bucket = decision.bucket && BUCKET_META[decision.bucket]
  const status = decision.bucket === 'work' && decision.workStatus ? WORK_STATUS_META[decision.workStatus] : undefined
  const relation = decision.bucket === 'personal' && decision.relation ? PERSONAL_RELATION_META[decision.relation] : undefined
  const labels = [bucket, status, relation].filter((meta) => !!meta)
  const destinations = (Object.keys(BUCKET_META) as Bucket[]).filter((value) => value !== decision.bucket)
  async function move(destination: Bucket) {
    if (busy) return
    setBusy(true)
    try {
      await saveDecision(setBucket(decision, destination))
      reveal(false)
      toast(`${contact.displayName} → ${BUCKET_META[destination].label}`, { tone: destination, action: {
        label: 'Undo', onClick: () => { void saveDecision(decision).catch(() => toast('Could not undo. Please try again.')) },
      } })
    } catch { toast('Could not move contact. Please try again.') }
    finally { setBusy(false) }
  }
  return <li className="relative h-16 border-b border-rule">
    {!selecting && <div className="absolute -right-2 inset-y-0 flex items-center" style={{ visibility: revealed ? 'visible' : 'hidden' }}>
      {destinations.slice(0, 2).map((value) => <IconButton key={value} size={44} color={BUCKET_META[value].color}
        label={`Move ${contact.displayName} to ${BUCKET_META[value].label}`} disabled={busy} onClick={() => void move(value)}>
        <BucketGlyph bucket={value} />
      </IconButton>)}
    </div>}
    <div className="h-full overflow-hidden">
      <motion.div drag={selecting ? false : 'x'} dragConstraints={{ left: -80, right: 0 }} dragElastic={0} dragMomentum={false}
        style={{ x, touchAction: 'pan-y' }} className="relative flex h-full items-center gap-3 bg-paper"
        onDragStart={() => { cancel(); dragged.current = true; setRevealed(true) }}
        onDragEnd={(_, info) => reveal(x.get() < -35 || info.velocity.x < -300)}>
        {selecting && <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center p-3">
          <input type="checkbox" aria-label={`Select ${contact.displayName}`} checked={selected} onChange={() => onToggle(contact.id)}
            className="h-5 w-5 accent-ink" />
        </label>}
        <button type="button" className="flex h-full min-w-0 flex-1 touch-pan-y items-center gap-3 text-left"
          aria-label={`${selecting ? 'Select' : 'View'} ${contact.displayName}`} aria-description="Swipe left or press Left Arrow for quick actions."
          onKeyDown={(event) => {
            if (!selecting && ['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) {
              event.preventDefault(); reveal(event.key === 'ArrowLeft')
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            pressed.current = false; dragged.current = false
            origin.current = { x: event.clientX, y: event.clientY }
            timer.current = window.setTimeout(() => { pressed.current = true; haptic(10); onLongPress(contact.id) }, 500)
          }}
          onPointerMove={(event) => {
            if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancel()
          }}
          onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            if (pressed.current || dragged.current) { pressed.current = false; dragged.current = false; return }
            if (revealed) { reveal(false); return }
            if (selecting) onToggle(contact.id)
            else onOpen(contact.id)
          }}>
          <Avatar name={contact.displayName} photo={contact.photo} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-[17px]">{contact.displayName}</span>
            <span className="block truncate text-[13px] text-ink-2">{contact.org || contact.phones[0]?.value}</span>
          </span>
          <span className="flex max-w-[95px] shrink-0 flex-col items-end gap-1">
            <span aria-hidden="true" className="flex gap-1">{labels.map((meta) => <span key={meta.label} className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />)}</span>
            <span className="text-xs text-ink-2">{status?.label ?? relation?.label}</span>
          </span>
        </button>
      </motion.div>
    </div>
  </li>
})
