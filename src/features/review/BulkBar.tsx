import { useState } from 'react'
import { saveDecisions, type ContactWithDecision } from '@/db/repo'
import { BUCKET_META, normalizeTag, setBucket, toggleCustomTag } from '@/domain/taxonomy'
import type { Bucket } from '@/domain/types'
import { shareOrDownload } from '@/export/share'
import { vcfText } from '@/export/vcf'
import { Button, Sheet } from '@/ui'
import { toast } from '@/ui/toast'

export default function BulkBar({ rows, onClear, onSelectAll }: { rows: ContactWithDecision[]; onClear: () => void; onSelectAll: () => void }) {
  const [open, setOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [tag, setTag] = useState('')
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-serif text-xl tabular">{rows.length} selected</p>
        <button className="min-h-11 text-xs underline underline-offset-4" disabled={busy} onClick={onSelectAll}>Select all in view</button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" className="px-3! text-[13px]! whitespace-nowrap" disabled={!rows.length || busy} onClick={() => setOpen(true)}>Move to…</Button>
        <Button variant="outline" className="px-3! text-[13px]! whitespace-nowrap" disabled={!rows.length || busy} onClick={() => setTagOpen(true)}>Tag…</Button>
        <Button variant="outline" className="px-3! text-[13px]! whitespace-nowrap" disabled={!rows.length || busy} onClick={async () => {
          setBusy(true); setError('')
          try { await shareOrDownload([new File([vcfText(rows)], 'selected-contacts.vcf', { type: 'text/vcard' })]) }
          catch (reason) { setError(reason instanceof Error && reason.name === 'AbortError' ? 'Sharing cancelled.' : 'Could not export contacts.') }
          finally { setBusy(false) }
        }}>Export .vcf</Button>
        <Button variant="ghost" className="px-2! text-[13px]!" disabled={busy} onClick={onClear}>Clear</Button>
      </div>
      {!open && !tagOpen && error && <p role="alert" className="mt-2 text-sm">{error}</p>}
    </div>
    <Sheet open={open} onClose={() => { if (!busy) setOpen(false) }} title={`Move ${rows.length} contacts to…`}>
      <div className="space-y-3">{(Object.keys(BUCKET_META) as Bucket[]).map((bucket) =>
        <Button full variant="outline" key={bucket} disabled={busy} onClick={() => void move(bucket)}>{BUCKET_META[bucket].label}</Button>)}</div>
      {error && <p role="alert" className="mt-3">{error}</p>}
      <Button full variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
    </Sheet>
    <Sheet open={tagOpen} onClose={() => { if (!busy) setTagOpen(false) }} title={`Tag ${rows.length} contacts`}>
      <form onSubmit={async (event) => {
        event.preventDefault()
        const value = normalizeTag(tag)
        if (!value || busy) return
        setBusy(true); setError('')
        try {
          await saveDecisions(rows.filter(({ decision }) => !decision.customTags.includes(value)).map(({ decision }) => toggleCustomTag(decision, value)))
          toast(`Added “${value}” to ${rows.length} contacts`)
          setTag(''); setTagOpen(false)
        } catch { setError('Could not tag contacts. Please try again.') }
        finally { setBusy(false) }
      }}>
        <input aria-label="Tag selected contacts" autoFocus maxLength={32} value={tag} onChange={(event) => setTag(event.target.value)}
          className="mb-4 min-h-11 w-full border-b border-rule bg-transparent" placeholder="Add a tag" />
        <Button type="submit" full disabled={busy || !tag.trim()}>Add tag</Button>
        {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
        <Button type="button" full variant="ghost" disabled={busy} onClick={() => setTagOpen(false)}>Cancel</Button>
      </form>
    </Sheet>
  </>
}
