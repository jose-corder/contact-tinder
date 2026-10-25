import { memo, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'framer-motion'
import { saveDecision, type ContactWithDecision } from '@/db/repo'
import { BUCKET_META, WORK_STATUS_META, PERSONAL_RELATION_META, setBucket } from '@/domain/taxonomy'
import { decisionLabels } from '@/domain/taxonomy'
import QuickActions, { RevealedActions, destinationsFor, destinationLabel, type Destination } from './QuickActions'
import { Avatar, IconButton, InlineNotice, LabelDot, formatPhone, useMediaQuery } from '@/ui'
import { IconMore } from '@/ui/icons'
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

export default memo(function ReviewRow({ row: { contact, decision }, selecting, selected, onOpen, onToggle, onLongPress }: Props) {
  const timer = useRef<number | undefined>(undefined)
  const pressed = useRef(false)
  const dragged = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const [revealed, setRevealed] = useState(false)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const x = useMotionValue(0)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const cancel = () => window.clearTimeout(timer.current)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (selecting) { setRevealed(false); x.set(0) }
  }, [selecting, x])
  const reveal = (open: boolean) => {
    setRevealed(open)
    const target = open ? -destinationsFor(decision.bucket).length * 72 : 0
    if (reduced) { x.stop(); x.set(target) }
    else animate(x, target, { duration: 0.18 })
  }
  useEffect(() => {
    if (reduced) { x.stop(); x.set(revealed ? -destinationsFor(decision.bucket).length * 72 : 0) }
  }, [reduced, revealed, decision.bucket, x])
  const bucket = decision.bucket && BUCKET_META[decision.bucket]
  const status = decision.bucket === 'work' && decision.workStatus ? WORK_STATUS_META[decision.workStatus] : undefined
  const effective = decision.bucket === 'personal' && !decision.relation && decision.personalTypes.length ? { ...decision, relation: 'other' as const } : decision
  const relation = effective.bucket === 'personal' && effective.relation ? PERSONAL_RELATION_META[effective.relation] : undefined
  const classification = [bucket?.label ?? 'Unsorted', status?.label, relation?.label].filter(Boolean).join(' · ')
  const labels = decisionLabels(effective)
  const summary = labels.slice(decision.bucket ? 1 + (status || relation ? 1 : 0) : 0)
  const accessible = [contact.displayName, contact.org, ...(decision.bucket ? labels : ['Unsorted', ...decision.customTags])].filter(Boolean).join(', ')
  async function move(destination: Destination) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await saveDecision(setBucket(decision, destination === 'unsorted' ? undefined : destination))
      reveal(false); setMenu(false)
      toast(`${contact.displayName} → ${destinationLabel(destination)}`, { duration: 10000, priority: 'high', tone: destination === 'unsorted' ? 'default' : destination, action: {
        label: 'Undo', onClick: () => { void saveDecision(decision).catch(() => toast('Could not undo. Please try again.')) },
      } })
    } catch { setError('Could not move contact. Please try again.') }
    finally { setBusy(false) }
  }
  return <li className="relative min-h-16 border-b border-rule">
    {!selecting && <div className="absolute right-0 top-0 flex h-full items-center" style={{ visibility: revealed ? 'visible' : 'hidden' }}>
      <RevealedActions name={contact.displayName} bucket={decision.bucket} busy={busy} onMove={value => void move(value)} />
    </div>}
    <div className="min-h-20 overflow-hidden">
      <motion.div drag={selecting ? false : 'x'} dragConstraints={{ left: -destinationsFor(decision.bucket).length * 72, right: 0 }} dragElastic={0} dragMomentum={false}
        style={{ x, touchAction: 'pan-y' }} className="relative flex min-h-20 items-center gap-3 bg-paper py-2"
        onDragStart={() => { cancel(); dragged.current = true; setRevealed(true) }}
        onDragEnd={(_, info) => reveal(x.get() < -35 || info.velocity.x < -300)}>
        {selecting && <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center p-3">
          <input type="checkbox" aria-label={`Select ${contact.displayName}`} checked={selected} onChange={() => onToggle(contact.id)}
            className="h-5 w-5 accent-ink" />
        </label>}
        <button type="button" className="flex h-full min-w-0 flex-1 touch-pan-y items-center gap-3 text-left"
          aria-label={`${selecting ? 'Select' : 'View'} ${accessible}`} aria-description="Swipe left or press Left Arrow for quick actions."
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
            <span className="block truncate font-serif serif-text t-heading">{contact.displayName}</span>
            <span className="block truncate t-meta text-ink-2">{contact.org || (contact.phones[0] && formatPhone(contact.phones[0].value))}</span>
            <LabelDot tone={decision.bucket ?? 'skip'} label={classification} size={8} />
            {!!summary.length && <span className="flex min-w-0 items-center gap-2 t-meta">
              {summary.slice(0, 2).map((label, index) => <span key={index} className="min-w-0 truncate"><LabelDot tone={decision.bucket ?? 'ink'} label={label} /></span>)}
              {summary.length > 2 && <span className="shrink-0 text-ink-2">+{summary.length - 2}</span>}
            </span>}
          </span>

        </button>
        {!selecting && <IconButton size={44} label={'More actions for ' + contact.displayName} onClick={() => { setError(''); setMenu(true) }}><IconMore /></IconButton>}
      </motion.div>
    </div>
    {!menu && error && <InlineNotice tone="error">{error}</InlineNotice>}
    <QuickActions name={contact.displayName} bucket={decision.bucket} busy={busy} open={menu} error={error}
      onMove={value => void move(value)} onClose={() => { if (!busy) setMenu(false) }} />
  </li>
})
