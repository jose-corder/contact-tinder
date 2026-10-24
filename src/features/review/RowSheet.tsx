import { useState } from 'react'
import { useNavigate } from 'react-router'
import { deleteContacts, saveDecision, type ContactWithDecision } from '@/db/repo'
import type { Bucket, Decision, PersonalRelation, PersonalType, WorkStatus, WorkType } from '@/domain/types'
import { BUCKET_META, WORK_STATUS_META, WORK_TYPE_META, PERSONAL_RELATION_META, PERSONAL_TYPE_META, normalizeTag, setBucket, toggleChip, toggleCustomTag } from '@/domain/taxonomy'
import { Avatar, Button, Chip, Rule, Sheet } from '@/ui'
import ContactValue from './ContactValue'
import DecisionLabels from './DecisionLabels'
import { resetForReview } from './model'

export default function RowSheet({ row, onClose }: { row: ContactWithDecision; onClose: () => void }) {
  const { contact } = row
  const [decision, setDecision] = useState(row.decision)
  const [tag, setTag] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function save(next: Decision) {
    setBusy(true); setError('')
    try { await saveDecision(next); setDecision(next) }
    catch { setError('Could not save this change. Please try again.') }
    finally { setBusy(false) }
  }
  return <Sheet open onClose={() => { if (!busy) onClose() }} title="Contact details">
    <div className="max-h-[75dvh] overflow-y-auto overscroll-contain pb-2">
      <div className="flex items-center gap-3">
        <Avatar name={contact.displayName} photo={contact.photo} size={56} />
        <h2 className="min-w-0 break-words font-serif text-2xl">{contact.displayName}</h2>
      </div>
      <DecisionLabels decision={decision} />
      <dl className="my-5 space-y-3 break-words text-sm">
        {contact.givenName && <div><dt className="text-ink-2">Given name</dt><dd>{contact.givenName}</dd></div>}
        {contact.familyName && <div><dt className="text-ink-2">Family name</dt><dd>{contact.familyName}</dd></div>}
        {contact.org && <div><dt className="text-ink-2">Organization</dt><dd>{contact.org}</dd></div>}
        {contact.title && <div><dt className="text-ink-2">Title</dt><dd>{contact.title}</dd></div>}
        {contact.phones.map((phone, i) => <ContactValue key={`phone-${i}`} label={`Phone${phone.type ? ` · ${phone.type}` : ''}`} value={phone.value} href={`tel:${phone.e164 || phone.value}`} />)}
        {contact.emails.map((email, i) => <ContactValue key={`email-${i}`} label={`Email${email.type ? ` · ${email.type}` : ''}`} value={email.value} href={`mailto:${email.value}`} />)}
        {contact.notes && <div><dt className="text-ink-2">Notes</dt><dd className="whitespace-pre-wrap">{contact.notes}</dd></div>}
        <div><dt className="text-ink-2">Source</dt><dd>{contact.source}</dd></div>
        <div><dt className="text-ink-2">Added</dt><dd>{new Date(contact.importedAt).toLocaleString()}</dd></div>
        {contact.rev && <div><dt className="text-ink-2">Last modified</dt><dd>{contact.rev}</dd></div>}
      </dl>
      {contact.raw && <details className="mb-4 text-sm"><summary className="cursor-pointer text-ink-2">Original contact fields</summary><pre className="mt-2 whitespace-pre-wrap break-all font-sans text-xs">{contact.raw}</pre></details>}
      <Rule className="mb-5" />
      <fieldset disabled={busy} className="space-y-5">
        <legend className="sr-only">Sort contact</legend>
        <div><h3 className="eyebrow mb-2">Bucket</h3><div className="flex flex-wrap gap-2">
          {(Object.keys(BUCKET_META) as Bucket[]).map((bucket) => <Chip key={bucket} label={BUCKET_META[bucket].label}
            selected={decision.bucket === bucket} color={BUCKET_META[bucket].color} onClick={() => void save(setBucket(decision, bucket))} />)}
        </div></div>
        {decision.bucket === 'work' && <>
          <div><h3 className="eyebrow mb-2">Work status</h3><div className="flex flex-wrap gap-2">
            {(Object.keys(WORK_STATUS_META) as WorkStatus[]).map((status) => <Chip key={status} label={WORK_STATUS_META[status].label}
              selected={decision.workStatus === status} color={WORK_STATUS_META[status].color}
              onClick={() => void save({ ...decision, workStatus: decision.workStatus === status ? undefined : status, updatedAt: Date.now() })} />)}
          </div></div>
          <div><h3 className="eyebrow mb-2">Work types</h3><div className="flex flex-wrap gap-2">
            {(Object.keys(WORK_TYPE_META) as WorkType[]).map((type) => <Chip key={type} label={WORK_TYPE_META[type].label}
              selected={decision.workTypes.includes(type)} color={BUCKET_META.work.color} onClick={() => void save(toggleChip(decision, 'work', type))} />)}
          </div></div>
        </>}
        {decision.bucket === 'personal' && <>
          <div><h3 className="eyebrow mb-2">Relation</h3><div className="flex flex-wrap gap-2">
            {(Object.keys(PERSONAL_RELATION_META) as PersonalRelation[]).map((relation) => <Chip key={relation} label={PERSONAL_RELATION_META[relation].label}
              selected={decision.relation === relation} color={PERSONAL_RELATION_META[relation].color}
              onClick={() => void save({ ...decision, relation: decision.relation === relation ? undefined : relation, updatedAt: Date.now() })} />)}
          </div></div>
          <div><h3 className="eyebrow mb-2">Personal types</h3><div className="flex flex-wrap gap-2">
            {(Object.keys(PERSONAL_TYPE_META) as PersonalType[]).map((type) => <Chip key={type} label={PERSONAL_TYPE_META[type].label}
              selected={decision.personalTypes.includes(type)} color={BUCKET_META.personal.color} onClick={() => void save(toggleChip(decision, 'personal', type))} />)}
          </div></div>
        </>}
        <div><h3 className="eyebrow mb-2">Custom tags</h3>
          <div className="mb-2 flex flex-wrap gap-2">{decision.customTags.map((value) => <Chip key={value} label={value} selected onClick={() => void save(toggleCustomTag(decision, value))} />)}</div>
          <form className="flex gap-2" onSubmit={(event) => {
            event.preventDefault()
            const value = normalizeTag(tag)
            if (value && !decision.customTags.includes(value)) void save(toggleCustomTag(decision, value))
            setTag('')
          }}>
            <input aria-label="New custom tag" placeholder="Add a tag" maxLength={32} value={tag} onChange={(event) => setTag(event.target.value)}
              className="min-w-0 flex-1 border-b border-rule bg-transparent px-1 py-2 outline-offset-2" />
            <Button variant="outline" type="submit" disabled={!tag.trim()}>Add</Button>
          </form>
        </div>
        <Button variant="ghost" className="px-0 underline underline-offset-4" onClick={async () => {
          setBusy(true); setError('')
          try {
            const reset = resetForReview([{ contact, decision }], decision.bucket ?? 'unsorted')
            await saveDecision(reset.decisions[0])
            navigate(`/deck/${reset.pass}`)
          } catch { setError('Could not return this contact to the deck. Please try again.'); setBusy(false) }
        }}>Jump to deck</Button>
        {!confirm ? <Button variant="ghost" onClick={() => setConfirm(true)}>Remove from app</Button> :
          <div className="space-y-3 border-t border-rule pt-4">
            <p className="text-sm text-ink-2">Remove this contact and its decisions from this app? Your phone's address book is unchanged.</p>
            <Button full onClick={async () => {
              setBusy(true); setError('')
              try { await deleteContacts([contact.id]); onClose() }
              catch { setError('Could not remove this contact.'); setBusy(false) }
            }}>Confirm removal</Button>
            <Button full variant="ghost" onClick={() => setConfirm(false)}>Cancel removal</Button>
          </div>}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
      <Button full variant="ghost" disabled={busy} onClick={onClose}>Done</Button>
    </div>
  </Sheet>
}
