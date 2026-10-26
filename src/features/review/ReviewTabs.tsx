import { Segmented, type SegmentedOption } from '@/ui'
import { useEffect, useRef } from 'react'
import type { ReviewTab } from './model'
import { useScrollFade } from '@/ui/useScrollFade'
import './ReviewTabs.css'

export default function ReviewTabs({ options, value, onChange }: {
  options: SegmentedOption<ReviewTab>[]; value: ReviewTab; onChange: (value: ReviewTab) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  useScrollFade(scroller, true, 'x')
  useEffect(() => {
    const selected = scroller.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    selected?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [value])
  return <div ref={scroller} className="review-tabs-scroll">
    <Segmented options={options.map(option => ({ ...option, panelId: 'review-' + option.value }))}
      value={value} onChange={onChange} className="review-tabs t-meta justify-between" />
  </div>
}
