import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import RowSheet from '@/features/review/RowSheet'
import { emailHref, phoneHref } from '@/features/review/safeLinks'
import { row } from '../export/fixtures'

afterEach(cleanup)

it('mailto_reserved_characters_cannot_add_headers', () => {
  const contact = row('Unsafe values')
  const emails = ['friend@example.test?bcc=other@example.test&subject=hello', 'a@example.test\r\nbcc:b@example.test',
    'a@example.test,b@example.test', 'a%0Abcc@example.test', 'a@example.test\n', 'a..b@example.test']
  const phones = ['123;phone-context=evil.test', '123?body=hello', '123;ext=2;ext=3', '123\n', 'javascript:123', '12+34']
  contact.contact.emails = emails.map((value) => ({ value }))
  contact.contact.phones = phones.map((value) => ({ value }))
  render(<MemoryRouter><RowSheet row={contact} onClose={vi.fn()} /></MemoryRouter>)
  // Audit #23/#46: compact identity precedes classification; remaining values are in All fields.
  fireEvent.click(screen.getByText('All fields'))
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Copy Phone' })).toHaveLength(phones.length)
  expect(screen.getAllByRole('button', { name: 'Copy Email' })).toHaveLength(emails.length)
})

it('encodes valid email addresses and permits only supported dial characters and extensions', () => {
  expect(emailHref('first.last+work@example.test')).toBe('mailto:first.last%2Bwork%40example.test')
  expect(emailHref(`a@${'x'.repeat(64)}.test`)).toBeUndefined()
  expect(phoneHref('+1 (202) 555-0101;ext=42')).toBe('tel:+12025550101;ext=42')
  expect(phoneHref('*123#')).toBe('tel:*123#')
  expect(phoneHref('555.0101', '+15550101')).toBe('tel:+15550101')
  expect(phoneHref('555.0101', '+15550101?body=bad')).toBe('tel:5550101')
})
