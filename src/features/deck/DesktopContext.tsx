import type { Contact } from '@/domain/types'
import { useMediaQuery } from '@/ui'
import { KeyboardLegend } from './KeyboardLegend'

export function DesktopContext({ contacts, done, remaining, skipped }: {
  contacts: Contact[]; done: number; remaining: number; skipped: number
}) {
  const desktop = useMediaQuery('(min-width: 1024px) and (pointer: fine)')
  if (!desktop) return null
  return <aside className="deck-desktop-context t-meta text-ink-2" aria-label="Deck context">
    <section><h2 className="t-eyebrow mb-3">Keyboard shortcuts</h2><KeyboardLegend /></section>
    <section className="border-t border-rule pt-4"><h2 className="t-eyebrow mb-3">Up next</h2>
      {contacts.length ? <ol className="space-y-3">{contacts.map(contact => <li key={contact.id} className="break-words">{contact.displayName}</li>)}</ol>
        : <p>No more cards queued.</p>}
    </section>
    <section className="border-t border-rule pt-4"><h2 className="t-eyebrow mb-3">This session</h2>
      <dl className="space-y-2 tabular">{[['Classified', done - skipped], ['Remaining', remaining], ['Skipped to Review', skipped]].map(([label, count]) =>
        <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    </section>
  </aside>
}
