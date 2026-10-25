import type { ImportPreview as Preview, ImportProgress } from '@/import'
import { Avatar, Button } from '@/ui'

export function ImportProgressView({ progress }: { progress: ImportProgress }) {
  const fraction = progress.total ? progress.parsed / progress.total : progress.parsed / (progress.parsed + 200)
  const verb = { reading: 'read', parsing: 'parsed', deduping: 'checked', saving: 'saved' }[progress.phase]
  return <div className="my-6 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <span className="eyebrow text-ink-2">{progress.phase}</span>
      <span className="tabular t-body">{progress.parsed.toLocaleString()} contacts {verb}</span>
    </div>
    <div role="progressbar" aria-label={progress.phase} aria-valuemin={0} aria-valuemax={progress.total}
      aria-valuenow={progress.total === undefined ? undefined : progress.parsed} className="h-[2px] bg-rule">
      <div className="h-full bg-ink" style={{ width: `${Math.min(1, fraction) * 100}%` }} />
    </div>
  </div>
}

export default function ImportPreview({ preview, busy, onConfirm, onCancel }: {
  preview: Preview; busy: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return <section className="mt-6 border-y border-rule py-5" aria-label="Import preview">
    {preview.allAlreadyImported ? <>
      <h2 className="font-serif t-title">All {preview.total.toLocaleString()} already imported</h2>
      <Button full className="mt-4" onClick={onCancel}>Choose another file</Button>
    </> : <>
      <h2 className="font-serif t-title">{preview.added.toLocaleString()} contacts will be added</h2>
      <p className="tabular mt-2 t-body text-ink-2">{preview.total.toLocaleString()} contacts found · {preview.merged.toLocaleString()} duplicates will merge{preview.photos > 0 ? ` · ${preview.photos.toLocaleString()} with photos` : ''}</p>
      <div className="mt-3">
        <Button full disabled={busy} onClick={onConfirm}>Import {preview.total.toLocaleString()} contacts</Button>
        <Button full variant="ghost" disabled={busy} onClick={onCancel}>Cancel import</Button>
      </div>
      {(preview.merged > 0 || preview.possibleDuplicates.length > 0) && <details className="mt-2 t-body">
        <summary className="min-h-11 cursor-pointer py-3">See what merges</summary>
        <p className="t-meta text-ink-2">Showing up to 20 pairs in each group.</p>
        <ul className="divide-y divide-rule">{preview.mergePairs.map((pair, index) => <li key={index} className="py-2 break-words">{pair.names.join(' ↔ ')} · {pair.reason}</li>)}</ul>
        {preview.possibleDuplicates.length > 0 && <>
          <p className="mt-3 font-medium">{preview.possibleDuplicates.length} possible duplicates kept apart</p>
          <ul className="divide-y divide-rule">{preview.keptApartPairs.map((pair, index) => <li key={index} className="py-2 break-words">{pair.names.join(' · ')} · {pair.reason}</li>)}</ul>
        </>}
      </details>}
      <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-3 t-body">Preview sample contacts</summary>
      <ul className="my-4 divide-y divide-rule">
        {preview.contacts.slice(0, 3).map((contact, index) => <li key={`${contact.id}-${index}`} className="flex min-h-16 items-center gap-3 py-2">
          <Avatar name={contact.displayName} photo={contact.photo} size={32} />
          <div className="min-w-0">
            <p className="truncate font-serif t-heading">{contact.displayName}</p>
            {contact.org && <p className="truncate t-meta text-ink-2">{contact.org}</p>}
          </div>
        </li>)}
      </ul>
      </details>
    </>}
  </section>
}
