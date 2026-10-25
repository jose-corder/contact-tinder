import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { deleteContacts, getDecision, saveDecision, type ContactWithDecision } from '@/db/repo'
import type { Decision } from '@/domain/types'
import { Button, InlineNotice, ScrollFallback, Sheet, SheetConfirm, SheetFooterActions } from '@/ui'
import { normalizeDecision } from '@/domain/taxonomy'
import { registerDecisionRecovery } from './undo'
import { destinationLabel } from './QuickActions'
import ClassificationEditor from './ClassificationEditor'
import { ContactFields, ContactIdentity } from './ContactFields'
import { prepareReswipe } from './reswipe'

export default function RowSheet({ row, onClose, pane = false }: { row: ContactWithDecision; onClose: () => void; pane?: boolean }) {
  const { contact } = row
  const [decision, setDecision] = useState(row.decision)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deckError, setDeckError] = useState('')
  const [removeError, setRemoveError] = useState('')
  const locked = useRef(false)
  const navigate = useNavigate()
  useEffect(() => { setDecision(row.decision) }, [row.decision])
  async function save(next: Decision) {
    if (locked.current) return false
    locked.current = true; setBusy(true); setSaveError('')
    try {
      const after = normalizeDecision({ ...next, updatedAt: Math.max(Date.now(), decision.updatedAt + 1) })
      await saveDecision(after)
      if (decision.bucket !== after.bucket) registerDecisionRecovery({ before: [decision], after: [after] },
        contact.displayName + ' → ' + destinationLabel(after.bucket ?? 'unsorted'))
      setDecision(await getDecision(contact.id)); return true
    }
    catch { setSaveError('Could not save this change. Please try again.'); return false }
    finally { locked.current = false; setBusy(false) }
  }
  const close = () => { if (!locked.current) onClose() }
  async function remove() {
    if (locked.current) return
    locked.current = true; setBusy(true); setRemoveError('')
    try { await deleteContacts([contact.id]); onClose() }
    catch { setRemoveError('Could not remove this contact. Please try again.') }
    finally { locked.current = false; setBusy(false) }
  }
  const footer = <SheetFooterActions secondary={{ label: 'Remove from app', onClick: () => setConfirm(true), disabled: busy || confirm }}
    primary={{ label: 'Done', onClick: close, disabled: busy }} />
  const content = <ScrollFallback>
    <ContactIdentity contact={contact} />
    <ClassificationEditor decision={decision} busy={busy} error={saveError} save={save} />
    <ContactFields contact={contact} />
    <div className="py-3">
      <Button variant="ghost" disabled={busy} onClick={async () => {
        if (locked.current) return
        locked.current = true; setBusy(true); setDeckError('')
        try {
          const { pass, ids } = await prepareReswipe([{ contact, decision }], decision.bucket ?? 'unsorted')
          navigate('/deck/' + pass, { state: { only: ids } })
        } catch { setDeckError('Could not open the deck. Please try again.') }
        finally { locked.current = false; setBusy(false) }
      }}>Jump to deck</Button>
      <p className="t-meta text-ink-2">Nothing changes until you swipe.</p>
      {deckError && <InlineNotice tone="error">{deckError}</InlineNotice>}
    </div>
    {confirm && <fieldset disabled={busy} aria-busy={busy}>
      <SheetConfirm title="Remove from app?" tone="danger"
        body="Remove this contact and its decisions from this app? Your phone's address book is unchanged."
        confirmLabel="Confirm removal" cancelLabel="Cancel removal" onConfirm={() => void remove()} onCancel={() => setConfirm(false)} />
      {removeError && <InlineNotice tone="error">{removeError}</InlineNotice>}
    </fieldset>}
  </ScrollFallback>
  return pane ? <section aria-label="Contact details" className="flex min-w-0 flex-col rounded-[20px] border border-rule bg-paper-2 p-5">
    {content}<div className="mt-auto border-t border-rule pt-4">{footer}</div>
  </section> : <Sheet open onClose={close} title="Contact details" footer={footer}>{content}</Sheet>
}
