import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ContactValue from '@/features/review/ContactValue'
import { dismissToast, Toaster } from '@/ui/toast'

afterEach(() => { cleanup(); dismissToast(); vi.unstubAllGlobals() })

it('copies the exact value and confirms it with the shared toast', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  try {
    render(<><dl><ContactValue label="Email" value="maria@example.com" href="mailto:maria@example.com" /></dl><Toaster /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy maria@example.com' }))
    expect(writeText).toHaveBeenCalledWith('maria@example.com')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original)
    else Reflect.deleteProperty(navigator, 'clipboard')
  }
})
