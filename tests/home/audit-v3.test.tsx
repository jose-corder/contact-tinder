import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as repo from '@/db/repo'
import { backupJson, restoreJson, RESTORE_UNDO_MS, restoreHistory } from '@/export/json'
import { candidatePairs, savePairResolution } from '@/import/duplicates'
import HomeScreen from '@/features/home/HomeScreen'
import SettingsScreen from '@/features/home/SettingsScreen'
import InstallRow from '@/features/home/InstallRow'
import { row } from '../export/fixtures'

beforeEach(repo.resetAll)
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('#54/#35/#41: Home links unresolved pairs and distinguishes classified, sorted and waiting', async () => {
  const rows = [row('Work', { bucket: 'work' }), row('Waiting')]
  await repo.upsertContacts(rows.map(r => r.contact)); await repo.saveDecisions(rows.map(r => r.decision))
  const pairs = candidatePairs([{ ids: ['Work', 'Waiting'], reason: 'shared email' }], rows.map(r => r.contact))
  await repo.setMeta('possibleDuplicates', pairs)
  render(<MemoryRouter><HomeScreen /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: 'Possible duplicates · 1' })).toHaveAttribute('href', '/review?dupes=1')
  expect(screen.getByText('1 classified, 0 fully sorted')).toBeVisible()
  expect(screen.getByText('1 waiting in Review')).toBeVisible()
  await act(async () => { await savePairResolution(pairs[0].id, 'kept') })
  await waitFor(() => expect(screen.queryByRole('link', { name: /Possible duplicates/ })).not.toBeInTheDocument())
})

it('#41: Data recovery copy appears for a real entry and disappears at expiry', async () => {
  await restoreJson(await backupJson())
  render(<MemoryRouter><SettingsScreen /></MemoryRouter>)
  const copy = await screen.findByText('You can undo a restore for 10 minutes')
  expect(within(copy.closest('section')!).getByRole('heading', { name: 'Data' })).toBeVisible()
  const history = await restoreHistory()
  await act(async () => { await repo.setMeta('restoreHistory', history.map(entry => ({ ...entry, at: Date.now() - RESTORE_UNDO_MS }))) })
  await waitFor(() => expect(screen.queryByText('You can undo a restore for 10 minutes')).not.toBeInTheDocument())
})

it.each(['iPhone AppleWebKit/605.1 Mobile Instagram', 'iPhone Version/18.0 Mobile Safari/605.1 FBAN/FBIOS'])('#37: embedded iOS browser gives Safari fallback: %s', userAgent => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  render(<InstallRow />)
  expect(screen.getByText('Open this page in Safari to install')).toBeVisible()
  expect(screen.queryByText('Share → Add to Home Screen')).not.toBeInTheDocument()
})
