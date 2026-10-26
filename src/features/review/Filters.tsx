import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContactWithDecision } from '@/db/repo'
import { WORK_STATUS_META, PERSONAL_RELATION_META, WORK_TYPE_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'
import { Chip, RadioGroup } from '@/ui'
import type { ReviewTab } from './model'
import './Filters.css'

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
  const scroller = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const measure = () => {
    const node = scroller.current
    if (node) setMore(node.scrollWidth - node.clientWidth - node.scrollLeft > 1)
  }
  useEffect(() => {
    const node = scroller.current
    if (!node) return
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(node)
    for (const child of node.children) observer?.observe(child)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [tab, availableTags, active])
  return <div ref={scroller} onScroll={measure} onFocusCapture={event => {
    event.target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }} aria-label="Filter contacts" data-more={more} className="review-filters flex items-center gap-2 overflow-x-auto py-2 [&>*]:shrink-0">
    {segments && <RadioGroup label={tab === 'work' ? 'Work status' : 'Personal relationship'} value={segment} onChange={onSegment} options={[
      { value: 'all', label: 'All' }, ...Object.entries(segments).map(([value, meta]) => ({ value, label: meta.label })),
    ]} />}
    {typeMeta && Object.entries(typeMeta).map(([value, meta]) => <Chip key={value} label={'uiLabel' in meta ? String(meta.uiLabel) : meta.label}
      tone={tone} selected={types.includes(value)} onClick={() => onType(value)} />)}
    {availableTags.map(tag => <Chip key={'tag-' + tag} label={tag} tone={tone} selected={tags.includes(tag)} onClick={() => onTag(tag)} />)}
    {active && <button className="hit-44 t-meta underline underline-offset-4" onClick={onClear}>Clear filters</button>}
  </div>
}
