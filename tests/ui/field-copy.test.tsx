import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FieldList, useLongPressCopy } from '@/ui'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('renders canonical labels, multiline values, optional copying and safe links', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const { container } = render(<FieldList fields={[
    { label: 'Phone', value: '+52 555 1234', href: 'tel:+525551234;ext=42', copy: true },
    { label: 'Email', value: 'maria@example.com', href: 'mailto:maria@example.com' },
    { label: 'Site', value: 'Website', href: 'https://example.com' },
    { label: 'Notes', value: 'First line\nSecond line', href: 'javascript:alert(1)' },
    { label: 'Bad data', value: 'Unsafe', href: 'data:text/html,bad' },
    { label: 'Obfuscated', value: 'Invalid', href: 'java\nscript:alert(1)' },
  ]} />)
  expect(container.querySelectorAll('dt')).toHaveLength(6)
  expect(container.querySelectorAll('dd')).toHaveLength(6)
  expect(screen.getByRole('link', { name: '+52 555 1234' })).toHaveAttribute('href', 'tel:+525551234;ext=42')
  expect(screen.getByRole('link', { name: 'maria@example.com' })).toHaveAttribute('href', 'mailto:maria@example.com')
  expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getAllByRole('link')).toHaveLength(3)
  expect(screen.getByText('First line Second line')).toHaveClass('whitespace-pre-wrap')
  expect(screen.getAllByRole('button')).toHaveLength(1)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy Phone' })))
  expect(writeText).toHaveBeenCalledWith('+52 555 1234')
  expect(screen.getByRole('status')).toHaveTextContent('Copied')
})

function LongPress({ value = '555', onCopied = () => {}, onClick = () => {} }) {
  const { handlers, feedback } = useLongPressCopy(value, { onCopied })
  return <><button {...handlers} onClick={onClick}>Phone</button>{feedback}</>
}
function clipboard() {
  vi.useFakeTimers()
  vi.stubGlobal('PointerEvent', MouseEvent)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  return writeText
}

it('acknowledges a long press locally and suppresses the trailing click', async () => {
  const writeText = clipboard(), onCopied = vi.fn(), onClick = vi.fn()
  render(<LongPress onCopied={onCopied} onClick={onClick} />)
  const button = screen.getByRole('button')
  fireEvent.pointerDown(button, { button: 0, clientX: 10, clientY: 10 })
  act(() => vi.advanceTimersByTime(499))
  expect(writeText).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(1))
  fireEvent.pointerUp(button)
  fireEvent.click(button)
  expect(onClick).not.toHaveBeenCalled()
  expect(writeText).toHaveBeenCalledExactlyOnceWith('555')
  expect(onCopied).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('Copied')
  act(() => vi.advanceTimersByTime(1500))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('cancels copying on movement, release, cancellation, value change and unmount', () => {
  const writeText = clipboard()
  const { rerender, unmount } = render(<LongPress />)
  const button = screen.getByRole('button')
  for (const cancel of [
    () => fireEvent.pointerMove(button, { clientX: 30, clientY: 0 }),
    () => fireEvent.pointerUp(button), () => fireEvent.pointerCancel(button),
    () => rerender(<LongPress value="New" />), () => unmount(),
  ]) {
    fireEvent.pointerDown(button, { button: 0, clientX: 0, clientY: 0 })
    cancel()
    act(() => vi.advanceTimersByTime(600))
  }
  expect(writeText).not.toHaveBeenCalled()
})

it('provides keyboard retry and selectable text on failure, using the same acknowledgement', async () => {
  const writeText = clipboard().mockRejectedValueOnce(new Error('Denied'))
  render(<LongPress />)
  await act(async () => fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' }))
  expect(screen.getByRole('status')).toHaveTextContent('Copy failed')
  expect(screen.getByText('555')).toHaveStyle({ userSelect: 'all' })
  await act(async () => fireEvent.keyDown(screen.getByRole('button'), { key: ' ' }))
  expect(screen.getByRole('status')).toHaveTextContent('Copied')
  expect(writeText).toHaveBeenCalledTimes(2)
})
