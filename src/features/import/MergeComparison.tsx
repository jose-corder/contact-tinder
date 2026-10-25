import { useEffect, useId, useRef, useState } from 'react'
import { prepareMerge, mergePair, proposedDecision, type DecisionChoice, type MergeComparison as Comparison, type MergeResult } from '@/import/duplicates'
import type { Decision } from '@/domain/types'
import { BUCKET_META, WORK_STATUS_META, WORK_TYPE_META, PERSONAL_RELATION_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'
import { Button, InlineNotice, Sheet } from '@/ui'

export function classificationLabel(d?: Decision): string {
  if (!d) return 'Unsorted'
  const labels: string[] = [d.bucket ? BUCKET_META[d.bucket].label : 'Unsorted']
  if (d.bucket === 'work') {
    if (d.workStatus) labels.push(WORK_STATUS_META[d.workStatus].label)
    labels.push(...d.workTypes.map(type => WORK_TYPE_META[type].uiLabel))
  }
  if (d.bucket === 'personal') {
    if (d.relation) labels.push(PERSONAL_RELATION_META[d.relation].label)
    labels.push(...d.personalTypes.map(type => PERSONAL_TYPE_META[type].label))
  }
  return [...labels, ...d.customTags].join(' · ')
}

export interface MergeComparisonProps {
  aId: string
  bId: string
  open: boolean
  onClose: () => void
  onMerged: (result: MergeResult) => void
}

/** #58: all comparison, error and confirmation content shares the sheet's scroller. */
export default function MergeComparison({ aId, bId, open, onClose, onMerged }: MergeComparisonProps) {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [choice, setChoice] = useState<DecisionChoice>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const locked = useRef(false)
  const name = useId()
  useEffect(() => {
    let current = true
    setComparison(null); setChoice(undefined); setError('')
    if (open) void prepareMerge(aId, bId).then(value => { if (current) setComparison(value) })
      .catch(() => { if (current) setError('Could not load the comparison. Try again.') })
    return () => { current = false }
  }, [aId, bId, open, attempt])

  async function confirm() {
    if (!comparison || locked.current || (comparison.conflict && !choice)) return
    locked.current = true; setBusy(true); setError('')
    try {
      const result = await mergePair(aId, bId, { keepDecisionFrom: choice, expected: comparison })
      onMerged(result)
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not merge. Try again.') }
    finally { locked.current = false; setBusy(false) }
  }

  const result = comparison && proposedDecision(aId, comparison.aDecision, comparison.bDecision, choice)
  return <Sheet open={open} onClose={() => { if (!locked.current) onClose() }} title="Compare contacts">
    <div className="space-y-4 break-words [overflow-wrap:anywhere]">
      {!comparison && !error && <InlineNotice tone="info">Loading comparison…</InlineNotice>}
      {comparison && <>
        {([['A', comparison.a, comparison.aDecision], ['B', comparison.b, comparison.bDecision]] as const).map(([side, c, decision]) =>
          <section key={side} aria-label={`Contact ${side}`} className="space-y-1 border-b border-rule pb-3">
            <h3 className="font-serif t-heading">{c.displayName}</h3>
            {c.org && <p className="t-body">{c.org}</p>}
            <p className="t-body">{classificationLabel(decision)}</p>
          </section>
        )}
        <section aria-label="Shared values">
          <h3 className="font-medium t-body">Shared values</h3>
          {[...comparison.sharedValues.phones, ...comparison.sharedValues.emails].map(value => <p key={value} className="t-body">{value}</p>)}
          {!comparison.sharedValues.phones.length && !comparison.sharedValues.emails.length && <p className="t-body">No shared phone or email.</p>}
        </section>
        {comparison.conflict && <fieldset disabled={busy}>
          <legend className="font-medium t-body">Choose the saved classification</legend>
          {(['a', 'b', 'union'] as const).map(value => <label key={value} className="flex min-h-11 items-center gap-3 py-2 t-body">
            <input type="radio" name={name} checked={choice === value} onChange={() => setChoice(value)} />
            <span>{value === 'a' ? `Keep A: ${comparison.a.displayName}` : value === 'b' ? `Keep B: ${comparison.b.displayName}` : 'Combine types and tags; prefer A’s existing choices'}</span>
          </label>)}
          <p className="t-meta text-ink-2">Combining keeps A’s populated bucket, status and relationship. Both sets of types and tags are saved; only the resulting bucket’s fields appear in lists and exports.</p>
        </fieldset>}
        <section aria-label="Merged result" className="space-y-2">
          <h3 className="font-serif t-heading">Keep {comparison.proposedSurvivor.displayName}</h3>
          <p className="t-body">All phone numbers, emails and original fields are kept. Both contacts’ tags are combined.</p>
          {(!comparison.conflict || choice) && <p className="t-body">Result: {classificationLabel(result ?? undefined)}</p>}
          <p className="t-meta text-ink-2">Undo is available for 10 minutes unless the merged contact or its comparisons change.</p>
        </section>
      </>}
      {error && <><InlineNotice tone="error">{error}</InlineNotice><Button variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Refresh comparison</Button></>}
      <Button full loading={busy} disabled={!comparison || (comparison.conflict && !choice)} onClick={() => void confirm()}>Merge contacts</Button>
      <Button full variant="ghost" disabled={busy} onClick={onClose}>Cancel merge</Button>
    </div>
  </Sheet>
}
