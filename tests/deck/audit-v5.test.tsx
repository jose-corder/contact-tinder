import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { emptyDecision, type Contact } from '@/domain/types'
import { useDeck } from '@/hooks/useDeck'
import { resetSessionSkips } from '@/hooks/deckSession'
import * as persistence from '@/hooks/deckSession'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import * as feedback from '@/ui/toast'

const contact = (id: string): Contact => ({ id, displayName: id, phones: [], emails: [], raw: '',
  source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] })
const legacy = { ...emptyDecision('a', 10), bucket: 'personal' as const, personalTypes: ['neighbor' as const],
  customTags: ['saved'], skips: { triage: 1, work: 1, personal: 1 } }
const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeEach(async () => { await repo.resetAll(); await repo.upsertContacts(['a', 'b'].map(contact)) })
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); feedback.dismissToast()
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

it('#61 refuses a Merge restore with the swipe timestamp and different content without touching queue or tags', async () => {
  await repo.saveDecisions([legacy, { ...emptyDecision('b'), bucket: 'personal', skips: { triage: 0, work: 0, personal: 1 } }], { exact: true })
  const { result } = renderHook(() => useDeck('personal'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.top?.contact.id).toBe('a')
  await act(async () => { await result.current.swipe('right') })
  const written = await repo.getDecision('a')
  expect(written.relation).toBe('friend')
  const restored = { ...written, relation: 'family' as const, customTags: ['restored'], personalTypes: ['service' as const] }
  await repo.restoreAll({ version: 1, exportedAt: new Date().toISOString(), contacts: [contact('a')], decisions: [restored] }, 'merge')
  const before = { top: result.current.top, next: result.current.next, remaining: result.current.remaining,
    done: result.current.done, draft: result.current.draft }
  const tags = await db.tags.toArray()
  const notify = vi.spyOn(feedback, 'toast')
  await act(async () => { await result.current.undo() })
  expect(await repo.getDecision('a')).toEqual(restored)
  expect(await db.tags.toArray()).toEqual(tags)
  expect({ top: result.current.top, next: result.current.next, remaining: result.current.remaining,
    done: result.current.done, draft: result.current.draft }).toEqual(before)
  expect(result.current.returning).toBeUndefined()
  expect(result.current.canUndo).toBe(false)
  expect(notify).toHaveBeenCalledWith('Changed since — not undone')
})

it('#61 refuses Undo when the contact is gone even if its written decision remains', async () => {
  const { result } = renderHook(() => useDeck('triage'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { await result.current.swipe('right') })
  const written = await repo.getDecision('a')
  await db.contacts.delete('a')
  await act(async () => { await result.current.undo() })
  expect(await repo.getDecision('a')).toEqual(written)
  expect(result.current.top?.contact.id).toBe('b')
  expect(result.current.canUndo).toBe(false)
})

it('#64 deck retry preserves current legacy fields and only resets the selected pass and IDs', async () => {
  const other = { ...legacy, contactId: 'b' }
  await repo.saveDecisions([legacy, other], { exact: true })
  const latest = { ...legacy, customTags: ['latest'], skips: { triage: 2, work: 1, personal: 2 } }
  await repo.saveDecision(latest, { exact: true })
  const rows = await resetSessionSkips('personal', ['a', 'missing'])
  expect(rows).toHaveLength(1)
  expect(rows[0].decision).toEqual({ ...latest, skips: { ...latest.skips, personal: 0 }, updatedAt: expect.any(Number) })
  expect(await repo.getDecision('a')).toEqual(rows[0].decision)
  expect(await repo.getDecision('b')).toEqual(other)
})

it.each([[320, 568, 240], [568, 320, 320]])('#63 Later reveals confirmation and Cancel returns focus at %sx%s', async (width, height, viewport) => {
  vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height)
  vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { height: viewport, offsetTop: 0 }))
  const reveal = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: reveal })
  const decision = { ...legacy, customTags: Array.from({ length: 40 }, (_, i) => `tag ${i}`) }
  const close = vi.fn()
  render(<FollowUpSheet target={{ contact: contact('a'), decision }} onClose={close} />)
  await act(async () => {}) // Settle the sheet's initial focus before activating Later.
  fireEvent.click(screen.getByRole('button', { name: 'Acquaintance' }))
  const later = screen.getByRole('button', { name: 'Later' })
  const body = document.querySelector('.sheet-body')!
  body.scrollTop = 0
  later.focus()
  reveal.mockClear()
  fireEvent.click(later)
  const confirmation = screen.getByRole('group', { name: 'Unsaved selections' })
  await waitFor(() => expect(confirmation).toContainElement(document.activeElement as HTMLElement))
  expect(reveal).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }))
  expect(screen.getByRole('button', { name: 'Keep' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(later).toHaveFocus())
  expect(screen.queryByRole('group', { name: 'Unsaved selections' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Acquaintance' })).toHaveAttribute('aria-pressed', 'true')
  expect(close).not.toHaveBeenCalled()
})

it('#63 failed Keep retains the confirmation, draft and reachable retry/cancel actions', async () => {
  await repo.saveDecision(legacy, { exact: true })
  vi.spyOn(persistence, 'saveDeckDecision').mockRejectedValueOnce(new Error('Unavailable'))
  const close = vi.fn()
  render(<FollowUpSheet target={{ contact: contact('a'), decision: legacy }} onClose={close} />)
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'Acquaintance' }))
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep' })) })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
  expect(screen.getByRole('button', { name: 'Keep' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  expect(screen.getByRole('group', { name: 'Unsaved selections' })).toContainElement(document.activeElement as HTMLElement)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep' })) })
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect((await repo.getDecision('a')).personalTypes).toEqual(['neighbor', 'acquaintance'])
})
