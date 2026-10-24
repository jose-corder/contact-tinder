import { useEffect, useRef, useState } from 'react'
import type { Contact } from '@/domain/types'
import { Avatar } from '@/ui'

const sources = { vcf: 'iCloud', csv: 'Google', picker: 'Phone', demo: 'Demo' }
function year(value: string | number) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.getFullYear()
}

export function SwipeCard({ contact, preview = false, onFlip }: { contact: Contact; preview?: boolean; onFlip?: (flipped: boolean) => void }) {
  const [flipped, setFlipped] = useState(false)
  const [toast, setToast] = useState('')
  const origin = useRef({ x: 0, y: 0 })
  const moved = useRef(false)
  const copied = useRef(false)
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alive = useRef(true)
  const cancel = () => clearTimeout(press.current)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; clearTimeout(press.current); clearTimeout(toastTimer.current) }
  }, [])
  const copy = async (value: string) => {
    copied.current = true
    try {
      await navigator.clipboard.writeText(value)
      if (alive.current) setToast('Copied')
    } catch { if (alive.current) setToast('Could not copy') }
    if (alive.current) toastTimer.current = setTimeout(() => setToast(''), 1200)
  }
  const phones = flipped ? contact.phones : contact.phones.slice(0, 2)
  const emails = flipped ? contact.emails : contact.emails.slice(0, 2)
  const edited = contact.rev ? year(contact.rev) : undefined
  const flip = () => { setFlipped(!flipped); onFlip?.(!flipped) }
  return (
    <article
      aria-label={preview ? undefined : `${contact.displayName} contact card`}
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-rule bg-paper-2 p-5 text-ink shadow-card select-none"
      onPointerDown={(event) => { origin.current = { x: event.clientX, y: event.clientY }; moved.current = false; copied.current = false }}
      onPointerMove={(event) => {
        if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) { moved.current = true; cancel() }
      }}
      onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
      onClick={() => { if (!preview && !moved.current && !copied.current) flip() }}
    >
      <div className={`flex min-h-0 flex-1 flex-col gap-3 ${flipped ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`}>
        {!flipped && <Avatar name={contact.displayName} photo={contact.photo} size={72} />}
        <h2 className="line-clamp-2 shrink-0 break-words font-serif text-[34px] leading-[38px] tracking-tight">{contact.displayName}</h2>
        {!flipped && <p className="truncate text-[15px] text-ink-2">{[contact.title, contact.org].filter(Boolean).join(' · ') || ' '}</p>}
        <div className="hairline shrink-0" />
        <dl className="grid shrink-0 grid-cols-[76px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-[15px]">
          {flipped && [['Given name', contact.givenName], ['Family name', contact.familyName], ['Role', contact.title], ['Org', contact.org]].map(([label, value]) => value && <Field key={label} label={label!} value={value} />)}
          {phones.map((phone, index) => <Field key={`phone-${index}`} label={friendlyType(phone.type, 'Phone')} value={phone.value} phone onHold={() => { cancel(); press.current = setTimeout(() => void copy(phone.value), 500) }} />)}
          {emails.map((email, index) => <Field key={`email-${index}`} label={friendlyType(email.type, 'Email')} value={email.value} />)}
        </dl>
        {contact.notes && <p className={`break-words text-[15px] text-ink-2 ${flipped ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{contact.notes}</p>}
      </div>
      <div className="hairline mt-3 shrink-0 pt-3">
        <div className="flex flex-wrap gap-x-3 text-[12px] tracking-wide text-ink-2 uppercase">
          <span>{sources[contact.source]}</span><span>added {year(contact.importedAt)}</span>{edited && <span>edited {edited}</span>}
        </div>
        {!preview && <button type="button" className="mt-2 text-xs text-ink-2" onClick={(event) => { event.stopPropagation(); flip() }}>{flipped ? 'back' : 'View all fields'}</button>}
      </div>
      {toast && <div role="status" className="absolute inset-x-5 bottom-4 rounded-full bg-ink px-3 py-2 text-center text-sm text-paper">{toast}</div>}
    </article>
  )
}

function Field({ label, value, phone, onHold }: { label: string; value: string; phone?: boolean; onHold?: () => void }) {
  return <><dt className="eyebrow truncate text-ink-2" title={label}>{label}</dt><dd className={`min-w-0 truncate ${phone ? 'tabular' : ''}`} title={value} onPointerDown={onHold} onContextMenu={phone ? (event) => event.preventDefault() : undefined}>{value}</dd></>
}

/** Turn vCard TYPE params (CELL, INTERNET, pref, voice...) into a short human label. */
export function friendlyType(type: string | undefined, fallback: string): string {
  const t = (type ?? '').toLowerCase().split(/[,;\s]+/).filter((p) => p && !['internet', 'pref', 'voice', 'x-mobile'].includes(p))
  const map: Record<string, string> = { cell: 'Mobile', mobile: 'Mobile', iphone: 'Mobile', main: 'Main', work: 'Work', home: 'Home', fax: 'Fax', other: fallback }
  const first = t[0]
  if (!first) return fallback
  return map[first] ?? first.charAt(0).toUpperCase() + first.slice(1)
}
