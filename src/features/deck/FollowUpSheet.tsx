// Bottom sheet shown right after a Work or Personal swipe in triage so the user can
// set status/relation and type without waiting for the later decks.
import { useRef, useState } from 'react'
import { saveDecision } from '@/db/repo'
import { PASS_META, PERSONAL_RELATION_META, WORK_STATUS_META, toggleChip, toggleCustomTag } from '@/domain/taxonomy'
import type { Contact, Decision, PersonalRelation, PersonalType, WorkStatus, WorkType } from '@/domain/types'
import { Button, Chip, Sheet } from '@/ui'
import { setFollowUpEnabled } from '@/ui/theme'
import { ChipRow } from './ChipRow'

export interface FollowUpTarget {
  contact: Contact
  decision: Decision
}

export function FollowUpSheet({ target, onClose }: {
  target: FollowUpTarget | undefined
  /** Called with the saved decision after Done, or undefined after Later / dismiss. */
  onClose: (saved?: Decision) => void
}) {
  return (
    <Sheet open={!!target} onClose={() => onClose()} title={target ? `${target.decision.bucket} contact` : undefined}>
      {target && <FollowUpBody key={target.contact.id} target={target} onClose={onClose} />}
    </Sheet>
  )
}

function FollowUpBody({ target, onClose }: { target: FollowUpTarget; onClose: (saved?: Decision) => void }) {
  const bucket = target.decision.bucket === 'personal' ? 'personal' : 'work'
  const meta = PASS_META[bucket]
  const [draft, setDraft] = useState<Decision>(target.decision)
  const [tagOpen, setTagOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)

  const primary: Array<{ key: WorkStatus | PersonalRelation; label: string; color: string }> =
    bucket === 'work'
      ? (Object.keys(WORK_STATUS_META) as WorkStatus[]).map((key) => ({ key, ...WORK_STATUS_META[key] }))
      : (['friend', 'family', 'ex'] as PersonalRelation[]).map((key) => ({ key, ...PERSONAL_RELATION_META[key] }))
  const primaryValue = bucket === 'work' ? draft.workStatus : draft.relation

  const setPrimary = (key: WorkStatus | PersonalRelation) => {
    setDraft((d) =>
      bucket === 'work'
        ? { ...d, workStatus: d.workStatus === key ? undefined : (key as WorkStatus), updatedAt: Date.now() }
        : { ...d, relation: d.relation === key ? undefined : (key as PersonalRelation), updatedAt: Date.now() },
    )
  }

  const done = async () => {
    setBusy(true)
    setError(undefined)
    try {
      await saveDecision(draft)
      onClose(draft)
    } catch {
      setError('Could not save. Please try again.')
      setBusy(false)
    }
  }

  const org = [target.contact.title, target.contact.org].filter(Boolean).join(' · ')

  return (
    <div className="pb-1">
      <div className="mb-4">
        <div className="font-serif text-2xl leading-tight text-ink">{target.contact.displayName}</div>
        {org && <div className="text-sm text-ink-2">{org}</div>}
      </div>

      <div className="eyebrow mb-2 text-ink-2">{bucket === 'work' ? 'Status' : 'Relation'}</div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={bucket === 'work' ? 'Status' : 'Relation'}>
        {primary.map((p) => (
          <Chip key={p.key} label={p.label} selected={primaryValue === p.key} color={p.color} disabled={busy} onClick={() => setPrimary(p.key)} />
        ))}
      </div>

      <div className="eyebrow text-ink-2">Type</div>
      <ChipRow
        pass={bucket}
        draft={draft}
        toggleChip={(key: WorkType | PersonalType) => setDraft((d) => toggleChip(d, bucket, key))}
        toggleTag={(tag) => setDraft((d) => toggleCustomTag(d, tag))}
        inputRef={inputRef}
        open={tagOpen}
        setOpen={setTagOpen}
        disabled={busy}
      />

      {error && <p role="alert" className="mb-2 text-sm text-stamp-delete">{error}</p>}

      <div className="mt-2 flex items-center gap-3">
        <Button variant="ghost" className="px-0!" disabled={busy} onClick={() => onClose()}>Later</Button>
        <Button className="flex-1" disabled={busy} onClick={() => void done()}>Done</Button>
      </div>
      <button
        type="button"
        className="mt-3 text-xs text-ink-2 underline underline-offset-4"
        onClick={() => { setFollowUpEnabled(false); onClose() }}
      >
        Don't ask after swipes; I'll sort types in the {meta.title} deck
      </button>
    </div>
  )
}
