import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { InlineNotice, Sheet, SheetConfirm, SheetFooterActions } from '@/ui'

let footerHeight = 180
let measure: () => void
beforeEach(() => {
  footerHeight = 180
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { measure = callback }
    observe() {} disconnect() {}
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = this.classList.contains('sheet-footer') ? footerHeight
      : this.classList.contains('sheet-body') ? 164 : this.tagName === 'BUTTON' ? 44 : 0
    return { height, width: 280, x: 0, y: 0, top: 0, left: 0, right: 280, bottom: height, toJSON() {} }
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.fontSize = '' })

function viewport(width: number, height: number, visualHeight = height, safe = 0) {
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('innerHeight', height)
  const visual = Object.assign(new EventTarget(), { height: visualHeight, offsetTop: 0 })
  vi.stubGlobal('visualViewport', visual)
  const computed = window.getComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node, pseudo) => {
    const result = computed(node, pseudo)
    if ((node as HTMLElement).style.cssText.includes('--sheet-safe-top')) {
      return new Proxy(result, { get: (target, key) => key === 'paddingTop' || key === 'paddingBottom' ? `${safe}px` : Reflect.get(target, key) })
    }
    return result
  })
  return visual
}
function Example({ legacy = false }: { legacy?: boolean }) {
  const confirmation = <SheetConfirm title="Unsaved selections" body="Keep selected types?"
    confirmLabel="Keep" cancelLabel="Discard" onConfirm={() => {}} onCancel={() => {}} />
  return <Sheet open title="Contact details" onClose={() => {}} footer={<>
    {legacy && confirmation}
    <SheetFooterActions secondary={{ label: 'Cancel', onClick: () => {} }} primary={{ label: 'Done', onClick: () => {} }} />
  </>}>
    <label>Name<input defaultValue="Maria" /></label>
    {!legacy && confirmation}
    <InlineNotice tone="error">Could not save. Try again.</InlineNotice>
  </Sheet>
}

it.each([false, true])('keeps expanded content and all actions in one scroller at 320×568 with a 240px keyboard viewport (legacy=%s)', legacy => {
  viewport(320, 568, 240)
  document.documentElement.style.fontSize = '24px'
  render(<Example legacy={legacy} />)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('data-constrained', 'true')
  expect(dialog).toHaveStyle({ maxHeight: '240px', bottom: '328px' })
  const scroller = dialog.querySelector('.sheet-body')!
  for (const node of [screen.getByRole('textbox'), screen.getByText('Keep selected types?'), screen.getByRole('alert'),
    ...['Keep', 'Discard', 'Cancel', 'Done'].map(name => screen.getByRole('button', { name }))]) {
    expect(scroller).toContainElement(node)
  }
  expect(dialog.querySelectorAll('.overflow-y-auto')).toHaveLength(1)
})

it('keeps removal, inline error and final actions reachable in 568×320 landscape with 24px safe areas', () => {
  viewport(568, 320, 320, 24)
  document.documentElement.style.fontSize = '24px'
  render(<Sheet open title="Contact details" onClose={() => {}} footer={<>
    <p>Remove this contact from this app?</p><InlineNotice tone="error">Could not remove</InlineNotice>
    <SheetFooterActions secondary={{ label: 'Cancel removal', onClick: () => {} }} primary={{ label: 'Confirm removal', onClick: () => {} }} />
  </>}><input aria-label="Contact field" /></Sheet>)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('data-constrained', 'true')
  expect(dialog).toHaveStyle({ maxHeight: '272px', bottom: '24px' })
  const scroller = dialog.querySelector('.sheet-body')!
  for (const node of [screen.getByRole('textbox'), screen.getByText('Remove this contact from this app?'),
    screen.getByRole('alert'), screen.getByRole('button', { name: 'Cancel removal' }), screen.getByRole('button', { name: 'Confirm removal' })]) {
    expect(scroller).toContainElement(node)
  }
  expect((dialog.querySelector('.sheet-footer') as HTMLElement).style.position).toBe('static')
})

it('keeps the normal 390×844 footer fixed outside the scroller', () => {
  viewport(390, 844)
  render(<Example />)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('data-constrained', 'false')
  expect(dialog.querySelector('.sheet-body')).not.toContainElement(screen.getByRole('button', { name: 'Done' }))
  expect(screen.getByRole('button', { name: 'Done' }).closest('.sheet-footer')?.parentElement).toBe(dialog)
})

it('remeasures expansion and restores the fixed footer without losing footer state or focus', () => {
  const visual = viewport(390, 844)
  function StatefulFooter() {
    const [count, setCount] = useState(0)
    return <button onClick={() => setCount(count + 1)}>Count {count}</button>
  }
  render(<Sheet open title="Details" onClose={() => {}} footer={<StatefulFooter />}><input defaultValue="Draft" /></Sheet>)
  const button = screen.getByRole('button', { name: 'Count 0' })
  fireEvent.click(button)
  button.focus()
  act(() => { visual.height = 240; visual.dispatchEvent(new Event('resize')) })
  expect(button).toHaveFocus()
  expect(button).toHaveTextContent('Count 1')
  expect(button.closest('.sheet-body')).not.toBeNull()
  act(() => { visual.height = 844; visual.dispatchEvent(new Event('resize')) })
  expect(button.closest('.sheet-body')).toBeNull()
  act(() => { footerHeight = 650; measure() })
  expect(button.closest('.sheet-body')).not.toBeNull()
  expect(screen.getByRole('textbox')).toHaveValue('Draft')
})

it('renders inline actions as the last body row and exposes confirmation callbacks', () => {
  viewport(390, 844)
  const confirm = vi.fn(), cancel = vi.fn()
  render(<Sheet open onClose={() => {}}>
    <SheetConfirm title="Remove contact?" body="Your address book is unchanged." tone="danger"
      confirmLabel="Remove" cancelLabel="Cancel" onConfirm={confirm} onCancel={cancel} />
    <SheetFooterActions inline primary={{ label: 'Done', onClick: () => {} }} />
  </Sheet>)
  const scroller = screen.getByRole('dialog').querySelector('.sheet-body')!
  expect(scroller.lastElementChild).toHaveClass('sheet-actions-inline')
  expect(scroller).toContainElement(screen.getByRole('group', { name: 'Remove contact?' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(cancel).toHaveBeenCalledOnce()
})

it('keeps the footer last when a new error is appended to the constrained body', () => {
  viewport(320, 568, 240)
  const footer = <SheetFooterActions primary={{ label: 'Save', onClick: () => {} }} />
  const { rerender } = render(<Sheet open title="Details" onClose={() => {}} footer={footer}><p>Body</p></Sheet>)
  rerender(<Sheet open title="Details" onClose={() => {}} footer={footer}><p>Body</p><InlineNotice tone="error">New error</InlineNotice></Sheet>)
  const body = screen.getByRole('dialog').querySelector('.sheet-body')!
  expect(body).toContainElement(screen.getByRole('alert'))
  expect(body.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Save' }))
})
