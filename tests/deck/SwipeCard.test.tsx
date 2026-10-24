import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Contact } from '@/domain/types'
import { SwipeCard } from '@/features/deck/SwipeCard'

const contact: Contact = {
  id: 'a', displayName: 'Ana Example', title: 'Director', org: 'Studio',
  phones: [{ value: '111' }, { value: '222' }, { value: '333' }], emails: [{ value: 'ana@example.com' }],
  notes: 'A complete note.', raw: '', source: 'vcf', importedAt: Date.UTC(2024, 6, 1), rev: '2025-06-01', phoneKeys: [], emailKeys: [],
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('flips to all fields and back, with source and date metadata', () => {
  render(<SwipeCard contact={contact} />)
  expect(screen.queryByText('333')).not.toBeInTheDocument()
  expect(screen.getByText('iCloud')).toBeInTheDocument()
  expect(screen.getByText('added 2024')).toBeInTheDocument()
  expect(screen.getByText('edited 2025')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('article'))
  expect(screen.getByText('333')).toBeInTheDocument()
  expect(screen.getByText('Director')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(screen.queryByText('333')).not.toBeInTheDocument()
})

it('copies a long-pressed number, suppresses the flip, and dismisses the toast', async () => {
  vi.useFakeTimers()
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<SwipeCard contact={contact} />)
  const phone = screen.getByText('111')
  fireEvent.pointerDown(phone)
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(writeText).toHaveBeenCalledExactlyOnceWith('111')
  expect(screen.getByRole('status')).toHaveTextContent('Copied')
  fireEvent.pointerUp(phone)
  fireEvent.click(phone)
  expect(screen.queryByRole('button', { name: 'back' })).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1200))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('cancels copying when the pointer is released early', async () => {
  vi.useFakeTimers()
  const writeText = vi.fn()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<SwipeCard contact={contact} />)
  fireEvent.pointerDown(screen.getByText('111'))
  fireEvent.pointerUp(screen.getByText('111'))
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(writeText).not.toHaveBeenCalled()
})
