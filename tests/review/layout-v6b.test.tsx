import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { readFileSync } from 'node:fs'
import RowSheet from '@/features/review/RowSheet'
import ReviewTabs from '@/features/review/ReviewTabs'
import Filters from '@/features/review/Filters'
import ReviewScreen from '@/features/review/ReviewScreen'
import { resetAll, upsertContacts } from '@/db/repo'
import { row } from '../export/fixtures'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const css = (file: string) => readFileSync(`src/features/review/${file}.css`, 'utf8')

it('pairs every identity value with its copy control and groups the deck action with its helper (#1)', () => {
  const entry = row('Ada Lovelace')
  entry.contact.phones = [{ value: '+12025550101' }]
  entry.contact.emails = [{ value: 'ada@example.test' }]
  entry.contact.org = 'Analytical Engines'
  render(<MemoryRouter><RowSheet row={entry} onClose={() => {}} /></MemoryRouter>)
  const identity = screen.getByRole('region', { name: 'Contact identity' })
  const identityRows = identity.querySelectorAll('.review-identity-row')
  expect(identityRows).toHaveLength(3)
  for (const [index, value] of ['Ada Lovelace', '+12025550101', 'ada@example.test'].entries()) {
    expect(within(identityRows[index] as HTMLElement).getByRole('button', { name: `Copy ${value}` })).toBeVisible()
  }
  expect(within(identity).getByRole('link', { name: 'ada@example.test' })).toHaveAttribute('href', 'mailto:ada%40example.test')
  expect(within(identity).getByText('Analytical Engines')).toHaveClass('t-meta', 'text-ink-2')
  const jump = screen.getByRole('button', { name: 'Jump to deck' })
  expect(jump).toHaveClass('w-full', 'border-control')
  expect(jump.nextElementSibling).toHaveTextContent('Nothing changes until you swipe.')
  expect(jump.nextElementSibling).toHaveClass('mt-2', 't-meta', 'text-ink-2')
  expect(css('RowSheet')).toMatch(/grid-template-columns: minmax\(0, 1fr\) 40px/)
  expect(css('RowSheet')).toContain('min-height: 44px')
})

it('keeps tab counts accessible and scrolls a keyboard-selected edge tab into view (#2)', () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  const options = (['delete', 'work', 'personal', 'unsorted'] as const).map(value => ({ value, label: value, count: 1234 }))
  const change = vi.fn()
  const { rerender } = render(<ReviewTabs options={options} value="delete" onChange={change} />)
  fireEvent.keyDown(screen.getByRole('tab', { name: /delete\s*1234/ }), { key: 'End' })
  expect(change).toHaveBeenCalledWith('unsorted')
  rerender(<ReviewTabs options={options} value="unsorted" onChange={change} />)
  expect(screen.getByRole('tab', { name: /unsorted\s*1234/ })).toHaveAttribute('aria-selected', 'true')
  expect(scroll).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' })
  const rules = css('ReviewTabs')
  expect(rules).toContain('@media (width < 390px)')
  expect(rules).toContain('padding-inline: 20px')
  expect(rules).toContain('scroll-snap-type: x proximity')
  expect(rules).toContain('flex-shrink: 0')
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

it('shows the filter fade only while more chips remain and remeasures after resize (#3)', () => {
  let resize: () => void = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback }
    observe = vi.fn()
    disconnect = disconnect
  })
  const change = vi.fn()
  const { unmount } = render(<Filters tab="work" rows={[]} segment="all" types={[]} tags={[]}
    onSegment={change} onType={change} onTag={change} active={false} onClear={change} />)
  const scroller = screen.getByLabelText('Filter contacts')
  Object.defineProperties(scroller, {
    clientWidth: { configurable: true, value: 280 },
    scrollWidth: { configurable: true, value: 900 },
    scrollLeft: { configurable: true, writable: true, value: 0 },
  })
  act(() => resize())
  expect(scroller).toHaveAttribute('data-more', 'true')
  scroller.scrollLeft = 620
  fireEvent.scroll(scroller)
  expect(scroller).toHaveAttribute('data-more', 'false')
  scroller.scrollLeft = 0
  fireEvent.scroll(scroller)
  expect(scroller).toHaveAttribute('data-more', 'true')
  Object.defineProperty(scroller, 'clientWidth', { value: 900 })
  act(() => resize())
  expect(scroller).toHaveAttribute('data-more', 'false')
  fireEvent.click(screen.getByRole('radio', { name: 'Current' }))
  expect(change).toHaveBeenCalledWith('current')
  expect(css('Filters')).toContain('padding-inline: 4px 20px')
  expect(css('Filters')).toContain('calc(100% - 24px)')
  expect(css('Filters')).toContain('scroll-snap-align: start')
  unmount()
  expect(disconnect).toHaveBeenCalled()
})

it('aligns the desktop detail pane with the list grid row and caps its width (#7)', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 1024px)',
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  await resetAll()
  await upsertContacts([row('Ada').contact])
  const { container } = render(<MemoryRouter initialEntries={['/review?tab=unsorted']}><ReviewScreen /></MemoryRouter>)
  await screen.findByRole('button', { name: /View Ada/ })
  const pane = screen.getByRole('complementary', { name: 'Selected contact' })
  const list = screen.getByRole('tabpanel')
  expect(pane.parentElement).toBe(list.parentElement)
  expect(list).toHaveClass('lg:row-start-4')
  expect(pane).toHaveClass('lg:row-start-4', 'max-w-[480px]', 'self-start')
  expect(screen.getByRole('heading', { name: 'Choose a contact.' }).parentElement).toHaveClass('pt-2')
  expect(container.querySelector('.ui-frame')).toHaveClass('lg:max-w-[960px]')
})
