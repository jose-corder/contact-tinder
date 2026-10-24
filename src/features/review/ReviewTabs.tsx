import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { cx } from '@/ui'
import type { SegmentedOption } from '@/ui'
import type { ReviewTab } from './model'

export default function ReviewTabs({ options, value, onChange }: {
  options: SegmentedOption<ReviewTab>[]; value: ReviewTab; onChange: (value: ReviewTab) => void
}) {
  const reduced = useReducedMotion()
  return <LayoutGroup><div role="tablist" aria-label="Contact buckets" className="flex justify-between gap-1 border-b border-rule">
    {options.map((option) => <button key={option.value} role="tab" aria-selected={value === option.value}
      onClick={() => onChange(option.value)} className={cx('relative flex min-h-11 items-center gap-1 text-[13px]', value !== option.value && 'text-ink-2')}>
      {option.label}<span className="tabular text-[11px] text-ink-2">{option.count}</span>
      {value === option.value && <motion.span layoutId="review-tab" className="absolute -bottom-px inset-x-0 h-0.5 bg-ink"
        transition={{ duration: reduced ? 0 : 0.2 }} />}
    </button>)}
  </div></LayoutGroup>
}
