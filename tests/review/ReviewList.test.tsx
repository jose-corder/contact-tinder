import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReviewList from '@/features/review/ReviewList'
import { row } from '../export/fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Review paging', () => {
  it('mounts 60 of 5,000 contacts, then one more page per sentinel intersection', () => {
    const observers: Array<{ callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn()
      observe = vi.fn()
      constructor(callback: IntersectionObserverCallback) { observers.push({ callback, disconnect: this.disconnect }) }
    })
    const rows = Array.from({ length: 5000 }, (_, i) => row(`Contact ${String(i).padStart(4, '0')}`, { bucket: 'work' }))
    render(<ReviewList rows={rows} selecting={false} selected={new Set()} onOpen={vi.fn()} onToggle={vi.fn()} onLongPress={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^View Contact/ })).toHaveLength(60)
    expect(screen.getByLabelText('Names beginning with C')).toBeInTheDocument()
    act(() => observers[0].callback([{ isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver))
    expect(screen.getAllByRole('button', { name: /^View Contact/ })).toHaveLength(60)
    act(() => observers[0].callback([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver))
    expect(screen.getAllByRole('button', { name: /^View Contact/ })).toHaveLength(120)
    expect(observers[0].disconnect).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'View Contact 0000' })).toBeInTheDocument()
  }, 20000) // 5,000-row render is slow under full-suite load

  it('offers a load button when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<ReviewList rows={Array.from({ length: 61 }, (_, i) => row(`Person ${i}`))} selecting={false} selected={new Set()}
      onOpen={vi.fn()} onToggle={vi.fn()} onLongPress={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more contacts' }))
    expect(screen.getAllByRole('button', { name: /^View Person/ })).toHaveLength(61)
    expect(screen.queryByRole('button', { name: 'Load more contacts' })).not.toBeInTheDocument()
  })
})
