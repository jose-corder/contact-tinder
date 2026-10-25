import { Fragment, useEffect, useRef, useState } from 'react'
import type { ContactWithDecision } from '@/db/repo'
import ReviewRow from './ReviewRow'
import ReviewEmpty from './ReviewEmpty'
import type { ReviewTab } from './model'

interface Props {
  rows: ContactWithDecision[]
  selecting: boolean
  selected: Set<string>
  onOpen: (id: string) => void
  onToggle: (id: string) => void
  onLongPress: (id: string) => void
  tab?: ReviewTab
  filtered?: boolean
  onClear?: () => void
  limit?: number
  onLimit?: (limit: number) => void
}

export default function ReviewList({ rows, selecting, selected, onOpen, onToggle, onLongPress, tab = 'unsorted', filtered = false, onClear, limit: controlledLimit, onLimit }: Props) {
  const [localLimit, setLocalLimit] = useState(60)
  const limit = controlledLimit ?? localLimit
  const loadMore = () => { setLocalLimit(limit + 60); onLimit?.(limit + 60) }
  const sentinel = useRef<HTMLButtonElement>(null)
  const more = limit < rows.length
  useEffect(() => {
    if (!more || !sentinel.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        loadMore()
      }
    }, { rootMargin: '240px' })
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [more, limit, rows.length])
  if (!rows.length) return <ReviewEmpty tab={tab} filtered={filtered} onClear={onClear} />
  const letter = (name: string) => name.trim().charAt(0).toLocaleUpperCase() || '#'
  return <>
    <ul aria-label="Contacts" className="pb-2">{rows.slice(0, limit).map((row, index) => <Fragment key={row.contact.id}>
    {rows.length > 30 && (index === 0 || letter(rows[index - 1].contact.displayName) !== letter(row.contact.displayName)) &&
      <li className="eyebrow sticky top-12 z-[5] border-b border-rule bg-paper py-2" aria-label={`Names beginning with ${letter(row.contact.displayName)}`}>{letter(row.contact.displayName)}</li>}
    <ReviewRow row={row}
    selecting={selecting} selected={selected.has(row.contact.id)}
    onOpen={onOpen} onToggle={onToggle} onLongPress={onLongPress} /></Fragment>)}</ul>
    {more && <button ref={sentinel} className="min-h-11 w-full t-meta text-ink-2" onClick={loadMore}>Load more contacts</button>}
  </>
}
