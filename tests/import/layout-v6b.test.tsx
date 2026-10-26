import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import ImportScreen from '@/features/import/ImportScreen'

afterEach(cleanup)

it('lets the import headline balance inside a 160px minimum zone with 24px padding (#6)', () => {
  render(<MemoryRouter><ImportScreen /></MemoryRouter>)
  const input = screen.getByLabelText('Choose contact files')
  expect(input.closest('label')).toHaveClass('min-h-40', 'p-6')
  expect(input.closest('label')).not.toHaveClass('min-h-48', 'py-8')
  expect(screen.getByText('Choose your contacts file')).toHaveClass('text-balance')
  expect(input).toHaveAttribute('accept', '.vcf,.vcard,.csv,text/vcard,text/x-vcard,text/csv')
})
