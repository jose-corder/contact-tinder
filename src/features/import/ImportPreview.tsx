import type { ImportPreview as Preview, ImportProgress } from '@/import'
import { Avatar, Button } from '@/ui'

export function ImportProgressView({ progress }: { progress: ImportProgress }) {
  const fraction = progress.total ? progress.parsed / progress.total : progress.parsed / (progress.parsed + 200)
  const verb = { reading: 'read', parsing: 'parsed', deduping: 'checked', saving: 'saved' }[progress.phase]
  return <div role="status" className="my-6 space-y-3" aria-live="polite">
    <div className="flex items-center justify-between gap-2">
      <span className="eyebrow text-ink-2">{progress.phase}</span>
      <span className="tabular text-sm">{progress.parsed.toLocaleString()} contacts {verb}</span>
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
      <h2 className="font-serif text-2xl">All {preview.total.toLocaleString()} already imported</h2>
      <Button full className="mt-4" onClick={onCancel}>Done</Button>
    </> : <>
      <h2 className="font-serif text-2xl">Ready when you are.</h2>
      <p className="tabular mt-2 text-sm text-ink-2">{preview.total.toLocaleString()} contacts found · {preview.merged.toLocaleString()} duplicates will merge · {preview.photos.toLocaleString()} with photos</p>
      <ul className="my-4 divide-y divide-rule">
        {preview.contacts.slice(0, 3).map((contact, index) => <li key={`${contact.id}-${index}`} className="flex min-h-16 items-center gap-3 py-2">
          <Avatar name={contact.displayName} photo={contact.photo} size={32} />
          <div className="min-w-0">
            <p className="truncate font-serif text-[17px]">{contact.displayName}</p>
            {contact.org && <p className="truncate text-[13px] text-ink-2">{contact.org}</p>}
          </div>
        </li>)}
      </ul>
      <Button full disabled={busy} onClick={onConfirm}>Import {preview.total.toLocaleString()}</Button>
      <Button full variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
    </>}
  </section>
}
