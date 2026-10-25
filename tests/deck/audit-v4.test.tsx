import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { emptyDecision, type Contact } from '@/domain/types'
import { isUnsorted } from '@/domain/taxonomy'
import { useDeck } from '@/hooks/useDeck'
import { groupFiles } from '@/export/vcf'
import DeckScreen from '@/features/deck/DeckScreen'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import { setFollowUpEnabled } from '@/ui/theme'
import { dismissDeckCoaches } from './helpers'

vi.mock('framer-motion', async original => {
  const actual = await original<typeof import('framer-motion')>()
  return { ...actual, animate: (value: { set: (next: number) => void }, next: number) => {
    value.set(next)
    return Object.assign(Promise.resolve(), { stop: () => {} })
  } }
})
const contact: Contact = { id: 'a', displayName: 'Ana', phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] }
beforeEach(async () => {
  await repo.resetAll(); await repo.upsertContacts([contact]); dismissDeckCoaches(); setFollowUpEnabled(false)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function click(name: string) {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  await act(async () => fireEvent.click(button))
}

it.each([false, true])('#16/#60 Neighbor → Skip returns the draft once, then Unsorted, then explicit Done (scoped %s)', async scoped => {
  const before = { ...emptyDecision('a', 10), bucket: 'personal' as const, customTags: ['saved'] }
  await repo.saveDecision(before)
  if (scoped) await repo.setMeta('deckScope', { pass: 'personal', ids: ['a'], mode: 'reclassify', createdAt: Date.now() })
  const save = vi.spyOn(repo, 'saveDecision')
  render(<MemoryRouter><DeckScreen pass="personal" /></MemoryRouter>)
  await click('Neighbor')
  await click('+ tag')
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'draft' } })
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
  await click('Skip')
  const first = await repo.getDecision('a')
  expect(first).toEqual({ ...before, skips: { ...before.skips, personal: 1 }, updatedAt: expect.any(Number) })
  expect(save).toHaveBeenLastCalledWith(first, { exact: true, expectedUpdatedAt: 10, requireContact: true })
  expect(await repo.deckContacts('personal')).toHaveLength(1)
  expect((await repo.counts()).relation.other).toBe(0)
  expect(groupFiles(await repo.allWithDecisions()).some(file => file.filename === 'personal-other.vcf')).toBe(false)
  expect(await repo.allTags()).toEqual(['saved'])
  expect(screen.getByRole('button', { name: 'Neighbor' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'draft' })).toHaveAttribute('aria-pressed', 'true')
  await click('Skip')
  const second = await repo.getDecision('a')
  expect(second.relation).toBeUndefined()
  expect(second.personalTypes).toEqual([])
  expect(isUnsorted(second, 'personal')).toBe(true)
  expect((await repo.counts()).unsorted.personal).toBe(1)
  expect(await screen.findByText('1 still need sorting')).toBeInTheDocument()
  expect(screen.queryByText('SORTED')).not.toBeInTheDocument()
  await click('Sort the skipped ones')
  expect(await screen.findByRole('button', { name: 'Neighbor' })).toHaveAttribute('aria-pressed', 'true')
  await click('Done')
  expect((await repo.getDecision('a')).relation).toBe('other')
  expect(groupFiles(await repo.allWithDecisions()).find(file => file.filename === 'personal-other.vcf')?.rows).toHaveLength(1)
  expect((await repo.getDecision('a')).personalTypes).toEqual(['neighbor'])
  expect((await repo.getDecision('a')).customTags).toEqual(['saved', 'draft'])
  expect(await screen.findByText('SORTED')).toBeInTheDocument()
})

