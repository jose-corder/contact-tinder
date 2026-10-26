import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/schema'
import * as repo from '@/db/repo'
import { emptyDecision } from '@/domain/types'
import { removeSampleContacts } from '@/import'
import { makeContact } from '@/import/contact'

beforeEach(() => repo.resetAll())

describe('removeSampleContacts', () => {
  it('removes only demo contacts and their decisions, releasing only their share of tags', async () => {
    const samples = ['Old sample', 'Another sample'].map(displayName =>
      makeContact({ displayName, phones: [], emails: [] }, 'demo')!)
    const own = (['vcf', 'csv', 'picker'] as const).map(source =>
      makeContact({ displayName: `${source} contact`, phones: [], emails: [] }, source)!)
    await repo.upsertContacts([...samples, ...own])
    await repo.saveDecisions(samples.map(c => ({ ...emptyDecision(c.id), bucket: 'work', customTags: ['sample-only', 'shared'] })))
    await repo.saveDecisions(own.map(c => ({ ...emptyDecision(c.id), bucket: 'personal', customTags: ['mine', 'shared'] })))
    const ownDecisions = (await repo.allDecisions()).filter(d => own.some(c => c.id === d.contactId))
    expect(await db.tags.get('shared')).toEqual({ name: 'shared', count: 5 })

    expect(await removeSampleContacts()).toBe(2)

    expect(await repo.allContacts()).toEqual([...own].sort((a, b) => a.displayName.localeCompare(b.displayName)))
    expect(await repo.allDecisions()).toEqual(ownDecisions)
    expect(await db.tags.get('sample-only')).toBeUndefined()
    expect(await db.tags.get('shared')).toEqual({ name: 'shared', count: 3 })
    expect(await db.tags.get('mine')).toEqual({ name: 'mine', count: 3 })
    expect(await removeSampleContacts()).toBe(0)
    expect(await repo.allDecisions()).toEqual(ownDecisions)
    expect(await db.tags.get('shared')).toEqual({ name: 'shared', count: 3 })
  })

  it('returns zero for an empty database', async () => {
    expect(await removeSampleContacts()).toBe(0)
    expect(await repo.allContacts()).toEqual([])
    expect(await repo.allDecisions()).toEqual([])
    expect(await repo.allTags()).toEqual([])
  })

  it('counts demo contacts that have no decisions or tags', async () => {
    await repo.upsertContacts([makeContact({ displayName: 'Unsorted sample', phones: [], emails: [] }, 'demo')!])
    expect(await removeSampleContacts()).toBe(1)
    expect(await repo.allContacts()).toEqual([])
    expect(await repo.allTags()).toEqual([])
  })
})
