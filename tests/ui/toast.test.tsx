import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { dismissToast, setToastBottom, setToastSuppressed, toast, Toaster } from '@/ui/toast'

// Motion exit frames are independent of the store's dismissal timer.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props}>{children}</div> },
}))

beforeEach(() => { vi.useFakeTimers(); dismissToast(); setToastSuppressed(false) })
afterEach(() => { cleanup(); dismissToast(); setToastSuppressed(false); setToastBottom(null); vi.useRealTimers() })

it('retains a toast issued before React mounts', () => {
  toast('Ready to work offline')
  render(<Toaster />)
  expect(screen.getByRole('status')).toHaveTextContent('Ready to work offline')
})

it('runs an action and dismisses the toast', () => {
  const reload = vi.fn()
  render(<Toaster />)
  act(() => toast('A new version is ready', { action: { label: 'Reload', onClick: reload }, duration: 10000 }))
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
  expect(reload).toHaveBeenCalledOnce()
  expect(screen.queryByText('A new version is ready')).not.toBeInTheDocument()
})

it('auto-dismisses at the configured duration', () => {
  render(<Toaster />)
  act(() => toast('Saved', { duration: 10000 }))
  act(() => vi.advanceTimersByTime(9999))
  expect(screen.getByText('Saved')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByText('Saved')).not.toBeInTheDocument()
})

it('cancels a replaced toast timer', () => {
  render(<Toaster />)
  act(() => toast('Old', { duration: 1000 }))
  act(() => vi.advanceTimersByTime(500))
  act(() => toast('New', { duration: 2000 }))
  act(() => vi.advanceTimersByTime(500))
  expect(screen.getByText('New')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1500))
  expect(screen.queryByText('New')).not.toBeInTheDocument()
})

it('preserves a new toast created by an action', () => {
  render(<Toaster />)
  act(() => toast('Undo?', { action: { label: 'Undo', onClick: () => toast('Undone') } }))
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(screen.getByText('Undone')).toBeInTheDocument()
})

it('reads a live root placement token and clears it back to the safe-area fallback', () => {
  render(<Toaster />)
  act(() => setToastBottom(144))
  expect(document.documentElement.style.getPropertyValue('--toast-bottom')).toBe('144px')
  expect(screen.getByRole('status').style.bottom).toBe('var(--toast-bottom, calc(env(safe-area-inset-bottom) + 88px))')
  setToastBottom(null)
  expect(document.documentElement.style.getPropertyValue('--toast-bottom')).toBe('')
})

it('pauses the remaining timeout for hover and focus independently', () => {
  render(<Toaster />)
  act(() => toast('Moved', { duration: 2000, action: { label: 'Undo', onClick: vi.fn() } }))
  act(() => vi.advanceTimersByTime(500))
  const message = screen.getByText('Moved').parentElement!
  const action = screen.getByRole('button', { name: 'Undo' })
  fireEvent.mouseEnter(message)
  fireEvent.focus(action)
  act(() => vi.advanceTimersByTime(10000))
  fireEvent.mouseLeave(message)
  act(() => vi.advanceTimersByTime(10000))
  expect(screen.getByText('Moved')).toBeInTheDocument()
  fireEvent.blur(action, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(1499))
  expect(screen.getByText('Moved')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByText('Moved')).not.toBeInTheDocument()
})

it('queues a fresh toast and discards one that is six seconds old', () => {
  render(<Toaster />)
  act(() => { setToastSuppressed(true); toast('Queued') })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(5999))
  act(() => setToastSuppressed(false))
  expect(screen.getByText('Queued')).toBeInTheDocument()
  act(() => { setToastSuppressed(true); toast('Expired') })
  act(() => vi.advanceTimersByTime(6000))
  act(() => setToastSuppressed(false))
  expect(screen.queryByText('Expired')).not.toBeInTheDocument()
})

it('suppresses toasts for modal dialogs outside Sheet as well', async () => {
  render(<Toaster />)
  act(() => toast('Saved'))
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  await act(async () => { document.body.append(dialog) })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await act(async () => { dialog.remove() })
  expect(screen.getByRole('status')).toHaveTextContent('Saved')
})
