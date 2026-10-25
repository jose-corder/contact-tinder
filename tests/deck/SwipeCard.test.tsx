import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Contact } from '@/domain/types'
import { SwipeCard } from '@/features/deck/SwipeCard'
import * as feedback from '@/ui/toast'

const contact: Contact = {
  id: 'a', displayName: 'Ana Example', title: 'Director', org: 'Studio',
  phones: [{ value: '111' }, { value: '222' }, { value: '333' }], emails: [{ value: 'ana@example.com' }],
  notes: 'A complete note.', raw: '', source: 'vcf', importedAt: Date.UTC(2024, 6, 1), rev: '2025-06-01', phoneKeys: [], emailKeys: [],
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); feedback.dismissToast() })

it('flips to all fields and back, with source and date metadata', () => {
  render(<SwipeCard contact={contact} />)
  expect(screen.queryByText('333')).not.toBeInTheDocument()
  // Audit #15/#19: truthful provenance and localized dates.
  expect(screen.getByText(/vCard file.*Added/)).toBeInTheDocument()
  expect(screen.queryByText(/iCloud/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('article'))
  expect(screen.getByText('333')).toBeInTheDocument()
  expect(screen.getByText('Director')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '333' })).toHaveAttribute('href', 'tel:333')
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.queryByRole('link', { name: '333' })).not.toBeInTheDocument()
})

it('copies a long-pressed number, suppresses the flip, and uses the shared toast', async () => {
  vi.useFakeTimers()
  const notify = vi.spyOn(feedback, 'toast')
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<SwipeCard contact={contact} />)
  const phone = screen.getByText('111')
  fireEvent.pointerDown(phone)
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(writeText).toHaveBeenCalledExactlyOnceWith('111')
  expect(notify).toHaveBeenCalledExactlyOnceWith('Number copied')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  fireEvent.pointerUp(phone)
  fireEvent.click(phone)
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
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


it.each([[5, true], [6, false], [20, false]] as const)('discriminates a %s px movement on the detail button from a tap', (distance, flips) => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  render(<SwipeCard contact={contact} />)
  const button = screen.getByRole('button', { name: 'View all fields' })
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 })
  fireEvent.pointerMove(button, { clientX: 10 + distance, clientY: 10 })
  fireEvent.pointerUp(button, { clientX: 10 + distance, clientY: 10 })
  fireEvent.click(button)
  expect(!!screen.queryByRole('button', { name: 'Back' })).toBe(flips)
})

it('cancels a long press when a drag starts and keeps the front free of telephone links', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('PointerEvent', MouseEvent)
  const writeText = vi.fn()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<SwipeCard contact={contact} />)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  const phone = screen.getByText('111')
  fireEvent.pointerDown(phone, { clientX: 0, clientY: 0 })
  fireEvent.pointerMove(phone, { clientX: 6, clientY: 0 })
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(writeText).not.toHaveBeenCalled()
})
