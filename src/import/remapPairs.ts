import type { Contact } from '@/domain/types'
import type { DuplicatePair } from './duplicates'
import { keysFor } from './dedupe'
import { metadata } from './metadata'

export const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort())
export const pairIdentity = ({ id, displayName, org }: Contact) => ({ id, displayName, ...(org ? { org } : {}) })
export const touches = (pair: DuplicatePair, a: string, b: string) =>
  [pair.a.id, pair.b.id].some(id => id === a || id === b)

export function sharedValues(a: Contact, b: Contact) {
  const ak = keysFor(a.phones, a.emails, metadata(a).defaultCountry)
  const bk = keysFor(b.phones, b.emails, metadata(b).defaultCountry)
  return { phones: ak.phoneKeys.filter(key => bk.phoneKeys.includes(key)),
    emails: ak.emailKeys.filter(key => bk.emailKeys.includes(key)) }
}

/** #59: remap before deleting B, recompute evidence and let unresolved evidence win
 * over an older dismissal when two edges collapse to the same canonical key. */
export function remapPairs(pairs: DuplicatePair[], merged: Contact, bId: string, contacts: Contact[]): DuplicatePair[] {
  const byId = new Map(contacts.map(contact => [contact.id, contact]))
  byId.set(merged.id, merged)
  const result = new Map<string, DuplicatePair>()
  for (const pair of pairs) {
    const a = pair.a.id === bId ? merged.id : pair.a.id
    const b = pair.b.id === bId ? merged.id : pair.b.id
    if (a === b) continue // Includes the resolved A/B pair, in either direction.
    const key = pairKey(a, b)
    let next = pair
    if (touches(pair, merged.id, bId)) {
      const left = byId.get(a), right = byId.get(b)
      const shared = left && right ? sharedValues(left, right) : undefined
      next = { ...pair, id: key, a: left ? pairIdentity(left) : { ...pair.a, id: a },
        b: right ? pairIdentity(right) : { ...pair.b, id: b },
        reason: !shared ? pair.reason : shared.phones.length ? 'shared phone' : shared.emails.length ? 'shared email' : 'same name' }
    }
    const previous = result.get(key)
    if (!previous) result.set(key, next)
    else if (previous.resolved && !next.resolved) result.set(key, { ...next, createdAt: Math.min(previous.createdAt, next.createdAt) })
  }
  return [...result.values()]
}
