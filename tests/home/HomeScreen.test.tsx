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
    <Route path="/deck/triage" element={<p>Triage destination</p>} /></Routes></MemoryRouter>)
}

describe('Home dashboard', () => {
  it('counts completed decisions, with skipped contacts still incomplete', () => {
    const result = homeProgress(rows)
    expect(result.percent).toBe(50)
    expect(result.completed).toBe(3)
    expect(result.steps.map(({ done, total }) => [done, total])).toEqual([[5, 6], [1, 2], [1, 2]])
    expect(result.current?.pass).toBe('triage')
    expect(homeProgress([]).percent).toBe(0)
    expect(homeProgress([rows[0]]).percent).toBe(100)
    expect(homeProgress([rows[0], rows[3]]).current?.pass).toBe('work')
  })
  it('renders the percentage, stepper math and count links, and resumes the first incomplete pass', async () => {
    await upsertContacts(rows.map(({ contact }) => contact))
    await saveDecisions(rows.map(({ decision }) => decision))
    open()
    const ring = await screen.findByRole('progressbar', { name: 'Overall completion' })
    expect(ring).toHaveAttribute('aria-valuenow', '50')
    expect(within(ring).getByText('50%')).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: 'Sorting passes' })).getAllByRole('listitem')
    expect(steps[0]).toHaveAttribute('aria-current', 'step')
    expect(within(steps[0]).getByText('5 / 6')).toBeInTheDocument()
    expect(within(steps[1]).getByText('1 / 2')).toBeInTheDocument()
    expect(within(steps[2]).getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Work 2' })).toHaveAttribute('href', '/review?tab=work')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByText('Triage destination')
    expect((await getDecision('triage')).skips.triage).toBe(0)
    expect((await getDecision('work-done')).workStatus).toBe('current')
  })
  it('offers import and a three-step introduction for an empty address book', async () => {
    open()
    expect(await screen.findByRole('button', { name: 'Import contacts' })).toBeInTheDocument()
    expect(screen.getByText('Room for the right people.')).toBeInTheDocument()
    expect(screen.getByText('Swipe into Work, Personal, or Delete.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
