import { emptyDecision, type Decision } from '@/domain/types'
import { canonical } from '@/export/recovery'

export type DecisionChoice = 'a' | 'b' | 'union'
const union = <T>(a: T[] = [], b: T[] = []) => [...new Set([...a, ...b])]
const classification = (d: Decision) => [d.bucket, d.workStatus, [...d.workTypes].sort(),
  d.relation, [...d.personalTypes].sort()]
const classified = (d?: Decision) => d && (d.bucket || d.workStatus || d.relation || d.workTypes.length || d.personalTypes.length)

export function decisionsConflict(a?: Decision, b?: Decision): boolean {
  return !!(classified(a) && classified(b) && canonical(classification(a!)) !== canonical(classification(b!)))
}

/** Union keeps A's populated single-choice fields and combines types/tags. The UI must
 * disclose that only the resulting bucket's fields are active in screens and exports. */
export function proposedDecision(aId: string, a?: Decision, b?: Decision, choice?: DecisionChoice): Decision | undefined {
  if (!a && !b) return undefined
  const base = (choice === 'a' ? a : choice === 'b' ? b : classified(a) ? a : b ?? a) ?? emptyDecision(aId, 0)
  const result: Decision = { ...base, contactId: aId, customTags: union(a?.customTags, b?.customTags) }
  if (choice === 'union') {
    result.bucket = a?.bucket ?? b?.bucket
    result.workStatus = a?.workStatus ?? b?.workStatus
    result.relation = a?.relation ?? b?.relation
    result.workTypes = union(a?.workTypes, b?.workTypes)
    result.personalTypes = union(a?.personalTypes, b?.personalTypes)
  }
  return result
}
