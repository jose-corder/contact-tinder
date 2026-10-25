import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InstallRow from '@/features/home/InstallRow'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function media(standalone = false) {
  const listeners: Array<() => void> = []
  let installed = standalone
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(display-mode: standalone)' ? installed : query === '(display-mode: browser)' && !installed,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener), removeEventListener: vi.fn(),
  })))
  return () => { installed = true; listeners.forEach((listener) => listener()) }
}
describe('Install app row', () => {
  it('hides in standalone mode', () => {
    media(true)
    render(<InstallRow />)
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument()
  })
  it('hides as soon as the display mode becomes standalone', () => {
    const install = media()
    render(<InstallRow />)
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) })
    act(() => { window.dispatchEvent(event) })
    expect(screen.getByRole('region', { name: 'Install app' })).toBeInTheDocument()
    act(install)
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument()
  })
  it('defers the browser prompt, prompts on tap and hides after appinstalled', async () => {
    media()
    render(<InstallRow />)
    const event = new Event('beforeinstallprompt', { cancelable: true })
    const prompt = vi.fn().mockResolvedValue(undefined)
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
    act(() => { window.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    expect(prompt).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Install Contacts.' }))
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install Contacts.' })).not.toBeInTheDocument())
    // #37: unsupported browsers and consumed prompts have no inert install row.
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument()
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument()
  })
  // Audit #37: iOS guidance applies to Safari, Chrome, Firefox, and Edge.
  it.each(['Version/18.0', 'CriOS/131', 'FxiOS/131', 'EdgiOS/131'])('shows iOS instructions for %s and honors standalone', browser => {
    media()
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone ' + browser + ' Mobile Safari/604.1')
    const { unmount } = render(<InstallRow />)
    expect(screen.getByText('Share → Add to Home Screen')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Install app' }).querySelector('svg')).toBeInTheDocument()
    unmount()
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    render(<InstallRow />)
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument()
    Reflect.deleteProperty(navigator, 'standalone')
  })
  it('#37: hides unsupported desktop browsers entirely', () => {
    media()
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Firefox/131')
    render(<InstallRow />)
    expect(screen.queryByRole('region', { name: 'Install app' })).not.toBeInTheDocument()
  })
  it('#37: recognizes iPad desktop mode without a prompt event', () => {
    media()
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    render(<InstallRow />)
    expect(screen.getByText('Share → Add to Home Screen')).toBeInTheDocument()
    Reflect.deleteProperty(navigator, 'maxTouchPoints')
  })
})
