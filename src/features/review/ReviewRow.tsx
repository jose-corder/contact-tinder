import { useEffect, useRef } from 'react'
import type { ContactWithDecision } from '@/db/repo'
import { BUCKET_META, WORK_STATUS_META, PERSONAL_RELATION_META } from '@/domain/taxonomy'
import { Avatar } from '@/ui'

interface Props {
  row: ContactWithDecision
  selecting: boolean
  selected: boolean
  onOpen: () => void
  onToggle: () => void
  onLongPress: () => void
}

export default function ReviewRow({ row: { contact, decision }, selecting, selected, onOpen, onToggle, onLongPress }: Props) {
  const timer = useRef<number | undefined>(undefined)
  const pressed = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const cancel = () => window.clearTimeout(timer.current)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const bucket = decision.bucket && BUCKET_META[decision.bucket]
  const status = decision.bucket === 'work' && decision.workStatus ? WORK_STATUS_META[decision.workStatus] : undefined
  const relation = decision.bucket === 'personal' && decision.relation ? PERSONAL_RELATION_META[decision.relation] : undefined
  const labels = [bucket, status, relation].filter((meta) => !!meta)
  return <li className="flex h-16 items-center gap-3 border-b border-rule">
    {selecting && <input type="checkbox" aria-label={`Select ${contact.displayName}`} checked={selected} onChange={onToggle}
      className="h-5 w-5 shrink-0 accent-ink" />}
    <button type="button" className="flex h-full min-w-0 flex-1 touch-pan-y items-center gap-3 text-left"
      aria-label={`${selecting ? 'Select' : 'View'} ${contact.displayName}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        pressed.current = false
        origin.current = { x: event.clientX, y: event.clientY }
        timer.current = window.setTimeout(() => { pressed.current = true; onLongPress() }, 500)
      }}
      onPointerMove={(event) => {
        if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancel()
      }}
      onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (pressed.current) { pressed.current = false; return }
        if (selecting) onToggle()
        else onOpen()
      }}>
      <Avatar name={contact.displayName} photo={contact.photo} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[17px]">{contact.displayName}</span>
        <span className="block truncate text-[13px] text-ink-2">{contact.org || contact.phones[0]?.value}</span>
      </span>
      <span className="flex max-w-[95px] shrink-0 flex-col items-end gap-1">
        <span aria-hidden="true" className="flex gap-1">{labels.map((meta, i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />)}</span>
        <span className="text-xs text-ink-2">{status?.label ?? relation?.label}</span>
      </span>
    </button>
  </li>
}
