import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { isInDeck, setBucket } from '@/domain/taxonomy'
import { homeProgress } from '@/features/home/progress'
import { vcfText } from '@/export/vcf'
import { restoreJson } from '@/export/json'
import ReviewScreen from '@/features/review/ReviewScreen'
import { canUndoDecisions, registerDecisionRecovery, undoDecisions } from '@/features/review/undo'
import { RecoveryBar, recoveryStore } from '@/ui'
import { row } from '../export/fixtures'

beforeEach(async () => {
  recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id))
  await repo.resetAll(); window.sessionStorage.clear()
})
afterEach(() => {
  cleanup(); recoveryStore.list().forEach(entry => recoveryStore.remove(entry.id))
  vi.restoreAllMocks(); vi.useRealTimers()
})
const open = (tab = 'work') => render(<MemoryRouter initialEntries={['/review?tab=' + tab]}><ReviewScreen /></MemoryRouter>)
async function seed(items: ReturnType<typeof row>[]) {
  await repo.upsertContacts(items.map(item => item.contact))
  await repo.saveDecisions(items.map(item => item.decision), { exact: true })
}

it('#5: row Undo survives ten seconds, tab changes and remount; storage failure is retryable', async () => {
  const item = row('Maria', { bucket: 'work', workStatus: 'current', customTags: ['vip'] })
  await seed([item])
  const view = open()
  fireEvent.click(await screen.findByRole('button', { name: 'More actions for Maria' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move to Personal' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const recovery = await screen.findByRole('region', { name: 'Pending recoveries' })
  expect(within(recovery).getByText('Maria → Personal')).toBeVisible()
  // Exercise the actual retention timer, beyond the former ten-second toast lifetime.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 11000)) })
  fireEvent.click(screen.getByRole('tab', { name: /^Personal/ }))
  view.unmount(); open('personal')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  vi.spyOn(repo, 'saveDecision').mockRejectedValueOnce(new Error('Temporary disk failure'))
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(await screen.findByText('Could not undo. Please try again.')).toBeVisible()
  expect((await repo.getDecision('Maria')).bucket).toBe('personal')
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  await waitFor(async () => expect(await repo.getDecision('Maria')).toEqual(item.decision))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Pending recoveries' })).not.toBeInTheDocument())
}, 30000)

it('#5: a bulk move stays recoverable after leaving the selected tab', async () => {
  const items = ['A', 'B', 'C'].map(id => row(id, { bucket: 'work', customTags: ['original'] }))
  await seed(items); open()
  await screen.findByRole('button', { name: /^View A/ })
  fireEvent.click(await screen.findByRole('button', { name: 'Select' }))
  await screen.findByRole('checkbox', { name: 'Select A' })
  fireEvent.click(screen.getByRole('button', { name: 'Select all 3 results' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move to…' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Personal' }))
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('tab', { name: /^Delete/ }))
  expect(screen.getByText('3 moved to Personal')).toBeVisible()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  await waitFor(async () => expect(await repo.allDecisions()).toEqual(items.map(item => item.decision)))
})

it.each([1, 2])('#55: %s-row recovery refuses a Merge restore that reuses updatedAt and stays dismissible', async count => {
  const items = ['A', 'B'].slice(0, count).map(id => row(id, { bucket: 'work', updatedAt: 1 }))
  await seed(items)
  const before = items.map(item => item.decision)
  const after = before.map(d => setBucket(d, 'personal', 2))
  await repo.saveDecisions(after)
  registerDecisionRecovery({ before, after }, 'Moved contacts')
  const changed = { ...after.at(-1)!, customTags: ['from backup'] }
  await restoreJson(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(),
    contacts: [items.at(-1)!.contact], decisions: [changed] }), 'merge')
  const tags = await db.tags.toArray()
  expect(await canUndoDecisions({ before, after })).toBe(false)
  await expect(undoDecisions({ before, after })).rejects.toBeInstanceOf(repo.StaleDecisionError)
  render(<RecoveryBar />)
  expect(await screen.findByRole('button', { name: 'Changed since' })).toBeDisabled()
  expect(await repo.getDecision(changed.contactId)).toEqual(changed)
  if (count === 2) expect(await repo.getDecision('A')).toEqual(after[0])
  expect(await db.tags.toArray()).toEqual(tags)
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  await waitFor(() => expect(screen.queryByText('Moved contacts')).not.toBeInTheDocument())
})

it.each([1, 2])('#61: %s-row Undo restores legacy decisions exactly, including tags, skips and unfinished membership', async count => {
  const items = ['Legacy', 'Second'].slice(0, count).map(id => row(id, { bucket: 'personal', personalTypes: ['neighbor'],
    customTags: ['school'], skips: { triage: 1, work: 1, personal: 1 }, updatedAt: 17 }))
  await seed(items)
  const before = items.map(item => item.decision), after = before.map(d => setBucket(d, 'work', 18))
  const tags = await db.tags.toArray(), progress = homeProgress(await repo.allWithDecisions())
  await repo.saveDecisions(after)
  const save = vi.spyOn(repo, 'saveDecision')
  await undoDecisions({ before, after })
  expect(await repo.allDecisions()).toEqual(before)
  for (const decision of before) {
    // #61: the repository now guards full content and contact existence.
    expect(save).toHaveBeenCalledWith(decision, { exact: true, expectedDecision: after.find(d => d.contactId === decision.contactId), requireContact: true })
    expect(isInDeck(await repo.getDecision(decision.contactId), 'personal')).toBe(true)
  }
  expect(await db.tags.toArray()).toEqual(tags)
  expect(homeProgress(await repo.allWithDecisions())).toEqual(progress)
  expect(vcfText(await repo.allWithDecisions())).not.toContain('Other')
})

it('#55: failure during the second exact write rolls back the first and permits retry', async () => {
  // #61: recovery fixtures represent existing contacts, not orphan decisions.
  await repo.upsertContacts(['A', 'B'].map(id => row(id).contact))
  const before = ['A', 'B'].map(id => row(id, { bucket: 'work', customTags: ['old'], updatedAt: 1 }).decision)
  const after = before.map(d => ({ ...setBucket(d, 'personal', 2), customTags: ['new'] }))
  await repo.saveDecisions(after)
  let writes = 0
  const fail = () => { if (++writes === 2) throw new Error('Storage failure') }
  db.decisions.hook('updating', fail)
  try { await expect(undoDecisions({ before, after })).rejects.toThrow('Storage failure') }
  finally { db.decisions.hook('updating').unsubscribe(fail) }
  expect(await repo.allDecisions()).toEqual(after)
  expect(await repo.allTags()).toEqual(['new'])
  await act(async () => { await undoDecisions({ before, after }) })
  expect(await repo.allDecisions()).toEqual(before)
  expect(await repo.allTags()).toEqual(['old'])
})
