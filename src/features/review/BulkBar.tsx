import { useEffect, useRef, useState } from 'react'
import { saveDecisions, type ContactWithDecision } from '@/db/repo'
import { BUCKET_META, normalizeTag, setBucket, toggleCustomTag } from '@/domain/taxonomy'
import type { Bucket, Decision } from '@/domain/types'
import { shareOrDownload } from '@/export/share'
import { vcfText } from '@/export/vcf'
import { Button, InlineNotice, LabelDot, Sheet } from '@/ui'
import { setToastBottom, toast } from '@/ui/toast'

export default function BulkBar({ rows, onClear, onSelectAll, total = rows.length, resultCount = rows.length, tabLabel = 'contacts' }: {
  rows: ContactWithDecision[]; onClear: () => void; onSelectAll: () => void; total?: number; resultCount?: number; tabLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [previous, setPrevious] = useState<Decision[]>()
  const locked = useRef(false)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const measure = () => setToastBottom((bar.current?.getBoundingClientRect().height ?? 160) + 12)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    if (bar.current) observer?.observe(bar.current)
    return () => { observer?.disconnect(); setToastBottom(null) }
  }, [])
  async function undo(snapshot: Decision[]) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try { await saveDecisions(snapshot); setPrevious(undefined); toast('Changes undone') }
    catch { setError('Could not undo these changes. Try Undo again.') }
    finally { locked.current = false; setBusy(false) }
  }
  async function apply(next: Decision[], message: string) {
    if (locked.current) return
    const snapshot = rows.map(({ decision }) => decision)
    locked.current = true; setBusy(true); setError('')
    try {
      await saveDecisions(next)
      setPrevious(snapshot); setOpen(false); setTagOpen(false); setTag('')
      toast(message + ' ·', { action: { label: 'Undo', onClick: () => { void undo(snapshot) } } })
    } catch { setError('Could not save these changes. Nothing was changed. Please try again.') }
    finally { locked.current = false; setBusy(false) }
  }
  return <>
    <div ref={bar} aria-label="Bulk selection" className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[440px] border-t border-rule bg-paper-2 pt-3"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', paddingLeft: 'max(20px, env(safe-area-inset-left))', paddingRight: 'max(20px, env(safe-area-inset-right))' }}>
      <p className="t-body tabular">{rows.length} of {total} selected in {tabLabel}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="hit-44 t-meta underline" disabled={busy} onClick={onSelectAll}>Select all {resultCount} results</button>
        <button className="hit-44 t-meta underline" disabled={busy} onClick={onClear}>Cancel selection</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button loading={busy} variant="outline" disabled={!rows.length} onClick={() => { setError(''); setOpen(true) }}>Move to…</Button>
        <Button variant="outline" disabled={!rows.length || busy} onClick={() => { setError(''); setTagOpen(true) }}>Tag…</Button>
        <Button variant="outline" disabled={!rows.length || busy} onClick={async () => {
          if (locked.current) return
          locked.current = true; setBusy(true); setError(''); setCancelled(false)
          try { await shareOrDownload([new File([vcfText(rows)], 'selected-contacts.vcf', { type: 'text/vcard' })]) }
          catch (reason) {
            if (reason instanceof Error && reason.name === 'AbortError') setCancelled(true)
            else setError('Could not export contacts. Please try again.')
          } finally { locked.current = false; setBusy(false) }
        }}>Export contacts</Button>
        {previous && <Button variant="ghost" disabled={busy} onClick={() => void undo(previous)}>Undo last action</Button>}
      </div>
      {!open && !tagOpen && error && <InlineNotice tone="error">{error}</InlineNotice>}
      {cancelled && <InlineNotice tone="info">Sharing cancelled.</InlineNotice>}
    </div>
    <Sheet open={open} onClose={() => { if (!busy) setOpen(false) }} title={'Move ' + rows.length + ' contacts to…'}>
      <div className="space-y-3">{(Object.keys(BUCKET_META) as Bucket[]).map(bucket =>
        <Button full variant="outline" key={bucket} disabled={busy}
          onClick={() => void apply(rows.map(({ decision }) => setBucket(decision, bucket)), rows.length + ' moved to ' + BUCKET_META[bucket].label)}>
          <LabelDot tone={bucket} label={BUCKET_META[bucket].label} size={8} />
        </Button>)}</div>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <Button full variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
    </Sheet>
    <Sheet open={tagOpen} onClose={() => { if (!busy) setTagOpen(false) }} title={'Tag ' + rows.length + ' contacts'}>
      <form onSubmit={event => {
        event.preventDefault()
        const value = normalizeTag(tag)
        if (!value || busy) return
        void apply(rows.map(({ decision }) => decision.customTags.includes(value) ? decision : toggleCustomTag(decision, value)), 'Tagged ' + rows.length + ' contacts')
      }}>
        <input aria-label="Tag selected contacts" autoFocus maxLength={32} value={tag} onChange={event => setTag(event.target.value)}
          className="mb-4 min-h-11 w-full border-b border-rule bg-transparent text-base" placeholder="Add a tag" />
        <Button loading={busy} type="submit" full disabled={!tag.trim()}>Add tag</Button>
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
        <Button type="button" full variant="ghost" disabled={busy} onClick={() => setTagOpen(false)}>Cancel</Button>
      </form>
    </Sheet>
  </>
}
