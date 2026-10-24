// Labels, colors and swipe mappings for every pass. Pure functions only; no React, no Dexie.
import type {
  Bucket, Decision, Direction, Pass, PersonalRelation, PersonalType, WorkStatus, WorkType,
} from './types'

export const PASS_ORDER: Pass[] = ['triage', 'work', 'personal']

export const BUCKET_META: Record<Bucket, { label: string; color: string }> = {
  delete: { label: 'Delete', color: 'var(--stamp-delete)' },
  work: { label: 'Work', color: 'var(--stamp-work)' },
  personal: { label: 'Personal', color: 'var(--stamp-personal)' },
}

export const WORK_STATUS_META: Record<WorkStatus, { label: string; color: string }> = {
  old: { label: 'Old', color: 'var(--status-old)' },
  current: { label: 'Current', color: 'var(--status-current)' },
  potential: { label: 'Potential', color: 'var(--status-potential)' },
}

export const WORK_TYPE_META: Record<WorkType, { label: string }> = {
  client: { label: 'Client' },
  vendor: { label: 'Vendor' },
  relationship: { label: 'Relationship' },
  namedrop: { label: 'Name-drop flex' },
}

export const PERSONAL_RELATION_META: Record<PersonalRelation, { label: string; color: string }> = {
  friend: { label: 'Friend', color: 'var(--stamp-personal)' },
  family: { label: 'Family', color: 'var(--stamp-personal)' },
  ex: { label: 'Ex', color: 'var(--stamp-delete)' },
}

export const PERSONAL_TYPE_META: Record<PersonalType, { label: string }> = {
  acquaintance: { label: 'Acquaintance' },
  neighbor: { label: 'Neighbor' },
  service: { label: 'Service provider' },
}

export type SwipeOutcome =
  | { kind: 'bucket'; value: Bucket; label: string; color: string }
  | { kind: 'workStatus'; value: WorkStatus; label: string; color: string }
  | { kind: 'relation'; value: PersonalRelation; label: string; color: string }
  | { kind: 'skip'; label: string; color: string }

export interface ChipDef {
  /** WorkType | PersonalType key */
  key: WorkType | PersonalType
  label: string
}

export interface PassMeta {
  title: string
  /** Shown on the deck-end screen, e.g. "Triage done." */
  doneTitle: string
  swipes: Record<Direction, SwipeOutcome>
  chips: ChipDef[]
  /** Color used to fill selected chips in this pass. */
  chipColor: string
  next?: Pass
}

const SKIP: SwipeOutcome = { kind: 'skip', label: 'Skip', color: 'var(--stamp-skip)' }

export const PASS_META: Record<Pass, PassMeta> = {
  triage: {
    title: 'Triage',
    doneTitle: 'Triage done.',
    swipes: {
      left: { kind: 'bucket', value: 'delete', label: 'Delete', color: BUCKET_META.delete.color },
      right: { kind: 'bucket', value: 'work', label: 'Work', color: BUCKET_META.work.color },
      up: { kind: 'bucket', value: 'personal', label: 'Personal', color: BUCKET_META.personal.color },
      down: SKIP,
    },
    chips: [],
    chipColor: 'var(--ink)',
    next: 'work',
  },
  work: {
    title: 'Work',
    doneTitle: 'Work sorted.',
    swipes: {
      left: { kind: 'workStatus', value: 'old', label: 'Old', color: WORK_STATUS_META.old.color },
      right: { kind: 'workStatus', value: 'current', label: 'Current', color: WORK_STATUS_META.current.color },
      up: { kind: 'workStatus', value: 'potential', label: 'Potential', color: WORK_STATUS_META.potential.color },
      down: SKIP,
    },
    chips: (Object.keys(WORK_TYPE_META) as WorkType[]).map((key) => ({ key, label: WORK_TYPE_META[key].label })),
    chipColor: BUCKET_META.work.color,
    next: 'personal',
  },
  personal: {
    title: 'Personal',
    doneTitle: 'Personal sorted.',
    swipes: {
      left: { kind: 'relation', value: 'ex', label: 'Ex', color: PERSONAL_RELATION_META.ex.color },
      right: { kind: 'relation', value: 'friend', label: 'Friend', color: PERSONAL_RELATION_META.friend.color },
      up: { kind: 'relation', value: 'family', label: 'Family', color: PERSONAL_RELATION_META.family.color },
      down: SKIP,
    },
    chips: (Object.keys(PERSONAL_TYPE_META) as PersonalType[]).map((key) => ({ key, label: PERSONAL_TYPE_META[key].label })),
    chipColor: BUCKET_META.personal.color,
  },
}

