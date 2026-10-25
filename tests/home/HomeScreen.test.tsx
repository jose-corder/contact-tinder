import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { getDecision, resetAll, saveDecisions, upsertContacts } from '@/db/repo'
import HomeScreen from '@/features/home/HomeScreen'
import { homeProgress } from '@/features/home/progress'
import { row } from '../export/fixtures'

beforeEach(resetAll)
afterEach(cleanup)
const rows = [
  row('delete', { bucket: 'delete' }), row('work-done', { bucket: 'work', workStatus: 'current' }),
  row('personal-done', { bucket: 'personal', relation: 'friend' }), row('work-pending', { bucket: 'work' }),
  row('triage', { skips: { triage: 2, work: 0, personal: 0 } }), row('personal-pending', { bucket: 'personal' }),
]
function open() {
  render(<MemoryRouter><Routes><Route path="/" element={<HomeScreen />} />
    <Route path="/deck/triage" element={<p>Triage destination</p>} />
    <Route path="/deck/work" element={<p>Work destination</p>} /></Routes></MemoryRouter>)
}

describe('Home dashboard', () => {
  it('counts completed decisions, with skipped contacts still incomplete', () => {
    const result = homeProgress(rows)
    expect(result.percent).toBe(50)
    expect(result.completed).toBe(3)
    expect(result.steps.map(({ done, total }) => [done, total])).toEqual([[5, 6], [1, 2], [1, 2]])
    // Finding #23: skipped cards count as incomplete but do not block active decks.
    expect(result.current?.pass).toBe('work')
    expect(homeProgress([]).percent).toBe(0)
    expect(homeProgress([rows[0]]).percent).toBe(100)
    expect(homeProgress([rows[0], rows[3]]).current?.pass).toBe('work')
    const skippedWork = row('skipped-work', { bucket: 'work', skips: { triage: 0, work: 2, personal: 0 } })
    expect(homeProgress([rows[4], skippedWork, rows[5]]).current?.pass).toBe('personal')
    const finishedDecks = homeProgress([rows[4], skippedWork])
    expect(finishedDecks.current).toBeUndefined()
    expect(finishedDecks.percent).toBe(0)
    expect(finishedDecks.steps.map(({ done, total }) => [done, total])).toEqual([[1, 2], [0, 1], [0, 0]])
  })
  it('home_continue_respects_twice_skipped_cards', async () => {
    await upsertContacts(rows.map(({ contact }) => contact))
    await saveDecisions(rows.map(({ decision }) => decision))
    open()
    const ring = await screen.findByRole('progressbar', { name: 'Overall completion' })
    expect(ring).toHaveAttribute('aria-valuenow', '50')
    // #16: classification is only the first pass; the ring measures full completion.
    expect(ring).toHaveAttribute('aria-valuetext', '3 of 6 fully sorted')
    expect(screen.getByText('5 classified, 3 fully sorted')).toBeInTheDocument()
    expect(within(ring).getByText('50%')).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Sorting passes' })).getAllByRole('listitem')
    // Finding #23: Work is current even though Triage has a skipped card.
    expect(steps[0]).not.toHaveAttribute('aria-current')
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(within(steps[0]).getByText('5 / 6')).toBeInTheDocument()
    expect(within(steps[1]).getByText('1 / 2')).toBeInTheDocument()
    expect(within(steps[2]).getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Work 2' })).toHaveAttribute('href', '/review?tab=work')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Work destination')
    expect((await getDecision('triage')).skips.triage).toBe(2)
    expect((await getDecision('work-done')).workStatus).toBe('current')
  })
  it('offers import and a three-step introduction for an empty address book', async () => {
    open()
    expect(await screen.findByRole('button', { name: 'Import contacts' })).toBeInTheDocument()
    expect(screen.getByText('Room for the right people.')).toBeInTheDocument()
    expect(screen.getByText('Swipe into Work, Personal, or Delete.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
  it('home_continue_respects_twice_skipped_cards: only Retry skipped resets skips', async () => {
    const skipped = Array.from({ length: 7 }, (_, i) => row(`Skipped ${i}`, {
      skips: { triage: 2, work: 0, personal: 0 }, customTags: ['later'],
    }))
    await upsertContacts(skipped.map(({ contact }) => contact))
    await saveDecisions(skipped.map(({ decision }) => decision))
    open()
    expect(await screen.findByText('All decks done · 7 skipped waiting in Review')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getAllByRole('link', { name: 'Review' })[0]).toHaveAttribute('href', '/review?tab=unsorted')
    expect((await getDecision('Skipped 0')).skips.triage).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Retry skipped' }))
    await screen.findByText('Triage destination')
    for (const { contact } of skipped) {
      expect((await getDecision(contact.id)).skips.triage).toBe(0)
      expect((await getDecision(contact.id)).customTags).toEqual(['later'])
    }
  })
})
