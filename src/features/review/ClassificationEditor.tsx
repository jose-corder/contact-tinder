import { useState } from 'react'
import type { Bucket, Decision, PersonalRelation, PersonalType, WorkStatus, WorkType } from '@/domain/types'
import { BUCKET_META, WORK_STATUS_META, WORK_TYPE_META, PERSONAL_RELATION_META, PERSONAL_TYPE_META, normalizeTag, setBucket, toggleChip, toggleCustomTag } from '@/domain/taxonomy'
import { Button, Chip, InlineNotice } from '@/ui'
import { toggleDeckType } from '@/domain/decks'

export default function ClassificationEditor({ decision, busy, error, save }: {
  decision: Decision; busy: boolean; error: string; save: (next: Decision) => Promise<boolean>
}) {
  const [tag, setTag] = useState('')
  return <section aria-label="Classification">
      <fieldset disabled={busy} aria-busy={busy}>
        <legend className="sr-only">Sort contact</legend>
        <div className="sheet-section"><h3 className="eyebrow t-eyebrow">List</h3><div className="flex flex-wrap gap-2">
          {(Object.keys(BUCKET_META) as Bucket[]).map((bucket) => <Chip key={bucket} label={BUCKET_META[bucket].label}
            selected={decision.bucket === bucket} tone={bucket} onClick={() => void save(setBucket(decision, bucket))} />)}
        </div></div>
        {decision.bucket === 'work' && <>
          <div className="sheet-section"><h3 className="eyebrow t-eyebrow">Work status</h3><div className="flex flex-wrap gap-2">
            {(Object.keys(WORK_STATUS_META) as WorkStatus[]).map((status) => <Chip key={status} label={WORK_STATUS_META[status].label}
              selected={decision.workStatus === status} tone={status}
              onClick={() => void save({ ...decision, workStatus: decision.workStatus === status ? undefined : status, updatedAt: Date.now() })} />)}
          </div></div>
          <div className="sheet-section"><h3 className="eyebrow t-eyebrow">Work types</h3><div className="flex flex-wrap gap-2">
            {(Object.keys(WORK_TYPE_META) as WorkType[]).map((type) => <Chip key={type} label={WORK_TYPE_META[type].uiLabel}
              selected={decision.workTypes.includes(type)} tone="work" onClick={() => void save(toggleChip(decision, 'work', type))} />)}
          </div></div>
        </>}
        {decision.bucket === 'personal' && <>
          <div className="sheet-section"><h3 className="eyebrow t-eyebrow">Relationship</h3><div className="flex flex-wrap gap-2">
            {(Object.keys(PERSONAL_RELATION_META) as PersonalRelation[]).map((relation) => <Chip key={relation} label={PERSONAL_RELATION_META[relation].label}
              selected={decision.relation === relation} tone={relation === 'ex' ? 'delete' : relation === 'other' ? 'skip' : 'personal'}
              onClick={() => void save({ ...decision, relation: decision.relation === relation ? undefined : relation, updatedAt: Date.now() })} />)}
          </div></div>
          <div className="sheet-section"><h3 className="eyebrow t-eyebrow">Personal types</h3>
            <p className="mb-2 t-meta text-ink-2">Choosing a type saves this contact as Other until you pick a relation</p><div className="flex flex-wrap gap-2">
            {(Object.keys(PERSONAL_TYPE_META) as PersonalType[]).map((type) => <Chip key={type} label={PERSONAL_TYPE_META[type].label}
              selected={decision.personalTypes.includes(type)} tone="personal" onClick={() => void save(toggleDeckType(decision, 'personal', type))} />)}
          </div></div>
        </>}
        <div className="sheet-section"><h3 className="eyebrow t-eyebrow">Custom tags</h3>
          {!!decision.customTags.length && <div className="mb-2 flex flex-wrap gap-2">{decision.customTags.map((value) => <Chip key={value} label={value} selected onClick={() => void save(toggleCustomTag(decision, value))} />)}</div>}
          <form className="flex gap-2" onSubmit={(event) => {
            event.preventDefault()
            const value = normalizeTag(tag)
            if (value && !decision.customTags.includes(value)) void save(toggleCustomTag(decision, value)).then(saved => { if (saved) setTag('') })
          }}>
            <input aria-label="New custom tag" placeholder="Add a tag" maxLength={32} value={tag} onChange={(event) => setTag(event.target.value)}
              className="min-w-0 flex-1 t-body border-b border-rule bg-transparent px-1 py-2 outline-offset-2" />
            <Button variant="outline" type="submit" disabled={!tag.trim()}>Add</Button>
          </form>
        </div>
      </fieldset>
      {busy && <InlineNotice tone="info">Saving classification…</InlineNotice>}
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
    </section>
}
