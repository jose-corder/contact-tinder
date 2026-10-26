import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { resetAll, upsertContacts } from '@/db/repo'
import ExportScreen from '@/features/export/ExportScreen'
import { row } from './fixtures'

beforeEach(resetAll)
afterEach(cleanup)

it('puts a short inclusion summary before the export action and platform instructions after it (#5)', async () => {
  await upsertContacts([row('Ada').contact])
  render(<MemoryRouter><ExportScreen /></MemoryRouter>)
  const heading = await screen.findByRole('heading', { name: 'Clean address book' })
  const section = heading.closest('section')!
  const button = within(section).getByRole('button', { name: /clean address book/ })
  const summary = within(section).getByText('Everything except Delete, including unsorted contacts.')
  const instructions = within(section).getByText(/Import this vCard into your phone/)
  expect(summary.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(button.compareDocumentPosition(instructions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(section).getByText(/1 contacts · contacts-clean.vcf/)).toHaveClass('t-meta')
})
