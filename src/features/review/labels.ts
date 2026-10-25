import type { Decision } from '@/domain/types'
import { BUCKET_META, WORK_STATUS_META, WORK_TYPE_META, PERSONAL_RELATION_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'

/** #41: display labels are separate from the stable export vocabulary. */
export function uiDecisionLabels(d?: Decision): string[] {
  if (!d) return []
  const labels = d.bucket ? [BUCKET_META[d.bucket].label] : []
  if (d.bucket === 'work') {
    if (d.workStatus) labels.push(WORK_STATUS_META[d.workStatus].label)
    labels.push(...d.workTypes.map(type => WORK_TYPE_META[type].uiLabel))
  }
  if (d.bucket === 'personal') {
    if (d.relation) labels.push(PERSONAL_RELATION_META[d.relation].label)
    labels.push(...d.personalTypes.map(type => PERSONAL_TYPE_META[type].label))
  }
  return [...labels, ...d.customTags]
}
