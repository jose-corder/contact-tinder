import { useEffect, useState, type RefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { allTags } from '@/db/repo'
import { normalizeTag, PASS_META } from '@/domain/taxonomy'
import type { Decision, Pass, PersonalRelation, PersonalType, WorkType } from '@/domain/types'
import { PERSONAL_RELATION_META } from '@/domain/taxonomy'
import { Button, Chip } from '@/ui'

export function ChipRow({ pass, draft, toggleChip, toggleTag, inputRef, open, setOpen, disabled, sheet, setRelation, completePersonal }: {
  pass: Pass; draft: Decision; toggleChip: (key: WorkType | PersonalType) => void
  toggleTag: (tag: string) => void; inputRef: RefObject<HTMLInputElement | null>
  open: boolean; setOpen: (value: boolean) => void; disabled?: boolean
  sheet?: boolean; setRelation?: (relation: PersonalRelation) => void; completePersonal?: () => void
}) {
  const tags = useLiveQuery(allTags, [], [])
  const [query, setQuery] = useState('')
  const meta = PASS_META[pass]
  const selected: string[] = pass === 'work' ? draft.workTypes : draft.personalTypes
  useEffect(() => { if (open) inputRef.current?.focus() }, [open, inputRef])
  const add = (tag: string) => {
    const normalized = normalizeTag(tag)
    if (!normalized) return
    if (!draft.customTags.includes(normalized)) toggleTag(normalized)
    setQuery('')
    setOpen(false)
  }
  return <div className={`deck-chips shrink-0 py-1 ${sheet ? 'deck-chips-sheet' : 'deck-chips-stage'}`} aria-label="Contact tags">
      {pass === 'personal' && setRelation && <div className="flex justify-between gap-2" role="group" aria-label="Relation">
        {(Object.keys(PERSONAL_RELATION_META) as PersonalRelation[]).map((key) => <Chip key={key} label={PERSONAL_RELATION_META[key].label}
          aria-label={`Relation: ${PERSONAL_RELATION_META[key].label}`} tone={key === 'ex' ? 'delete' : key === 'other' ? 'skip' : 'personal'}
          selected={draft.relation === key} disabled={disabled} onClick={() => setRelation(key)} />)}
      </div>}
    <div className="flex min-w-0 items-center gap-2">
    <div className={sheet ? 'flex flex-wrap gap-2' : 'deck-chip-rail flex min-w-0 flex-1 items-center gap-2 overflow-x-auto'}>
      {meta.chips.map((chip) => <Chip key={chip.key} label={chip.label} selected={selected.includes(chip.key)} tone={pass === 'triage' ? 'ink' : pass} disabled={disabled} onClick={() => toggleChip(chip.key)} />)}
      {draft.customTags.map((tag) => <Chip className="max-w-full truncate" key={tag} label={tag} selected tone="ink" disabled={disabled} onClick={() => toggleTag(tag)} />)}
      <Chip label="+ tag" selected={open} disabled={disabled} onClick={() => setOpen(!open)} />
    </div>
    {completePersonal && draft.relation && <Button disabled={disabled} onClick={completePersonal}>Done</Button>}
    </div>
    {pass === 'personal' && !sheet && <p className="t-meta text-ink-2">A type counts as Other if no relation fits</p>}
    {open && <div className="mt-2">
      <input ref={inputRef} aria-label="Custom tag" value={query} maxLength={64} disabled={disabled}
        placeholder="Add a tag" className="h-11 w-full rounded-full border border-rule bg-paper px-3.5 font-sans text-base outline-offset-2"
        onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); add(query) }
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery('') }
        }} />
      <div className="mt-2 flex flex-wrap gap-2">{tags.filter((tag) => !draft.customTags.includes(tag) && tag.includes(normalizeTag(query))).slice(0, 5).map((tag) => <Chip key={tag} label={tag} disabled={disabled} onClick={() => add(tag)} />)}</div>
    </div>}
  </div>
}
