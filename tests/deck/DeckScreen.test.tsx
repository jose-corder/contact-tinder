import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { applySwipe } from '@/domain/taxonomy'
import type { Contact, Pass } from '@/domain/types'
import DeckScreen from '@/features/deck/DeckScreen'

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

beforeEach(async () => { await repo.resetAll() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('DeckScreen', () => {
  it('saves Work optimistically, advances the counter and restores the decision on undo', async () => {
    await seed()
    show()
    expect(await screen.findByText('0 / 3')).toBeInTheDocument()
    await action('Work')
    await waitFor(async () => expect((await repo.getDecision('a')).bucket).toBe('work'))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    await action('undo')
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
    await action('undo')
    expect(await screen.findByText('2 / 3')).toBeInTheDocument()
    expect((await repo.getDecision('a')).skips.triage).toBe(1)
    await action('undo')
    expect(await screen.findByText('1 / 3')).toBeInTheDocument()
  })

  it('undoes a first skip without inflating the queue', async () => {
    await seed()
    show()
    await action('Skip')
    await action('undo')
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
    const original = repo.saveDecision
    vi.spyOn(repo, 'saveDecision').mockImplementationOnce(async (decision) => {
      await new Promise<void>((resolve) => { finish = resolve })
      await original(decision)
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
    expect(screen.getByRole('button', { name: 'Sort personal contacts' })).toBeInTheDocument()
  })

  it('reloads the local queue when the pass changes', async () => {
    await seed()
    const view = show()
    await action('Work')
    await screen.findByRole('button', { name: 'undo' })
    view.rerender(<MemoryRouter><DeckScreen pass="work" /></MemoryRouter>)
    expect(await screen.findByText('0 / 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'undo' })).not.toBeInTheDocument()
    await act(async () => {})
  })
})
