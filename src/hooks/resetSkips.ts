import { allWithDecisions, saveDecisions } from '@/db/repo'
import { db } from '@/db/schema'
import { resetSkipsExact } from '@/domain/decks'
import { isUnsorted, PASS_ORDER } from '@/domain/taxonomy'
import type { Decision, Pass } from '@/domain/types'

/** Read and reset in one transaction so rendered snapshots never overwrite newer edits. */
export function resetSavedSkips(
  passes: readonly Pass[] = PASS_ORDER,
  select: (decision: Decision, pass: Pass) => boolean = isUnsorted,
) {
  return db.transaction('rw', db.contacts, db.decisions, db.tags, async () => {
    const current = await allWithDecisions()
    const now = Date.now()
    const rows = current.flatMap(row => {
      const intended = passes.filter(pass => select(row.decision, pass))
      return intended.length ? [{ ...row, decision: resetSkipsExact([row.decision], intended, now)[0] }] : []
    })
    await saveDecisions(rows.map(row => row.decision), { exact: true })
    return rows
  })
}
