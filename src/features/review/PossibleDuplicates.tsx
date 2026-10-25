import { useState } from 'react'
import { mergePair, savePairResolution, type DuplicatePair, type PairResolution } from '@/import/duplicates'
import { Button, InlineNotice, toast } from '@/ui'

function PairCard({ pair }: { pair: DuplicatePair }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function resolve(resolution: PairResolution) {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (resolution === 'merged') {
        await mergePair(pair.a.id, pair.b.id)
        // mergePair has no recovery contract; do not advertise an unsafe Undo.
        toast('Contacts merged')
      } else await savePairResolution(pair.id, resolution)
    } catch { setError('Could not review this pair. Please try again.') }
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
      <Button variant="outline" disabled={busy} onClick={() => void resolve('merged')}>Merge</Button>
      <Button variant="ghost" disabled={busy} onClick={() => void resolve('dismissed')}>Dismiss</Button>
    </div>
    {error && <InlineNotice tone="error">{error}</InlineNotice>}
  </article>
}

export default function PossibleDuplicates({ pairs }: { pairs: DuplicatePair[] }) {
  return <section aria-label="Possible duplicates" className="space-y-3 py-4">
    <h2 className="font-serif t-heading">Possible duplicates</h2>
    {pairs.length ? pairs.map(pair => <PairCard key={pair.id} pair={pair} />) : <p className="t-body text-ink-2">All reviewed</p>}
  </section>
}
