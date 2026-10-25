import { Segmented, type SegmentedOption } from '@/ui'
import type { ReviewTab } from './model'
import './ReviewTabs.css'

export default function ReviewTabs({ options, value, onChange }: {
  options: SegmentedOption<ReviewTab>[]; value: ReviewTab; onChange: (value: ReviewTab) => void
}) {
  return <Segmented options={options.map(option => ({ ...option, panelId: 'review-' + option.value }))}
    value={value} onChange={onChange} className="review-tabs t-meta justify-between gap-1!" />
}
