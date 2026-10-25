import { useEffect, useRef, useState } from 'react'
import { mergePair, prepareMerge, proposedDecision, type DecisionChoice, type DuplicatePair, type MergeComparison, type MergeResult } from '@/import/duplicates'
import { Button, InlineNotice, RadioGroup, Sheet, SheetFooterActions } from '@/ui'
import { uiDecisionLabels } from './labels'
import type { Decision } from '@/domain/types'

const classification = (d?: Decision) => [!d?.bucket ? 'Unsorted' : '', ...uiDecisionLabels(d)].filter(Boolean).join(' · ')
export default function MergeSheet({ pair, onClose, onMerged }: {
  pair: DuplicatePair; onClose: () => void; onMerged: (result: MergeResult) => void
}) {
  const [comparison, setComparison] = useState<MergeComparison>()
  const [choice, setChoice] = useState<DecisionChoice | ''>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const locked = useRef(false)
  useEffect(() => {
    let active = true
    setComparison(undefined); setChoice(''); setError('')
    void prepareMerge(pair.a.id, pair.b.id).then(value => { if (active) setComparison(value) })
      .catch(() => { if (active) setError('Could not load comparison. Please try again.') })
    return () => { active = false }
  }, [pair.a.id, pair.b.id, retry])
  const close = () => { if (!locked.current) onClose() }
  async function merge() {
    if (!comparison || locked.current || (comparison.conflict && !choice)) return
    locked.current = true; setBusy(true); setError('')
    try {
      const result = await mergePair(pair.a.id, pair.b.id, { keepDecisionFrom: choice || undefined, expected: comparison })
      onMerged(result); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not merge. Please try again.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <Sheet open onClose={close} title="Compare contacts"
    footer={<SheetFooterActions secondary={{ label: 'Cancel merge', disabled: busy, onClick: close }}
      primary={{ label: 'Merge contacts', loading: busy, disabled: !comparison || (comparison.conflict && !choice), onClick: () => void merge() }} />}>
    <div className="space-y-4 break-words [overflow-wrap:anywhere]">
      {!comparison && !error && <InlineNotice tone="info">Loading comparison…</InlineNotice>}
      {comparison && <>
        {([['A', comparison.a, comparison.aDecision], ['B', comparison.b, comparison.bDecision]] as const).map(([side, contact, decision]) =>
          <section key={side} aria-label={'Contact ' + side} className="space-y-1 border-b border-rule pb-3">
            <h3 className="font-serif t-heading">{side}: {contact.displayName}</h3>
            {contact.org && <p className="t-body">{contact.org}</p>}
            <p className="t-body">Saved classification: {classification(decision)}</p>
          </section>)}
        <section aria-label="Shared values">
          <h3 className="t-heading">Why this pair: {pair.reason}</h3>
          {comparison.sharedValues.phones.map(value => <p key={value} className="t-body">Shared phone: {value}</p>)}
          {comparison.sharedValues.emails.map(value => <p key={value} className="t-body">Shared email: {value}</p>)}
          {!comparison.sharedValues.phones.length && !comparison.sharedValues.emails.length && <p className="t-body">No shared phone or email.</p>}
        </section>
        {comparison.conflict && <>
          <p className="t-body">Choose which saved classification to keep.</p>
          <RadioGroup<DecisionChoice | ''> label="Saved classification" value={choice} onChange={setChoice} disabled={busy}
            options={[{ value: 'a', label: "Keep A's" }, { value: 'b', label: "Keep B's" }, { value: 'union', label: 'Combine' }]} />
          <p className="t-meta text-ink-2">Combine keeps A’s populated list, status and relationship, and both sets of types and tags. Only the resulting list’s fields appear in lists and exports.</p>
        </>}
        <section aria-label="Proposed survivor">
          <h3 className="font-serif t-heading">Keep {comparison.proposedSurvivor.displayName}</h3>
          <p className="t-body">All phone numbers, emails and original fields are kept. Both contacts’ tags are combined.</p>
          {(!comparison.conflict || choice) && <p className="t-body">Result: {classification(proposedDecision(pair.a.id, comparison.aDecision, comparison.bDecision, choice || undefined))}</p>}
          <p className="t-meta text-ink-2">Undo available for 10 minutes unless these contacts or comparisons change.</p>
        </section>
      </>}
      {error && <><InlineNotice tone="error">{error}</InlineNotice><Button variant="outline" disabled={busy} onClick={() => setRetry(value => value + 1)}>Refresh comparison</Button></>}
    </div>
  </Sheet>
}
