import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { resetAll, saveDecision, upsertContacts } from '@/db/repo'
import { decisionLabels } from '@/domain/taxonomy'
import ReviewScreen from '@/features/review/ReviewScreen'
import { row } from '../export/fixtures'

beforeEach(async () => { await resetAll(); window.sessionStorage.clear() })
afterEach(cleanup)
it('#41: Review rows, filters and editor show Notable contact while export labels stay stable', async () => {
  const item = row('Maria', { bucket: 'work', workTypes: ['namedrop'] })
  await upsertContacts([item.contact]); await saveDecision(item.decision)
  render(<MemoryRouter initialEntries={['/review?tab=work']}><ReviewScreen /></MemoryRouter>)
  await screen.findByRole('button', { name: 'View Maria, Work, Notable contact' })
  fireEvent.click(screen.getByRole('button', { name: 'Notable contact' }))
  const contact = screen.getByRole('button', { name: 'View Maria, Work, Notable contact' })
  expect(contact).toBeVisible()
  expect(screen.queryByText('Name-drop flex')).not.toBeInTheDocument()
  fireEvent.click(contact)
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Notable contact' })).toHaveAttribute('aria-pressed', 'true')
  expect(decisionLabels(item.decision)).toContain('Name-drop flex')
})
