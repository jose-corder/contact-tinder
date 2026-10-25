import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Sheet, SheetFooterActions } from '@/ui'
import { dismissToast, setToastSuppressed, toast, Toaster } from '@/ui/toast'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/index.css', 'utf8')

afterEach(() => { cleanup(); vi.unstubAllGlobals(); dismissToast(); setToastSuppressed(false) })

it('keeps the title and footer outside the only body scroller', () => {
  const primary = vi.fn()
  const secondary = vi.fn()
  render(<Sheet open title="Details" onClose={() => {}}
    footer={<SheetFooterActions secondary={{ label: 'Later', onClick: secondary }} primary={{ label: 'Done', onClick: primary }} />}>
    <p>Contact details</p>
  </Sheet>)
  const dialog = screen.getByRole('dialog')
  const body = screen.getByText('Contact details').parentElement!
  expect(body).toHaveClass('min-h-0', 'overflow-y-auto', 'overscroll-contain')
  expect(body.style.scrollPaddingBottom).toBe('96px')
  expect(body).not.toContainElement(screen.getByRole('heading'))
  expect(body).not.toContainElement(screen.getByRole('button', { name: 'Done' }))
  expect(dialog.querySelectorAll('.overflow-y-auto')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Done' }).closest('.sheet-footer')?.parentElement).toBe(dialog)
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  expect(primary).toHaveBeenCalledOnce()
  expect(secondary).toHaveBeenCalledOnce()
  // Legacy consumers still declaring body overflow are flattened during migration.
  expect(css).toContain('.sheet-body :where(.overflow-y-auto, .overflow-y-scroll) { overflow-y: visible; max-height: none; }')
})

it('keeps loading and disabled footer actions unavailable', () => {
  render(<SheetFooterActions secondary={{ label: 'Later', onClick: vi.fn(), disabled: true }} primary={{ label: 'Done', onClick: vi.fn(), loading: true }} />)
  expect(screen.getByRole('button', { name: 'Later' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-busy', 'true')
})

it('shrinks max height and raises the footer on visualViewport resize, then restores it', () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  const remove = vi.spyOn(viewport, 'removeEventListener')
  const { unmount } = render(<Sheet open onClose={() => {}} footer={<button>Done</button>}>Body</Sheet>)
  const dialog = screen.getByRole('dialog')
  expect(dialog.style.maxHeight).toBe('min(var(--sheet-max-height, 85vh), 776px)')
  act(() => { viewport.height = 500; viewport.dispatchEvent(new Event('resize')) })
  expect(dialog.style.maxHeight).toBe('min(var(--sheet-max-height, 85vh), 476px)')
  expect(dialog.style.bottom).toBe('300px')
  act(() => { viewport.offsetTop = 30; viewport.dispatchEvent(new Event('scroll')) })
  expect(dialog.style.bottom).toBe('270px')
  act(() => { viewport.height = 800; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize')) })
  expect(dialog.style.maxHeight).toBe('min(var(--sheet-max-height, 85vh), 776px)')
  expect(dialog.style.bottom).toBe('0px')
  unmount()
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
})

it('suppresses feedback until the last sheet unmounts', async () => {
  render(<Toaster />)
  const first = render(<Sheet open onClose={() => {}}>First</Sheet>)
  const second = render(<Sheet open onClose={() => {}}>Second</Sheet>)
  act(() => toast('Saved'))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  first.unmount()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  second.unmount()
  await act(async () => {})
  await waitFor(() => expect(within(screen.getByRole('status')).getByText('Saved')).toBeVisible())
})

it('updates the viewport cap on rotation without the visualViewport API', () => {
  vi.stubGlobal('visualViewport', undefined)
  vi.stubGlobal('innerHeight', 800)
  render(<Sheet open onClose={() => {}}>Body</Sheet>)
  expect(screen.getByRole('dialog').style.maxHeight).toContain('776px')
  act(() => { vi.stubGlobal('innerHeight', 400); window.dispatchEvent(new Event('resize')) })
  expect(screen.getByRole('dialog').style.maxHeight).toContain('376px')
  expect(screen.getByRole('dialog').style.bottom).toBe('0px')
})
