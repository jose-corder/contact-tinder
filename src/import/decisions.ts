import type { Decision } from '@/domain/types'
import { allDecisions, saveDecisions } from '@/db/repo'

/** Called inside the import transaction, before superseded rows release their tags. */
export async function migrateDecisions(migrations: Array<{ from: string; to: string }>): Promise<number> {
  if (!migrations.length) return 0
  const byId = new Map((await allDecisions()).map((d) => [d.contactId, d]))
  const changed = new Map<string, Decision>()
  let count = 0
  for (const { from, to } of migrations) {
    const other = byId.get(from)
    if (!other) continue
    const survivor = changed.get(to) ?? byId.get(to)
    const base = !survivor || !survivor.bucket ? other : survivor
    changed.set(to, { ...base, contactId: to,
      customTags: [...new Set([...(survivor?.customTags ?? []), ...other.customTags])],
      updatedAt: Math.max(Date.now(), (survivor?.updatedAt ?? 0) + 1, other.updatedAt + 1),
    })
    count++
  }
  await saveDecisions([...changed.values()])
  return count
}
