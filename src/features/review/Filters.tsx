import { useMemo } from 'react'
import type { ContactWithDecision } from '@/db/repo'
import { WORK_STATUS_META, PERSONAL_RELATION_META, WORK_TYPE_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'
import { Chip, RadioGroup } from '@/ui'
import type { ReviewTab } from './model'

interface Props {
  tab: ReviewTab; rows: ContactWithDecision[]; segment: string; types: string[]; tags: string[]
  onSegment: (value: string) => void; onType: (value: string) => void; onTag: (value: string) => void
  active: boolean; onClear: () => void
}
export default function Filters({ tab, rows, segment, types, tags, onSegment, onType, onTag, active, onClear }: Props) {
  const segments = tab === 'work' ? WORK_STATUS_META : tab === 'personal' ? PERSONAL_RELATION_META : undefined
  const typeMeta = tab === 'work' ? WORK_TYPE_META : tab === 'personal' ? PERSONAL_TYPE_META : undefined
  const availableTags = useMemo(() => [...new Set(rows.flatMap(({ decision }) => decision.customTags))].sort(), [rows])
  const tone = tab === 'unsorted' ? 'skip' : tab
  return <div aria-label="Filter contacts" className="flex items-center gap-2 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&>*]:shrink-0">
    {segments && <RadioGroup label={tab === 'work' ? 'Work status' : 'Personal relationship'} value={segment} onChange={onSegment} options={[
      { value: 'all', label: 'All' }, ...Object.entries(segments).map(([value, meta]) => ({ value, label: meta.label })),
    ]} />}
    {typeMeta && Object.entries(typeMeta).map(([value, meta]) => <Chip key={value} label={meta.label}
      tone={tone} selected={types.includes(value)} onClick={() => onType(value)} />)}
    {availableTags.map(tag => <Chip key={'tag-' + tag} label={tag} tone={tone} selected={tags.includes(tag)} onClick={() => onTag(tag)} />)}
    {active && <button className="hit-44 t-meta underline underline-offset-4" onClick={onClear}>Clear filters</button>}
  </div>
}
