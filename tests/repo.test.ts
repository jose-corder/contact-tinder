import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/schema'
import { allTags, counts, deckContacts, getDecision, saveDecision, upsertContacts } from '@/db/repo'
import { applySwipe, toggleCustomTag } from '@/domain/taxonomy'
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
