import type { RefObject } from 'react'
import type { Contact } from '@/domain/types'
import { Avatar } from '@/ui'
import { sourceLabel } from '@/import/sourceLabel'
import { useElementSize } from '@/hooks/useElementSize'
import { friendlyType } from './CardFields'

export function formatContactDate(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function CardFront({ contact, stageHeight, preview, hold, toggleRef, flip }: {
  contact: Contact; stageHeight: number; preview: boolean; hold: (value: string) => void
  toggleRef: RefObject<HTMLButtonElement | null>; flip: () => void
}) {
  const compact = stageHeight < 680
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
      <div ref={content.ref} className="deck-front-content">
        <div ref={identity.ref}>
        <div className={compact ? 'flex items-center gap-3' : 'flex flex-col gap-3'}>
          <Avatar name={contact.displayName} photo={contact.photo} size={compact ? 44 : 72} />
          <h2 className={`min-w-0 font-serif t-display ${compact ? 'truncate' : 'line-clamp-2 break-words'}`}>{contact.displayName}</h2>
        </div>
        <p className={`mt-1 t-body text-ink-2 ${compact ? 'truncate' : 'line-clamp-2'}`}>{[contact.title, contact.org].filter(Boolean).join(' · ') || '\u00a0'}</p>
        </div>
        <dl className="deck-summary-fields mt-2 border-t border-rule pt-1">
          {visible.map((row, index) => <div key={index} className="deck-field-row grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2">
            <dt className="truncate t-meta text-ink-2">{row.label}</dt>
            <dd className="truncate t-body" title={row.value} onPointerDown={row.phone ? () => hold(row.value) : undefined}
              onContextMenu={row.phone ? (event) => event.preventDefault() : undefined}>{row.value}</dd>
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
