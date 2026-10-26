import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AnimatedRoutes } from '@/App'
import * as repo from '@/db/repo'
import { candidatePairs } from '@/import/duplicates'
import { recoveryHistory, RESTORE_UNDO_MS } from '@/export/recovery'
import { recoveryStore } from '@/ui'
import { row } from '../export/fixtures'

beforeEach(async () => {
  await repo.resetAll(); sessionStorage.clear()
  recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id))
})
afterEach(() => { cleanup(); recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id)); vi.restoreAllMocks() })
function Navigation() {
  const navigate = useNavigate()
  return <><button onClick={() => navigate(-1)}>Browser Back</button>
    <button onClick={() => navigate('/settings')}>Visit Settings</button>
    <button onClick={() => navigate('/review?tab=work')}>Visit Review</button></>
}
function open(path = '/review?tab=work') {
  return render(<MemoryRouter initialEntries={[path]}><Navigation /><AnimatedRoutes /></MemoryRouter>)
}
async function seed() {
  const items = [row('A', { bucket: 'work', workStatus: 'current', workTypes: ['client'], customTags: ['vip'] }), row('B')]
  await repo.upsertContacts(items.map(item => item.contact))
  await repo.saveDecisions(items.map(item => item.decision))
  await repo.setMeta('possibleDuplicates', candidatePairs([{ ids: ['A', 'B'], reason: 'same name' }], items.map(item => item.contact)))
}

it.each(['Back to list', 'Browser Back', 'resolve final pair'])('#62: real routes preserve filters, scroll and meaningful focus via %s', async way => {
  await seed()
  let top = 0
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => top)
  vi.spyOn(window, 'scrollTo').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'object') top = (args[0] as ScrollToOptions).top ?? 0
  })
  open()
  const control = await screen.findByRole('button', { name: 'Possible duplicates' })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'A' } })
  fireEvent.click(screen.getByRole('radio', { name: 'Current' }))
  for (const name of ['Client', 'vip']) fireEvent.click(screen.getByRole('button', { name }))
  act(() => { top = 430; window.dispatchEvent(new Event('scroll')) })
  control.focus(); fireEvent.click(control)
  expect(await screen.findByRole('heading', { name: 'Review possible duplicates' })).toHaveFocus()
  if (way === 'resolve final pair') {
    fireEvent.click(await screen.findByRole('button', { name: 'Keep both' }))
    await screen.findByText('All reviewed')
  }
  const back = way === 'Browser Back' ? screen.getByRole('button', { name: way }) : screen.getByRole('link', { name: 'Back to list' })
  back.focus(); fireEvent.click(back)
  const target = way === 'resolve final pair' ? await screen.findByRole('tab', { name: /^Work/ })
    : await screen.findByRole('button', { name: 'Possible duplicates' })
  await waitFor(() => expect(target).toHaveFocus())
  expect(target.isConnected).toBe(true)
  expect(screen.getByRole('searchbox')).toHaveValue('A')
  expect(screen.getByRole('radio', { name: 'Current' })).toHaveAttribute('aria-checked', 'true')
  for (const name of ['Client', 'vip']) expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
  expect(top).toBe(430)
})

async function mergeOnRoute() {
  fireEvent.click(await screen.findByRole('button', { name: 'Merge' }))
  const dialog = within(screen.getByRole('dialog'))
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Merge contacts' })).toBeEnabled())
  fireEvent.click(dialog.getByRole('button', { name: 'Merge contacts' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  return (await recoveryHistory())[0]
}

it('#65: mounted MergeSheet → lost runtime callbacks → remounted Review rebinds Undo with original expiry', async () => {
  await seed()
  const first = open('/review?tab=work&dupes=1')
  const entry = await mergeOnRoute()
  first.unmount()
  // Simulate a reload: no surviving callback or runtime metadata is needed.
  recoveryStore.list().forEach(item => recoveryStore.remove(item.id))
  const clock = vi.spyOn(Date, 'now').mockReturnValue(entry.at + 60000)
  open('/review?tab=work&dupes=1')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  expect(screen.queryByText('Undo unavailable')).not.toBeInTheDocument()
  expect(recoveryStore.list()[0]).toMatchObject({ id: entry.id, at: entry.at, ttlMs: RESTORE_UNDO_MS, available: true })
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  await waitFor(async () => expect(await repo.contactById('B')).toBeDefined())
  await waitFor(() => expect(screen.queryByText('Merged A and B')).not.toBeInTheDocument())
  expect(await recoveryHistory()).toEqual([])
  clock.mockRestore()
})

it.each(['Undo merge', 'Dismiss'])('#65: Settings %s removes the repository and Review action without losing move recovery', async action => {
  await seed(); open('/review?tab=work&dupes=1')
  const entry = await mergeOnRoute()
  act(() => recoveryStore.add({ id: 'review-move', label: 'Earlier move', at: Date.now(), onUndo() {}, onDismiss() {} }))
  fireEvent.click(screen.getByRole('button', { name: 'Visit Settings' }))
  const backup = await screen.findByText('Back up app data')
  fireEvent.click(backup)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo merge' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: action }))
  await waitFor(async () => expect(await recoveryHistory()).toEqual([]))
  // The runtime store is cleared a tick after the repository under full-suite load; wait for it.
  await waitFor(() => expect(recoveryStore.list().some(item => item.id === entry.id)).toBe(false))
  expect(recoveryStore.list().some(item => item.id === 'review-move')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Visit Review' }))
  await screen.findByRole('tab', { name: /^Work/ })
  expect(screen.queryByText('Merged A and B')).not.toBeInTheDocument()
  // The route can mount before its entrance animation has made it visible.
  await waitFor(() => expect(screen.getByText('Earlier move')).toBeVisible())
})

it('#65: failed persistent dismissal remains retryable and retains both copies until success', async () => {
  await seed(); open('/review?tab=work&dupes=1')
  const entry = await mergeOnRoute()
  vi.spyOn(repo, 'setMeta').mockRejectedValueOnce(new Error('Storage full'))
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(await screen.findByText('Could not dismiss. Please try again.')).toBeVisible()
  expect((await recoveryHistory()).some(item => item.id === entry.id)).toBe(true)
  expect(recoveryStore.list().some(item => item.id === entry.id)).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  await waitFor(async () => expect(await recoveryHistory()).toEqual([]))
  await waitFor(() => expect(screen.queryByText('Merged A and B')).not.toBeInTheDocument())
})

it('#65: remounting an expired merge does not offer an unavailable or renewed Undo', async () => {
  await seed()
  const first = open('/review?tab=work&dupes=1')
  const entry = await mergeOnRoute()
  first.unmount()
  vi.spyOn(Date, 'now').mockReturnValue(entry.at + RESTORE_UNDO_MS)
  open('/review?tab=work&dupes=1')
  await screen.findByText('All reviewed')
  expect(screen.queryByRole('region', { name: 'Pending recoveries' })).not.toBeInTheDocument()
  expect(screen.queryByText('Undo unavailable')).not.toBeInTheDocument()
  expect(await repo.contactById('B')).toBeUndefined()
})
