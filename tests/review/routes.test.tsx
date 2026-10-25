import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { AnimatedRoutes } from '@/App'
import { resetAll, saveDecisions, upsertContacts } from '@/db/repo'
import { row } from '../export/fixtures'

beforeEach(async () => { await resetAll(); window.sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.sessionStorage.clear() })
function History() {
  const navigate = useNavigate()
  const location = useLocation()
  return <><button onClick={() => navigate(-1)}>Browser Back</button><output>{location.pathname}</output></>
}

it('#44/#31: consecutive arrows keep focus through the real App routes and preserve scroll', async () => {
  render(<MemoryRouter initialEntries={['/review?tab=delete']}><AnimatedRoutes /></MemoryRouter>)
  await screen.findByText('Nothing here yet.')
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(320)
  const scroll = vi.spyOn(window, 'scrollTo')
  const first = screen.getByRole('tab', { name: /^Delete/ })
  first.focus()
  for (const name of ['Work', 'Personal', 'Unsorted', 'Delete']) {
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    const tab = screen.getByRole('tab', { name: new RegExp('^' + name) })
    expect(tab).toHaveFocus()
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(scroll).toHaveBeenLastCalledWith({ top: 320, behavior: 'instant' })
  }
  expect(screen.getByRole('tab', { name: /^Delete/ })).toBe(first)
})

it('#12/#44: POP from a real deck restores the tab, saved pagination and scroll', async () => {
  const rows = Array.from({ length: 65 }, (_, i) => row('Person ' + String(i).padStart(2, '0'), { bucket: 'work' }))
  await upsertContacts(rows.map(r => r.contact)); await saveDecisions(rows.map(r => r.decision))
  let top = 0
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => top)
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation((...args: unknown[]) => {
    const options = args[0] as ScrollToOptions
    if (typeof options === 'object') top = options.top ?? 0
  })
  render(<MemoryRouter initialEntries={['/review?tab=work']}><History /><AnimatedRoutes /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Load more contacts' }))
  expect(screen.getAllByRole('button', { name: /^View Person/ })).toHaveLength(65)
  act(() => { top = 1300; window.dispatchEvent(new Event('scroll')) })
  fireEvent.click(screen.getByRole('button', { name: 'Sort again' }))
  // Sort again writes deckScope to IndexedDB before navigating; allow for slow CI runners.
  await screen.findByText('/deck/work', {}, { timeout: 10000 })
  await waitFor(() => expect(screen.queryByRole('tab', { name: /^Work/ })).not.toBeInTheDocument())
  // #12: shared screen context replaces local tab-only persistence.
  expect(JSON.parse(window.sessionStorage.getItem('ct.screen.["/review","review"]')!)).toMatchObject({ tab: 'work', top: 1300, limit: 120 })
  fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }))
  await waitFor(() => expect(screen.getAllByRole('button', { name: /^View Person/ })).toHaveLength(65))
  expect(screen.getByRole('tab', { name: /^Work/ })).toHaveAttribute('aria-selected', 'true')
  await waitFor(() => expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ top: 1300, behavior: 'instant' })))
})

it('#12: unavailable session storage does not break tab navigation', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private') })
  render(<MemoryRouter initialEntries={['/review']}><AnimatedRoutes /></MemoryRouter>)
  fireEvent.click(screen.getByRole('tab', { name: /^Personal/ }))
  expect(screen.getByRole('tab', { name: /^Personal/ })).toHaveFocus()
})

it('#12: Back restores search, all filters, selected identity and scroll after a row deck visit', async () => {
  const rows = [row('Maria', { bucket: 'work', workStatus: 'current', workTypes: ['client'], customTags: ['vip'] }),
    row('Other', { bucket: 'work', workStatus: 'old' })]
  await upsertContacts(rows.map(r => r.contact)); await saveDecisions(rows.map(r => r.decision))
  let top = 0
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => top)
  vi.spyOn(window, 'scrollTo').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'object') top = (args[0] as ScrollToOptions).top ?? 0
  })
  render(<MemoryRouter initialEntries={['/review?tab=work']}><History /><AnimatedRoutes /></MemoryRouter>)
  await screen.findByRole('button', { name: 'View Maria, Work, Current, Client, vip' })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Maria' } })
  fireEvent.click(screen.getByRole('radio', { name: 'Current' }))
  fireEvent.click(screen.getByRole('button', { name: 'Client' }))
  fireEvent.click(screen.getByRole('button', { name: 'vip' }))
  act(() => { top = 420; window.dispatchEvent(new Event('scroll')) })
  fireEvent.click(screen.getByRole('button', { name: 'View Maria, Work, Current, Client, vip' }))
  fireEvent.click(screen.getByRole('button', { name: 'Jump to deck' }))
  await screen.findByText('/deck/work', {}, { timeout: 10000 })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(JSON.parse(window.sessionStorage.getItem('ct.screen.["/review","review"]')!)).toMatchObject({
    tab: 'work', search: 'Maria', segment: 'current', types: ['client'], tags: ['vip'], selectedId: 'Maria', focusId: 'review-row-Maria', top: 420,
  })
  fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }))
  const restored = await screen.findByRole('button', { name: 'View Maria, Work, Current, Client, vip' })
  expect(screen.getByRole('searchbox')).toHaveValue('Maria')
  expect(screen.getByRole('radio', { name: 'Current' })).toHaveAttribute('aria-checked', 'true')
  for (const name of ['Client', 'vip']) expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
  await waitFor(() => expect(restored).toHaveFocus())
  expect(top).toBe(420)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
