import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as repo from '@/db/repo'
import { emptyDecision, type Contact, type Pass } from '@/domain/types'
import { nextUnfinishedPass, toggleDeckType } from '@/domain/decks'
import { useDeck } from '@/hooks/useDeck'
import DeckScreen from '@/features/deck/DeckScreen'
import { DeckCoach, COACH_COPY } from '@/features/deck/DeckCoach'
import { DeckEnd } from '@/features/deck/DeckEnd'
import { SwipeCard } from '@/features/deck/SwipeCard'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import { formatContactDate } from '@/features/deck/CardFront'
import { ActionBar } from '@/features/deck/ActionBar'
import { setFollowUpEnabled } from '@/ui/theme'
import { Toaster, dismissToast, toast } from '@/ui/toast'
import { dismissDeckCoaches } from './helpers'

vi.mock('framer-motion', async (original) => {
  const actual = await original<typeof import('framer-motion')>()
  return { ...actual, animate: (value: { set: (next: number) => void }, next: number) => {
    value.set(next)
    return Object.assign(Promise.resolve(), { stop: () => {} })
  } }
})
const contact: Contact = {
  id: 'a', displayName: 'Maria Gomez', org: 'Acme Corp', title: 'Director', source: 'vcf', raw: '',
  phones: [{ value: '111', type: 'CELL' }, { value: '222' }, { value: '333' }],
  emails: [{ value: 'maria@example.com', type: 'INTERNET' }, { value: 'extra@example.com' }],
  phoneKeys: [], emailKeys: [], importedAt: Date.UTC(2024, 6, 1), rev: '2025-06-01T12:00:00Z',
}
beforeEach(async () => { await repo.resetAll(); dismissDeckCoaches(); setFollowUpEnabled(false) })
afterEach(() => { cleanup(); dismissToast(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('#2 observes the stage and selects compact below 680, retaining complete essential rows', async () => {
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal('innerHeight', 844)
  let resize!: (height: number) => void
  vi.stubGlobal('ResizeObserver', class {
    callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) { this.callback = callback }
    observe(node: HTMLElement) {
      if (node.hasAttribute('data-deck-stage')) {
        resize = (height) => this.callback([{ contentRect: { width: 280, height } } as ResizeObserverEntry], this as unknown as ResizeObserver)
        resize(250)
      }
    }
    disconnect() {}
  })
  await repo.upsertContacts([contact])
  render(<MemoryRouter><DeckScreen pass="triage" /></MemoryRouter>)
  const card = await screen.findByRole('article')
  expect(card).toHaveAttribute('data-layout', 'compact')
  expect(screen.getByText('111')).toBeVisible()
  expect(screen.getByText('maria@example.com')).toBeVisible()
  expect(screen.getByText('Director · Acme Corp')).toBeVisible()
  expect(screen.getByText('+3 more')).toBeInTheDocument()
  expect(screen.queryByText('222')).not.toBeInTheDocument()
  act(() => resize(680))
  expect(card).toHaveAttribute('data-layout', 'tall')
  expect(screen.getByText('222')).toBeVisible()
  expect(card.querySelector('.deck-front-scroll')).toHaveClass('justify-center')
})

it('#3 has four equal columns and complete 12px captions with 48px circles at 320', () => {
  vi.stubGlobal('innerWidth', 320)
  render(<ActionBar pass="personal" triggerSwipe={() => {}} />)
  const actions = screen.getByLabelText('Swipe actions')
  expect(actions).toHaveClass('grid-cols-4')
  expect(actions.children).toHaveLength(4)
  for (const caption of actions.querySelectorAll('.deck-action-caption')) expect(caption.className).not.toMatch(/truncate|ellipsis/)
  const css = readFileSync('src/features/deck/deck.css', 'utf8')
  expect(actions.querySelector('.deck-action-caption')).toHaveClass('t-meta') // #39 shared type role
  expect(css).toContain('@media (max-width: 359px)')
  expect(css).toContain('width: 48px !important; height: 48px !important;')
  expect(screen.getByRole('button', { name: 'Skip' })).toHaveAttribute('aria-description', 'Comes back at the end; twice = Unsorted')
})

it('#2 removes a whole row when the measured viewport is five pixels too short', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = this.classList.contains('deck-front-scroll') ? 218
      : this.parentElement?.classList.contains('deck-front-content') ? 70 : 0
    return { height, width: 246 } as DOMRect
  })
  render(<SwipeCard contact={{ ...contact, notes: 'Extra note' }} stageHeight={323} />)
  expect(document.querySelectorAll('.deck-field-row')).toHaveLength(4)
  expect(screen.queryByText('Extra note')).not.toBeInTheDocument()
  expect(screen.getByText('+2 more')).toBeInTheDocument()
})

it('#3/#13 keeps the toolbar mounted and focused, moves Undo into the header, and announces each new card', async () => {
  await repo.upsertContacts([{ ...contact, displayName: 'Ana' }, { ...contact, id: 'b' }])
  const view = render(<MemoryRouter><DeckScreen pass="triage" /></MemoryRouter>)
  const work = await screen.findByRole('button', { name: 'Work' })
  work.focus()
  await act(async () => { fireEvent.click(work) })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  expect(screen.getByRole('button', { name: 'Work' })).toBe(work)
  expect(work).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Undo' }).closest('header')).not.toBeNull()
  expect(view.container.querySelector('[aria-live="polite"]')).toHaveTextContent('Card 2 of 2: Maria Gomez, Acme Corp')
})

