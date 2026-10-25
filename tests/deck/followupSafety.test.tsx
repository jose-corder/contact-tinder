import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import * as deckPersistence from '@/hooks/deckSession'
import { applySwipe } from '@/domain/taxonomy'
import { emptyDecision, type Contact } from '@/domain/types'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import { followUpEnabled, setFollowUpEnabled } from '@/ui/theme'
import * as feedback from '@/ui/toast'

const sheet = vi.hoisted(() => ({ dismiss: () => {} }))
vi.mock('@/ui', async (original) => {
  const actual = await original<typeof import('@/ui')>()
  return { ...actual, Sheet: (props: Parameters<typeof actual.Sheet>[0]) => {
    // Exercise the very same callback used by shared Sheet's drag-end handler.
    sheet.dismiss = props.onClose
    return <actual.Sheet {...props} />
  } }
})
const contact: Contact = { id: 'a', displayName: 'Ana', phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] }
beforeEach(async () => { await repo.resetAll(); await repo.upsertContacts([contact]); setFollowUpEnabled(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); feedback.dismissToast() })

it.each([
  ['work', 'right', 'Vendor', 'Choose a status', 'Current'],
  ['personal', 'up', 'Neighbor', 'Choose a relation', 'Family'],
] as const)('followup_done_type_only_has_defined_completion: %s requires a primary; Later stays available', async (pass, direction, type, _prompt, primary) => {
  const decision = applySwipe(emptyDecision('a'), 'triage', direction)
  await repo.saveDecision(decision)
  const onClose = vi.fn()
  const view = render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: type }))
  // Audit #7: a Personal type supplies the Other relation.
  if (pass === 'personal') expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
  else expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Later' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  fireEvent.click(screen.getByRole('button', { name: 'Discard' })) // #16
  expect(onClose).toHaveBeenCalledExactlyOnceWith(undefined)
  expect(await repo.deckContacts(pass)).toHaveLength(1)
  view.unmount()
  onClose.mockClear()
  render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: primary }))
  expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(await repo.deckContacts(pass)).toHaveLength(0)
})

it('followup_pending_save_blocks_every_dismissal_and_preserves_the_failed_draft', async () => {
  const decision = applySwipe(emptyDecision('a'), 'triage', 'right')
  await repo.saveDecision(decision)
  const onClose = vi.fn()
  let reject!: (error: Error) => void
  vi.spyOn(deckPersistence, 'saveDeckDecision').mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Current' }))
  fireEvent.click(screen.getByRole('button', { name: 'Vendor' }))
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  const body = document.querySelector('.deck-followup-body')
  fireEvent.click(document.querySelector('[aria-hidden="true"].z-40')!)
  fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }))
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.keyDown(window, { key: 'Escape' })
  act(() => sheet.dismiss()) // Drag's onClose callback is also ignored while pending.
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  expect(onClose).not.toHaveBeenCalled()
  expect(followUpEnabled()).toBe(true)
  await act(async () => { reject(new Error('Quota')) })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
  expect(document.querySelector('.deck-followup-body')).toBe(body)
  expect(screen.getByRole('button', { name: 'Current' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Vendor' })).toHaveAttribute('aria-pressed', 'true')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect((await repo.getDecision('a')).workTypes).toEqual(['vendor'])
})

it('followup_stale_snapshot_does_not_overwrite_a_later_edit', async () => {
  const decision = applySwipe(emptyDecision('a'), 'triage', 'right', 10)
  await repo.saveDecision(decision)
  const onClose = vi.fn(), notify = vi.spyOn(feedback, 'toast')
  render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Current' }))
  const moved = applySwipe(decision, 'triage', 'up', 11)
  await repo.saveDecision(moved)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
  await waitFor(() => expect(onClose).toHaveBeenCalled())
  expect(await repo.getDecision('a')).toEqual(moved)
  expect(notify).toHaveBeenCalledWith('This contact changed elsewhere — skipped')
})

it('followup_actions_remain_scroll_reachable_on_small_screen: shrinking scroll viewport', () => {
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal('innerHeight', 568)
  const decision = { ...applySwipe(emptyDecision('a'), 'triage', 'right'), customTags: Array.from({ length: 40 }, (_, i) => `tag ${i}`) }
  render(<FollowUpSheet target={{ contact, decision }} onClose={() => {}} />)
  const body = document.querySelector('.deck-followup-body')!
  // Audit #4: one shared body scroller, footer outside it.
  expect(body).not.toHaveClass('overflow-y-auto')
  expect(body.parentElement).toHaveClass('sheet-body', 'overflow-y-auto')
  expect(body).not.toContainElement(screen.getByRole('button', { name: 'Later' }))
  const footer = document.querySelector('.sheet-footer')!
  expect(footer).toHaveClass('shrink-0')
  expect(footer).toContainElement(screen.getByRole('button', { name: 'Later' }))
  expect(footer).toContainElement(screen.getByRole('button', { name: 'Done' }))
  // jsdom has no layout/virtual keyboard: this verifies the scroll structure and
  // CSS contract; it cannot measure actual 390×568 scrolling or focus visibility.
})
