import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { toast, dismissToast, Toaster, ToastDock, useToastHeight, type ToastHandle } from '@/ui'
import { getToast } from '@/ui/toastStore'
import { setToastSuppressed } from '@/ui/toast'
import { readFileSync } from 'node:fs'

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, transformTemplate: _tt, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props}>{children}</div> },
}))
beforeEach(() => { vi.useFakeTimers(); while (getToast()) dismissToast() })
afterEach(() => {
  cleanup(); while (getToast()) dismissToast()
  setToastSuppressed(false); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers()
})

it('dismisses queued and active handles by identity, with unknown/stale ids harmless', () => {
  render(<Toaster />)
  let first!: ToastHandle, second!: ToastHandle, third!: ToastHandle
  act(() => { first = toast('First'); second = toast('Second'); third = toast('Third', { priority: 'high' }) })
  expect(first.id).not.toBe(second.id)
  act(() => { dismissToast(first.id); second.dismiss(); dismissToast(-1) })
  expect(screen.getByRole('status')).toHaveTextContent('Third')
  act(() => third.dismiss())
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  act(() => { toast('Unrelated'); third.dismiss() })
  expect(screen.getByRole('status')).toHaveTextContent('Unrelated')
})

it('shows high priorities newest first, then resumes the exact remaining time and low FIFO', () => {
  render(<Toaster />)
  act(() => toast('Original', { duration: 1000 }))
  act(() => vi.advanceTimersByTime(400))
  act(() => {
    toast('High A', { priority: 'high', duration: 100 })
    toast('Low A', { duration: 100 })
    toast('High B', { priority: 'high', duration: 100 })
    toast('Low B', { duration: 100 })
  })
  for (const message of ['High B', 'High A']) {
    expect(screen.getByRole('status')).toHaveTextContent(message)
    act(() => vi.advanceTimersByTime(100))
  }
  expect(screen.getByRole('status')).toHaveTextContent('Original')
  act(() => vi.advanceTimersByTime(599))
  expect(screen.getByRole('status')).toHaveTextContent('Original')
  act(() => vi.advanceTimersByTime(1))
  for (const message of ['Low A', 'Low B']) {
    expect(screen.getByRole('status')).toHaveTextContent(message)
    act(() => vi.advanceTimersByTime(100))
  }
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('updates a queued handle in place and resets the visible duration when updated', () => {
  render(<Toaster />)
  let handle!: ToastHandle
  act(() => { handle = toast('Old', { duration: 1000 }); toast('Urgent', { priority: 'high' }); handle.update('Updated') })
  expect(screen.getByRole('status')).toHaveTextContent('Urgent')
  act(() => dismissToast())
  expect(screen.getByRole('status')).toHaveTextContent('Updated')
  act(() => vi.advanceTimersByTime(900))
  act(() => handle.update('Again', { duration: 2000 }))
  act(() => vi.advanceTimersByTime(1999))
  expect(screen.getByRole('status')).toHaveTextContent('Again')
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  act(() => handle.update('Cannot resurrect'))
  expect(screen.queryByText('Cannot resurrect')).not.toBeInTheDocument()
})

it.each([false, true])('checks validity at click time (valid=%s)', valid => {
  const action = vi.fn()
  let allowed = true
  const validUntil = vi.fn(() => allowed)
  render(<Toaster />)
  act(() => toast('Moved', { validUntil, action: { label: 'Undo', onClick: action } }))
  expect(validUntil).not.toHaveBeenCalled()
  allowed = valid
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(validUntil).toHaveBeenCalledOnce()
  expect(action).toHaveBeenCalledTimes(valid ? 1 : 0)
  if (!valid) {
    expect(screen.getByRole('status')).toHaveTextContent('This can no longer be undone')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  }
})

it('uses the latest dock, restores the previous dock, and falls back on unmount', () => {
  render(<Toaster />)
  act(() => toast('Recovery'))
  const first = render(<ToastDock data-testid="first" />)
  expect(within(screen.getByTestId('first')).getByRole('status')).toHaveTextContent('Recovery')
  const second = render(<ToastDock data-testid="second" />)
  expect(screen.getByTestId('first')).toBeEmptyDOMElement()
  expect(within(screen.getByTestId('second')).getByRole('status')).toHaveTextContent('Recovery')
  expect(screen.getByRole('status')).not.toHaveClass('fixed')
  second.unmount()
  expect(within(screen.getByTestId('first')).getByRole('status')).toHaveTextContent('Recovery')
  first.unmount()
  expect(screen.getByRole('status')).toHaveClass('fixed')
})

it('publishes growing measured heights and leaves the dock in normal flow', () => {
  let resize!: () => void
  let height = 60
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height } as DOMRect))
  function Height() { return <output data-testid="height">{useToastHeight()}</output> }
  render(<><ToastDock data-testid="dock" /><Toaster /><Height /></>)
  act(() => toast('A'.repeat(500), { action: { label: 'Undo', onClick: vi.fn() } }))
  expect(screen.getByTestId('height')).toHaveTextContent('60')
  act(() => { height = 98; resize() })
  expect(screen.getByTestId('height')).toHaveTextContent('98')
  expect(screen.getByTestId('dock')).toHaveStyle({ minHeight: '44px', height: 'auto', flexShrink: '0' })
  expect(screen.getByRole('button')).toHaveClass('whitespace-nowrap', 'shrink-0', 'hit-44')
  const css = readFileSync('src/ui/layout.css', 'utf8')
  expect(css).toContain('-webkit-line-clamp: 3')
  expect(css).toContain('overflow-wrap: anywhere')
  act(() => setToastSuppressed(true))
  expect(screen.getByTestId('height')).toHaveTextContent('0')
  act(() => { setToastSuppressed(false); dismissToast() })
  expect(screen.getByTestId('height')).toHaveTextContent('0')
})