it('#4/#5 fixes the footer outside the one body scroller and owns Undo inside the sheet', async () => {
  await repo.upsertContacts([contact])
  setFollowUpEnabled(true)
  render(<MemoryRouter><DeckScreen pass="triage" /><Toaster /></MemoryRouter>)
  const work = await screen.findByRole('button', { name: 'Work' })
  await act(async () => { fireEvent.click(work) })
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('Moved to Work')
  const later = within(dialog).getByRole('button', { name: 'Later' })
  expect(later.closest('.sheet-footer')).toHaveClass('shrink-0')
  expect(later.closest('.sheet-body')).toBeNull()
  expect(later).toHaveAttribute('aria-description', 'Keep in Work; finish details in the Work deck')
  act(() => toast('Queued system notice'))
  expect(document.querySelector('[role="status"][aria-hidden="true"]')).not.toBeNull()
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' })) })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect((await repo.getDecision('a')).bucket).toBeUndefined()
})

it.each(['acquaintance', 'neighbor', 'service'] as const)('#7 automatically assigns Other for Personal type %s', (type) => {
  const draft = { ...emptyDecision('a'), bucket: 'personal' as const }
  expect(toggleDeckType(draft, 'personal', type).relation).toBe('other')
  expect(toggleDeckType({ ...draft, relation: 'family' }, 'personal', type).relation).toBe('family')
})

it('#7 saves a type-only Personal sheet and omits the contact from the later deck', async () => {
  await repo.upsertContacts([contact])
  const decision = { ...emptyDecision('a'), bucket: 'personal' as const }
  await repo.saveDecision(decision)
  const close = vi.fn()
  render(<FollowUpSheet target={{ contact, decision }} onClose={close} />)
  expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Neighbor' }))
  expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect((await repo.getDecision('a')).relation).toBe('other')
  expect(await repo.deckContacts('personal')).toHaveLength(0)
})

it('#7 completes and undoes a type-only Personal deck decision', async () => {
  await repo.upsertContacts([contact])
  await repo.saveDecision({ ...emptyDecision('a'), bucket: 'personal' })
  render(<MemoryRouter><DeckScreen pass="personal" /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Service provider' }))
  expect(screen.getByRole('button', { name: 'Relation: Other' })).toHaveAttribute('aria-pressed', 'true')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Done' })) })
  expect(await screen.findByText('Personal sorted.')).toBeInTheDocument()
  expect((await repo.getDecision('a')).relation).toBe('other')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })) })
  await screen.findByRole('article')
  expect((await repo.getDecision('a')).relation).toBeUndefined()
})

it.each(['triage', 'work', 'personal'] as Pass[])('#17 uses compact, pass-specific coach copy: %s', (pass) => {
  render(<DeckCoach pass={pass} dismiss={() => {}} />)
  expect(screen.getByText(COACH_COPY[pass])).toBeInTheDocument()
  expect(screen.getByRole('complementary')).toHaveClass('bottom-0', 'max-h-[200px]')
})

it('#13/#15/#19 exposes friendly labels, accessible copying, full labels and localized dates', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<SwipeCard contact={contact} stageHeight={300} />)
  fireEvent.click(screen.getByRole('button', { name: 'View all fields' }))
  const details = screen.getByLabelText('All contact fields')
  expect(details).toHaveAttribute('tabindex', '0')
  expect(details).toHaveTextContent('Mobile')
  expect(details).toHaveTextContent('Email')
  expect(details).not.toHaveTextContent('CELL')
  expect(details).not.toHaveTextContent(contact.rev!)
  expect(details).toHaveTextContent(formatContactDate(contact.rev)!)
  expect(details).toHaveTextContent('vCard file')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy Mobile' })) })
  expect(writeText).toHaveBeenCalledWith('111')
  expect(screen.getByRole('button', { name: 'Back' })).not.toHaveAttribute('tabindex', '-1')
  expect(formatContactDate('invalid')).toBeUndefined()
})

it('#27 skips empty and completed passes, including Other completions', async () => {
  await repo.upsertContacts([contact])
  await repo.saveDecision({ ...emptyDecision('a'), bucket: 'personal' })
  expect(nextUnfinishedPass('triage', await repo.counts())).toBe('personal')
  await repo.saveDecision({ ...emptyDecision('a'), bucket: 'personal', relation: 'other' })
  expect(nextUnfinishedPass('triage', await repo.counts())).toBeUndefined()
})

it('#27 distinguishes the scoped session from all Work contacts', async () => {
  await repo.upsertContacts([contact, { ...contact, id: 'b' }])
  await repo.saveDecisions(['a', 'b'].map((id) => ({ ...emptyDecision(id), bucket: 'work' as const })))
  await repo.setMeta('deckScope', { pass: 'work', ids: ['a'], createdAt: Date.now() })
  const { result } = renderHook(() => useDeck('work'))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.sessionTotal).toBe(1)
  await act(async () => { await result.current.swipe('right') })
  render(<MemoryRouter><DeckEnd pass="work" sessionIds={result.current.sessionIds} skippedIds={result.current.skippedIds} retrySkipped={result.current.retrySkipped} scoped={result.current.scoped} /></MemoryRouter>)
  expect(await screen.findByText('All Work contacts: 2')).toBeInTheDocument()
  expect(screen.getByText('This session: 1 of 1 classified')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sort work contacts' })).toBeInTheDocument()
})
