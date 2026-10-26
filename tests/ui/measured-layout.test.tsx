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

it('recomputes body padding and scroll clearance from the resized real footer', () => {
  let footerHeight = 76
  let notify = () => {}
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { height: this.classList.contains('sheet-footer') ? footerHeight : 500 } as DOMRect
  })
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notify = callback }
    observe() {} disconnect() {}
  })
  render(<Sheet open title="Tall content" onClose={() => {}} footer={<button>Done</button>}>
    {Array.from({ length: 40 }, (_, i) => <button key={i}>Tag {i}</button>)}
  </Sheet>)
  const body = document.querySelector<HTMLElement>('.sheet-body')!
  expect(body.style.paddingBottom).toBe('calc(92px)')
  expect(body.style.scrollPaddingBottom).toBe('92px')
  act(() => { footerHeight = 144; notify() })
  expect(body.style.paddingBottom).toBe('calc(160px)')
  expect(body.style.scrollPaddingBottom).toBe('160px')
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
