import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { dismissToast, toast, Toaster } from '@/ui/toast'

// Motion exit frames are independent of the store's dismissal timer.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props}>{children}</div> },
}))

beforeEach(() => { vi.useFakeTimers(); dismissToast() })
afterEach(() => { cleanup(); dismissToast(); vi.useRealTimers() })

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
