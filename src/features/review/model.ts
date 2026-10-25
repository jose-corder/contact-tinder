import type { ContactWithDecision } from '@/db/repo'
import type { Bucket, Pass } from '@/domain/types'
import { PASS_ORDER } from '@/domain/taxonomy'
import { isUnsortedRow } from '@/export/vcf'

export type ReviewTab = Bucket | 'unsorted'
export function inTab(row: ContactWithDecision, tab: ReviewTab): boolean {
  return tab === 'unsorted' ? isUnsortedRow(row) : row.decision.bucket === tab
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
export function matchesSearch({ contact: c }: ContactWithDecision, search: string): boolean {
  const query = normalize(search.trim())
  if ([c.displayName, c.org ?? '', ...c.phones.map(p => p.value), ...c.emails.map(e => e.value)]
    .some(value => normalize(value).includes(query))) return true
  const digits = query.replace(/\D/g, '')
  return !!digits && /^[+() .0-9-]+$/.test(query) && c.phones.some(p => p.value.replace(/\D/g, '').includes(digits))
}

/** Choose the first unfinished pass for a mixed Unsorted list without changing any decision. */
export function reviewPass(rows: ContactWithDecision[], tab: ReviewTab): Pass {
  if (tab === 'work' || tab === 'personal') return tab
  if (tab === 'delete') return 'triage'
  return PASS_ORDER.find(pass => rows.some(({ decision: d }) =>
    pass === 'triage' ? !d.bucket : d.bucket === pass && (pass === 'work' ? !d.workStatus : !d.relation))) ?? 'triage'
}
