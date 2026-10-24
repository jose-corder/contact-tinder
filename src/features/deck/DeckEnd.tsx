import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { counts } from '@/db/repo'
import { PASS_META } from '@/domain/taxonomy'
import type { Pass } from '@/domain/types'
import { Button } from '@/ui'
import { prefersReducedMotion } from '@/ui/theme'

export function Tick({ value }: { value: number }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0)
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return }
    setShown(0)
    let frame = 0
    let start: number | undefined
    const tick = (now: number) => {
      start ??= now
      const fraction = Math.min(1, (now - start) / 600)
      setShown(Math.round(value * fraction))
      if (fraction < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <span className="tabular font-serif text-2xl">{shown}</span>
}

export function DeckEnd({ pass }: { pass: Pass }) {
  const summary = useLiveQuery(counts, [])
  const navigate = useNavigate()
  const meta = PASS_META[pass]
  const rows = summary ? (pass === 'triage' ? [['Delete', summary.bucket.delete], ['Work', summary.bucket.work], ['Personal', summary.bucket.personal]] : pass === 'work' ? [['Old', summary.workStatus.old], ['Current', summary.workStatus.current], ['Potential', summary.workStatus.potential]] : [['Ex', summary.relation.ex], ['Friend', summary.relation.friend], ['Family', summary.relation.family]]) as [string, number][] : []
  const next = meta.next
  const sorted = rows.reduce((sum, [, value]) => sum + value, 0)
  const total = summary ? (pass === 'triage' ? summary.total : summary.bucket[pass]) : 0
  return <section className="flex min-h-0 flex-1 flex-col justify-center gap-6 py-6">
    <h1 className="font-serif text-[38px] leading-tight">{meta.doneTitle}</h1>
    <dl>{rows.map(([label, value]) => <div key={label} className="hairline flex items-center justify-between py-3"><dt className="text-ink-2">{label}</dt><dd><Tick value={value} /></dd></div>)}</dl>
    {summary && <p className="hairline tabular pt-3 text-[13px] text-ink-2">{sorted} of {total} sorted in this pass</p>}
    {!!summary?.unsorted[pass] && <p className="text-sm text-ink-2">{summary.unsorted[pass]} skipped twice · find them under Review → Unsorted</p>}
    <div className="flex flex-col gap-2">
      <Button full onClick={() => navigate(next ? `/deck/${next}` : '/review')}>{next ? `Sort ${next} contacts` : 'Review everything'}</Button>
      <Button variant="ghost" full onClick={() => navigate('/review')}>Review</Button>
    </div>
  </section>
}
