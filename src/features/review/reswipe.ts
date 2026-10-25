import { setMeta, type ContactWithDecision } from '@/db/repo'
import { reviewPass, type ReviewTab } from './model'

/** Navigation only: the deck replaces a decision only when the user swipes. */
export async function prepareReswipe(rows: ContactWithDecision[], tab: ReviewTab) {
  const pass = reviewPass(rows, tab)
  const ids = rows.map(({ contact }) => contact.id)
  await setMeta('deckScope', { pass, ids, createdAt: Date.now(), mode: 'reclassify' })
  return { pass, ids }
}
