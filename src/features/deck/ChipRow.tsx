import { useEffect, useState, type RefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { allTags } from '@/db/repo'
import { normalizeTag, PASS_META } from '@/domain/taxonomy'
import type { Decision, Pass, PersonalType, WorkType } from '@/domain/types'
import { Chip } from '@/ui'

export function ChipRow({ pass, draft, toggleChip, toggleTag, inputRef, open, setOpen, disabled }: {
  pass: Pass; draft: Decision; toggleChip: (key: WorkType | PersonalType) => void
  toggleTag: (tag: string) => void; inputRef: RefObject<HTMLInputElement | null>
  open: boolean; setOpen: (value: boolean) => void; disabled?: boolean
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
  return <div className="max-h-[180px] shrink-0 overflow-y-auto py-3" aria-label="Contact tags">
    <div className="flex flex-wrap gap-2">
      {meta.chips.map((chip) => <Chip key={chip.key} label={chip.label} selected={selected.includes(chip.key)} color={meta.chipColor} disabled={disabled} onClick={() => toggleChip(chip.key)} />)}
      {draft.customTags.map((tag) => <Chip className="max-w-full truncate" key={tag} label={tag} selected color="var(--ink)" disabled={disabled} onClick={() => toggleTag(tag)} />)}
      <Chip label="+ tag" selected={open} disabled={disabled} onClick={() => setOpen(!open)} />
    </div>
    {open && <div className="mt-2">
      <input ref={inputRef} aria-label="Custom tag" value={query} maxLength={64} disabled={disabled}
        placeholder="Add a tag" className="h-9 w-full rounded-full border border-rule bg-paper px-3.5 font-sans text-[13px] outline-offset-2"
        onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); add(query) }
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery('') }
        }} />
      <div className="mt-2 flex flex-wrap gap-2">{tags.filter((tag) => !draft.customTags.includes(tag) && tag.includes(normalizeTag(query))).slice(0, 5).map((tag) => <Chip key={tag} label={tag} disabled={disabled} onClick={() => add(tag)} />)}</div>
    </div>}
  </div>
}
