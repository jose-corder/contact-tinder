// Audit #41: literal pass titles come from taxonomy.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as repo from '@/db/repo'
import { emptyDecision, type Contact } from '@/domain/types'
import DeckScreen from '@/features/deck/DeckScreen'
import { DeckEnd } from '@/features/deck/DeckEnd'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import { CardFields } from '@/features/deck/CardFields'
import { ChipRow } from '@/features/deck/ChipRow'
import { ToastDock, Toaster, toast } from '@/ui/toast'
import { DECK_MOTION } from '@/features/deck/motion'
import { resolveDirection, stampOpacity } from '@/features/deck/swipeMath'
import { setFollowUpEnabled } from '@/ui/theme'
import { dismissDeckCoaches } from './helpers'

vi.mock('framer-motion', async original => {
  const actual = await original<typeof import('framer-motion')>()
  return { ...actual, animate: (value: { set: (next: number) => void }, next: number) => {
    value.set(next)
    return Object.assign(Promise.resolve(), { stop: () => {} })
  } }
})
const contact: Contact = { id: 'a', displayName: 'Ana Example', phones: [], emails: [], raw: '', source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] }
beforeEach(async () => { await repo.resetAll(); await repo.upsertContacts([contact]); dismissDeckCoaches(); setFollowUpEnabled(false) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const show = () => render(<MemoryRouter><DeckScreen pass="triage" /></MemoryRouter>)
async function click(name: string) {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toBeEnabled())
  await act(async () => fireEvent.click(button))
}

it('#47/#13 shows SORTED only after classification, focuses the heading and announces once', async () => {
  const view = show()
  const focus = vi.spyOn(HTMLElement.prototype, 'focus')
  await click('Delete')
  const heading = await screen.findByRole('heading', { name: 'Sorting done.' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(heading).toHaveAttribute('tabindex', '-1')
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(screen.getByText('SORTED')).toBeInTheDocument()
  expect(screen.getByText('This session: 1 of 1 classified')).toBeInTheDocument()
  const live = view.container.querySelector('[aria-live="polite"]')!
  expect(live).toHaveTextContent('1 classified.')
  const calls = focus.mock.calls.length
  await act(async () => { await repo.setMeta('unrelated', true) })
  expect(focus).toHaveBeenCalledTimes(calls)
})

it('#47 explicitly resets only the skipped session, preserving unrelated skips and saved tags', async () => {
  await repo.upsertContacts([{ ...contact, id: 'outside', displayName: 'Outside' }])
  await repo.saveDecision({ ...emptyDecision('outside'), skips: { triage: 2, work: 1, personal: 0 } })
  await repo.saveDecision({ ...emptyDecision('a'), customTags: ['keep'] })
  show()
  await click('Skip'); await click('Skip')
  const heading = await screen.findByRole('heading', { name: 'Pass finished' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(screen.queryByText('SORTED')).not.toBeInTheDocument()
  expect(screen.getByText('1 still need sorting')).toBeInTheDocument()
  expect(screen.getByText('This session: 0 of 1 classified')).toBeInTheDocument()
  expect((await repo.getDecision('a')).skips.triage).toBe(2)
  await click('Sort the skipped ones')
  await screen.findByRole('article', { name: 'Ana Example contact card' })
  expect((await repo.getDecision('a')).skips.triage).toBe(0)
  expect((await repo.getDecision('a')).customTags).toEqual(['keep'])
  expect((await repo.getDecision('outside')).skips.triage).toBe(2)
  await click('Delete')
  expect(await screen.findByText('SORTED')).toBeInTheDocument()
})

it('#47 does not certify an unchanged reclassification after two skips', async () => {
  await repo.saveDecision({ ...emptyDecision('a'), bucket: 'work', workStatus: 'current' })
  await repo.setMeta('deckScope', { pass: 'triage', ids: ['a'], mode: 'reclassify', createdAt: Date.now() })
  show(); await click('Skip'); await click('Skip')
  expect(await screen.findByText('1 still need sorting')).toBeInTheDocument()
  expect(screen.queryByText('SORTED')).not.toBeInTheDocument()
  await click('Sort the skipped ones')
  expect((await repo.getDecision('a')).workStatus).toBe('current')
  await screen.findByRole('article')
})

it('#24 shows only a skeleton until counts resolve and retries a failed summary read', async () => {
  let reject!: (reason: Error) => void
  const pending = new Promise<Awaited<ReturnType<typeof repo.counts>>>((_, fail) => { reject = fail })
  // Keep live-query invalidations on the same pending read until the explicit retry.
  const count = vi.spyOn(repo, 'counts').mockImplementation(() => pending)
  render(<MemoryRouter><DeckEnd pass="triage" sessionIds={['a']} skippedIds={['a']} scoped={false} retrySkipped={async () => {}} /></MemoryRouter>)
  expect(screen.getByTestId('deck-end-loading')).toBeInTheDocument()
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  await waitFor(() => expect(count).toHaveBeenCalled())
  await act(async () => reject(new Error('unavailable')))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
  expect(screen.queryByText('SORTED')).not.toBeInTheDocument()
  count.mockRestore()
  await click('Retry')
  expect(await screen.findByRole('heading', { name: 'Pass finished' })).toBeInTheDocument()
})

it('#24 retries a rejected deckContacts read in place', async () => {
  vi.spyOn(repo, 'deckContacts').mockRejectedValueOnce(new Error('unavailable'))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load contacts')
  await click('Retry')
  expect(await screen.findByRole('article')).toBeInTheDocument()
})

it.each(['work', 'personal'] as const)('#53/#16 Later Keep persists %s types with shared completion semantics', async bucket => {
  const decision = { ...emptyDecision('a'), bucket }
  await repo.saveDecision(decision)
  const onClose = vi.fn()
  render(<FollowUpSheet target={{ contact, decision }} onClose={onClose} />)
  await click(bucket === 'work' ? 'Current' : 'Family')
  await click(bucket === 'work' ? 'Client' : 'Neighbor')
  await click(bucket === 'work' ? 'Vendor' : 'Acquaintance')
  await click('Later')
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByText(bucket === 'personal' ? 'Keep 2 types · counts as Other' : 'Keep 2 selected types?')).toBeInTheDocument()
  await click('Keep')
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  const saved = await repo.getDecision('a')
  expect(saved.bucket).toBe(bucket)
  expect(saved[bucket === 'work' ? 'workTypes' : 'personalTypes']).toHaveLength(2)
  // #53: the repo persists Other for Personal types, while Work still awaits status.
  expect(saved.workStatus).toBeUndefined(); expect(saved.relation).toBe(bucket === 'personal' ? 'other' : undefined)
  expect(onClose.mock.lastCall?.[0]).toEqual(saved)
})

it('#53/#7/#16 returning saved Personal types show the persisted Other relation', async () => {
  await repo.saveDecision({ ...emptyDecision('a'), bucket: 'personal', personalTypes: ['neighbor'] })
  // #53: completed Other returns only through explicit reclassification.
  expect(await repo.deckContacts('personal')).toHaveLength(0)
  await repo.setMeta('deckScope', { pass: 'personal', ids: ['a'], mode: 'reclassify', createdAt: Date.now() })
  render(<MemoryRouter><DeckScreen pass="personal" /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'Relation: Other' })).toHaveAttribute('aria-pressed', 'true')
  await click('Done')
  expect((await repo.getDecision('a')).relation).toBe('other')
  expect(await screen.findByText('SORTED')).toBeInTheDocument()
})

it('#49 preserves ext even with e164 and keeps unsupported addresses copyable', () => {
  render(<CardFields contact={{ ...contact,
    phones: [{ value: '+1 555 0100;ext=42', e164: '+15550100' }, { value: '123;foo=4' }],
    emails: [{ value: 'valid@example.com' }, { value: 'bad@example.com?subject=x' }],
  }} />)
  expect(screen.getByRole('link', { name: '+1 555 0100;ext=42' })).toHaveAttribute('href', 'tel:+15550100;ext=42')
  expect(screen.getByRole('link', { name: 'valid@example.com' })).toHaveAttribute('href', 'mailto:valid%40example.com')
  expect(screen.queryByRole('link', { name: '123;foo=4' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Copy Phone' })[1]).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'bad@example.com?subject=x' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Copy Email' })[1]).toBeInTheDocument()
})

it('#50 uses the shared inner label for a 32-character custom tag in a 280px rail', () => {
  const tag = 'x'.repeat(32)
  render(<div style={{ width: 280 }}><ChipRow pass="triage" draft={{ ...emptyDecision('a'), customTags: [tag] }}
    toggleChip={() => {}} toggleTag={() => {}} inputRef={createRef()} open={false} setOpen={() => {}} /></div>)
  const button = screen.getByRole('button', { name: tag })
  expect(button).not.toHaveClass('truncate')
  expect(button.querySelector('.chip-label')).toHaveTextContent(tag)
  expect(button).toHaveClass('max-w-full') // shared outer size bound; clipping belongs to the label
  expect(readFileSync('src/index.css', 'utf8')).toMatch(/\.chip-label[^}]*overflow: hidden[^}]*text-overflow: ellipsis/)
})

