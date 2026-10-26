import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { readFileSync } from 'node:fs'
import { resetAll, upsertContacts } from '@/db/repo'
import HomeScreen from '@/features/home/HomeScreen'
import SettingsScreen from '@/features/home/SettingsScreen'
import { row } from '../export/fixtures'

beforeEach(resetAll)
afterEach(cleanup)

it('gives the compact stepper three equal columns with each count below its label (#4)', async () => {
  await upsertContacts([row('Ada').contact])
  render(<MemoryRouter><HomeScreen /></MemoryRouter>)
  const steps = await screen.findByRole('list', { name: 'Sorting passes' })
  expect(steps).toHaveClass('grid-cols-3')
  const items = within(steps).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  for (const item of items) {
    expect(item.children[0]).toHaveClass('home-step-label')
    expect(item.children[1]).toHaveClass('block', 'tabular')
  }
  const css = readFileSync('src/features/home/HomeScreen.css', 'utf8')
  expect(css).toContain('gap: 24px')
  expect(css).toContain('@media (width < 360px)')
  expect(css).toContain('grid-column: 1 / -1')
  expect(css).toContain('(orientation: landscape) and (height < 500px)')
  expect(css).toContain('.home-progress { grid-area: 1 / 2; }')
})

it('keeps desktop counts beside the resume card with a 32px gutter and bounded width (#7)', async () => {
  await upsertContacts([row('Ada').contact])
  const { container } = render(<MemoryRouter><HomeScreen /></MemoryRouter>)
  const counts = await screen.findByRole('navigation', { name: 'Contact counts' })
  expect(counts.parentElement).toBe(screen.getByRole('region', { name: 'Continue sorting' }).parentElement)
  expect(container.querySelector('.ui-frame')).toHaveClass('lg:max-w-[920px]')
  const css = readFileSync('src/features/home/HomeScreen.css', 'utf8')
  expect(css).toContain('column-gap: 32px')
  expect(css).toContain('.home-counts { grid-area: 1 / 2 / 3 / 3; }')
})

it('uses 24px section padding and 44px controls throughout Settings (#5)', async () => {
  render(<MemoryRouter><SettingsScreen /></MemoryRouter>)
  await screen.findByText('No backup exported yet.')
  for (const heading of screen.getAllByRole('heading', { level: 2 })) {
    expect(heading.closest('section')).toHaveClass('py-6')
  }
  for (const control of [...screen.getAllByRole('radio'), ...screen.getAllByRole('switch')]) {
    expect(control).toHaveClass('hit-44')
  }
  expect(screen.getByRole('switch', { name: 'Ask for type after swipe' })).toHaveClass('shrink-0')
})
