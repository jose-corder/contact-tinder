import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { allDecisions, getMeta, resetAll, saveDecisions, setMeta, upsertContacts } from '@/db/repo'
import { db } from '@/db/schema'
import ReviewScreen from '@/features/review/ReviewScreen'
import { prepareReswipe } from '@/features/review/reswipe'
import { row } from '../export/fixtures'

beforeEach(resetAll)
afterEach(cleanup)
function Destination() {
  const location = useLocation()
  return <output aria-label="Deck request">{JSON.stringify({ path: location.pathname, state: location.state })}</output>
}
function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/review" element={<ReviewScreen />} />
    <Route path="/deck/:pass" element={<Destination />} />
  </Routes></MemoryRouter>)
}

it('review_reswipe_scopes_real_decks_and_orders_mixed_passes: route and persistent contract', async () => {
  const rows = [
    row('A personal', { bucket: 'personal', skips: { triage: 0, work: 0, personal: 2 } }),
    row('B work', { bucket: 'work', skips: { triage: 0, work: 2, personal: 0 } }),
    row('Z triage', { skips: { triage: 2, work: 0, personal: 0 } }),
    row('Unrelated work', { bucket: 'work' }),
  ]
  await upsertContacts(rows.map(({ contact }) => contact))
  await saveDecisions(rows.map(({ decision }) => decision))
  open('/review?tab=unsorted')
  fireEvent.click(await screen.findByRole('button', { name: 'Re-swipe these' }))
  const ids = ['A personal', 'B work', 'Z triage']
  expect(JSON.parse((await screen.findByLabelText('Deck request')).textContent!)).toEqual({
    path: '/deck/triage', state: { only: ids },
  })
  expect(await getMeta('deckScope', null)).toEqual({ pass: 'triage', ids, createdAt: expect.any(Number) })
})

it('persists a one-contact scope for Jump to deck', async () => {
  const rows = [row('A', { bucket: 'work', workStatus: 'old' }), row('B', { bucket: 'work' })]
  await upsertContacts(rows.map(({ contact }) => contact))
  await saveDecisions(rows.map(({ decision }) => decision))
  open('/review?tab=work')
  fireEvent.click(await screen.findByRole('button', { name: 'View A' }))
  fireEvent.click(screen.getByRole('button', { name: 'Jump to deck' }))
  expect(JSON.parse((await screen.findByLabelText('Deck request')).textContent!)).toEqual({ path: '/deck/work', state: { only: ['A'] } })
  expect(await getMeta('deckScope', null)).toEqual({ pass: 'work', ids: ['A'], createdAt: expect.any(Number) })
})

it('rolls back the reset if persisting the scope fails', async () => {
  const rows = [row('A', { bucket: 'work', workStatus: 'old' })]
  await upsertContacts(rows.map(({ contact }) => contact))
  await saveDecisions(rows.map(({ decision }) => decision))
  const previousScope = { pass: 'personal', ids: ['previous'], createdAt: 1 }
  await setMeta('deckScope', previousScope)
  const rejectScope = () => { throw new Error('Metadata write rejected') }
  db.meta.hook('updating', rejectScope)
  try {
    await expect(prepareReswipe(rows, 'work')).rejects.toThrow('Metadata write rejected')
    expect(await allDecisions()).toEqual(rows.map(({ decision }) => decision))
    expect(await getMeta('deckScope', null)).toEqual(previousScope)
  } finally { db.meta.hook('updating').unsubscribe(rejectScope) }
})
