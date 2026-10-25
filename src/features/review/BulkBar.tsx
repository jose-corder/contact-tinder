import { useEffect, useRef, useState } from 'react'
import { saveDecisions, StaleDecisionError, type ContactWithDecision } from '@/db/repo'
import { useLiveQuery } from 'dexie-react-hooks'
import { BUCKET_META, normalizeTag, setBucket, toggleCustomTag } from '@/domain/taxonomy'
import type { Bucket, Decision } from '@/domain/types'
import { dbRevision } from '@/export/json'
import { ExportAction } from '@/features/export/ExportAction'
import { vcfText } from '@/export/vcf'
import { Button, InlineNotice, RadioGroup, Sheet, SheetFooterActions } from '@/ui'
import { dismissToast, setToastBottom, toast, type ToastHandle } from '@/ui/toast'
import { observeVersions, snapshotUnchanged, undoDecisions, type UndoSnapshot } from './undo'

export default function BulkBar({ rows, onClear, onSelectAll, total = rows.length, resultCount = rows.length, tabLabel = 'contacts' }: {
  rows: ContactWithDecision[]; onClear: () => void; onSelectAll: () => void; total?: number; resultCount?: number; tabLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [tag, setTag] = useState('')
  const [destination, setDestination] = useState<Bucket>('work')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previous, setPrevious] = useState<UndoSnapshot>()
  const notice = useRef<ToastHandle | undefined>(undefined)
  const revision = useLiveQuery(dbRevision)
  const locked = useRef(false)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const measure = () => setToastBottom((bar.current?.getBoundingClientRect().height ?? 160) + 12)
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    if (bar.current) observer?.observe(bar.current)
    return () => { observer?.disconnect(); setToastBottom(null) }
  }, [])
  async function undo(snapshot: UndoSnapshot) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try {
      await undoDecisions(snapshot); setPrevious(undefined)
      if (notice.current) dismissToast(notice.current.id)
      toast('Changes undone')
    } catch (error) {
      const message = error instanceof StaleDecisionError ? 'Changed since — none undone' : 'Could not undo these changes. Try Undo again.'
      setError(message)
      if (error instanceof StaleDecisionError) {
        setPrevious(undefined)
        if (notice.current) dismissToast(notice.current.id)
        toast(message, { priority: 'high' })
      }
    }
    finally { locked.current = false; setBusy(false) }
  }
  async function apply(next: Decision[], message: string) {
    if (locked.current) return
    const before = rows.map(({ decision }) => decision)
    const after = next.map((decision, index) => ({ ...decision, updatedAt: Math.max(Date.now(), before[index].updatedAt + 1) }))
    const snapshot = { before, after }
    locked.current = true; setBusy(true); setError('')
    try {
      await saveDecisions(after)
      observeVersions(after)
      setPrevious(snapshot); setOpen(false); setTagOpen(false); setTag('')
      if (notice.current) dismissToast(notice.current.id)
      notice.current = toast(message + ' ·', { priority: 'high', duration: 10000,
        validUntil: () => snapshotUnchanged(snapshot), action: { label: 'Undo', onClick: () => { void undo(snapshot) } } })
    } catch { setError('Could not save these changes. Nothing was changed. Please try again.') }
    finally { locked.current = false; setBusy(false) }
  }
  function applyTag() {
    const value = normalizeTag(tag)
    if (!value || busy) return
    void apply(rows.map(({ decision }) => decision.customTags.includes(value) ? decision : toggleCustomTag(decision, value)), 'Tagged ' + rows.length + ' contacts')
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
        <ExportAction key={JSON.stringify(rows.map(row => row.contact.id))} label="selected contacts" revision={revision}
          disabled={!rows.length || busy} compact
          files={async () => [new File([vcfText(rows)], 'selected-contacts.vcf', { type: 'text/vcard' })]} />
        {previous && <Button variant="ghost" disabled={busy} onClick={() => void undo(previous)}>Undo last action</Button>}
      </div>
      {!open && !tagOpen && error && <InlineNotice tone="error">{error}</InlineNotice>}
    </div>
    <Sheet open={open} onClose={() => { if (!busy) setOpen(false) }} title={'Move ' + rows.length + ' contacts to…'}
      footer={<SheetFooterActions secondary={{ label: 'Cancel', disabled: busy, onClick: () => setOpen(false) }}
        primary={{ label: 'Apply', loading: busy, onClick: () => void apply(rows.map(({ decision }) => setBucket(decision, destination)), rows.length + ' moved to ' + BUCKET_META[destination].label) }} />}>
      <RadioGroup label="Destination list" value={destination} onChange={setDestination} disabled={busy}
        options={(Object.keys(BUCKET_META) as Bucket[]).map(value => ({ value, label: BUCKET_META[value].label }))} />
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
    </Sheet>
    <Sheet open={tagOpen} onClose={() => { if (!busy) setTagOpen(false) }} title={'Tag ' + rows.length + ' contacts'}
      footer={<SheetFooterActions secondary={{ label: 'Cancel', disabled: busy, onClick: () => setTagOpen(false) }}
        primary={{ label: 'Apply', loading: busy, disabled: !tag.trim(), onClick: applyTag }} />}>
      <form onSubmit={event => {
        event.preventDefault()
        applyTag()
      }}>
        <input aria-label="Tag selected contacts" autoFocus maxLength={32} value={tag} onChange={event => setTag(event.target.value)}
          className="mb-4 min-h-11 w-full border-b border-rule bg-transparent t-body" placeholder="Add a tag" />
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
      </form>
    </Sheet>
  </>
}
