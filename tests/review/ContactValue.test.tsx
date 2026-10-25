// Audit #42: exercise the shared copy affordance used by ContactDetails.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CopyButton } from '@/ui'
import { dismissToast, Toaster } from '@/ui/toast'

afterEach(() => { cleanup(); dismissToast(); vi.unstubAllGlobals() })

it('copies the exact value and confirms it locally (#45)', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  try {
    render(<><CopyButton label="maria@example.com" value="maria@example.com" /><Toaster /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy maria@example.com' }))
    expect(writeText).toHaveBeenCalledWith('maria@example.com')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original)
    else Reflect.deleteProperty(navigator, 'clipboard')
  }
})
