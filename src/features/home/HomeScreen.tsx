import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions, counts } from '@/db/repo'
import { BUCKET_META, isInDeck, PASS_META, PASS_ORDER } from '@/domain/taxonomy'
import { isUnsortedRow } from '@/export/vcf'
import { Button, Frame } from '@/ui'

export default function HomeScreen() {
  const rows = useLiveQuery(() => allWithDecisions(), [])
  const totals = useLiveQuery(counts)
  const navigate = useNavigate()
  const pass = PASS_ORDER.find((p) => rows?.some(({ decision }) => isInDeck(decision, p)))
  const passRows = rows?.filter(({ decision }) => pass === 'triage' || decision.bucket === pass) ?? []
  const remaining = pass ? passRows.filter(({ decision }) => isInDeck(decision, pass)).length : 0
  const unsorted = rows?.filter(isUnsortedRow).length ?? 0
  return <Frame>
    <header className="pb-10 pt-10">
      <h1 className="font-serif text-[56px] leading-none tracking-tight">Contacts.</h1>
      <p className="mt-5 text-sm text-ink-2">Swipe. Sort. Stay in touch with the right people.</p>
    </header>
    {!rows || !totals ? <p role="status">Loading contacts…</p> : totals.total === 0 ? <div className="space-y-4 py-8">
      <Button full size="lg" onClick={() => navigate('/import')}>Import contacts</Button>
      <p className="text-center text-sm text-ink-2">Nothing leaves this device.</p>
    </div> : <>
      <section className="rounded-[20px] border border-rule bg-paper-2 p-5 shadow-card">
        <p className="eyebrow mb-3">{pass ? 'Pick up where you left off' : 'Your address book'}</p>
        <h2 className="mb-5 font-serif text-2xl tabular">{pass ? `${PASS_META[pass].title} · ${passRows.length - remaining} of ${passRows.length}` : 'All sorted.'}</h2>
        <Button full onClick={() => navigate(pass ? `/deck/${pass}` : '/review')}>{pass ? 'Continue' : 'Review'}</Button>
        {!pass && unsorted > 0 && <p className="mt-3 text-sm text-ink-2">{unsorted} unsorted {unsorted === 1 ? 'contact awaits' : 'contacts await'} review.</p>}
      </section>
      <dl className="my-8 border-t border-rule">
        {(Object.keys(BUCKET_META) as Array<keyof typeof BUCKET_META>).map((key) =>
          <div key={key} className="flex justify-between border-b border-rule py-3"><dt>{BUCKET_META[key].label}</dt><dd className="tabular">{totals.bucket[key]}</dd></div>)}
        <div className="flex justify-between border-b border-rule py-3"><dt>Unsorted</dt><dd className="tabular">{unsorted}</dd></div>
      </dl>
      <nav aria-label="Contacts" className="flex flex-wrap justify-between gap-4 underline underline-offset-4">
        <Link to="/review">Review</Link><Link to="/export">Export</Link><Link to="/import">Import more</Link>
      </nav>
    </>}
    <footer className="mt-auto pt-12 pb-3"><Link to="/settings" className="text-sm text-ink-2 underline underline-offset-4">Settings</Link></footer>
  </Frame>
}
