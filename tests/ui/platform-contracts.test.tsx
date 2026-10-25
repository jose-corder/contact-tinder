import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import { MemoryRouter } from 'react-router'
import { Button, Chip, CopyButton, ErrorBoundary, Frame, IconButton, RadioGroup, Rule, Sheet, TopBar, formatDate, formatPhone, motionProps } from '@/ui'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('announces copy inside a sheet, swaps the icon, and clears success after 1.5 seconds', async () => {
  vi.useFakeTimers()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
  render(<Sheet open onClose={() => {}}><CopyButton value="123" label="phone" /></Sheet>)
  const button = screen.getByRole('button', { name: 'Copy phone' })
  expect(button.querySelector('rect')).toBeInTheDocument()
  await act(async () => fireEvent.click(button))
  expect(within(button).getByRole('status')).toHaveTextContent('Copied')
  expect(within(button).getByRole('status')).toHaveAttribute('aria-live', 'polite')
  expect(button.querySelector('rect')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1499))
  expect(button).toHaveTextContent('Copied')
  act(() => vi.advanceTimersByTime(1))
  expect(within(button).getByRole('status')).toBeEmptyDOMElement()
  expect(button.querySelector('rect')).toBeInTheDocument()
})

it('allows a failed clipboard action to retry without a toast or losing the selectable value', async () => {
  const writeText = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValueOnce(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<CopyButton value="local@example.com" label="email" />)
  const button = screen.getByRole('button')
  await act(async () => fireEvent.click(button))
  expect(within(button).getByRole('status')).toHaveTextContent('Copy failed')
  expect(screen.getByText('local@example.com')).toHaveStyle({ userSelect: 'all' })
  await act(async () => fireEvent.click(button))
  expect(within(button).getByRole('status')).toHaveTextContent('Copied')
  expect(screen.queryByText('local@example.com')).not.toBeInTheDocument()
})

it('ignores pending clipboard results after the value changes', async () => {
  let resolve!: () => void
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>(done => { resolve = done }) } })
  const { rerender } = render(<CopyButton value="old" label="email" />)
  fireEvent.click(screen.getByRole('button'))
  rerender(<CopyButton value="new" label="email" />)
  await act(async () => resolve())
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(screen.getByRole('button')).toBeEnabled()
})

