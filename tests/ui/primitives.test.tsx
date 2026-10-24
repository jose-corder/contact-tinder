import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { Button, IconButton, Sheet } from '@/ui'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Sheet', () => {
  beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })

  it('names the dialog, focuses the first control and cycles Tab in both directions', () => {
    render(<Sheet open onClose={() => {}} title="Choose a type"><button>First</button><button disabled>Unavailable</button><button>Last</button></Sheet>)
    expect(screen.getByRole('dialog', { name: 'Choose a type' })).toBeInTheDocument()
    const first = screen.getByRole('button', { name: 'Close sheet' })
    const last = screen.getByRole('button', { name: 'Last' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
  })

  it('contains focus moved outside the dialog', () => {
    render(<><button>Outside</button><Sheet open onClose={() => {}} title="Choices"><button>Inside</button></Sheet></>)
    act(() => screen.getByRole('button', { name: 'Outside' }).focus())
    expect(screen.getByRole('button', { name: 'Close sheet' })).toHaveFocus()
  })

  it('closes with Escape, restores focus and preserves body scroll styles', async () => {
    document.body.style.overflow = 'auto'
    function Example() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Open</button><Sheet open={open} onClose={() => setOpen(false)} title="Options"><button>Save</button></Sheet></>
    }
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('fixed')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.body.style.overflow).toBe('auto')
    expect(document.body.style.position).toBe('')
    expect(trigger).toHaveFocus()
    document.body.style.overflow = ''
  })

  it('unlocks on unmount and keeps a second open sheet locked', () => {
    const first = render(<Sheet open onClose={() => {}} title="First">One</Sheet>)
    const second = render(<Sheet open onClose={() => {}} title="Second">Two</Sheet>)
    first.unmount()
    expect(document.body.style.overflow).toBe('hidden')
    second.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('Button', () => {
  it('keeps the label in layout while loading, announces busy and blocks clicks', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button loading onClick={onClick}>Import contacts</Button>)
    const button = screen.getByRole('button', { name: 'Import contacts' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('.invisible')).toHaveTextContent('Import contacts')
    expect(button.querySelector('.button-spinner')).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    rerender(<Button onClick={onClick}>Import contacts</Button>)
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('keeps an explicitly disabled button disabled after loading', () => {
    const { rerender } = render(<Button disabled loading>Save</Button>)
    rerender(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('adds an IconButton caption without changing its accessible label', () => {
    render(<IconButton label="Keep contact" caption="Keep"><svg aria-hidden="true" /></IconButton>)
    expect(screen.getByRole('button', { name: 'Keep contact' })).toBeInTheDocument()
    expect(screen.getByText('Keep')).toHaveClass('eyebrow')
  })
})
