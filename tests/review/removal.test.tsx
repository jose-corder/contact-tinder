import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { allTags, contactById, resetAll, saveDecisions, upsertContacts } from '@/db/repo'
import ReviewScreen from '@/features/review/ReviewScreen'
import { row } from '../export/fixtures'

beforeEach(resetAll)
afterEach(cleanup)

it('remove_contact_updates_vocabulary and live Review tag filters', async () => {
  const rows = [row('A', { bucket: 'work', customTags: ['private-client', 'shared'] }),
    row('B', { bucket: 'work', customTags: ['shared'] })]
  await upsertContacts(rows.map(({ contact }) => contact))
  await saveDecisions(rows.map(({ decision }) => decision))
  render(<MemoryRouter initialEntries={['/review?tab=work']}><ReviewScreen /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'private-client' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'View A' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove from app' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.queryByRole('button', { name: 'private-client' })).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'shared' })).toBeInTheDocument()
  expect(await allTags()).toEqual(['shared'])
  expect(await contactById('A')).toBeUndefined()
  expect(screen.getByRole('button', { name: 'View B' })).toBeInTheDocument()
})
