import { useMemo } from 'react'
import type { ContactWithDecision } from '@/db/repo'
import { BUCKET_META, WORK_STATUS_META, PERSONAL_RELATION_META, WORK_TYPE_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'
import { Chip, Segmented } from '@/ui'
import type { ReviewTab } from './model'

interface Props {
  tab: ReviewTab
  rows: ContactWithDecision[]
  segment: string
  types: string[]
  tags: string[]
  onSegment: (value: string) => void
  onType: (value: string) => void
  onTag: (value: string) => void
  active: boolean
  onClear: () => void
}

export default function Filters({ tab, rows, segment, types, tags, onSegment, onType, onTag, active, onClear }: Props) {
  const segments = tab === 'work' ? WORK_STATUS_META : tab === 'personal' ? PERSONAL_RELATION_META : undefined
  const typeMeta = tab === 'work' ? WORK_TYPE_META : tab === 'personal' ? PERSONAL_TYPE_META : undefined
  const availableTags = useMemo(() => [...new Set(rows.flatMap(({ decision }) => decision.customTags))].sort(), [rows])
  const color = tab === 'unsorted' ? 'var(--stamp-skip)' : BUCKET_META[tab].color
  return <div className="space-y-3">
    {segments && <Segmented value={segment} onChange={onSegment} options={[
      { value: 'all', label: 'All' }, ...Object.entries(segments).map(([value, meta]) => ({ value, label: meta.label })),
    ]} />}
    <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0">
      {active && <button className="min-h-11 text-sm underline underline-offset-4" onClick={onClear}>Clear</button>}
      {typeMeta && Object.entries(typeMeta).map(([value, meta]) => <Chip key={value} label={meta.label}
        color={color} selected={types.includes(value)} onClick={() => onType(value)} />)}
      {availableTags.map((tag) => <Chip key={`tag-${tag}`} label={tag} color={color} selected={tags.includes(tag)} onClick={() => onTag(tag)} />)}
    </div>
  </div>
}
