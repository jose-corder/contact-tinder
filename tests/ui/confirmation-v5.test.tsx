import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Sheet, SheetConfirm } from '@/ui'
import RowSheet from '@/features/review/RowSheet'
import * as repo from '@/db/repo'
import { row } from '../export/fixtures'

beforeEach(repo.resetAll)
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.fontSize = '' })

it.each([false, true])('#63: initial heading focus, one polite announcement and nearest reveal (reduced=%s)', reduced => {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }))
  const scroll = vi.fn()
  vi.stubGlobal('HTMLElement', HTMLElement)
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  try {
    const view = render(<StrictMode><Sheet open onClose={() => {}}>
      <SheetConfirm initialFocus="heading" title="Review removal" body="Keep your address book."
        confirmLabel="Remove" cancelLabel="Cancel" onConfirm={() => {}} onCancel={() => {}} />
    </Sheet></StrictMode>)
    expect(screen.getByRole('heading', { name: 'Review removal' })).toHaveFocus()
    expect(scroll).toHaveBeenCalledOnce()
    expect(scroll.mock.instances[0]).toBe(screen.getByRole('heading', { name: 'Review removal' }))
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    expect(view.baseElement.querySelector('[aria-live="polite"]')).toHaveTextContent('Review removal')
  } finally { HTMLElement.prototype.scrollIntoView = original }
})

it.each([[320, 568, 240], [568, 320, 320]])('#63: actual RowSheet hands off focus, restores Remove, and exposes retry/error at %sx%s', async (width, height, visualHeight) => {
  vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height)
  vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { height: visualHeight, offsetTop: 0 }))
  document.documentElement.style.fontSize = '24px'
  const item = row('Long contact', { bucket: 'work' })
  item.contact.notes = 'Long notes. '.repeat(300)
  await repo.upsertContacts([item.contact])
  const close = vi.fn()
  render(<MemoryRouter><RowSheet row={item} onClose={close} /></MemoryRouter>)
  const body = screen.getByRole('dialog').querySelector<HTMLElement>('.sheet-body')!
  body.scrollTop = 0
  const original = HTMLElement.prototype.scrollIntoView
  const reveal = vi.fn()
  HTMLElement.prototype.scrollIntoView = reveal
  try {
    const trigger = screen.getByRole('button', { name: 'Remove from app' })
    trigger.focus(); fireEvent.keyDown(trigger, { key: 'Enter' }); fireEvent.click(trigger)
    const confirmation = screen.getByRole('group', { name: 'Remove from app?' })
    expect(confirmation).toContainElement(document.activeElement as HTMLElement)
    expect(screen.getByRole('button', { name: 'Cancel removal' })).toHaveFocus()
    expect(body).toContainElement(confirmation)
    expect(reveal).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
    expect(reveal.mock.instances[0]).toBe(screen.getByRole('button', { name: 'Cancel removal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel removal' }))
    await waitFor(() => expect(trigger).toHaveFocus())
    fireEvent.click(trigger)
    vi.spyOn(repo, 'deleteContacts').mockRejectedValueOnce(new Error('Disk full'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
    const error = await screen.findByRole('alert')
    const errorTarget = error.closest<HTMLElement>('[tabindex]')!
    expect(errorTarget.tabIndex).toBe(0)
    errorTarget.focus(); expect(errorTarget).toHaveFocus()
    expect(body).toContainElement(error)
    expect(screen.getByRole('button', { name: 'Confirm removal' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel removal' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  } finally { HTMLElement.prototype.scrollIntoView = original }
})