/** Max skips before a card leaves the deck as "unsorted". */
export const MAX_SKIPS = 2

function needsDecision(decision: Decision | undefined, pass: Pass): boolean {
  switch (pass) {
    case 'triage':
      return !decision?.bucket
    case 'work':
      return decision?.bucket === 'work' && !decision.workStatus
    case 'personal':
      return decision?.bucket === 'personal' && !decision.relation
  }
}

/** Is this contact (with its current decision, possibly undefined) part of the given deck? */
export function isInDeck(decision: Decision | undefined, pass: Pass): boolean {
  const skips = decision?.skips[pass] ?? 0
  return skips < MAX_SKIPS && needsDecision(decision, pass)
}

/** Contact was skipped out of a pass and still needs a decision there. */
export function isUnsorted(decision: Decision | undefined, pass: Pass): boolean {
  const skips = decision?.skips[pass] ?? 0
  return skips >= MAX_SKIPS && needsDecision(decision, pass)
}

/** Pure: returns a new Decision with the swipe applied. Changing bucket clears pass 2/3 fields. */
export function applySwipe(decision: Decision, pass: Pass, direction: Direction, now = Date.now()): Decision {
  const outcome = PASS_META[pass].swipes[direction]
  const next: Decision = { ...decision, skips: { ...decision.skips }, updatedAt: now }
  switch (outcome.kind) {
    case 'skip':
      next.skips[pass] = (next.skips[pass] ?? 0) + 1
      return next
    case 'bucket':
      return setBucket(next, outcome.value, now)
    case 'workStatus':
      next.workStatus = outcome.value
      return next
    case 'relation':
      next.relation = outcome.value
      return next
  }
}

/** Pure: move a contact to a bucket (used by swipes and by the Review re-bucket menu). */
export function setBucket(decision: Decision, bucket: Bucket | undefined, now = Date.now()): Decision {
  const next: Decision = { ...decision, bucket, updatedAt: now }
  if (bucket !== 'work') {
    next.workStatus = undefined
    next.workTypes = []
  }
  if (bucket !== 'personal') {
    next.relation = undefined
    next.personalTypes = []
  }
  return next
}

/** Pure: toggle a chip for the given pass. Unknown keys are ignored. */
export function toggleChip(decision: Decision, pass: Pass, key: WorkType | PersonalType, now = Date.now()): Decision {
  if (pass === 'work' && key in WORK_TYPE_META) {
    const k = key as WorkType
    const has = decision.workTypes.includes(k)
    return { ...decision, workTypes: has ? decision.workTypes.filter((x) => x !== k) : [...decision.workTypes, k], updatedAt: now }
  }
  if (pass === 'personal' && key in PERSONAL_TYPE_META) {
    const k = key as PersonalType
    const has = decision.personalTypes.includes(k)
    return { ...decision, personalTypes: has ? decision.personalTypes.filter((x) => x !== k) : [...decision.personalTypes, k], updatedAt: now }
  }
  return decision
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 32)
}

/** Pure: add or remove a custom tag. */
export function toggleCustomTag(decision: Decision, tag: string, now = Date.now()): Decision {
  const t = normalizeTag(tag)
  if (!t) return decision
  const has = decision.customTags.includes(t)
  return { ...decision, customTags: has ? decision.customTags.filter((x) => x !== t) : [...decision.customTags, t], updatedAt: now }
}

/** All human-readable labels on a decision, for Review rows and exports (CATEGORIES). */
export function decisionLabels(decision: Decision | undefined): string[] {
  if (!decision) return []
  // Custom tags survive even before triage (a skipped-twice card can still carry tags).
  if (!decision.bucket) return [...decision.customTags]
  const out: string[] = [BUCKET_META[decision.bucket].label]
  if (decision.bucket === 'work') {
    if (decision.workStatus) out.push(WORK_STATUS_META[decision.workStatus].label)
    for (const t of decision.workTypes) out.push(WORK_TYPE_META[t].label)
  }
  if (decision.bucket === 'personal') {
    if (decision.relation) out.push(PERSONAL_RELATION_META[decision.relation].label)
    for (const t of decision.personalTypes) out.push(PERSONAL_TYPE_META[t].label)
  }
  out.push(...decision.customTags)
  return out
}
