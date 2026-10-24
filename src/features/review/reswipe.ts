import { db } from '@/db/schema'
import { saveDecisions, setMeta, type ContactWithDecision } from '@/db/repo'
import { resetForReview, type ReviewTab } from './model'

/** Keep the reset and its reload-safe scope together, including on storage failure. */
export async function prepareReswipe(rows: ContactWithDecision[], tab: ReviewTab) {
  const { decisions, pass } = resetForReview(rows, tab)
  const ids = rows.map(({ contact }) => contact.id)
  await db.transaction('rw', db.decisions, db.tags, db.meta, async () => {
    await saveDecisions(decisions)
    await setMeta('deckScope', { pass, ids, createdAt: Date.now() })
  })
  return { pass, ids }
}
