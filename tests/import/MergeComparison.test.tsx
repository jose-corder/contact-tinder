import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MergeComparison from '@/features/import/MergeComparison'
import MergeRecovery from '@/features/import/MergeRecovery'
import { db } from '@/db/schema'
import * as repo from '@/db/repo'
import { candidatePairs, mergePair } from '@/import/duplicates'
import { makeContact } from '@/import/contact'
import { emptyDecision } from '@/domain/types'
import { csvText } from '@/export/csv'
import { vcfText } from '@/export/vcf'
import { recoveryHistory } from '@/export/recovery'

const a = { ...makeContact({ displayName: 'Alice Work', phones: [{ value: '+12025550101' }], emails: [] }, 'csv')!, id: 'a' }
const b = { ...makeContact({ displayName: 'Bob Family', phones: a.phones, emails: [] }, 'csv')!, id: 'b' }
const ad = { ...emptyDecision('a', 12), bucket: 'work' as const, workStatus: 'current' as const, workTypes: ['namedrop' as const] }
const bd = { ...emptyDecision('b', 12), bucket: 'personal' as const, relation: 'family' as const, personalTypes: ['neighbor' as const] }
beforeEach(async () => {
  await repo.resetAll(); await repo.upsertContacts([a, b]); await repo.saveDecisions([ad, bd])
  await repo.setMeta('possibleDuplicates', candidatePairs([{ ids: ['a', 'b'], reason: 'shared phone' }], [a, b]))
  vi.stubGlobal('innerWidth', 320); vi.stubGlobal('innerHeight', 568)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('reviewed Merge UI at 320×568 (#58/#41)', () => {
  it('shows identities, actual shared values and both classifications; Cancel makes no writes', async () => {
    const before = await db.meta.toArray()
    const close = vi.fn(), merged = vi.fn()
    render(<MergeComparison open aId="a" bId="b" onClose={close} onMerged={merged} />)
    expect(await screen.findByText('+12025550101')).toBeVisible()
    expect(screen.getByText('Work · Current · Notable contact')).toBeVisible()
    expect(screen.getByText('Personal · Family · Neighbor')).toBeVisible()
    expect(screen.queryByText(/Name-drop flex/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Merge contacts' })).toBeDisabled()
    // Confirmation and errors share the existing Sheet scroll region, no growing fixed footer.
    expect(screen.getByRole('button', { name: 'Cancel merge' }).closest('.sheet-body')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel merge' }))
    expect(close).toHaveBeenCalledOnce(); expect(merged).not.toHaveBeenCalled()
    expect(await repo.allDecisions()).toEqual([ad, bd])
    expect(await db.meta.toArray()).toEqual(before)
  })

  it.each(['a', 'b', 'union'] as const)('requires reviewed %s choice and displays the same result as storage/export', async choice => {
    const merged = vi.fn()
    render(<MergeComparison open aId="a" bId="b" onClose={() => {}} onMerged={merged} />)
    const radios = await screen.findAllByRole('radio')
    fireEvent.click(radios[choice === 'a' ? 0 : choice === 'b' ? 1 : 2])
    const expected = choice === 'b' ? 'Personal · Family · Neighbor' : 'Work · Current · Notable contact'
    expect(within(screen.getByRole('region', { name: 'Merged result' })).getByText('Result: ' + expected)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Merge contacts' }))
    await waitFor(() => expect(merged).toHaveBeenCalledOnce())
    expect(await repo.allContacts()).toHaveLength(1)
    const rows = await repo.allWithDecisions()
    expect(rows[0].decision.bucket).toBe(choice === 'b' ? 'personal' : 'work')
    expect(vcfText(rows)).toContain(choice === 'b' ? 'Personal,Family,Neighbor' : 'Work,Current,Name-drop flex')
    expect(csvText(rows)).toContain(choice === 'b' ? 'Personal' : 'Name-drop flex')
    expect((await recoveryHistory())[0].kind).toBe('merge')
  })

  it('rejects changed data after review and offers a fresh comparison', async () => {
    render(<MergeComparison open aId="a" bId="b" onClose={() => {}} onMerged={() => {}} />)
    fireEvent.click((await screen.findAllByRole('radio'))[0])
    await repo.saveDecision({ ...ad, workStatus: 'old' })
    fireEvent.click(screen.getByRole('button', { name: 'Merge contacts' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh the comparison')
    expect(await repo.allContacts()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh comparison' }))
    expect(await screen.findByText('Work · Old · Notable contact')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Merge contacts' })).toBeDisabled()
  })
})

it('keeps merge recovery after remount and permits retry after a storage failure (#58/#61)', async () => {
  await mergePair('a', 'b', { keepDecisionFrom: 'a' })
  const first = render(<MergeRecovery />)
  await screen.findByRole('button', { name: 'Undo merge' })
  first.unmount()
  render(<MergeRecovery />)
  vi.spyOn(repo, 'saveDecisions').mockRejectedValueOnce(new Error('Full'))
  fireEvent.click(await screen.findByRole('button', { name: 'Undo merge' }))
  expect(await screen.findByText('Could not undo the merge. Try again.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Undo merge' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo merge' })).not.toBeInTheDocument())
  expect(await repo.allContacts()).toHaveLength(2)
})

it('retains recovery after a conflicting edit without overwriting newer work (#58)', async () => {
  await mergePair('a', 'b', { keepDecisionFrom: 'a' })
  render(<MergeRecovery />)
  await act(async () => { await db.contacts.update('a', { title: 'Changed' }) })
  fireEvent.click(await screen.findByRole('button', { name: 'Undo merge' }))
  expect(await screen.findByText(/Undo would overwrite newer work/)).toBeVisible()
  expect((await db.contacts.get('a'))!.title).toBe('Changed')
})
