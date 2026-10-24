import type { ContactWithDecision } from '@/db/repo'
import { Empty } from '@/ui'
import ReviewRow from './ReviewRow'

interface Props {
  rows: ContactWithDecision[]
  selecting: boolean
  selected: Set<string>
  onOpen: (id: string) => void
  onToggle: (id: string) => void
  onLongPress: (id: string) => void
}

export default function ReviewList({ rows, selecting, selected, onOpen, onToggle, onLongPress }: Props) {
  if (!rows.length) return <Empty title="Nothing here yet." />
  return <ul aria-label="Contacts" className="pb-8">{rows.map((row) => <ReviewRow key={row.contact.id} row={row}
    selecting={selecting} selected={selected.has(row.contact.id)}
    onOpen={() => onOpen(row.contact.id)} onToggle={() => onToggle(row.contact.id)} onLongPress={() => onLongPress(row.contact.id)} />)}</ul>
}
