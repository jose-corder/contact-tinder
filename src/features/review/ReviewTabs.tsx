import { Segmented, type SegmentedOption } from '@/ui'
import type { ReviewTab } from './model'

export default function ReviewTabs({ options, value, onChange }: {
  options: SegmentedOption<ReviewTab>[]; value: ReviewTab; onChange: (value: ReviewTab) => void
}) {
  return <Segmented options={options.map(option => ({ ...option, panelId: 'review-' + option.value }))}
    value={value} onChange={onChange} className="justify-between gap-1! [&_button]:text-[13px]" />
}
