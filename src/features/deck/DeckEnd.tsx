import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { allWithDecisions, counts } from '@/db/repo'
import { isInDeck, isUnsorted, PASS_META } from '@/domain/taxonomy'
import { nextUnfinishedPass } from '@/domain/decks'
import type { Pass } from '@/domain/types'
import { Button, InlineNotice, LabelDot, Skeleton, motionProps, type ChipTone } from '@/ui'
import { prefersReducedMotion } from '@/ui/theme'
import { DECK_MOTION, useDeckReducedMotion } from './motion'

export function Tick({ value }: { value: number }) {
  const mediaReduced = useDeckReducedMotion()
  const reduced = mediaReduced || prefersReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) { setShown(value); return }
    setShown(0)
    let frame = 0
    let start: number | undefined
    const tick = (now: number) => {
      start ??= now
      const fraction = Math.min(1, (now - start) / DECK_MOTION.tickMs)
      setShown(Math.round(value * fraction))
      if (fraction < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])
  return <span aria-live="off" className="tabular font-serif t-heading"><span aria-hidden="true" className="deck-tick" data-count={reduced ? value : shown} /><span className="sr-only">{value}</span></span>
}

export function DeckEnd({ pass, sessionIds, skippedIds, scoped, retrySkipped, announce }: {
  pass: Pass; sessionIds: string[]; skippedIds: string[]; scoped: boolean
  retrySkipped: (ids: string[]) => Promise<void>; announce?: (message: string) => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const announced = useRef(false)
  const result = useLiveQuery(async () => {
    try {
      const [summary, rows] = await Promise.all([counts(), allWithDecisions()])
      const selected = new Set(sessionIds)
      const skipped = new Set(skippedIds)
      const session = rows.filter(row => selected.has(row.contact.id))
      const remaining = session.filter(({ contact, decision }) => skipped.has(contact.id) || isInDeck(decision, pass) || isUnsorted(decision, pass)).map(row => row.contact.id)
      return { summary, remaining, classified: session.length - remaining.length, total: session.length }
    } catch { return { failed: true as const } }
  }, [pass, sessionIds, skippedIds.join('|'), attempt])
  const navigate = useNavigate()
  const reduced = useDeckReducedMotion()
  const meta = PASS_META[pass]
  const ready = result && !result.failed ? result : undefined
  const title = ready?.remaining.length ? 'Pass finished' : meta.doneTitle
  useEffect(() => {
    if (!ready || announced.current) return
    announced.current = true
    // #13/#33: durable focus, without scrolling or motion, once data is known.
    heading.current?.focus({ preventScroll: true })
    announce?.(`${title.replace(/\.$/, '')}. ${ready.classified} classified.${ready.remaining.length ? ` ${ready.remaining.length} still need sorting.` : ''}`)
  }, [ready, title, announce])
  if (!result) return <Skeleton className="flex-1" data-testid="deck-end-loading" />
  if (!ready) return <InlineNotice tone="error">Could not load the pass results.
    <Button variant="ghost" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
  </InlineNotice>
  const { summary, remaining, classified, total: sessionTotal } = ready
  const rows: [string, number, ChipTone][] = pass === 'triage'
    ? [['Delete', summary.bucket.delete, 'delete'], ['Work', summary.bucket.work, 'work'], ['Personal', summary.bucket.personal, 'personal']]
    : pass === 'work' ? [['Old', summary.workStatus.old, 'old'], ['Current', summary.workStatus.current, 'current'], ['Potential', summary.workStatus.potential, 'potential']]
      : [['Ex', summary.relation.ex, 'delete'], ['Friend', summary.relation.friend, 'personal'], ['Family', summary.relation.family, 'personal'], ['Other', summary.relation.other, 'skip']]
  const next = nextUnfinishedPass(pass, summary)
  const total = pass === 'triage' ? summary.total : summary.bucket[pass]
  const retry = async () => {
    setBusy(true); setError('')
    try { await retrySkipped(remaining) }
    catch { setError('Could not reset skips. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="deck-end flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2" aria-label={scoped ? 'Selected session complete' : 'Session complete'}>
    {sessionTotal > 0 && !remaining.length && <motion.span aria-hidden="true" className="deck-sorted stamp t-meta self-start text-stamp-personal"
      {...motionProps(reduced, { initial: { scale: 1.1, opacity: 0 }, animate: { scale: 1, opacity: 0.9 }, transition: DECK_MOTION.settle })}>SORTED</motion.span>}
    <h1 ref={heading} tabIndex={-1} className="font-serif t-title">{title}</h1>
    <p className="tabular t-meta text-ink-2">This session: {classified} of {sessionTotal} classified</p>
    {!!remaining.length && <>
      <p className="t-body">{remaining.length} still need sorting</p>
      <Button full loading={busy} onClick={() => void retry()}>Sort the skipped ones</Button>
      <p className="t-meta text-ink-2">Resets their skips for this pass; saved labels stay.</p>
    </>}
    {error && <InlineNotice tone="error">{error}</InlineNotice>}
    {total !== sessionTotal && <p className="t-meta text-ink-2">{pass === 'triage' ? 'All contacts' : `All ${meta.title} contacts`}: {total}</p>}
    <dl aria-label="All contacts in this pass">{rows.map(([label, value, tone]) => <div key={label} className="hairline flex items-center justify-between py-2"><dt><LabelDot tone={tone} label={label} /></dt><dd><Tick value={value} /></dd></div>)}</dl>
    <div className="flex shrink-0 flex-col gap-2">
      <Button full variant={remaining.length ? 'outline' : 'primary'} onClick={() => navigate(next ? `/deck/${next}` : '/review')}>{next ? `Sort ${next} contacts` : 'Review contacts'}</Button>
      {next && <Button variant="ghost" full onClick={() => navigate('/review')}>Review contacts</Button>}
    </div>
  </section>
}