it('#60 drafts stay with their contact through another card and visibility reconciliation', async () => {
  await repo.upsertContacts([{ ...contact, id: 'b', displayName: 'Bo' }])
  await repo.saveDecisions(['a', 'b'].map(id => ({ ...emptyDecision(id), bucket: 'work' as const })))
  const { result } = renderHook(() => useDeck('work'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => { result.current.toggleChip('client'); result.current.toggleTag('draft') })
  await act(async () => { await result.current.swipe('down') })
  expect(result.current.top?.contact.id).toBe('b')
  expect(result.current.draft?.workTypes).toEqual([])
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  await act(async () => fireEvent(document, new Event('visibilitychange')))
  await waitFor(() => expect(result.current.canUndo).toBe(false))
  await act(async () => { await result.current.swipe('right') })
  expect(result.current.top?.contact.id).toBe('a')
  expect(result.current.draft?.workTypes).toEqual(['client'])
  expect(result.current.draft?.customTags).toEqual(['draft'])
  expect((await repo.getDecision('a')).workTypes).toEqual([])
})

it.each(['left', 'right', 'up'] as const)('#60 explicit %s swipe completes with the selected Personal types', async direction => {
  await repo.saveDecision({ ...emptyDecision('a'), bucket: 'personal' })
  const { result } = renderHook(() => useDeck('personal'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  act(() => result.current.toggleChip('neighbor'))
  expect(result.current.draft?.relation).toBeUndefined()
  await act(async () => { await result.current.swipe(direction) })
  expect((await repo.getDecision('a')).relation).toBe({ left: 'ex', right: 'friend', up: 'family' }[direction])
  expect((await repo.getDecision('a')).personalTypes).toEqual(['neighbor'])
})

it('#61 Undo after Later Keep restores a historical type-only Personal snapshot exactly', async () => {
  const legacy = { ...emptyDecision('a', 10), bucket: 'personal' as const, personalTypes: ['neighbor' as const],
    customTags: ['saved'], skips: { triage: 1, work: 0, personal: 1 } }
  await repo.saveDecision(legacy, { exact: true })
  await repo.setMeta('deckScope', { pass: 'triage', ids: ['a'], mode: 'reclassify', createdAt: Date.now() })
  setFollowUpEnabled(true)
  const save = vi.spyOn(repo, 'saveDecision')
  render(<MemoryRouter><DeckScreen pass="triage" /></MemoryRouter>)
  await click('Personal')
  await click('Acquaintance'); await click('Later'); await click('Keep')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const kept = await repo.getDecision('a')
  expect(kept.relation).toBe('other')
  await click('Undo')
  await screen.findByRole('article')
  const restored = await repo.getDecision('a')
  expect(restored).toEqual({ ...legacy, updatedAt: expect.any(Number) })
  expect(save).toHaveBeenLastCalledWith(restored, { exact: true, expectedDecision: kept, requireContact: true })
  expect(await db.tags.toArray()).toEqual([{ name: 'saved', count: 1 }])
  expect(await repo.deckContacts('personal')).toHaveLength(1)
  expect((await repo.counts()).relation.other).toBe(0)
  expect(groupFiles(await repo.allWithDecisions()).some(file => file.filename === 'personal-other.vcf')).toBe(false)
})

it('#41 uses literal taxonomy labels on the deck and follow-up screens', async () => {
  const view = render(<MemoryRouter><DeckScreen pass="triage" /></MemoryRouter>)
  expect(await screen.findByText('Sort contacts')).toBeInTheDocument()
  await click('Delete')
  expect(await screen.findByRole('heading', { name: 'Sorting done.' })).toBeInTheDocument()
  expect(screen.queryByText(/Triage/)).not.toBeInTheDocument()
  view.unmount()
  const decision = { ...emptyDecision('a'), bucket: 'work' as const }
  await repo.saveDecision(decision)
  const work = render(<MemoryRouter><DeckScreen pass="work" /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'Notable contact' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Name-drop flex' })).not.toBeInTheDocument()
  work.unmount()
  render(<FollowUpSheet target={{ contact, decision }} onClose={() => {}} />)
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Notable contact' })).toBeInTheDocument()
})

it('#14/#38 keeps expanded Keep/Discard inside the shared sheet body with the keyboard open', async () => {
  vi.stubGlobal('innerHeight', 568)
  vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { height: 240, offsetTop: 0 }))
  const decision = { ...emptyDecision('a'), bucket: 'personal' as const }
  await repo.saveDecision(decision)
  const close = vi.fn()
  render(<FollowUpSheet target={{ contact, decision }} onClose={close} />)
  await click('Neighbor'); await click('Later')
  const confirmation = screen.getByRole('group', { name: 'Unsaved selections' })
  expect(confirmation).toHaveClass('sheet-confirm')
  expect(confirmation.closest('.sheet-body')).not.toBeNull()
  expect(confirmation.closest('.sheet-footer')).toBeNull()
  await click('Keep')
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect((await repo.getDecision('a')).relation).toBe('other')
})
