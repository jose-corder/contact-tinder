import type { ContactWithDecision } from '@/db/repo'
import { isInDeck, isUnsorted, PASS_META, PASS_ORDER } from '@/domain/taxonomy'

export function homeProgress(rows: ContactWithDecision[]) {
  const steps = PASS_ORDER.map((pass) => {
    const members = rows.filter(({ decision }) => pass === 'triage' || decision.bucket === pass)
    const remaining = members.filter(({ decision }) => isInDeck(decision, pass) || isUnsorted(decision, pass)).length
    return { pass, title: PASS_META[pass].title, total: members.length, done: members.length - remaining }
  })
  const completed = rows.filter(({ decision: d }) => d.bucket === 'delete' ||
    (d.bucket === 'work' && !!d.workStatus) || (d.bucket === 'personal' && !!d.relation)).length
  return { steps, current: steps.find(({ pass }) => rows.some(({ decision }) => isInDeck(decision, pass))), completed,
    percent: rows.length ? Math.round(completed / rows.length * 100) : 0 }
}
