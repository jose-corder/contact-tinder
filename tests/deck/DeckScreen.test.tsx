// Audit #3: persistent Undo now belongs to the top bar.
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { applySwipe } from '@/domain/taxonomy'
import type { Contact, Pass } from '@/domain/types'
import DeckScreen from '@/features/deck/DeckScreen'
import { setFollowUpEnabled } from '@/ui/theme'
import { dismissDeckCoaches } from './helpers'
import * as feedback from '@/ui/toast'
import * as deckPersistence from '@/hooks/deckSession'

vi.mock('framer-motion', async (original) => {
  const actual = await original<typeof import('framer-motion')>()
  return { ...actual, animate: (value: { set: (next: number) => void }, next: number) => {
    value.set(next)
    return Object.assign(Promise.resolve(), { stop: () => {} })
  } }
})

const contact = (id: string, displayName: string): Contact => ({ id, displayName, phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] })
const seed = () => repo.upsertContacts([contact('a', 'Ana'), contact('b', 'Bo'), contact('c', 'Cy')])
const show = (pass: Pass = 'triage') => render(<StrictMode><MemoryRouter><DeckScreen pass={pass} /></MemoryRouter></StrictMode>)
async function action(label: string) {
  await screen.findByRole('button', { name: label })
  await waitFor(() => expect(screen.getByRole('button', { name: label })).toBeEnabled())
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: label })) })
}

// These tests exercise the raw deck; the post-swipe type sheet has its own test file.
beforeEach(async () => { await repo.resetAll(); setFollowUpEnabled(false); dismissDeckCoaches(); feedback.dismissToast() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('DeckScreen', () => {
  it('saves Work optimistically, advances the counter and restores the decision on undo', async () => {
    await seed()
    show()
    expect(await screen.findByText('0 / 3')).toBeInTheDocument()
    await action('Work')
    await waitFor(async () => expect((await repo.getDecision('a')).bucket).toBe('work'))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    await action('Undo')
    await waitFor(() => expect(screen.getByText('0 / 3')).toBeInTheDocument())
    expect((await repo.getDecision('a')).bucket).toBeUndefined()
    expect(screen.getByRole('article', { name: 'Ana contact card' })).toBeInTheDocument()
  })

  it('cycles a skip to the end, removes the second skip, and undoes without duplicating it', async () => {
    await seed()
    show()
    await action('Skip')
    await waitFor(() => expect(screen.getByRole('article', { name: 'Bo contact card' })).toBeInTheDocument())
    expect(screen.getByText('0 / 3')).toBeInTheDocument()
    await action('Work')
    await action('Personal')
    await waitFor(() => expect(screen.getByRole('article', { name: 'Ana contact card' })).toBeInTheDocument())
    await action('Skip')
    expect(await screen.findByText('Triage done.')).toBeInTheDocument()
    expect((await repo.getDecision('a')).skips.triage).toBe(2)
    expect(await screen.findByText('1 skipped twice · find them under Review → Unsorted')).toBeInTheDocument()
    // Audit #27: session completion includes the exhausted skip.
    expect(screen.getByText('This session: 3 of 3')).toBeInTheDocument()
    await action('Undo')
    expect(await screen.findByText('2 / 3')).toBeInTheDocument()
    expect((await repo.getDecision('a')).skips.triage).toBe(1)
    await action('Undo')
    expect(await screen.findByText('1 / 3')).toBeInTheDocument()
  })

  it('undoes a first skip without inflating the queue', async () => {
    await seed()
    show()
    await action('Skip')
    await action('Undo')
    await waitFor(() => expect(screen.getByRole('article', { name: 'Ana contact card' })).toBeInTheDocument())
    expect(screen.getByText('0 / 3')).toBeInTheDocument()
    expect((await repo.getDecision('a')).skips.triage).toBe(0)
  })

  it('keeps chip and tag edits on the draft until a swipe, and ignores shortcuts in the input', async () => {
    await seed()
    await repo.saveDecision(applySwipe(await repo.getDecision('a'), 'triage', 'right'))
    show('work')
    await action('Client')
    expect(screen.getByText('0 / 1')).toBeInTheDocument()
    expect((await repo.getDecision('a')).workTypes).toEqual([])
    fireEvent.keyDown(window, { key: 't' })
    const input = screen.getByRole('textbox', { name: 'Custom tag' })
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: ' Dinner ' } })
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    expect((await repo.getDecision('a')).workStatus).toBeUndefined()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'dinner' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: '2' })
    await action('Current')
    expect(await screen.findByText('Work sorted.')).toBeInTheDocument()
    const decision = await repo.getDecision('a')
    expect(decision.workTypes).toEqual(['client', 'vendor'])
    expect(decision.customTags).toEqual(['dinner'])
    fireEvent.keyDown(window, { key: 'z' })
    expect(await screen.findByRole('button', { name: 'Current' })).toBeInTheDocument()
    expect((await repo.getDecision('a')).workTypes).toEqual([])
  })

  it('rolls back a failed save and keeps the card available to retry', async () => {
    await seed()
    vi.spyOn(repo, 'saveDecision').mockRejectedValueOnce(new Error('Storage full'))
    show()
    await action('Work')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByText('0 / 3')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Ana contact card' })).toBeInTheDocument()
    await action('Work')
    await waitFor(async () => expect((await repo.getDecision('a')).bucket).toBe('work'))
  })

  it('advances before persistence resolves and serializes the next decision', async () => {
    await seed()
    let finish!: () => void
    // Finding #6: delay before the atomic contact/version-check transaction.
    const original = deckPersistence.saveDeckDecision
    vi.spyOn(deckPersistence, 'saveDeckDecision').mockImplementationOnce(async (decision, options) => {
      await new Promise<void>((resolve) => { finish = resolve })
      await original(decision, options)
    })
    show()
    await action('Work')
    expect(await screen.findByRole('article', { name: 'Bo contact card' })).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Work' })).toBeDisabled()
    expect((await repo.getDecision('a')).bucket).toBeUndefined()
    await act(async () => { finish() })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Work' })).toBeEnabled())
    expect((await repo.getDecision('a')).bucket).toBe('work')
  })

  it('returns the only contact after its first skip and finishes after its second', async () => {
    await repo.upsertContacts([contact('a', 'Ana')])
    show()
    await action('Skip')
    await waitFor(async () => expect((await repo.getDecision('a')).skips.triage).toBe(1))
    expect(screen.getByText('0 / 1')).toBeInTheDocument()
    await action('Skip')
    expect(await screen.findByText('Triage done.')).toBeInTheDocument()
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
  })

  it('distinguishes an empty database from a completed pass', async () => {
    const view = show()
    expect(await screen.findByText('No contacts yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Import contacts' })).toHaveAttribute('href', '/import')
    view.unmount()
    await seed()
    show('work')
    expect(await screen.findByText('Work sorted.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Sort triage contacts' })).toBeInTheDocument()
  })

  it('reloads the local queue when the pass changes', async () => {
    await seed()
    const view = show()
    await action('Work')
    await screen.findByRole('button', { name: 'Undo' })
    view.rerender(<MemoryRouter><DeckScreen pass="work" /></MemoryRouter>)
    expect(await screen.findByText('0 / 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    await act(async () => {})
  })
})


