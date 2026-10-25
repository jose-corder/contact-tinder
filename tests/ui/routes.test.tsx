import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { AnimatedRoutes } from '@/App'

vi.mock('@/features/home/HomeScreen', () => ({ default: () => <h1>Home screen</h1> }))
vi.mock('@/features/home/SettingsScreen', () => ({ default: () => <h1>Settings screen</h1> }))
vi.mock('@/features/import/ImportScreen', () => ({ default: () => <main><h1>Import screen</h1></main> }))
vi.mock('@/features/deck/DeckScreen', () => ({ default: () => <h1>Deck screen</h1> }))
vi.mock('@/features/review/ReviewScreen', () => ({ default: () => <h1>Review screen</h1> }))
vi.mock('@/features/export/ExportScreen', () => ({ default: () => <h1>Export screen</h1> }))

function Example() {
  const navigate = useNavigate()
  return <><nav>
    <button onClick={() => navigate('/review')}>Review</button>
    <button onClick={() => navigate('/import')}>Import</button>
    <button onClick={() => navigate('/deck/work')}>Work</button>
    <button onClick={() => navigate(-1)}>Back</button>
  </nav><AnimatedRoutes /></>
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation((options: ScrollToOptions | number) => {
    if (typeof options === 'object') {
      Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: options.top ?? 0 })
    }
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('updates titles and focuses the arriving main without waiting for the outgoing page', async () => {
  render(<MemoryRouter><Example /></MemoryRouter>)
  expect(document.title).toBe('Home · Contacts.')
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  expect(document.title).toBe('Review · Contacts.')
  const main = screen.getByRole('main')
  expect(main).toHaveFocus()
  expect(main).toHaveAttribute('tabindex', '-1')
  expect(main).toHaveTextContent('Review screen')
  expect(document.querySelectorAll('#main-content')).toHaveLength(1)
  const outgoing = screen.getByText('Home screen').closest('main')!
  expect(outgoing).toHaveAttribute('inert')
  expect(outgoing).toHaveAttribute('aria-hidden', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Import' }))
  expect(document.title).toBe('Import · Contacts.')
  expect(screen.getByRole('main')).toHaveFocus()
  expect(screen.getByRole('main')).toHaveTextContent('Import screen')
  expect(screen.getByRole('main').parentElement?.tagName).toBe('DIV')
  await waitFor(() => expect(screen.queryByText('Home screen')).not.toBeInTheDocument())
})

it('restores the prior entry scroll on POP without moving keyboard focus', async () => {
  render(<MemoryRouter><Example /></MemoryRouter>)
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)) })
  window.scrollTo({ top: 340 })
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)) })
  expect(window.scrollY).toBe(0)
  window.scrollTo({ top: 120 })
  const back = screen.getByRole('button', { name: 'Back' })
  back.focus()
  fireEvent.click(back)
  expect(document.title).toBe('Home · Contacts.')
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 340, left: 0, behavior: 'instant' })
  expect(back).toHaveFocus()
})

it('names deck passes in the document title', () => {
  render(<MemoryRouter><Example /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Work' }))
  expect(document.title).toBe('Work · Contacts.')
  expect(screen.getByRole('main')).toHaveFocus()
})
