import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as repo from '@/db/repo'
import HomeScreen from '@/features/home/HomeScreen'
import { row } from '../export/fixtures'

beforeEach(repo.resetAll)
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const model = "Delete marks a list. Your phone's contacts stay unchanged."
const before = (a: Element, b: Element) => expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
function open() { return render(<MemoryRouter><HomeScreen /></MemoryRouter>) }

it('#8/#28: leads with model and Continue, then compact progress and linked counts', async () => {
  const rows = [row('A'), row('B', { bucket: 'delete' })]
  await repo.upsertContacts(rows.map(r => r.contact)); await repo.saveDecisions(rows.map(r => r.decision))
  open()
  const resume = await screen.findByRole('region', { name: 'Continue sorting' })
  before(screen.getByRole('heading', { name: 'Contacts.' }), screen.getByText(model))
  before(screen.getByText(model), resume)
  before(resume, screen.getByRole('region', { name: 'Sorting progress' }))
  before(screen.getByRole('region', { name: 'Sorting progress' }), screen.getByRole('navigation', { name: 'Contact counts' }))
  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  expect(screen.getByText('1 to go')).toBeInTheDocument()
  expect(screen.getByText("50% fully sorted.")).toBeInTheDocument()
  // #16: no redundant comparison when both counts agree.
  expect(screen.queryByText(/classified,.*fully sorted/)).not.toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveClass('h-[72px]', 'w-[72px]')
  expect(screen.queryByText(/contacts sorted/)).not.toBeInTheDocument()
  // Audit #40: CSS grid places counts beside resume from the lg (1024px) breakpoint.
  expect(resume.parentElement).toHaveClass('lg:grid-cols-2')
  expect(screen.getByRole('navigation', { name: 'Contact counts' })).toHaveClass('lg:col-start-2', 'lg:row-start-1')
  for (const tab of ['delete', 'work', 'personal', 'unsorted']) {
    expect(screen.getByRole('navigation', { name: 'Contact counts' }).querySelector('a[href="/review?tab=' + tab + '"]')).toBeInTheDocument()
  }
})

it('#8: retires the model after ten classified cards and persists across remount and unsorting', async () => {
  const rows = Array.from({ length: 10 }, (_, i) => row('Contact ' + i, i < 9 ? { bucket: 'delete' } : {}))
  await repo.upsertContacts(rows.map(r => r.contact)); await repo.saveDecisions(rows.map(r => r.decision))
  const view = open()
  expect(await screen.findByText(model)).toBeInTheDocument()
  await act(async () => { await repo.saveDecision({ ...rows[9].decision, bucket: 'work' }) })
  await waitFor(async () => expect(await repo.getMeta('homeModelSeen', false)).toBe(true))
  expect(screen.queryByText(model)).not.toBeInTheDocument()
  view.unmount()
  await repo.saveDecision(rows[9].decision)
  open()
  await screen.findByRole('button', { name: 'Continue' })
  expect(screen.queryByText(model)).not.toBeInTheDocument()
})

it('#24: shows a designed loader and a retryable database failure', async () => {
  let rejectRead!: (reason: Error) => void
  vi.spyOn(repo, 'allWithDecisions').mockImplementationOnce(() => new Promise((_, reject) => { rejectRead = reject }))
  open()
  expect(screen.getByRole('status', { name: 'Loading contacts' }).querySelector('.skeleton')).toBeInTheDocument()
  await waitFor(() => expect(rejectRead).toBeTypeOf('function'))
  act(() => rejectRead(new Error('Unavailable')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your contacts')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('button', { name: 'Import contacts' })).toBeInTheDocument()
})
