import { allDecisions, allWithDecisions, counts, deckContacts, getMeta, saveDecision, setMeta, StaleDecisionError, type ContactWithDecision, type SaveOptions } from '@/db/repo'
import { db } from '@/db/schema'
import type { Decision, Pass } from '@/domain/types'

export interface DeckItem extends ContactWithDecision { persisted: boolean }
export interface DeckScope { pass: Pass; ids: string[]; createdAt: number; mode?: 'reclassify' }

export function saveDeckDecision(decision: Decision, options: SaveOptions): Promise<void> {
  return db.transaction('rw', db.contacts, db.decisions, db.tags, async () => {
    // Reset can remove a contact whose decision never existed. A null version
    // alone cannot detect that case; check existence in the same transaction.
    if (!await db.contacts.get(decision.contactId)) throw new StaleDecisionError(decision.contactId, undefined)
    await saveDecision(decision, options)
  })
}

/** Membership and existence must come from the same snapshot, including after reset. */
export function loadDeck(pass: Pass, scope?: DeckScope | null) {
  return db.transaction('r', db.contacts, db.decisions, db.meta, async () => {
    const [rows, decisions, summary, savedScope] = await Promise.all([
      deckContacts(pass), allDecisions(), counts(), getMeta<DeckScope | null>('deckScope', null),
    ])
    const candidate = scope === undefined ? savedScope : scope
    const active = candidate?.pass === pass && Array.isArray(candidate.ids) &&
      (scope !== undefined || (Date.now() - candidate.createdAt < 3_600_000 && candidate.createdAt <= Date.now())) ? candidate : null
    const ids = active && new Set(active.ids)
    const persisted = new Set(decisions.map((d) => d.contactId))
    // Review's reclassification scope keeps saved decisions until replacement (#13).
    const candidates = active?.mode === 'reclassify'
      ? (await allWithDecisions()).filter((r) => pass === 'triage' || r.decision.bucket === pass) : rows
    const items: DeckItem[] = candidates.filter((r) => !ids || ids.has(r.contact.id))
      .map((r) => ({ ...r, persisted: persisted.has(r.contact.id) }))
    return { items, summary, scope: active }
  })
}

export async function clearDeckScope(scope: DeckScope) {
  // A newer Review navigation may already have installed its own scope.
  await db.transaction('rw', db.meta, async () => {
    const current = await getMeta<DeckScope | null>('deckScope', null)
    if (current?.pass === scope.pass && current.createdAt === scope.createdAt &&
      JSON.stringify(current.ids) === JSON.stringify(scope.ids)) await setMeta('deckScope', null)
  })
}
