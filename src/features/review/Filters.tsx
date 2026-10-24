import type { ContactWithDecision } from '@/db/repo'
import { WORK_STATUS_META, PERSONAL_RELATION_META, WORK_TYPE_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'
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
}

export default function Filters({ tab, rows, segment, types, tags, onSegment, onType, onTag }: Props) {
  const segments = tab === 'work' ? WORK_STATUS_META : tab === 'personal' ? PERSONAL_RELATION_META : undefined
  const typeMeta = tab === 'work' ? WORK_TYPE_META : tab === 'personal' ? PERSONAL_TYPE_META : undefined
  const availableTags = [...new Set(rows.flatMap(({ decision }) => decision.customTags))].sort()
  return <div className="space-y-3">
    {segments && <Segmented value={segment} onChange={onSegment} options={[
      { value: 'all', label: 'All' }, ...Object.entries(segments).map(([value, meta]) => ({ value, label: meta.label })),
    ]} />}
    <div className="flex flex-wrap gap-2">
      {typeMeta && Object.entries(typeMeta).map(([value, meta]) => <Chip key={value} label={meta.label}
        selected={types.includes(value)} onClick={() => onType(value)} />)}
      {availableTags.map((tag) => <Chip key={`tag-${tag}`} label={tag} selected={tags.includes(tag)} onClick={() => onTag(tag)} />)}
    </div>
  </div>
}
