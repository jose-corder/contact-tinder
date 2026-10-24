import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions, saveDecisions } from '@/db/repo'
import { BUCKET_META, isUnsorted, PASS_ORDER } from '@/domain/taxonomy'
import { isUnsortedRow } from '@/export/vcf'
import { Button, Frame } from '@/ui'
import { homeProgress } from './progress'
import ProgressOverview from './ProgressOverview'
import FirstRun from './FirstRun'
import InstallRow from './InstallRow'

export default function HomeScreen() {
  const rows = useLiveQuery(() => allWithDecisions(), [])
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const progress = useMemo(() => homeProgress(rows ?? []), [rows])
  const current = progress.current
  const unsorted = rows?.filter(isUnsortedRow).length ?? 0
  const skipped = rows?.filter(({ decision }) => PASS_ORDER.some((pass) => isUnsorted(decision, pass))).length ?? 0
  return <Frame>
    <header className="pb-8 pt-10">
      <h1 className="font-serif text-[56px] leading-none tracking-tight">Contacts.</h1>
      <p className="mt-5 text-sm text-ink-2">Swipe. Sort. Stay in touch with the right people.</p>
    </header>
    {!rows ? <p role="status">Loading contacts…</p> : rows.length === 0 ? <FirstRun /> : <>
      <ProgressOverview progress={progress} total={rows.length} />
      <section className="rounded-[20px] border border-rule bg-paper-2 p-5">
        <p className="eyebrow mb-3">{current ? 'Pick up where you left off' : 'Your address book'}</p>
        <h2 className="mb-5 font-serif text-2xl tabular">{current ? `${current.title} · ${current.done} of ${current.total}` :
          skipped ? `All decks done · ${skipped} skipped waiting in Review` : 'All sorted.'}</h2>
        {current ? <Button full onClick={() => navigate(`/deck/${current.pass}`)}>Continue</Button> :
          <Link to={skipped ? '/review?tab=unsorted' : '/review'} className="flex min-h-11 items-center justify-center rounded-full bg-ink px-5 font-medium text-paper">Review</Link>}
        {!current && skipped > 0 && <Button full variant="ghost" loading={busy} onClick={async () => {
          setBusy(true); setError('')
          try {
            // Finding #23: only this explicit action revives twice-skipped cards.
            const pass = PASS_ORDER.find((p) => rows.some(({ decision }) => isUnsorted(decision, p)))!
            await saveDecisions(rows.filter(({ decision }) => PASS_ORDER.some((p) => isUnsorted(decision, p))).map(({ decision }) => {
              const skips = { ...decision.skips }
              for (const p of PASS_ORDER) if (isUnsorted(decision, p)) skips[p] = 0
              return { ...decision, skips, updatedAt: Date.now() }
            }))
            navigate(`/deck/${pass}`)
          } catch { setError('Could not retry skipped contacts. Nothing was changed. Please try again.') }
          finally { setBusy(false) }
        }}>Retry skipped</Button>}
        {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
      </section>
      <nav aria-label="Contact counts" className="my-7 border-t border-rule">
        {(Object.keys(BUCKET_META) as Array<keyof typeof BUCKET_META>).map((key) =>
          <Link key={key} to={`/review?tab=${key}`} className="flex min-h-12 items-center justify-between border-b border-rule">
            <span className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: BUCKET_META[key].color }} />{BUCKET_META[key].label}</span>{' '}
            <span className="font-serif text-xl tabular">{rows.filter(({ decision }) => decision.bucket === key).length}</span>
          </Link>)}
        <Link to="/review?tab=unsorted" className="flex min-h-12 items-center justify-between border-b border-rule">
          <span className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-stamp-skip" />Unsorted</span>{' '}<span className="font-serif text-xl tabular">{unsorted}</span>
        </Link>
      </nav>
      <nav aria-label="Contacts" className="flex flex-wrap justify-between gap-4 text-sm underline underline-offset-4">
        <Link className="py-3" to="/review">Review</Link><Link className="py-3" to="/export">Export</Link><Link className="py-3" to="/import">Import more</Link>
      </nav>
    </>}
    <InstallRow />
    <footer className="mt-auto pt-8 pb-3"><Link to="/settings" className="inline-flex min-h-11 items-center text-sm text-ink-2 underline underline-offset-4">Settings</Link></footer>
  </Frame>
}
