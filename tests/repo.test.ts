import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/schema'
import {
  allContacts, allTags, counts, deckContacts, deleteContacts, dumpAll, getDecision, restoreAll,
  saveDecision, saveDecisions, StaleDecisionError, upsertContacts,
} from '@/db/repo'
import { applySwipe, setBucket, toggleCustomTag } from '@/domain/taxonomy'
import type { Contact } from '@/domain/types'

function contact(id: string, displayName: string): Contact {
  return {
    id, displayName, phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [],
  }
}

describe('repo', () => {
  beforeEach(async () => {
    await Promise.all([db.contacts.clear(), db.decisions.clear(), db.tags.clear(), db.meta.clear()])
  })

  it('decks move contacts between passes and skipped cards go to the end', async () => {
    await upsertContacts([contact('a', 'Ana'), contact('b', 'Bo'), contact('c', 'Cy')])
    let deck = await deckContacts('triage')
    expect(deck.map((r) => r.contact.id)).toEqual(['a', 'b', 'c'])

    await saveDecision(applySwipe(await getDecision('a'), 'triage', 'down'))
    deck = await deckContacts('triage')
    expect(deck.map((r) => r.contact.id)).toEqual(['b', 'c', 'a'])

    await saveDecision(applySwipe(await getDecision('b'), 'triage', 'right'))
    expect((await deckContacts('work')).map((r) => r.contact.id)).toEqual(['b'])
    expect((await deckContacts('triage')).map((r) => r.contact.id)).toEqual(['c', 'a'])

    const c = await counts()
    expect(c.total).toBe(3)
    expect(c.bucket.work).toBe(1)
    expect(c.undecided).toBe(2)
  })

  it('rejects a stale write when the row changed since it was read', async () => {
    await upsertContacts([contact('a', 'Ana')])
    const read = await getDecision('a') // not stored yet
    await saveDecision(applySwipe(read, 'triage', 'up', 10)) // someone else triaged it
    await expect(saveDecision(applySwipe(read, 'triage', 'right', 20), { expectedUpdatedAt: null })).rejects.toBeInstanceOf(StaleDecisionError)
    expect((await getDecision('a')).bucket).toBe('personal')
    const current = await getDecision('a')
    await saveDecision(setBucket(current, 'work', 30), { expectedUpdatedAt: current.updatedAt })
    expect((await getDecision('a')).bucket).toBe('work')
  })

  it('saveDecisions is all-or-nothing', async () => {
    await upsertContacts([contact('a', 'Ana'), contact('b', 'Bo')])
    const good = applySwipe(await getDecision('a'), 'triage', 'right')
    const bad = { ...applySwipe(await getDecision('b'), 'triage', 'right'), contactId: undefined as unknown as string }
    await expect(saveDecisions([good, bad])).rejects.toBeDefined()
    expect((await getDecision('a')).bucket).toBeUndefined()
  })

  it('deleting contacts releases their tags', async () => {
    await upsertContacts([contact('a', 'Ana'), contact('b', 'Bo')])
    await saveDecision(toggleCustomTag(await getDecision('a'), 'vip'))
    await saveDecision(toggleCustomTag(await getDecision('b'), 'vip'))
    await deleteContacts(['a'])
    expect(await allTags()).toEqual(['vip'])
    await deleteContacts(['b'])
    expect(await allTags()).toEqual([])
  })

  it('restore replaces by default, merges on request, and keeps photos', async () => {
    const withPhoto = { ...contact('a', 'Ana'), photo: new Blob(['x'], { type: 'image/png' }) }
    await upsertContacts([withPhoto])
    const storedPhoto = (await allContacts())[0].photo // however the IndexedDB shim clones it
    expect(storedPhoto).toBeDefined()
    const snapshot = await dumpAll() // a undecided, no b
    expect(snapshot.contacts[0]).not.toHaveProperty('photo')
    await saveDecision(applySwipe(await getDecision('a'), 'triage', 'left'))
    await upsertContacts([contact('b', 'Bo')])

    await restoreAll(snapshot, 'merge')
    expect((await allContacts()).map((c) => c.id)).toEqual(['a', 'b'])
    expect((await getDecision('a')).bucket).toBe('delete') // merge keeps the live decision

    await restoreAll(snapshot) // replace
    const after = await allContacts()
    expect(after.map((c) => c.id)).toEqual(['a'])
    expect(after[0].photo).toEqual(storedPhoto)
    expect((await getDecision('a')).bucket).toBeUndefined()
  })

  it('tag vocabulary tracks custom tags', async () => {
    await upsertContacts([contact('a', 'Ana')])
    let d = toggleCustomTag(await getDecision('a'), 'padel')
    await saveDecision(d)
    expect(await allTags()).toEqual(['padel'])
    d = toggleCustomTag(d, 'padel')
    await saveDecision(d)
    expect(await allTags()).toEqual([])
  })
})
