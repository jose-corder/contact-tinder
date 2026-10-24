import type { Decision } from '@/domain/types'
import { BUCKET_META, decisionLabels, PERSONAL_RELATION_META, WORK_STATUS_META } from '@/domain/taxonomy'

export default function DecisionLabels({ decision }: { decision: Decision }) {
  const labels = decisionLabels(decision)
  return <ul aria-label="Labels" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2">
    {labels.map((label) => {
      const status = decision.bucket === 'work' && decision.workStatus ? WORK_STATUS_META[decision.workStatus] : undefined
      const relation = decision.bucket === 'personal' && decision.relation ? PERSONAL_RELATION_META[decision.relation] : undefined
      const color = status?.label === label ? status.color : relation?.label === label ? relation.color :
        decision.bucket && !decision.customTags.includes(label) ? BUCKET_META[decision.bucket].color : 'var(--stamp-skip)'
      return <li key={label} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</li>
    })}
  </ul>
}
