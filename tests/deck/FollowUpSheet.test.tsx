import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as repo from '@/db/repo'
import { applySwipe } from '@/domain/taxonomy'
import { emptyDecision, type Contact } from '@/domain/types'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import { setFollowUpEnabled } from '@/ui/theme'

const contact: Contact = {
  id: 'a', displayName: 'Ana Ruiz', org: 'Acme', title: 'CFO', phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [],
}

beforeEach(async () => {
  await repo.resetAll()
  await repo.upsertContacts([contact])
  setFollowUpEnabled(true)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('FollowUpSheet', () => {
  it('saves status, type and a tag on Done for a work contact', async () => {
    const decision = applySwipe(emptyDecision('a'), 'triage', 'right')
    await repo.saveDecision(decision)
    const onClose = vi.fn()
    render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Current' }))
    fireEvent.click(screen.getByRole('button', { name: 'Client' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const saved = await repo.getDecision('a')
    expect(saved.workStatus).toBe('current')
    expect(saved.workTypes).toEqual(['client'])
    // Fully typed in triage, so it no longer belongs in the Work deck.
    expect((await repo.deckContacts('work')).length).toBe(0)
  })

  it('offers relation chips for a personal contact and discards changes on Later', async () => {
    const decision = applySwipe(emptyDecision('a'), 'triage', 'up')
    await repo.saveDecision(decision)
    const onClose = vi.fn()
    render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Family' }))
    fireEvent.click(screen.getByRole('button', { name: 'Neighbor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    // #16: explicit Discard is required for draft selections.
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledWith(undefined)
    const saved = await repo.getDecision('a')
    expect(saved.relation).toBeUndefined()
    expect(saved.personalTypes).toEqual([])
    expect((await repo.deckContacts('personal')).length).toBe(1)
  })

  it('opens Settings without silently changing the preference', () => {
    const decision = applySwipe(emptyDecision('a'), 'triage', 'right')
    const onClose = vi.fn()
    // Audit #4: the small Settings action replaces the opt-out sentence.
    const settings = vi.fn()
    render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} onSettings={settings} />)
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }))
    expect(settings).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })
})


it('focuses the first chip on keyboard open and Escape closes as Later without saving edits', async () => {
  const decision = applySwipe(emptyDecision('a'), 'triage', 'right')
  await repo.saveDecision(decision)
  const onClose = vi.fn()
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Old' })).toHaveFocus())
  fireEvent.click(screen.getByRole('button', { name: 'Current' }))
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Discard' })) // #16
  expect(onClose).toHaveBeenCalledExactlyOnceWith(undefined)
  expect((await repo.getDecision('a')).workStatus).toBeUndefined()
})
