import { useState } from 'react'
import { savePairResolution, type DuplicatePair, type PairResolution } from '@/import/duplicates'
import { Button, InlineNotice } from '@/ui'
import MergeSheet from './MergeSheet'

export default function PossibleDuplicates({ pairs, filtered = false }: { pairs: DuplicatePair[]; filtered?: boolean }) {
  const [comparison, setComparison] = useState<DuplicatePair>()
  return <section aria-label="Possible duplicates" className="space-y-3 py-4">
    <h2 className="font-serif t-heading">Possible duplicates · {pairs.length}</h2>
    {pairs.length ? pairs.map(pair => <PairCard key={pair.id} pair={pair} onMerge={() => setComparison(pair)} />)
      : <p className="t-body text-ink-2">{filtered ? 'No matching pairs.' : 'All reviewed'}</p>}
    {comparison && <MergeSheet pair={comparison} onClose={() => setComparison(undefined)} onMerged={() => {}} />}
  </section>
}

function PairCard({ pair, onMerge }: { pair: DuplicatePair; onMerge: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function resolve(resolution: PairResolution) {
    if (busy) return
    setBusy(true); setError('')
    try { await savePairResolution(pair.id, resolution) }
    catch { setError('Could not review this pair. Please try again.') }
    finally { setBusy(false) }
  }
  return <article aria-label={pair.a.displayName + ' and ' + pair.b.displayName} className="rounded-xl border border-control p-3">
    <div className="grid grid-cols-2 gap-3">
      {[pair.a, pair.b].map(contact => <div key={contact.id} className="min-w-0">
        <h3 className="break-words font-serif t-heading">{contact.displayName}</h3>
        {contact.org && <p className="break-words t-meta text-ink-2">{contact.org}</p>}
      </div>)}
    </div>
    <p className="my-2 t-meta text-ink-2">{pair.reason}</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => void resolve('kept')}>Keep both</Button>
      <Button variant="outline" disabled={busy} onClick={onMerge}>Merge</Button>
      <Button variant="ghost" disabled={busy} onClick={() => void resolve('dismissed')}>Dismiss</Button>
    </div>
    {error && <InlineNotice tone="error">{error}</InlineNotice>}
  </article>
}
