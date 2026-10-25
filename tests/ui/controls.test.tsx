import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Chip, CopyButton, InlineNotice, LabelDot, Segmented } from '@/ui'
import { dismissToast } from '@/ui/toast'

afterEach(() => { cleanup(); dismissToast(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('roves tab focus with wrapping arrows, Home and End, and links panels', () => {
  function Tabs() {
    const [value, setValue] = useState('work')
    return <Segmented value={value} onChange={setValue} options={[
      { value: 'work', label: 'Work', panelId: 'work-panel' },
      { value: 'personal', label: 'Personal', panelId: 'personal-panel' },
      { value: 'delete', label: 'Delete', panelId: 'delete-panel' },
    ]} />
  }
  render(<Tabs />)
  const tabs = screen.getAllByRole('tab')
  expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
  expect(tabs[0]).toHaveAttribute('id', 'work-panel-tab')
  expect(tabs[0]).toHaveAttribute('aria-controls', 'work-panel')
  for (const [key, target] of [['ArrowLeft', 2], ['ArrowRight', 0], ['End', 2], ['Home', 0], ['ArrowRight', 1]] as const) {
    fireEvent.keyDown(tabs.find((tab) => tab.tabIndex === 0)!, { key })
    expect(tabs[target]).toHaveFocus()
    expect(tabs[target]).toHaveAttribute('aria-selected', 'true')
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
  }
  fireEvent.click(tabs[2])
  expect(tabs[2].tabIndex).toBe(0)
})

it('keeps separate tab groups and their underline IDs distinct', () => {
  const options = [{ value: 'yes', label: 'Yes' }]
  render(<><Segmented value="yes" options={options} onChange={() => {}} /><Segmented value="yes" options={options} onChange={() => {}} /></>)
  const tabs = screen.getAllByRole('tab')
  expect(tabs[0].id).not.toBe(tabs[1].id)
})

it('uses semantic foregrounds while preserving the legacy color fallback', () => {
  const { rerender } = render(<Chip label="Potential" selected tone="potential" color="red" />)
  const chip = screen.getByRole('button')
  expect(chip.style.background).toBe('var(--status-potential)')
  expect(chip.style.color).toBe('var(--on-status-potential)')
  expect(chip).toHaveClass('chip-hit', 'h-9')
  rerender(<Chip label="Custom" selected color="red" />)
  expect(chip.style.background).toBe('red')
  expect(chip.style.color).toBe('')
  expect(chip).toHaveClass('text-paper')
  rerender(<Chip label="Custom" tone="work" />)
  expect(chip.style.background).toBe('')
  expect(chip).toHaveClass('border-control')
})

it('uses one canonical notice style and decorative dots with optional readable labels', () => {
  render(<><InlineNotice tone="error">Could not save</InlineNotice><InlineNotice tone="info">Preparing</InlineNotice><LabelDot tone="current" label="Current" /></>)
  expect(screen.getByRole('alert')).toHaveClass('border-l', 't-meta')
  expect(screen.getByRole('status')).toHaveTextContent('Preparing')
  const dot = screen.getByText('Current').querySelector('span')!
  expect(dot).toHaveAttribute('aria-hidden', 'true')
  expect(dot.style.width).toBe('6px')
})

it('copies the exact value and confirms success once', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<CopyButton value="+52 555 1234" label="phone number" />)
  const button = screen.getByRole('button', { name: 'Copy phone number' })
  expect(button).toHaveClass('hit-44')
  await act(async () => fireEvent.click(button))
  expect(writeText).toHaveBeenCalledExactlyOnceWith('+52 555 1234')
  expect(screen.getByRole('status')).toHaveTextContent('Copied')
})

it('reports clipboard rejection without claiming success', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
  render(<CopyButton value="value" label="email" />)
  await act(async () => fireEvent.click(screen.getByRole('button')))
  expect(screen.getByRole('status')).toHaveTextContent('Copy failed')
  expect(screen.getByRole('button')).toBeEnabled()
  expect(screen.getByText('value').style.userSelect).toBe('all')
})
