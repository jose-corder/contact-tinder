import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { useScreenContext } from '@/ui'

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.sessionStorage.clear() })
type Snapshot = { search: string; filters: string[]; selectedId: string; focusId?: string }
const snapshot: Snapshot = { search: 'Maria', filters: ['current'], selectedId: 'contact-1', focusId: 'contact-1' }
const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter initialEntries={['/review']}>{children}</MemoryRouter>

it('round trips arbitrary JSON across remounts and isolates keys', () => {
  const first = renderHook(() => useScreenContext<Snapshot>('review'), { wrapper })
  act(() => first.result.current.save(snapshot))
  expect(first.result.current.restore()).toEqual(snapshot)
  expect(first.result.current.restore()).not.toBe(snapshot)
  first.unmount()
  const second = renderHook(() => useScreenContext<Snapshot>('review'), { wrapper })
  expect(second.result.current.restore()).toEqual(snapshot)
  const other = renderHook(() => useScreenContext('other'), { wrapper })
  expect(other.result.current.restore()).toBeNull()
})

it('isolates pathnames, including identical caller keys', () => {
  const first = renderHook(() => useScreenContext('shared'), { wrapper })
  act(() => first.result.current.save({ data: [1, true, null] }))
  const second = renderHook(() => useScreenContext('shared'), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/deck/work']}>{children}</MemoryRouter>,
  })
  expect(second.result.current.restore()).toBeNull()
})

it('tolerates corrupt snapshots and unavailable sessionStorage', () => {
  window.sessionStorage.setItem('ct.screen.["/review","review"]', '{bad')
  const { result } = renderHook(() => useScreenContext('review'), { wrapper })
  expect(result.current.restore()).toBeNull()
  vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('Disabled') })
  expect(() => result.current.save(snapshot)).not.toThrow()
  expect(result.current.restore()).toBeNull()
})

it.each([true, false])('restores semantic focus on Back, falling back to main if removed (present=%s)', async present => {
  function Review() {
    const { save, restore } = useScreenContext<Snapshot>('review')
    const navigate = useNavigate()
    return <main tabIndex={-1}><p>{restore()?.search}</p>
      {present && <button id="contact-1">Maria</button>}
      <button onClick={() => { save(snapshot); navigate('/deck') }}>Sort</button></main>
  }
  function Deck() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Back</button> }
  render(<MemoryRouter initialEntries={['/review']}><Routes>
    <Route path="/review" element={<Review />} /><Route path="/deck" element={<Deck />} />
  </Routes></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Sort' }))
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  await waitFor(() => expect(present ? screen.getByRole('button', { name: 'Maria' }) : screen.getByRole('main')).toHaveFocus())
  expect(screen.getByRole('main')).toHaveTextContent('Maria')
})
