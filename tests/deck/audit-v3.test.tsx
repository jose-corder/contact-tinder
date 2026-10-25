import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as repo from '@/db/repo'
import type { Contact } from '@/domain/types'
import { emptyDecision } from '@/domain/types'
import DeckScreen from '@/features/deck/DeckScreen'
import { SwipeCard } from '@/features/deck/SwipeCard'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import { SKIP_HELP } from '@/features/deck/KeyboardLegend'
import { metadata } from '@/import/metadata'
import { setFollowUpEnabled } from '@/ui/theme'
import { dismissToast, Toaster, toast } from '@/ui/toast'
import { getToast } from '@/ui/toastStore'
import { dismissDeckCoaches } from './helpers'

vi.mock('framer-motion', async original => {
  const actual = await original<typeof import('framer-motion')>()
  return { ...actual, animate: (value: { set: (next: number) => void }, next: number) => {
    value.set(next)
    return Object.assign(Promise.resolve(), { stop: () => {} })
  } }
})
const contact: Contact = { id: 'a', displayName: 'Ana', title: 'Director', org: 'Studio', phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] }
beforeEach(async () => {
  await repo.resetAll(); await repo.upsertContacts([contact]); dismissDeckCoaches(); setFollowUpEnabled(false)
  while (getToast()) dismissToast(getToast()!.id)
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.fontSize = ''
  while (getToast()) dismissToast(getToast()!.id)
})
const show = () => render(<MemoryRouter><DeckScreen pass="triage" /><Toaster /></MemoryRouter>)
async function click(name: string) {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  await act(async () => fireEvent.click(button))
}

it.each(['shortHeight', 'keyboardOpen', 'largeText'] as const)('#14/#38 enables the scrolling deck for %s independently', async flag => {
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal('innerHeight', flag === 'shortHeight' ? 390 : 844)
  vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { height: flag === 'shortHeight' ? 390 : flag === 'keyboardOpen' ? 600 : 844, offsetTop: 0 }))
  document.documentElement.style.fontSize = flag === 'largeText' ? '20px' : '16px'
  show(); await screen.findByRole('article')
  expect(document.querySelector('.scroll-fallback')).toHaveAttribute('data-constrained', 'true')
  expect(document.querySelector('[data-deck-stage]')).toHaveAttribute('data-scroll-stage')
  expect(document.querySelector('[data-deck-stage] > .z-10')).toHaveStyle({ touchAction: 'pan-y' })
  await click('+ tag')
  expect(screen.getByRole('textbox')).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Work' })).toBeEnabled()
  const css = readFileSync('src/features/deck/deck.css', 'utf8')
  expect(css).toContain('min-height: 240px')
  expect(css).toMatch(/\.deck-toolbar \{ position: sticky; bottom:/)
  expect(css).toContain('env(safe-area-inset-bottom)')
})

it.each([[320, 568, false], [390, 844, false], [844, 390, true]] as const)('#14/#38 keeps the dock between tags and actions at %sx%s', async (width, height, constrained) => {
  vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height); vi.stubGlobal('visualViewport', undefined)
  show(); await screen.findByRole('article')
  expect(document.querySelector('.scroll-fallback')).toHaveAttribute('data-constrained', String(constrained))
  const dock = document.querySelector('.deck-feedback-dock')!
  expect(dock.previousElementSibling).toHaveClass('deck-chip-region')
  expect(dock.nextElementSibling).toHaveClass('deck-toolbar')
  expect(dock).toHaveStyle({ height: 'auto', flexShrink: '0' })
})

it('#16 opens touch Skip help without deciding, blocks shortcuts, and dismisses with Got it', async () => {
  show(); await click('About Skip')
  const dialog = screen.getByRole('dialog', { name: 'About Skip' })
  expect(dialog).toHaveTextContent(SKIP_HELP)
  fireEvent.keyDown(window, { key: 'ArrowDown' })
  expect((await repo.getDecision('a')).skips.triage).toBe(0)
  await click('Got it')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await click('Keyboard shortcuts')
  expect(screen.getByText(/Tap the Skip caption for help/)).toHaveTextContent(SKIP_HELP)
  await click('Skip')
  expect((await repo.getDecision('a')).skips.triage).toBe(1)
})

it.each([679, 680])('#39 gives names and role/org two lines only at roomy stage height %s', height => {
  render(<SwipeCard contact={contact} stageHeight={height} />)
  const name = screen.getByRole('heading', { name: 'Ana' })
  const role = screen.getByText('Director · Studio')
  for (const node of [name, role]) {
    expect(node).toHaveClass(height >= 680 ? 'line-clamp-2' : 'truncate')
    expect(node).not.toHaveClass(height >= 680 ? 'truncate' : 'line-clamp-2')
  }
})

