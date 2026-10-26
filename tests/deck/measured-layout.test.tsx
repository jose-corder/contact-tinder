import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { FollowUpSheet } from '@/features/deck/FollowUpSheet'
import { SwipeCard } from '@/features/deck/SwipeCard'
import { emptyDecision, type Contact } from '@/domain/types'

const contact: Contact = { id: 'layout', displayName: 'Ana Ruiz', phones: [], emails: [], raw: '',
  source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] }
afterEach(cleanup)

it('keeps the serif identity compact when the fitted phone card is shorter than 350px', () => {
  render(<SwipeCard contact={{ ...contact, displayName: 'Daniel Rey Montemayor' }} stageHeight={300} />)
  expect(screen.getByRole('heading', { name: 'Daniel Rey Montemayor' })).toHaveClass('t-title')
})

it('keeps both hidden faces inert through a round-trip flip', () => {
  render(<SwipeCard contact={contact} />)
  const front = screen.getByRole('button', { name: 'View all fields' }).closest('.deck-face')!
  const back = document.querySelector('[data-deck-details]')!
  expect(back).toHaveAttribute('inert')
  fireEvent.click(screen.getByRole('button', { name: 'View all fields' }))
  expect(front).toHaveAttribute('inert')
  expect(front).toHaveAttribute('aria-hidden', 'true')
  expect([...document.querySelectorAll('[inert] button')].map(button => button.textContent)).toContain('View all fields')
  expect(back).not.toHaveAttribute('inert')
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(front).not.toHaveAttribute('inert')
  expect(back).toHaveAttribute('inert')
  expect(back).toHaveAttribute('aria-hidden', 'true')
})

it('opens follow-up on the heading for pointer input and groups status, helper and type with one rhythm', () => {
  fireEvent.pointerDown(window)
  render(<FollowUpSheet target={{ contact, decision: { ...emptyDecision(contact.id), bucket: 'work' } }} onClose={() => {}} />)
  expect(screen.getByRole('heading', { name: 'work contact' })).toHaveFocus()
  const sections = document.querySelectorAll('.sheet-section')
  expect(sections).toHaveLength(2)
  expect(sections[0]).toContainElement(screen.getByRole('group', { name: 'Status' }))
  expect(sections[0]).toContainElement(screen.getByText('Choose a status to finish, or leave it for Later.'))
  expect(sections[1]).toHaveTextContent('Type')
  expect(screen.getByText('Settings').parentElement).toHaveTextContent('Turn this off in Settings.')
})

it('sizes the keyboard legend to its text and hides it on narrow or coarse-pointer screens', () => {
  const css = readFileSync('src/features/deck/deck.css', 'utf8')
  expect(css).toMatch(/\.deck-keyboard-help \{[^}]*min-width: max-content;[^}]*white-space: nowrap;/)
  expect(css).toContain('@media (max-width: 359px), (pointer: coarse) { .deck-keyboard-help { display: none; } }')
})
