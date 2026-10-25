import type { Contact } from '@/domain/types'
import { identityName } from './metadata'

export interface MergePair { names: [string, string]; reason: string }

/** Called with the exact pairs accepted/rejected by dedupe; never guesses a merge. */
export function describeMergePair(a: Contact, b: Contact, keptApart = false): MergePair {
  const phone = a.phoneKeys.some((key) => b.phoneKeys.includes(key))
  const email = a.emailKeys.some((key) => b.emailKeys.includes(key))
  const detail = phone ? 'phone' : email ? 'email' : a.id === b.id ? 'contact ID' : 'name'
  return { names: [a.displayName, b.displayName], reason: keptApart
    ? `shared ${detail}, ${identityName(a) !== identityName(b) ? 'different names' : 'different identity details'}`
    : `same ${detail}` }
}
