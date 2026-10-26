// #53: Later → Keep saves Personal types as Other under the shared persistence rule.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { StaleDecisionError } from '@/db/repo'
import { saveDeckDecision } from '@/hooks/deckSession'
import { toast } from '@/ui/toast'
import { normalizeDecision, PERSONAL_RELATION_META, WORK_STATUS_META, toggleCustomTag } from '@/domain/taxonomy'
import { toggleDeckType } from '@/domain/decks'
import type { Contact, Decision, PersonalRelation, WorkStatus } from '@/domain/types'
import { Avatar, Button, Chip, InlineNotice, Sheet, SheetConfirm, SheetFooterActions, SheetSection, motionProps, type ChipTone } from '@/ui'
import { ChipRow } from './ChipRow'
import { DECK_MOTION, useDeckReducedMotion } from './motion'

export interface FollowUpTarget { contact: Contact; decision: Decision }
interface Props {
  target: FollowUpTarget | undefined
  onClose: (saved?: Decision) => void
  onBusyChange?: (busy: boolean) => void
  onUndo?: () => void
  onSettings?: () => void
}

export function FollowUpSheet(props: Props) {
  return props.target ? <FollowUpContent key={props.target.contact.id} {...props} target={props.target} /> : null
}

function FollowUpContent({ target, onClose, onBusyChange, onUndo, onSettings }: Props & { target: FollowUpTarget }) {
  const [draft, setDraft] = useState(target.decision)
  const [busy, setBusy] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [confirmLater, setConfirmLater] = useState(false)
  const afterClose = useRef<(() => void) | undefined>(undefined)
  const [error, setError] = useState<string>()
  const saving = useRef(false)
  const alive = useRef(true)
  const primaryRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const laterRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const reduced = useDeckReducedMotion()
  const bucket = target.decision.bucket === 'personal' ? 'personal' : 'work'
  const title = bucket === 'work' ? 'Work' : 'Personal'
  const primaryValue = bucket === 'work' ? draft.workStatus : draft.relation
  const types = bucket === 'work' ? draft.workTypes : draft.personalTypes
  const canComplete = !!primaryValue || (bucket === 'personal' && types.length > 0)
  const changed = ['workStatus', 'relation', 'workTypes', 'personalTypes', 'customTags'].some(key =>
    JSON.stringify(draft[key as keyof Decision]) !== JSON.stringify(target.decision[key as keyof Decision]))
  const close = (saved?: Decision) => { onClose(saved); afterClose.current?.() }
  const dismiss = () => { if (!saving.current) { if (changed) setConfirmLater(true); else close() } }
  useLayoutEffect(() => {
    // Adapter until shared SheetFooterActions exposes aria-description on actions.
    const later = [...(footerRef.current?.querySelectorAll('button') ?? [])].find(button => button.textContent === 'Later')
    later?.setAttribute('aria-description', bucket === 'personal'
      ? 'Keep in Personal as Other if types are selected; otherwise finish later'
      : 'Keep in Work; finish details in the Work deck')
  }, [bucket, confirmLater])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss() }
    }
    window.addEventListener('keydown', keydown, true)
    return () => window.removeEventListener('keydown', keydown, true)
  })
  const changeBusy = (value: boolean) => { saving.current = value; setBusy(value); onBusyChange?.(value) }
  const primary = bucket === 'work'
    ? (Object.keys(WORK_STATUS_META) as WorkStatus[]).map((key) => ({ key, ...WORK_STATUS_META[key], tone: key as ChipTone }))
    : (Object.keys(PERSONAL_RELATION_META) as PersonalRelation[]).map((key) => ({ key, ...PERSONAL_RELATION_META[key], tone: (key === 'ex' ? 'delete' : key === 'other' ? 'skip' : 'personal') as ChipTone }))
  const setPrimary = (key: WorkStatus | PersonalRelation) => setDraft((d) => bucket === 'work'
    ? { ...d, workStatus: d.workStatus === key ? undefined : key as WorkStatus }
    : { ...d, relation: d.relation === key ? undefined : key as PersonalRelation })
  const done = async (typesOnly = false) => {
    if (saving.current || (!typesOnly && !canComplete)) return
    changeBusy(true); setError(undefined)
    try {
      const values = typesOnly ? { ...target.decision, workTypes: draft.workTypes, personalTypes: draft.personalTypes, customTags: draft.customTags } : draft
      const decision = normalizeDecision({ ...values, updatedAt: Math.max(Date.now(), target.decision.updatedAt + 1) })
      await saveDeckDecision(decision, { expectedUpdatedAt: target.decision.updatedAt })
      if (alive.current) close(decision)
    } catch (error) {
      if (!alive.current) return
      if (error instanceof StaleDecisionError) { toast('This contact changed elsewhere — skipped'); onClose(); return }
      setError('Could not save. Please try again.')
    } finally {
      if (alive.current) changeBusy(false)
      else onBusyChange?.(false)
    }
  }
  return <Sheet open onClose={dismiss} title={`${bucket} contact`} initialFocus={primaryRef} footer={
    <div ref={footerRef}>
      <SheetFooterActions
      secondary={{ label: 'Later', onClick: dismiss, disabled: busy, ref: laterRef }}
      primary={{ label: 'Done', onClick: () => void done(), disabled: !canComplete, loading: busy }} />
    </div>
  }>
    <div className="deck-followup-body">
      <div className="deck-followup-identity mb-2 flex h-12 items-center gap-3">
        <Avatar name={target.contact.displayName} photo={target.contact.photo} size={40} />
        <div className="min-w-0">
          <div className="truncate font-serif t-heading">{target.contact.displayName}</div>
          <div className="truncate t-meta text-ink-2">{[target.contact.title, target.contact.org].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <motion.div className="mb-2 flex items-center gap-1 t-meta text-ink-2" {...motionProps(reduced, { transition: DECK_MOTION.fade })}>
        Moved to {title}{onUndo && <> · <button type="button" className="hit-44 underline" disabled={busy} onClick={() => { if (!saving.current) onUndo() }}>Undo</button></>}
      </motion.div>
      <SheetSection title={bucket === 'work' ? 'Status' : 'Relation'}
        help={bucket === 'personal' ? 'A type without a relation is saved as Other' : 'Choose a status to finish, or leave it for Later.'}>
      <motion.div ref={primaryRef} {...motionProps(reduced, { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: DECK_MOTION.fade })}
        className="flex flex-wrap gap-2" role="group" aria-label={bucket === 'work' ? 'Status' : 'Relation'}>
        {primary.map((p) => <Chip key={p.key} label={p.label} tone={p.tone} selected={primaryValue === p.key} disabled={busy} onClick={() => setPrimary(p.key)} />)}
      </motion.div>
      </SheetSection>
      <SheetSection title="Type">
      <ChipRow pass={bucket} draft={draft} toggleChip={(key) => setDraft((d) => toggleDeckType(d, bucket, key))}
        toggleTag={(tag) => setDraft((d) => toggleCustomTag(d, tag))} inputRef={inputRef} open={tagOpen} setOpen={setTagOpen} disabled={busy} sheet />
      </SheetSection>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      {confirmLater && <fieldset disabled={busy} className="min-w-0">
        <SheetConfirm title="Unsaved selections" initialFocus="cancel" returnFocusTo={laterRef}
          body={<>{types.length ? bucket === 'personal' && !target.decision.relation ? `Keep ${types.length} types · counts as Other` : `Keep ${types.length} selected types?` : draft.customTags.length ? 'Keep selected tags?' : 'Leave details for later?'}
            <p>{bucket === 'personal' ? 'A type without a relation is saved as Other' : 'Keep saves types and tags only; finish the status later.'}</p></>}
          confirmLabel="Keep" cancelLabel="Cancel" onConfirm={() => void done(true)}
          onCancel={() => { if (!saving.current) { afterClose.current = undefined; setConfirmLater(false) } }} />
        <Button type="button" variant="ghost" onClick={() => { if (!saving.current) close() }}>Discard</Button>
      </fieldset>}
      <p className="t-meta text-ink-2">
        Turn this off in{' '}
        <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/settings`} className="hit-44 inline-flex items-center underline"
          aria-disabled={busy || undefined} onClick={(event) => {
          event.preventDefault()
          // Respect the deploy base path (GitHub Pages serves from /contact-tinder/).
          if (!saving.current) { afterClose.current = () => { if (onSettings) onSettings(); else window.location.assign(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/settings`) }; dismiss() }
        }}>Settings</a>.
      </p>
    </div>
  </Sheet>
}
