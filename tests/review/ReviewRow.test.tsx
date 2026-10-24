import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDecision, resetAll, saveDecision, upsertContacts } from '@/db/repo'
import ReviewRow from '@/features/review/ReviewRow'
import { dismissToast, Toaster } from '@/ui/toast'
import { row } from '../export/fixtures'

// jsdom has no layout or pointer capture. Drive the drag callbacks at the motion boundary.
vi.mock('framer-motion', async (importOriginal) => {
  const original = await importOriginal<typeof import('framer-motion')>()
  return { ...original, motion: { ...original.motion, div: ({ children, drag, onDragStart, onDragEnd, className }: {
    children?: ReactNode; drag?: string; className?: string
    onDragStart?: () => void; onDragEnd?: (event: unknown, info: { velocity: { x: number } }) => void
  }) => <div className={className} data-testid={drag ? 'swipe-row' : undefined} data-drag={drag}
    onPointerMove={() => onDragStart?.()} onPointerUp={() => onDragEnd?.({}, { velocity: { x: -500 } })}>{children}</div> } }
})

beforeEach(resetAll)
afterEach(() => { cleanup(); dismissToast() })

describe('Review row actions', () => {
  it('reveals other buckets with a left swipe, moves, and restores the complete decision with Undo', async () => {
    const original = row('Maria', { bucket: 'work', workStatus: 'current', workTypes: ['vendor'], customTags: ['vip'] })
    await upsertContacts([original.contact])
    await saveDecision(original.decision)
    const onOpen = vi.fn()
    render(<><ul><ReviewRow row={original} selecting={false} selected={false} onOpen={onOpen} onToggle={vi.fn()} onLongPress={vi.fn()} /></ul><Toaster /></>)
    expect(screen.queryByRole('button', { name: 'Move Maria to Personal' })).not.toBeInTheDocument()
    const swipe = screen.getByTestId('swipe-row')
    expect(swipe).toHaveAttribute('data-drag', 'x')
    fireEvent.pointerMove(swipe)
    fireEvent.pointerUp(swipe)
    fireEvent.click(screen.getByRole('button', { name: 'View Maria' }))
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Move Maria to Personal' }))
    await waitFor(async () => expect((await getDecision('Maria')).bucket).toBe('personal'))
    expect(await screen.findByText('Maria → Personal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect(await getDecision('Maria')).toEqual(original.decision))
  })

  it('supports keyboard reveal and hides quick actions during multi-select', () => {
    const props = { row: row('Bo', { bucket: 'work' }), selecting: false, selected: false, onOpen: vi.fn(), onToggle: vi.fn(), onLongPress: vi.fn() }
    const { rerender } = render(<ul><ReviewRow {...props} /></ul>)
    fireEvent.keyDown(screen.getByRole('button', { name: 'View Bo' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('button', { name: 'Move Bo to Delete' })).toBeInTheDocument()
    rerender(<ul><ReviewRow {...props} selecting /></ul>)
    expect(screen.queryByRole('button', { name: 'Move Bo to Delete' })).not.toBeInTheDocument()
  })
})
