import type { RefObject } from 'react'
import type { Contact } from '@/domain/types'
import { formatDate, formatPhone } from '@/ui/format'
import { Avatar, useLongPressCopy } from '@/ui'
import { sourceLabel } from '@/import/sourceLabel'
import { useElementSize } from '@/hooks/useElementSize'
import { friendlyType } from './CardFields'
import { isDrag } from './swipeMath'
import { useRef } from 'react'

export function formatContactDate(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined
  const formatted = formatDate(value)
  return formatted === value && Number.isNaN(new Date(value).getTime()) ? undefined : formatted
}

export function CardFront({ contact, stageHeight, preview, toggleRef, flip }: {
  contact: Contact; stageHeight: number; preview: boolean
  toggleRef: RefObject<HTMLButtonElement | null>; flip: () => void
}) {
  const compact = stageHeight < 680
  const landscape = stageHeight > 0 && stageHeight < 420 && window.innerWidth > window.innerHeight
  const roomy = stageHeight >= 680
  const content = useElementSize<HTMLDivElement>()
  const viewport = useElementSize<HTMLDivElement>()
  const identity = useElementSize<HTMLDivElement>()
  const rows = [
    ...contact.phones.slice(0, 1).map((p) => ({ label: friendlyType(p.type, 'Phone'), value: p.value, phone: true })),
    ...contact.emails.slice(0, 1).map((e) => ({ label: friendlyType(e.type, 'Email'), value: e.value, phone: false })),
    ...contact.phones.slice(1, 2).map((p) => ({ label: friendlyType(p.type, 'Phone'), value: p.value, phone: true })),
    ...contact.emails.slice(1, 2).map((e) => ({ label: friendlyType(e.type, 'Email'), value: e.value, phone: false })),
    ...(contact.notes ? [{ label: 'Notes', value: contact.notes, phone: false }] : []),
  ]
  const required = Number(!!contact.phones.length) + Number(!!contact.emails.length)
  // Fixed-height rows are removed as units. Essential rows remain, with an internal
  // scroller as a last resort for zoom/landscape instead of slicing through glyphs.
  const available = viewport.height ? viewport.height - identity.height - 13 : stageHeight - 190
  const limit = compact ? Math.max(required, Math.floor(available / 28)) : rows.length
  const visible = rows.slice(0, limit)
  const more = contact.phones.length + contact.emails.length + Number(!!contact.notes) - visible.length
  const center = !compact && content.height < stageHeight - 120
  return <>
    <div ref={viewport.ref} className={`deck-front-scroll min-h-0 flex-1 overflow-y-auto ${center ? 'flex flex-col justify-center' : ''}`}>
      <div ref={content.ref} className={`deck-front-content ${landscape ? 'deck-front-columns' : ''}`}>
        <div ref={identity.ref}>
        <div className={compact ? 'flex items-center gap-3' : 'flex flex-col gap-3'}>
          <Avatar name={contact.displayName} photo={contact.photo} size={compact ? 44 : 72} />
          <h2 className={`min-w-0 font-serif ${landscape ? 't-title' : 't-display'} ${roomy ? 'line-clamp-2 break-words' : 'truncate'}`}>{contact.displayName}</h2>
        </div>
        <p className={`mt-1 t-body text-ink-2 ${roomy ? 'line-clamp-2 break-words' : 'truncate'}`}>{[contact.title, contact.org].filter(Boolean).join(' · ') || '\u00a0'}</p>
        </div>
        <dl className="deck-summary-fields mt-2 border-t border-rule pt-1">
          {visible.map((row, index) => <div key={index} className="deck-field-row grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2">
            <dt className="truncate t-meta text-ink-2">{row.label}</dt>
            {row.phone && !preview ? <FrontPhone value={row.value} /> : <dd className="truncate t-body" title={row.value}>{row.phone ? formatPhone(row.value) : row.value}</dd>}
          </div>)}
        </dl>
      </div>
    </div>
    <div className="deck-card-meta shrink-0 border-t border-rule pt-1">
      <div className="flex items-center gap-2 whitespace-nowrap t-meta text-ink-2">
        <span className="min-w-0 truncate" title={`${sourceLabel(contact)} · Added ${formatContactDate(contact.importedAt)}`}>{sourceLabel(contact)} · Added {formatContactDate(contact.importedAt)}</span>
        {more > 0 && <span className="shrink-0">+{more} more</span>}
      </div>
      {!preview && <button ref={toggleRef} type="button" className="hit-44 min-h-11 min-w-11 t-meta text-ink-2" onClick={(event) => { event.stopPropagation(); flip() }}>View all fields</button>}
    </div>
  </>
}

function FrontPhone({ value }: { value: string }) {
  const copy = useLongPressCopy(value)
  const origin = useRef({ x: 0, y: 0 })
  return <dd className="deck-front-phone min-w-0 t-body" {...copy.handlers}
    onPointerDown={event => { origin.current = { x: event.clientX, y: event.clientY }; copy.handlers.onPointerDown?.(event) }}
    onPointerMove={event => {
      // Cancel at the deck's drag slop even though the shared gesture allows 10px.
      if (isDrag(event.clientX - origin.current.x, event.clientY - origin.current.y)) copy.handlers.onPointerCancel?.(event)
      else copy.handlers.onPointerMove?.(event)
    }}>
    <span className="block truncate" title={value}>{formatPhone(value)}</span>
    <span className="deck-copy-feedback t-meta" onClick={event => event.stopPropagation()}>{copy.feedback}
      {copy.result === 'Copy failed' && <button type="button" className="hit-44 underline" onClick={() => void copy.copy()}>Retry copy</button>}
    </span>
  </dd>
}
