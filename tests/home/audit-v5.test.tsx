import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import * as repo from '@/db/repo'
import { db } from '@/db/schema'
import { emptyDecision, type Contact } from '@/domain/types'
import { resetSkipsExact } from '@/domain/decks'
import { resetSavedSkips } from '@/hooks/resetSkips'
import { homeProgress } from '@/features/home/progress'
import HomeScreen from '@/features/home/HomeScreen'
import { groupFiles } from '@/export/vcf'

const contact = (id: string): Contact => ({ id, displayName: id, phones: [], emails: [], raw: '',
  source: 'demo', importedAt: 1, phoneKeys: [], emailKeys: [] })
const legacy = { ...emptyDecision('personal', 10), bucket: 'personal' as const, personalTypes: ['neighbor' as const],
  customTags: ['saved'], skips: { triage: 1, work: 1, personal: 2 } }
const work = { ...emptyDecision('work', 20), bucket: 'work' as const, workTypes: ['client' as const],
  customTags: ['work'], skips: { triage: 1, work: 2, personal: 1 } }
beforeEach(repo.resetAll)
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function open() {
  render(<MemoryRouter><Routes><Route path="/" element={<HomeScreen />} />
    <Route path="/deck/personal" element={<p>Personal destination</p>} />
    <Route path="/deck/work" element={<p>Work destination</p>} /></Routes></MemoryRouter>)
}

it('#64 Home Retry preserves restored type-only Personal semantics and opens a populated deck', async () => {
  await repo.restoreAll({ version: 1, exportedAt: new Date().toISOString(), contacts: [contact('personal')], decisions: [legacy] })
  open()
  const retry = await screen.findByRole('button', { name: 'Retry skipped' })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  const save = vi.spyOn(repo, 'saveDecisions')
  fireEvent.click(retry)
  await screen.findByText('Personal destination')
  const saved = await repo.getDecision('personal')
  expect(saved).toEqual({ ...legacy, skips: { ...legacy.skips, personal: 0 }, updatedAt: expect.any(Number) })
  expect(saved.relation).toBeUndefined()
  expect(saved.updatedAt).toBeGreaterThan(legacy.updatedAt)
  expect(save).toHaveBeenCalledWith([saved], { exact: true })
  expect(await repo.deckContacts('personal')).toHaveLength(1)
  expect(homeProgress(await repo.allWithDecisions()).percent).toBe(0)
  expect(groupFiles(await repo.allWithDecisions()).some(file => file.filename === 'personal-other.vcf')).toBe(false)
  expect(await db.tags.toArray()).toEqual([{ name: 'saved', count: 1 }])
})

it('#64 mixed retry resets only unfinished skipped passes and preserves newer edits read inside the operation', async () => {
  const finished = { ...work, contactId: 'finished', workStatus: 'current' as const }
  await repo.upsertContacts(['personal', 'work', 'finished'].map(contact))
  await repo.saveDecisions([legacy, work, finished], { exact: true })
  open()
  const retry = await screen.findByRole('button', { name: 'Retry skipped' })
  const latest = { ...legacy, personalTypes: ['service' as const], customTags: ['new'], updatedAt: Date.now() + 1000 }
  // The write happens when Retry reads, after the dashboard's older snapshot was rendered.
  const read = repo.allWithDecisions
  vi.spyOn(repo, 'allWithDecisions').mockImplementationOnce(async () => {
    await repo.saveDecision(latest, { exact: true })
    return read()
  })
  fireEvent.click(retry)
  await screen.findByText('Work destination')
  const personal = await repo.getDecision('personal')
  expect(personal).toEqual({ ...latest, skips: { ...latest.skips, personal: 0 }, updatedAt: latest.updatedAt + 1 })
  expect(await repo.getDecision('work')).toEqual({ ...work, skips: { ...work.skips, work: 0 }, updatedAt: expect.any(Number) })
  expect(await repo.getDecision('finished')).toEqual(finished)
  expect(await repo.deckContacts('personal')).toHaveLength(1)
  expect(await repo.deckContacts('work')).toHaveLength(1)
})

it('#64 a failure after the first reset rolls back the whole batch and Home can retry', async () => {
  await repo.upsertContacts(['personal', 'work'].map(contact))
  await repo.saveDecisions([legacy, work], { exact: true })
  const tags = await db.tags.toArray()
  open()
  const retry = await screen.findByRole('button', { name: 'Retry skipped' })
  const put = db.decisions.put.bind(db.decisions)
  const write = vi.spyOn(db.decisions, 'put').mockImplementationOnce(put)
    .mockImplementationOnce(() => { throw new Error('Unavailable') })
  fireEvent.click(retry)
  expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was changed')
  expect(write).toHaveBeenCalledTimes(2)
  expect(await repo.getDecision('personal')).toEqual(legacy)
  expect(await repo.getDecision('work')).toEqual(work)
  expect(await db.tags.toArray()).toEqual(tags)
  write.mockRestore()
  await waitFor(() => expect(retry).toBeEnabled())
  await act(async () => { fireEvent.click(retry) })
  await screen.findByText('Work destination')
  expect((await repo.getDecision('personal')).skips.personal).toBe(0)
  expect((await repo.getDecision('work')).skips.work).toBe(0)
})

it('#64 reset skips is pure and never fills in a missing relationship', () => {
  const before = structuredClone(legacy)
  Object.freeze(before.skips); Object.freeze(before)
  const [reset] = resetSkipsExact([before], ['personal'])
  expect(reset).toEqual({ ...legacy, skips: { ...legacy.skips, personal: 0 }, updatedAt: 11 })
  expect(before).toEqual(legacy)
})

it('#64 retry does not resurrect a removed contact or a decision completed before the operation', async () => {
  await repo.upsertContacts(['personal', 'work'].map(contact))
  await repo.saveDecisions([legacy, work], { exact: true })
  await repo.deleteContacts(['personal'])
  const completed = { ...work, workStatus: 'current' as const }
  await repo.saveDecision(completed)
  expect(await resetSavedSkips()).toEqual([])
  expect(await db.decisions.get('personal')).toBeUndefined()
  expect(await repo.getDecision('work')).toEqual(completed)
})
