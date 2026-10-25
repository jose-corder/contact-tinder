import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { RecoveryBar, recoveryStore, useRecoveryStore, type RecoveryEntry } from '@/ui'

const entry = (overrides: Partial<RecoveryEntry> = {}): RecoveryEntry => ({
  id: 'move-1', label: 'Maria moved to Work', at: Date.now(), onUndo: vi.fn(), onDismiss: vi.fn(), ...overrides,
})
beforeEach(() => { for (const item of recoveryStore.list()) recoveryStore.remove(item.id); sessionStorage.clear() })
afterEach(() => {
  cleanup()
  for (const item of recoveryStore.list()) recoveryStore.remove(item.id)
  vi.restoreAllMocks(); vi.useRealTimers()
})

it('adds, replaces by ID, removes and notifies all store consumers', () => {
  const first = renderHook(useRecoveryStore)
  const second = renderHook(useRecoveryStore)
  act(() => first.result.current.add(entry()))
  expect(second.result.current.list()).toHaveLength(1)
  act(() => second.result.current.add(entry({ label: 'Updated label' })))
  expect(first.result.current.list()).toHaveLength(1)
  expect(first.result.current.list()[0].label).toBe('Updated label')
  act(() => first.result.current.remove('move-1'))
  expect(second.result.current.list()).toEqual([])
})

it('expires at ttlMs, keeps other unexpired entries and defaults to ten minutes', async () => {
  vi.useFakeTimers()
  recoveryStore.add(entry({ ttlMs: 1000 }))
  recoveryStore.add(entry({ id: 'move-2', label: 'Other move' }))
  render(<RecoveryBar />)
  await act(async () => {})
  act(() => vi.advanceTimersByTime(999))
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(recoveryStore.list()[0].id).toBe('move-2')
  act(() => vi.advanceTimersByTime(599000))
  expect(recoveryStore.list()).toEqual([])
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(JSON.parse(sessionStorage.getItem('ct.recoveries.v1')!)).toEqual([])
})

it('persists metadata in tab storage and keeps callbacks across remounts and ten-second toast lifetimes', async () => {
  vi.useFakeTimers()
  const saved = entry()
  recoveryStore.add(saved)
  const first = render(<RecoveryBar />)
  await act(async () => {})
  first.unmount()
  act(() => vi.advanceTimersByTime(61000))
  const stored = JSON.parse(sessionStorage.getItem('ct.recoveries.v1')!)
  expect(stored).toEqual([{ id: saved.id, label: saved.label, at: saved.at, ttlMs: 600000 }])
  render(<RecoveryBar />)
  await act(async () => {})
  expect(screen.getByText('1 min ago')).toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })))
  expect(saved.onUndo).toHaveBeenCalledOnce()
  expect(recoveryStore.list()).toEqual([])
})

it('disables Undo with Changed since when the content guard resolves false', async () => {
  const saved = entry({ canUndo: vi.fn().mockResolvedValue(false) })
  render(<RecoveryBar entries={[saved]} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Changed since' })).toBeDisabled())
  fireEvent.click(screen.getByRole('button', { name: 'Changed since' }))
  expect(saved.onUndo).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(saved.onDismiss).toHaveBeenCalledOnce()
})

it('checks again at click time and never invokes a stale Undo', async () => {
  const canUndo = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false)
  const saved = entry({ canUndo })
  render(<RecoveryBar entries={[saved]} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })))
  expect(screen.getByRole('button', { name: 'Changed since' })).toBeDisabled()
  expect(saved.onUndo).not.toHaveBeenCalled()
  expect(canUndo).toHaveBeenCalledTimes(2)
})

it('retains a failed Undo for retry and prevents duplicate concurrent clicks', async () => {
  const onUndo = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValue(undefined)
  recoveryStore.add(entry({ onUndo }))
  render(<RecoveryBar />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  await act(async () => {
    const button = screen.getByRole('button', { name: 'Undo' })
    fireEvent.click(button); fireEvent.click(button)
  })
  expect(onUndo).toHaveBeenCalledOnce()
  expect(screen.getByRole('alert')).toHaveTextContent('Could not undo. Please try again.')
  expect(recoveryStore.list()).toHaveLength(1)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })))
  expect(onUndo).toHaveBeenCalledTimes(2)
  expect(recoveryStore.list()).toEqual([])
})

it('does not remove a recovery when the consumer reports an unsuccessful Undo', async () => {
  recoveryStore.add(entry({ onUndo: async () => false }))
  render(<RecoveryBar />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })))
  expect(recoveryStore.list()).toHaveLength(1)
})

it('keeps recoveries separate and dismisses only the selected row', async () => {
  recoveryStore.add(entry())
  recoveryStore.add(entry({ id: 'move-2', label: 'Rosa moved to Personal' }))
  render(<RecoveryBar />)
  const list = screen.getByRole('list', { name: 'Pending recoveries' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows[0]).toHaveAccessibleName('Maria moved to Work')
  await act(async () => fireEvent.click(within(rows[0]).getByRole('button', { name: 'Dismiss' })))
  expect(recoveryStore.list().map(item => item.id)).toEqual(['move-2'])
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(list.parentElement).not.toHaveClass('fixed')
})

it('keeps guard failures retryable and rechecks on returning to the tab', async () => {
  const canUndo = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(false)
  render(<RecoveryBar entries={[entry({ canUndo })]} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not check recovery')
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(screen.getByRole('button', { name: 'Changed since' })).toBeDisabled()
})

it('ignores an obsolete pending guard when an entry is replaced', async () => {
  let resolve!: (value: boolean) => void
  const old = entry({ canUndo: () => new Promise<boolean>(done => { resolve = done }) })
  const { rerender } = render(<RecoveryBar entries={[old]} />)
  const next = entry({ canUndo: async () => true })
  rerender(<RecoveryBar entries={[next]} />)
  await act(async () => resolve(false))
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
})

it('keeps in-memory recovery usable when sessionStorage rejects writes', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
  expect(() => recoveryStore.add(entry())).not.toThrow()
  expect(recoveryStore.list()).toHaveLength(1)
})

it.each([false, true])('settles an in-flight Undo after unmount without deleting a replacement (replace=%s)', async replace => {
  let resolve!: () => void
  recoveryStore.add(entry({ onUndo: () => new Promise<void>(done => { resolve = done }) }))
  const bar = render(<RecoveryBar />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  bar.unmount()
  if (replace) recoveryStore.add(entry({ label: 'New recovery' }))
  await act(async () => resolve())
  expect(recoveryStore.list()).toHaveLength(replace ? 1 : 0)
  if (replace) expect(recoveryStore.list()[0].label).toBe('New recovery')
})
