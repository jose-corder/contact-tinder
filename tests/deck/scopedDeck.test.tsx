import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { applySwipe } from '@/domain/taxonomy'
import { emptyDecision, type Contact } from '@/domain/types'
import { useDeck } from '@/hooks/useDeck'
import DeckScreen from '@/features/deck/DeckScreen'
import { dismissDeckCoaches } from './helpers'
import * as session from '@/hooks/deckSession'

const contact = (id: string): Contact => ({ id, displayName: id, phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] })
beforeEach(async () => {
  await repo.resetAll()
  await repo.upsertContacts(['Aaron', 'Zoe', 'Personal', 'Complete'].map(contact))
  await repo.saveDecisions(['Aaron', 'Zoe', 'Complete'].map((id) => applySwipe(emptyDecision(id), 'triage', 'right')))
  await repo.saveDecision(applySwipe(await repo.getDecision('Complete'), 'work', 'right'))
  await repo.saveDecision(applySwipe(emptyDecision('Personal'), 'triage', 'up'))
  dismissDeckCoaches()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const scope = (createdAt = Date.now()) => repo.setMeta('deckScope', { pass: 'work', ids: ['Zoe', 'Personal', 'Complete'], createdAt })

it('review_reswipe_scopes_real_decks_and_orders_mixed_passes: only selected eligible ids in this pass', async () => {
  await scope()
  render(<MemoryRouter><DeckScreen pass="work" /></MemoryRouter>)
  expect(await screen.findByRole('article', { name: 'Zoe contact card' })).toBeInTheDocument()
  expect(screen.getByText('Work · 1 selected')).toBeInTheDocument()
  expect(screen.getByText('0 / 1')).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: 'Aaron contact card' })).not.toBeInTheDocument()
})

it('scoped_deck_end_clears_the_scope', async () => {
  await scope()
  const { result } = renderHook(() => useDeck('work'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.swipe('right') })
  await waitFor(async () => expect(await repo.getMeta('deckScope', null)).toBeNull())
  expect(result.current.finished).toBe(true)
  expect((await repo.getDecision('Aaron')).workStatus).toBeUndefined()
})

it('scoped_deck_unmount_clears_the_scope', async () => {
  await scope()
  const view = renderHook(() => useDeck('work'))
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  view.unmount()
  await waitFor(async () => expect(await repo.getMeta('deckScope', null)).toBeNull())
})

it('scoped_deck_unmount_before_loading_finishes_still_clears_the_scope', async () => {
  await scope()
  const snapshot = await session.loadDeck('work')
  let resolve!: (value: typeof snapshot) => void
  vi.spyOn(session, 'loadDeck').mockImplementationOnce(() => new Promise<typeof snapshot>((done) => { resolve = done }) as ReturnType<typeof session.loadDeck>)
  const view = renderHook(() => useDeck('work'))
  view.unmount()
  await act(async () => { resolve(snapshot) })
  await waitFor(async () => expect(await repo.getMeta('deckScope', null)).toBeNull())
})

it('stale_scope_older_than_one_hour_is_ignored', async () => {
  await scope(Date.now() - 3_600_001)
  const { result } = renderHook(() => useDeck('work'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.remaining).toBe(2)
  expect(result.current.top?.contact.id).toBe('Aaron')
  expect(result.current.scopeLabel).toBeUndefined()
})

it('scope_for_another_pass_is_ignored', async () => {
  await scope()
  const { result } = renderHook(() => useDeck('personal'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.top?.contact.id).toBe('Personal')
  expect(result.current.scopeLabel).toBeUndefined()
})
