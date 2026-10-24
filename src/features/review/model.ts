// deck reads meta.deckScope when its pass matches and clears it on deck end
import type { ContactWithDecision } from '@/db/repo'
import type { Bucket, Decision, Pass } from '@/domain/types'
import { isInDeck, PASS_ORDER, setBucket } from '@/domain/taxonomy'
import { isUnsortedRow } from '@/export/vcf'

export type ReviewTab = Bucket | 'unsorted'
export function inTab(row: ContactWithDecision, tab: ReviewTab): boolean {
  return tab === 'unsorted' ? isUnsortedRow(row) : row.decision.bucket === tab
}

export function matchesSearch({ contact: c }: ContactWithDecision, search: string): boolean {
  const query = search.trim().toLocaleLowerCase()
  return [c.displayName, c.org ?? '', ...c.phones.map((p) => p.value), ...c.emails.map((e) => e.value)]
    .some((value) => value.toLocaleLowerCase().includes(query))
}

export function resetForReview(rows: ContactWithDecision[], tab: ReviewTab): { decisions: Decision[]; pass: Pass } {
  const decisions = rows.map(({ decision }) => {
    const pass: Pass = tab === 'work' || tab === 'personal' ? tab : tab === 'delete' || !decision.bucket ? 'triage'
      : decision.bucket === 'work' ? 'work' : 'personal'
    const next = pass === 'triage' ? setBucket(decision, undefined) : { ...decision, updatedAt: Date.now() }
    if (pass === 'work') next.workStatus = undefined
    if (pass === 'personal') next.relation = undefined
    return { ...next, skips: { ...next.skips, [pass]: 0 } }
  })
  return { decisions, pass: PASS_ORDER.find((pass) => decisions.some((d) => isInDeck(d, pass))) ?? 'triage' }
}
