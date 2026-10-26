import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { readFileSync } from 'node:fs'
import { Sheet, SheetConfirm } from '@/ui'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function Example() {
  const chips = useRef<HTMLDivElement>(null)
  return <Sheet open title="Work contact" onClose={() => {}} initialFocus={chips}>
    <button>Undo</button><div ref={chips}><button>Old</button><button>Current</button></div>
  </Sheet>
}

it.each(['pointer', 'keyboard'] as const)('uses %s opening modality even with an explicit chip target', modality => {
  if (modality === 'pointer') fireEvent.pointerDown(window)
  else fireEvent.keyDown(window, { key: 'Enter' })
  render(<Example />)
  expect(modality === 'pointer' ? screen.getByRole('heading') : screen.getByRole('button', { name: 'Old' })).toHaveFocus()
  // Later input must not repeat initial focus or steal it from a chosen control.
  const current = screen.getByRole('button', { name: 'Current' })
  act(() => current.focus())
  fireEvent.keyDown(current, { key: 'ArrowRight' })
  expect(current).toHaveFocus()
})

it('focuses an inline confirmation heading after pointer input, including initialFocus consumers', () => {
  fireEvent.pointerDown(window)
  render(<SheetConfirm title="Unsaved selections" initialFocus="cancel" body="Keep changes?"
    confirmLabel="Keep" cancelLabel="Cancel" onConfirm={() => {}} onCancel={() => {}} />)
  expect(screen.getByRole('heading')).toHaveFocus()
})

// The footer sits in normal flow below the body (or as a sticky last child when constrained), so
// the body never needs footer-sized padding; a footer-sized pad left a blank band above the actions.
// Only a sticky footer reserves scroll clearance, measured from its real height.
it('keeps a constant body padding and reserves scroll clearance only for a sticky footer', () => {
  let footerHeight = 76
  let notify = () => {}
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { height: this.classList.contains('sheet-footer') ? footerHeight : 500 } as DOMRect
  })
  // Several components observe size (sheet layout, scroll-edge fade); notify every observer.
  const callbacks: Array<() => void> = []
  notify = () => callbacks.forEach((callback) => callback())
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { callbacks.push(callback) }
    observe() {} disconnect() {}
  })
  render(<Sheet open title="Tall content" onClose={() => {}} footer={<button>Done</button>}>
    {Array.from({ length: 40 }, (_, i) => <button key={i}>Tag {i}</button>)}
  </Sheet>)
  const body = document.querySelector<HTMLElement>('.sheet-body')!
  const footer = () => document.querySelector<HTMLElement>('.sheet-footer')!
  const clearance = () => footer().closest('.sheet-body') && footer().style.position === 'sticky' ? `${footerHeight + 16}px` : '16px'
  expect(body.style.paddingBottom).toBe('16px')
  expect(body.style.scrollPaddingBottom).toBe(clearance())
  act(() => { footerHeight = 144; notify() })
  expect(body.style.paddingBottom).toBe('16px')
  expect(body.style.scrollPaddingBottom).toBe(clearance())
})

it('uses a single ink outline with three-pixel clearance and the shared section rhythm', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const focus = css.match(/:focus-visible\s*\{([^}]+)\}/)![1]
  expect(focus).toContain('outline: 2px solid var(--ink)')
  expect(focus).toContain('outline-offset: 3px')
  expect(focus).not.toMatch(/border|box-shadow/)
  expect(css).toContain('.sheet-section > .t-eyebrow { margin-bottom: 8px; }')
  expect(css).toContain('.sheet-section > .sheet-section-help { margin-top: 12px; color: var(--ink-2); }')
  expect(css).toContain('.sheet-section + .sheet-section { margin-top: 20px; }')
})
