import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions, getMeta, setMeta } from '@/db/repo'
import { resetSavedSkips } from '@/hooks/resetSkips'
import { BUCKET_META, isUnsorted, PASS_ORDER } from '@/domain/taxonomy'
import { isUnsortedRow } from '@/export/vcf'
import { Button, Frame, InlineNotice, LabelDot, Skeleton } from '@/ui'
import { homeProgress } from './progress'
import ProgressOverview from './ProgressOverview'
import FirstRun from './FirstRun'
import InstallRow from './InstallRow'
import { readPossibleDuplicates } from '@/import/duplicates'
import './HomeScreen.css'

export default function HomeScreen() {
  const [retry, setRetry] = useState(0)
  const data = useLiveQuery(async () => {
    try {
      const [rows, modelSeen, pairs] = await Promise.all([allWithDecisions(), getMeta('homeModelSeen', false), readPossibleDuplicates()])
      return { rows, modelSeen, duplicates: pairs.filter(pair => !pair.resolved).length, error: '' }
    } catch { return { rows: undefined, modelSeen: false, error: 'Could not load your contacts. Try again.' } }
  }, [retry])
  const rows = data?.rows
  const [modelError, setModelError] = useState('')
  const sorted = rows?.filter(({ decision }) => !!decision.bucket).length ?? 0
  useEffect(() => {
    if (sorted >= 10 && data && !data.modelSeen) {
      void setMeta('homeModelSeen', true).catch(() => setModelError('Could not save this preference. Try again.'))
    }
  }, [sorted, data])
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const progress = useMemo(() => homeProgress(rows ?? []), [rows])
  const current = progress.current
  const unsorted = rows?.filter(isUnsortedRow).length ?? 0
  const skipped = rows?.filter(({ decision }) => PASS_ORDER.some((pass) => isUnsorted(decision, pass))).length ?? 0
  return <Frame className="home-screen lg:max-w-[920px]">
    <header className="pb-6 pt-6">
      <h1 className="font-serif t-display tracking-tight">Contacts.</h1>

    </header>
    {data && !data.modelSeen && sorted < 10 && <p className="mb-6 t-meta text-ink-2">Delete marks a list. Your phone's contacts stay unchanged.</p>}
    {modelError && <InlineNotice tone="error">{modelError}<Button variant="ghost" onClick={() => {
      void setMeta('homeModelSeen', true).then(() => setModelError('')).catch(() => setModelError('Could not save this preference. Try again.'))
    }}>Retry</Button></InlineNotice>}
    {data?.error ? <InlineNotice tone="error">{data.error}<Button variant="ghost" onClick={() => setRetry(value => value + 1)}>Retry</Button></InlineNotice> :
      !rows ? <div role="status" aria-label="Loading contacts" className="space-y-5"><Skeleton className="h-36" /><Skeleton className="h-20" /><Skeleton className="h-48" /></div> : rows.length === 0 ? <FirstRun /> : <>
      <div className="home-dashboard">
      <section aria-label="Continue sorting" className="home-resume rounded-[20px] border border-rule bg-paper-2 p-5">
        <p className="eyebrow mb-3">{current ? 'Pick up where you left off' : 'Your address book'}</p>
        <h2 className="mb-4 font-serif t-title tabular">{current ? `${rows.length - progress.completed} to go` :
          skipped ? `All decks done · ${skipped} skipped waiting in Review` : 'All sorted.'}</h2>
        {current ? <Button full onClick={() => navigate(`/deck/${current.pass}`)}>Continue</Button> :
          <Link to={skipped ? '/review?tab=unsorted' : '/review'} className="flex min-h-11 items-center justify-center rounded-full bg-ink px-5 font-medium text-paper">Review</Link>}
        {!current && skipped > 0 && <Button full variant="ghost" loading={busy} onClick={async () => {
          setBusy(true); setError('')
          try {
            // Finding #23: only this explicit action revives twice-skipped cards.
            const reset = await resetSavedSkips()
            const pass = homeProgress(reset).current?.pass
            if (pass) navigate(`/deck/${pass}`)
          } catch { setError('Could not retry skipped contacts. Nothing was changed. Please try again.') }
          finally { setBusy(false) }
        }}>Retry skipped</Button>}
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
      </section>
      <ProgressOverview progress={progress} total={rows.length} unsorted={unsorted} />
      <nav aria-label="Contact counts" className="home-counts border-t border-rule">
        {(Object.keys(BUCKET_META) as Array<keyof typeof BUCKET_META>).map((key) =>
          <Link key={key} to={`/review?tab=${key}`} className="flex min-h-12 items-center justify-between border-b border-rule">
            <LabelDot tone={key} label={BUCKET_META[key].label} size={8} />{' '}
            <span className="font-serif t-heading tabular">{rows.filter(({ decision }) => decision.bucket === key).length}</span>
          </Link>)}
        <Link to="/review?tab=unsorted" className="flex min-h-12 items-center justify-between border-b border-rule">
          <LabelDot tone="skip" label="Unsorted" size={8} />{' '}<span className="font-serif t-heading tabular">{unsorted}</span>
        </Link>
        {!!data?.duplicates && <Link to="/review?dupes=1" className="flex min-h-12 items-center border-b border-rule t-body">
          Possible duplicates · {data.duplicates}
        </Link>}
      </nav>
      </div>
      <nav aria-label="Contacts" className="mt-6 flex flex-wrap justify-between gap-4 t-meta underline underline-offset-4">
        <Link className="hit-44 inline-flex items-center py-3" to="/review">Review</Link><Link className="hit-44 inline-flex items-center py-3" to="/export">Export</Link><Link className="hit-44 inline-flex items-center py-3" to="/import">Import more</Link>
      </nav>
    </>}
    <InstallRow />
    <footer className="mt-auto pt-8 pb-3"><Link to="/settings" className="inline-flex min-h-11 items-center t-meta text-ink-2 underline underline-offset-4">Settings</Link></footer>
  </Frame>
}
