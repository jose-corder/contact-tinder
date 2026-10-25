import { act, cleanup, render, screen } from '@testing-library/react'
import { Sheet, Segmented } from '@/ui'
import { dismissToast, setToastSuppressed, toast, Toaster } from '@/ui/toast'

vi.mock('framer-motion', async () => {
  const { createElement } = await import('react')
  function element(tag: string) {
    return ({ children, initial, animate, exit, transition, drag, layoutId,
      transformTemplate: _transformTemplate, dragListener: _listener, dragControls: _controls, dragConstraints: _constraints,
      dragElastic: _elastic, dragSnapToOrigin: _snap, onDragEnd: _end, ...props }: Record<string, unknown>) =>
      createElement(tag, { ...props, 'data-motion': JSON.stringify({ initial, animate, exit, transition, drag, layoutId }) }, children as React.ReactNode)
  }
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useDragControls: () => ({ start: vi.fn() }),
    motion: { div: element('div'), span: element('span') },
  }
})

afterEach(() => { cleanup(); dismissToast(); setToastSuppressed(false); vi.unstubAllGlobals() })

it('reacts to preference changes with short fades and disables sheet dragging and tab travel', () => {
  let matches = false
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return matches },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  render(<><Sheet open onClose={() => {}}>Body</Sheet>
    <Segmented value="work" onChange={() => {}} options={[{ value: 'work', label: 'Work' }]} /></>)
  const dialog = screen.getByRole('dialog')
  expect(JSON.parse(dialog.dataset.motion!).drag).toBe('y')
  act(() => { matches = true; listeners.forEach((listener) => listener()) })
  const sheetMotion = JSON.parse(dialog.dataset.motion!)
  expect(sheetMotion.initial).toEqual({ opacity: 0 })
  expect(sheetMotion.exit).toEqual({ opacity: 0 })
  expect(sheetMotion.transition.duration).toBe(0.12)
  expect(sheetMotion.drag).toBe(false)
  const underline = screen.getByRole('tab').querySelector('[data-motion]') as HTMLElement
  const underlineMotion = JSON.parse(underline.dataset.motion!)
  expect(underlineMotion.layoutId).toBeUndefined()
  expect(underlineMotion.transition.duration).toBe(0.12)
})

it('uses an opacity-only toast entry and exit under reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  render(<Toaster />)
  act(() => toast('Saved'))
  const data = JSON.parse(screen.getByText('Saved').parentElement!.dataset.motion!)
  expect(data.initial).toEqual({ opacity: 0 })
  expect(data.exit).toEqual({ opacity: 0 })
  expect(data.transition.duration).toBe(0.12)
})
