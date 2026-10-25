import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { counts } from '@/db/repo'
import { PASS_META } from '@/domain/taxonomy'
import { nextUnfinishedPass } from '@/domain/decks'
import type { Pass } from '@/domain/types'
import { Button, LabelDot, type ChipTone } from '@/ui'
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

export function DeckEnd({ pass, sessionDone, sessionTotal, scoped }: { pass: Pass; sessionDone: number; sessionTotal: number; scoped: boolean }) {
  const summary = useLiveQuery(counts, [])
  const navigate = useNavigate()
  const reduced = useDeckReducedMotion()
  const meta = PASS_META[pass]
  const rows: [string, number, ChipTone][] = !summary ? [] : pass === 'triage'
    ? [['Delete', summary.bucket.delete, 'delete'], ['Work', summary.bucket.work, 'work'], ['Personal', summary.bucket.personal, 'personal']]
    : pass === 'work' ? [['Old', summary.workStatus.old, 'old'], ['Current', summary.workStatus.current, 'current'], ['Potential', summary.workStatus.potential, 'potential']]
      : [['Ex', summary.relation.ex, 'delete'], ['Friend', summary.relation.friend, 'personal'], ['Family', summary.relation.family, 'personal'], ['Other', summary.relation.other, 'skip']]
  const next = summary && nextUnfinishedPass(pass, summary)
  const total = summary ? (pass === 'triage' ? summary.total : summary.bucket[pass]) : 0
  return <section className="deck-end flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto py-2" aria-label={scoped ? 'Selected session complete' : 'Session complete'}>
    <motion.span aria-hidden="true" className="deck-sorted stamp self-start text-stamp-personal" initial={reduced ? false : { scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.9 }} transition={DECK_MOTION.settle}>SORTED</motion.span>
    <h1 className="font-serif t-title">{meta.doneTitle}</h1>
    <p className="tabular t-meta text-ink-2">This session: {sessionDone} of {sessionTotal}</p>
    {summary && total !== sessionTotal && <p className="t-meta text-ink-2">{pass === 'triage' ? 'All contacts' : `All ${meta.title} contacts`}: {total}</p>}
    <dl aria-label="All contacts in this pass">{rows.map(([label, value, tone]) => <div key={label} className="hairline flex items-center justify-between py-2"><dt><LabelDot tone={tone} label={label} /></dt><dd><Tick value={value} /></dd></div>)}</dl>
    {!!summary?.unsorted[pass] && <p className="t-meta text-ink-2">{summary.unsorted[pass]} skipped twice · find them under Review → Unsorted</p>}
    <div className="flex shrink-0 flex-col gap-2">
      <Button full disabled={!summary} onClick={() => navigate(next ? `/deck/${next}` : '/review')}>{next ? `Sort ${next} contacts` : 'Review contacts'}</Button>
      {next && <Button variant="ghost" full onClick={() => navigate('/review')}>Review contacts</Button>}
    </div>
  </section>
}
