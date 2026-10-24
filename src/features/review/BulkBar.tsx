import { useState } from 'react'
import { saveDecisions, type ContactWithDecision } from '@/db/repo'
import { BUCKET_META, setBucket } from '@/domain/taxonomy'
import type { Bucket } from '@/domain/types'
import { shareOrDownload } from '@/export/share'
import { vcfText } from '@/export/vcf'
import { Button, Sheet } from '@/ui'

export default function BulkBar({ rows, onClear }: { rows: ContactWithDecision[]; onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function move(bucket: Bucket) {
    setBusy(true); setError('')
    try {
      await saveDecisions(rows.map(({ decision }) => setBucket(decision, bucket)))
      setOpen(false); onClear()
    } catch { setError('Could not move contacts. Please try again.') }
    finally { setBusy(false) }
  }
  return <>
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[440px] border-t border-rule bg-paper-2 px-5 pt-3"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <p className="mb-2 text-xs text-ink-2 tabular">{rows.length} selected</p>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" className="px-3 text-sm" disabled={!rows.length || busy} onClick={() => setOpen(true)}>Move to…</Button>
        <Button variant="outline" className="px-3 text-sm" disabled={!rows.length || busy} onClick={async () => {
          setBusy(true); setError('')
          try { await shareOrDownload([new File([vcfText(rows)], 'selected-contacts.vcf', { type: 'text/vcard' })]) }
          catch (reason) { setError(reason instanceof Error && reason.name === 'AbortError' ? 'Sharing cancelled.' : 'Could not export contacts.') }
          finally { setBusy(false) }
        }}>Export .vcf</Button>
        <Button variant="ghost" className="px-2" disabled={busy} onClick={onClear}>Clear</Button>
      </div>
      {!open && error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </div>
    <Sheet open={open} onClose={() => { if (!busy) setOpen(false) }} title={`Move ${rows.length} contacts to…`}>
      <div className="space-y-3">{(Object.keys(BUCKET_META) as Bucket[]).map((bucket) =>
        <Button full variant="outline" key={bucket} disabled={busy} onClick={() => void move(bucket)}>{BUCKET_META[bucket].label}</Button>)}</div>
      {error && <p role="alert" className="mt-3">{error}</p>}
      <Button full variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
    </Sheet>
  </>
}