it.each([true, false])('#40 renders five upcoming names and live session counts only with desktop fine pointer: %s', async desktop => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: desktop && query === '(min-width: 1024px) and (pointer: fine)', addEventListener() {}, removeEventListener() {} }))
  await repo.upsertContacts(['Bo', 'Cy', 'Dee', 'Eve', 'Flo', 'Gia'].map(name => ({ ...contact, id: name, displayName: name })))
  show(); await screen.findByRole('article', { name: 'Ana contact card' })
  const context = screen.queryByRole('complementary', { name: 'Deck context' })
  if (!desktop) { expect(context).not.toBeInTheDocument(); return }
  expect(within(context!).getAllByRole('listitem').map(node => node.textContent)).toEqual(['Bo', 'Cy', 'Dee', 'Eve', 'Flo'])
  expect(within(context!).queryByRole('button')).not.toBeInTheDocument()
  expect(context).toHaveTextContent('Classified0Remaining7')
  await click('Work')
  expect(within(context!).getAllByRole('listitem').map(node => node.textContent)).toEqual(['Cy', 'Dee', 'Eve', 'Flo', 'Gia'])
  expect(context).toHaveTextContent('Classified1Remaining6')
  expect(context).toHaveTextContent(SKIP_HELP)
})

it('#42/#46 reads decoded secondary source fields once and exposes both original records', () => {
  const merged = { ...contact, raw: 'BEGIN:VCARD\nVERSION:3.0\nURL:https://example.com\nEND:VCARD' }
  metadata(merged).rawCards = ['BEGIN:VCARD\nVERSION:3.0\nURL:https://example.com\nBDAY:19900102\nNOTE:Secondary\\nNote\nEND:VCARD']
  render(<SwipeCard contact={merged} />)
  fireEvent.click(screen.getByRole('button', { name: 'View all fields' }))
  const fields = screen.getByLabelText('All contact fields')
  expect(fields.querySelector('.field-list')).not.toBeNull()
  expect(within(fields).getAllByRole('link', { name: 'https://example.com' })).toHaveLength(1)
  expect(within(fields).getByText('Secondary Note')).toBeInTheDocument()
  expect(fields).toHaveTextContent('Birthday')
  expect(fields).toHaveTextContent('1990')
  expect(within(fields).getByText('Original record 1')).toBeInTheDocument()
  expect(within(fields).getByText('Original record 2')).toBeInTheDocument()
})

it('#53 gives Later the persisted promise and leaves an untouched Personal contact unfinished', async () => {
  const decision = { ...emptyDecision('a'), bucket: 'personal' as const }
  await repo.saveDecision(decision)
  const close = vi.fn()
  render(<FollowUpSheet target={{ contact, decision }} onClose={close} />)
  expect(screen.getByRole('button', { name: 'Later' })).toHaveAttribute('aria-description', 'Keep in Personal as Other if types are selected; otherwise finish later')
  expect(screen.getByText('A type without a relation is saved as Other')).toBeVisible()
  await click('Later')
  expect(close).toHaveBeenCalledWith(undefined)
  expect((await repo.getDecision('a')).relation).toBeUndefined()
  expect(await repo.deckContacts('personal')).toHaveLength(1)
})

it('#57 retains another owner’s recovery through deck mount, swipe, Undo and unmount', async () => {
  await repo.upsertContacts([{ ...contact, id: 'b', displayName: 'Bo' }])
  const outside = toast('Restore recovery', { priority: 'high', duration: 600000 })
  const view = show(); await screen.findByRole('article', { name: 'Ana contact card' })
  expect(getToast()?.id).toBe(outside.id)
  await click('Work')
  await waitFor(() => expect(getToast()?.validUntil).toBeTypeOf('function'))
  const swipeNotice = getToast()!
  expect(swipeNotice.validUntil?.()).toBe(true)
  let newer!: ReturnType<typeof toast>
  act(() => { newer = toast('New recovery', { priority: 'high' }) })
  await click('Undo')
  expect(getToast()?.id).toBe(newer.id)
  await waitFor(() => expect(swipeNotice.validUntil?.()).toBe(false))
  view.unmount()
  expect(getToast()?.id).toBe(newer.id)
  act(() => newer.dismiss())
  expect(getToast()?.id).toBe(outside.id)
})

it('#57 measures wrapped dock content and keeps its action in flow below the rail', async () => {
  vi.stubGlobal('innerWidth', 320)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { width: 280, height: this.getAttribute('role') === 'status' ? 96 : 0 } as DOMRect
  })
  show(); await screen.findByRole('article')
  act(() => { toast('LongUnbrokenName'.repeat(25), { priority: 'high', action: { label: 'Recover', onClick: vi.fn() } }) })
  await waitFor(() => expect(document.querySelector('.deck-feedback-dock')).toHaveAttribute('data-toast-height', '96'))
  expect(document.querySelector('.deck-feedback-dock')).toContainElement(screen.getByRole('button', { name: 'Recover' }))
  expect(document.querySelector('.deck-toolbar')).not.toContainElement(screen.getByRole('button', { name: 'Recover' }))
})
