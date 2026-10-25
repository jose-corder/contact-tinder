// Audit #3: persistent Undo now belongs to the top bar.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as repo from '@/db/repo'
import * as deckPersistence from '@/hooks/deckSession'
import { emptyDecision, type Contact } from '@/domain/types'
import { applySwipe } from '@/domain/taxonomy'
import DeckScreen from '@/features/deck/DeckScreen'
import { setFollowUpEnabled } from '@/ui/theme'
import * as feedback from '@/ui/toast'
import { dismissDeckCoaches } from './helpers'

vi.mock('framer-motion', async (original) => {
  const actual = await original<typeof import('framer-motion')>()
  return { ...actual, animate: (value: { set: (next: number) => void }, next: number) => {
    value.set(next)
    return Object.assign(Promise.resolve(), { stop: () => {} })
  } }
})
const contact = (id: string): Contact => ({ id, displayName: id, phones: [{ value: '111' }], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] })
beforeEach(async () => { await repo.resetAll(); await repo.upsertContacts(['Ana', 'Bo'].map(contact)); dismissDeckCoaches(); setFollowUpEnabled(false); feedback.dismissToast() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); feedback.dismissToast() })
const show = () => render(<MemoryRouter><DeckScreen pass="triage" /></MemoryRouter>)
async function click(name: string) {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  await act(async () => { fireEvent.click(button) })
}

it('details_arrow_keys_scroll_without_deciding_from_the_back_face_or_its_controls', async () => {
  show()
  await click('View all fields')
  const save = vi.spyOn(repo, 'saveDecision')
  const details = screen.getByLabelText('All contact fields')
  for (const target of [details, screen.getByRole('link', { name: '111' }), screen.getByRole('button', { name: 'Back' })]) {
    target.focus()
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'z', 't', '1']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      fireEvent(target, event)
      expect(event.defaultPrevented).toBe(false)
    }
  }
  expect(save).not.toHaveBeenCalled()
  await click('Back')
  await act(async () => { fireEvent.keyDown(window, { key: 'ArrowRight' }) })
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
})

it('followup_pending_save_blocks_global_undo_and_keyboard_until_retry_succeeds', async () => {
  setFollowUpEnabled(true)
  const notify = vi.spyOn(feedback, 'toast')
  show()
  await click('Work')
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('button', { name: 'Current' }))
  let reject!: (reason: Error) => void
  const save = vi.spyOn(deckPersistence, 'saveDeckDecision').mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  await click('Done')
  await act(async () => { notify.mock.lastCall?.[1]?.action?.onClick() })
  for (const key of ['ArrowDown', 'ArrowRight', 'z']) fireEvent.keyDown(window, { key })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(save).toHaveBeenCalledTimes(1)
  await act(async () => { reject(new Error('Unavailable')) })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
  expect(screen.getByRole('button', { name: 'Current' })).toHaveAttribute('aria-pressed', 'true')
  await click('Done')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await click('Undo')
  await waitFor(() => expect(screen.getByRole('article', { name: 'Ana contact card' })).toBeInTheDocument())
  expect((await repo.getDecision('Ana')).bucket).toBeUndefined()
  expect((await repo.getDecision('Ana')).workStatus).toBeUndefined()
})

it('deck_hit_areas_are_at_least_44px_without_growing_chip_visuals', async () => {
  await repo.saveDecision(applySwipe(emptyDecision('Ana'), 'triage', 'right'))
  render(<MemoryRouter><DeckScreen pass="work" /></MemoryRouter>)
  const view = await screen.findByRole('button', { name: 'View all fields' })
  expect(view).toHaveClass('min-h-11', 'min-w-11')
  const chip = screen.getByRole('button', { name: 'Client' })
  expect(chip).toHaveClass('h-9') // 36px visual + 4px hit extension on each edge.
  expect(chip.closest('.deck-chips')).not.toBeNull()
  // Audit #3/#13: use platform hit targets rather than deck-only overrides.
  const css = readFileSync('src/index.css', 'utf8')
  expect(css).toContain('.chip-hit')
  expect(screen.getByRole('link', { name: 'Back' })).toHaveClass('hit-44')
  await click('View all fields')
  expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('min-h-11', 'min-w-11')
  expect(screen.getByRole('link', { name: '111' })).toHaveClass('hit-44') // #42 shared FieldList
  await click('Current')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toHaveClass('h-11', 'min-w-11'))
  // jsdom does not lay out pixels or pseudo-elements; assert CSS/class contracts.
})

it('first_run_coach_and_next_card_peek_survive_swipe_and_undo', async () => {
  window.localStorage.removeItem('ct.coach.triage')
  show()
  expect(await screen.findByRole('complementary', { name: 'Swipe guide' })).toBeInTheDocument()
  const preview = screen.getByText('Bo').closest('[aria-hidden="true"]')!
  expect(preview).not.toBeNull()
  expect(preview).toHaveAttribute('inert')
  expect(screen.getAllByRole('article')).toHaveLength(1)
  await click('Got it')
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  await click('Work')
  expect(await screen.findByRole('article', { name: 'Bo contact card' })).toBeInTheDocument()
  await click('Undo')
  expect(await screen.findByRole('article', { name: 'Ana contact card' })).toBeInTheDocument()
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.getByText('Bo').closest('[aria-hidden="true"]')).not.toBeNull()
})