it.each([['Delete', 'delete'], ['Work', 'work'], ['Personal', 'personal'], ['Skip', 'default']] as const)('announces %s once, with the right tone and a working toast Undo', async (label, tone) => {
  await seed()
  const notify = vi.spyOn(feedback, 'toast')
  show()
  render(<feedback.Toaster />)
  await action(label)
  await waitFor(() => expect(notify).toHaveBeenCalledWith('Ana → ' + label, expect.objectContaining({ tone, action: { label: 'Undo', onClick: expect.any(Function) } })))
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  expect(screen.getByRole('status')).toHaveTextContent('Ana → ' + label)
  // Audit #3/#5: header Undo coexists with the toast action.
  await act(async () => { fireEvent.click(screen.getByRole('status').querySelector('button')!) })
  expect(await screen.findByRole('article', { name: 'Ana contact card' })).toBeInTheDocument()
  expect((await repo.getDecision('a')).bucket).toBeUndefined()
  expect((await repo.getDecision('a')).skips.triage).toBe(0)
})

it('keeps the toast undo current after more than one decision', async () => {
  await seed()
  const notify = vi.spyOn(feedback, 'toast')
  show()
  await action('Work')
  await action('Personal')
  await waitFor(() => expect(notify).toHaveBeenCalledTimes(2))
  await act(async () => { notify.mock.lastCall?.[1]?.action?.onClick() })
  await waitFor(() => expect(screen.getByRole('article', { name: 'Bo contact card' })).toBeInTheDocument())
  expect((await repo.getDecision('a')).bucket).toBe('work')
  expect((await repo.getDecision('b')).bucket).toBeUndefined()
})

it('does not reload contacts or recount the database on each swipe', async () => {
  await seed()
  const load = vi.spyOn(repo, 'deckContacts'), count = vi.spyOn(repo, 'counts')
  show()
  await screen.findByRole('article', { name: 'Ana contact card' })
  const loads = load.mock.calls.length, counts = count.mock.calls.length
  await action('Work')
  await action('Delete')
  expect(load).toHaveBeenCalledTimes(loads)
  expect(count).toHaveBeenCalledTimes(counts)
})

it('shows a new pass coach and consumes its dismissal tap without flipping', async () => {
  await seed()
  window.localStorage.removeItem('ct.coach.triage')
  show()
  expect(await screen.findByRole('complementary', { name: 'Swipe guide' })).toBeInTheDocument()
  // Audit #17: explicit coach dismissal leaves card controls usable.
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(window.localStorage.getItem('ct.coach.triage')).toBe('seen')
})


it.each([
  ['work', 'Old', 'work'], ['work', 'Current', 'work'], ['work', 'Potential', 'work'],
  ['personal', 'Ex', 'personal'], ['personal', 'Friend', 'personal'], ['personal', 'Family', 'personal'],
] as const)('announces the %s pass outcome %s using the given name', async (pass, label, tone) => {
  await repo.upsertContacts([{ ...contact('a', 'Santos, Maria'), givenName: 'Maria Elena' }])
  await repo.saveDecision(applySwipe(await repo.getDecision('a'), 'triage', pass === 'work' ? 'right' : 'up'))
  const notify = vi.spyOn(feedback, 'toast')
  show(pass)
  await action(label)
  await waitFor(() => expect(notify).toHaveBeenCalledWith('Maria → ' + label, expect.objectContaining({ tone })))
})