it('provides named radio semantics, wrapping keyboard selection and disabled-option skipping', () => {
  function Example() {
    const [value, setValue] = useState('replace')
    return <RadioGroup label="Restore mode" value={value} onChange={setValue} options={[
      { value: 'replace', label: 'Replace' }, { value: 'unavailable', label: 'Unavailable', disabled: true },
      { value: 'merge', label: 'Merge' },
    ]} />
  }
  render(<Example />)
  const group = screen.getByRole('radiogroup', { name: 'Restore mode' })
  const radios = within(group).getAllByRole('radio')
  expect(radios.map(radio => radio.tabIndex)).toEqual([0, -1, -1])
  expect(radios[1]).toBeDisabled()
  for (const [key, target] of [['ArrowRight', 2], ['ArrowDown', 0], ['ArrowLeft', 2], ['Home', 0], ['End', 2], ['ArrowUp', 0]] as const) {
    fireEvent.keyDown(radios.find(radio => radio.tabIndex === 0)!, { key })
    expect(radios[target]).toHaveFocus()
    expect(radios[target]).toHaveAttribute('aria-checked', 'true')
    expect(radios.filter(radio => radio.tabIndex === 0)).toHaveLength(1)
  }
  fireEvent.click(radios[2])
  expect(radios[2]).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

it('gives the first enabled radio a tab stop when no value is selected', () => {
  render(<RadioGroup label="Filter" value="" onChange={() => {}} options={[
    { value: 'none', label: 'Unavailable', disabled: true }, { value: 'all', label: 'All' },
  ]} />)
  expect(screen.getByRole('radio', { name: 'All' }).tabIndex).toBe(0)
})

it('bounds an unbroken 32-character chip inside a 280px rail while retaining the outer hit area', () => {
  const label = 'x'.repeat(32)
  render(<div style={{ width: 280 }}><Chip label={label} className="truncate" /></div>)
  const button = screen.getByRole('button', { name: label })
  expect(button).toHaveClass('chip-hit', 'max-w-full', 'min-w-0')
  expect(screen.getByText(label)).toHaveClass('chip-label')
  expect(button.parentElement).toHaveStyle({ width: '280px' })
  const css = readFileSync('src/index.css', 'utf8')
  const labelRule = css.match(/\.chip-label \{([^}]+)\}/)![1]
  for (const rule of ['max-width: 100%', 'overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap']) expect(labelRule).toContain(rule)
  expect(css).toMatch(/\.chip-hit \{[^}]*overflow: visible/)
  expect(css).toMatch(/\.chip-hit::after \{[^}]*inset: -4px 0/)
})

it('uses opacity-only reduced motion even when a caller supplies transform animations', () => {
  const props = motionProps(true, { initial: { x: 40 }, animate: { x: 0 }, transition: { type: 'spring' } })
  expect(props.initial).toEqual({ opacity: 0 })
  expect(props.animate).toEqual({ opacity: 1 })
  expect(props.exit).toEqual({ opacity: 0 })
  expect(props.transition).toEqual({ duration: 0.12, ease: 'easeOut' })
  expect(props.transformTemplate?.({}, 'translateY(40px)')).toBe('none')
  expect(motionProps(false, { animate: { x: 0 } }).animate).toEqual({ x: 0 })
})

it('provides readable dates without exposing invalid timestamps or guessing a phone country', () => {
  const expected = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date('2024-03-12'))
  for (const date of ['20240312', '20240312T120000Z', '2024-03-12', new Date('2024-03-12'), Date.parse('2024-03-12')]) expect(formatDate(date)).toBe(expected)
  expect(formatDate('Unknown')).toBe('Unknown')
  expect(formatDate(NaN)).toBe('Unknown date')
  expect(formatPhone('+12133734253')).toBe('+1 213 373 4253')
  expect(formatPhone('+12133734253;ext=42')).toContain('42')
  expect(formatPhone('555-0100 ext 42')).toBe('555-0100 ext 42')
  expect(formatPhone('+not-a-number')).toBe('+not-a-number')
})

it('renders a recoverable boundary fallback and reloads on request', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): never { throw new Error('Render failure') }
  render(<ErrorBoundary><Broken /></ErrorBoundary>)
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong loading this screen')
  const reload = vi.fn()
  vi.stubGlobal('window', { location: { reload } })
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
  expect(reload).toHaveBeenCalledOnce()
  vi.unstubAllGlobals()
})

it('uses type roles, landscape hooks, control boundaries and decorative dividers consistently', () => {
  const { container } = render(<MemoryRouter><Frame><TopBar title="Review" /><Button variant="outline">Save</Button>
    <IconButton label="Edit" /><Chip label="Tag" /><Rule /></Frame></MemoryRouter>)
  expect(container.querySelector('.ui-frame')).toBeInTheDocument()
  expect(container.querySelector('.ui-topbar')).toBeInTheDocument()
  for (const button of screen.getAllByRole('button')) expect(button).toHaveClass('border-control')
  expect(container.querySelector('.border-t')).toHaveClass('border-rule')
  for (const file of readdirSync('src/ui').filter(file => /\.tsx?$/.test(file))) {
    expect(readFileSync(`src/ui/${file}`, 'utf8'), file).not.toMatch(/text-\[\d+px\]/)
  }
  const css = readFileSync('src/index.css', 'utf8')
  expect(css).toContain('@media (orientation: landscape) and (max-height: 500px)')
  expect(css).toContain('.ui-topbar { height: 40px; }')
  expect(css).toContain('padding-bottom: max(12px, env(safe-area-inset-bottom))')
  expect(css).toContain('input, textarea, select { border-color: var(--control-border); }')
})