it('#14/#38 uses measured short-landscape cards and compact actions, then exposes keyboard entry', async () => {
  vi.stubGlobal('innerWidth', 844); vi.stubGlobal('innerHeight', 390)
  vi.stubGlobal('ResizeObserver', class {
    callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) { this.callback = callback }
    observe(node: HTMLElement) {
      if (node.hasAttribute('data-deck-stage')) this.callback([{ contentRect: { width: 804, height: 170 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
    disconnect() {}
  })
  const viewport = Object.assign(new EventTarget(), { height: 390, offsetTop: 0 })
  vi.stubGlobal('visualViewport', viewport)
  const scroll = vi.fn()
  HTMLElement.prototype.scrollIntoView = scroll
  show()
  expect(await screen.findByRole('article')).toHaveAttribute('data-layout', 'landscape')
  expect(document.querySelector('.deck-front-columns')).not.toBeNull()
  expect(document.querySelector('.deck-toolbar')).toHaveClass('deck-toolbar-compact')
  await click('+ tag')
  expect(screen.getByRole('textbox')).toHaveFocus()
  act(() => { viewport.height = 240; viewport.dispatchEvent(new Event('resize')) })
  expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'instant' })
  expect(document.querySelector('.deck-active')).toHaveClass('deck-keyboard-open')
  expect(screen.queryByRole('button', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument()
  act(() => { viewport.height = 390; viewport.dispatchEvent(new Event('resize')) })
  expect(document.querySelector('.deck-active')).not.toHaveClass('deck-keyboard-open')
})

it('#57/#5 docks wrapped feedback in flow without a fixed height or translation', () => {
  const view = render(<><ToastDock /><Toaster /></>)
  const handle = toast('LongName'.repeat(30), { priority: 'high' })
  act(() => handle.update('LongName'.repeat(30)))
  const dock = view.container.querySelector('.toast-dock')!
  expect(dock).toHaveStyle({ height: 'auto', minHeight: '44px', flexShrink: '0' })
  expect(dock).toContainElement(screen.getByText('LongName'.repeat(30)))
  expect(readFileSync('src/features/deck/deck.css', 'utf8')).not.toContain('translate: 0 100%')
  act(() => handle.dismiss())
})

it('#32 saturates exactly at the commit threshold and holds for 120ms during a 320ms fling', () => {
  const threshold = 400 * DECK_MOTION.commitThreshold
  expect(stampOpacity(threshold - 1, 0, 400).right).toBeLessThan(1)
  expect(resolveDirection(threshold - 1, 0, 0, 0, 400)).toBeNull()
  expect(stampOpacity(threshold, 0, 400).right).toBe(1)
  expect(resolveDirection(threshold, 0, 0, 0, 400)).toBe('right')
  expect(DECK_MOTION.stampHold).toBe(.12)
  expect(DECK_MOTION.fling.duration).toBe(.32)
})
