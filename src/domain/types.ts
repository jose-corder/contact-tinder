// Shared domain types. Single source of truth: do not duplicate these elsewhere.

export type Bucket = 'delete' | 'work' | 'personal'
export type WorkStatus = 'old' | 'current' | 'potential'
export type WorkType = 'client' | 'vendor' | 'relationship' | 'namedrop'
export type PersonalRelation = 'friend' | 'family' | 'ex'
export type PersonalType = 'acquaintance' | 'neighbor' | 'service'

/** The three swipe decks, in order. */
export type Pass = 'triage' | 'work' | 'personal'
export type Direction = 'left' | 'right' | 'up' | 'down'

export type ContactSource = 'vcf' | 'csv' | 'picker' | 'demo'

export interface PhoneEntry {
  value: string
  /** E.164 normalized form when parseable, e.g. +15550101 */
  e164?: string
  type?: string
}

export interface EmailEntry {
  value: string
  type?: string
}

export interface Contact {
  /** Stable id: hash of vCard UID, else hash of displayName + first phone/email. */
  id: string
  displayName: string
  givenName?: string
  familyName?: string
  org?: string
  title?: string
  phones: PhoneEntry[]
  emails: EmailEntry[]
  /** Image blob (jpeg/png). Stored in IndexedDB. */
  photo?: Blob
  notes?: string
  /** vCard REV (last modified) as ISO string if present. */
  rev?: string
  /** Richest decoded source vCard text, preserving folds and line endings. Empty for CSV/picker imports. */
  raw: string
  source: ContactSource
  importedAt: number
  /** Dedupe/index keys: normalized phones (digits, e164 when possible). */
  phoneKeys: string[]
  /** Dedupe/index keys: lowercased emails. */
  emailKeys: string[]
}

export interface Decision {
  contactId: string
  /** Set by pass 1 (triage). Undefined = not yet triaged. */
  bucket?: Bucket
  /** Set by pass 2 swipe. Only meaningful when bucket === 'work'. */
  workStatus?: WorkStatus
  /** Set by pass 2 chips. */
  workTypes: WorkType[]
  /** Set by pass 3 swipe. Only meaningful when bucket === 'personal'. */
  relation?: PersonalRelation
  /** Set by pass 3 chips. */
  personalTypes: PersonalType[]
  /** Free-text tags, any pass. Lowercased, trimmed, unique. */
  customTags: string[]
  /** How many times the card was skipped in each pass. 2 skips = leaves the deck ("unsorted"). */
  skips: Record<Pass, number>
  updatedAt: number
}

export interface Tag {
  name: string
  count: number
}

export interface MetaEntry {
  key: string
  value: unknown
}

export function emptyDecision(contactId: string, now = Date.now()): Decision {
  return {
    contactId,
    workTypes: [],
    personalTypes: [],
    customTags: [],
    skips: { triage: 0, work: 0, personal: 0 },
    updatedAt: now,
  }
}

export interface Counts {
  total: number
  undecided: number
  unsorted: Record<Pass, number>
  bucket: Record<Bucket, number>
  workStatus: Record<WorkStatus, number>
  workType: Record<WorkType, number>
  relation: Record<PersonalRelation, number>
  personalType: Record<PersonalType, number>
}
