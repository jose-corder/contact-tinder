// Bottom sheet shown right after a Work or Personal swipe in triage so the user can
// set status/relation and type without waiting for the later decks.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import './deck.css'
import { StaleDecisionError } from '@/db/repo'
import { saveDeckDecision } from '@/hooks/deckSession'
import { toast } from '@/ui/toast'
import { PASS_META, PERSONAL_RELATION_META, WORK_STATUS_META, toggleChip, toggleCustomTag } from '@/domain/taxonomy'
import type { Contact, Decision, PersonalRelation, PersonalType, WorkStatus, WorkType } from '@/domain/types'
import { Avatar, Button, Chip, Sheet } from '@/ui'
import { prefersReducedMotion, setFollowUpEnabled } from '@/ui/theme'
import { ChipRow } from './ChipRow'

export interface FollowUpTarget {
  contact: Contact
  decision: Decision
}

export function FollowUpSheet({ target, onClose, onBusyChange }: {
  target: FollowUpTarget | undefined
  /** Called with the saved decision after Done, or undefined after Later / dismiss. */
  onClose: (saved?: Decision) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const changeBusy = (value: boolean) => {
    saving.current = value
    setBusy(value)
    onBusyChange?.(value)
  }
  const dismiss = () => { if (!saving.current) onClose() }
  return (
    <Sheet open={!!target} onClose={dismiss} title={target ? `${target.decision.bucket} contact` : undefined}>
      {target && <FollowUpBody key={target.contact.id} target={target} onClose={onClose} busy={busy} setBusy={changeBusy} dismiss={dismiss} />}
    </Sheet>
  )
}

function FollowUpBody({ target, onClose, busy, setBusy, dismiss }: {
  target: FollowUpTarget; onClose: (saved?: Decision) => void; busy: boolean
  setBusy: (busy: boolean) => void; dismiss: () => void
}) {
  const bucket = target.decision.bucket === 'personal' ? 'personal' : 'work'
  const meta = PASS_META[bucket]
  const [draft, setDraft] = useState<Decision>(target.decision)
  const [tagOpen, setTagOpen] = useState(false)
  const [error, setError] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  const primaryRef = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    // The shared Sheet sets its initial focus in a parent effect; select the chip after it.
    let active = true
    queueMicrotask(() => { if (active) primaryRef.current?.querySelector('button')?.focus({ preventScroll: true }) })
    return () => { active = false; alive.current = false }
  }, [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation()
        dismiss()
      }
    }
    window.addEventListener('keydown', keydown, true)
    return () => window.removeEventListener('keydown', keydown, true)
  }, [dismiss])

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
    if (busy || !primaryValue) return
    setBusy(true)
    setError(undefined)
    try {
      const decision = { ...draft, updatedAt: Math.max(Date.now(), target.decision.updatedAt + 1) }
      await saveDeckDecision(decision, { expectedUpdatedAt: target.decision.updatedAt })
      if (!alive.current) return
      onClose(decision)
    } catch (error) {
      if (!alive.current) return
      if (error instanceof StaleDecisionError) {
        toast('This contact changed elsewhere — skipped')
        onClose()
        return
      }
      setError('Could not save. Please try again.')
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const org = [target.contact.title, target.contact.org].filter(Boolean).join(' · ')

  return (
    <div className="deck-followup-body min-h-0 overflow-y-auto overscroll-contain pb-1">
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={target.contact.displayName} photo={target.contact.photo} size={40} />
        <div className="min-w-0">
        <div className="font-serif text-2xl leading-tight text-ink">{target.contact.displayName}</div>
        {org && <div className="text-sm text-ink-2">{org}</div>}
        </div>
      </div>

      <div className="eyebrow mb-2 text-ink-2">{bucket === 'work' ? 'Status' : 'Relation'}</div>
      <motion.div ref={primaryRef} initial={{ opacity: 0, y: prefersReducedMotion() ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion() ? 0.12 : 0.15 }} className="mb-4 flex flex-wrap gap-2" role="group" aria-label={bucket === 'work' ? 'Status' : 'Relation'}>
        {primary.map((p) => (
          <Chip className="deck-chip" key={p.key} label={p.label} selected={primaryValue === p.key} color={p.color} disabled={busy} onClick={() => setPrimary(p.key)} />
        ))}
      </motion.div>
      {!primaryValue && <p className="-mt-2 mb-3 text-xs text-ink-2">Choose a {bucket === 'work' ? 'status' : 'relation'} to finish, or leave it for Later.</p>}

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
        <Button variant="ghost" className="min-w-11 px-0!" disabled={busy} onClick={dismiss}>Later</Button>
        <Button className="flex-1" disabled={busy || !primaryValue} onClick={() => void done()}>{primaryValue ? 'Done' : bucket === 'work' ? 'Choose a status' : 'Choose a relation'}</Button>
      </div>
      <button
        type="button"
        className="mt-3 min-h-11 min-w-11 text-xs text-ink-2 underline underline-offset-4"
        disabled={busy}
        onClick={() => { setFollowUpEnabled(false); onClose() }}
      >
        Don't ask after swipes; I'll sort types in the {meta.title} deck
      </button>
    </div>
  )
}
