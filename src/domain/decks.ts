import { normalizeDecision, PASS_ORDER, toggleChip } from './taxonomy'
import type { Counts, Decision, Pass, PersonalType, WorkType } from './types'

/** Type-only Personal completion has an explicit, exportable relation (#7). */
export function completePersonalTypes(decision: Decision): Decision {
  return normalizeDecision(decision)
}

export function toggleDeckType(decision: Decision, pass: Pass, key: WorkType | PersonalType): Decision {
  // #60: selecting a chip is a draft edit; only an explicit completion infers Other.
  return toggleChip(decision, pass, key)
}

export function nextUnfinishedPass(pass: Pass, counts: Counts): Pass | undefined {
  const remaining: Record<Pass, number> = {
    triage: counts.undecided - counts.unsorted.triage,
    work: counts.bucket.work - Object.values(counts.workStatus).reduce((a, b) => a + b, 0) - counts.unsorted.work,
    personal: counts.bucket.personal - Object.values(counts.relation).reduce((a, b) => a + b, 0) - counts.unsorted.personal,
  }
  // Continue forward first, then include unfinished earlier or scoped passes.
  const start = PASS_ORDER.indexOf(pass) + 1
  return [...PASS_ORDER.slice(start), ...PASS_ORDER.slice(0, start)].find((p) => remaining[p] > 0)
}

/** Queue helpers are immutable and preserve the identity of every item. */
export function enqueueSkipped<T>(queue: readonly T[], item: T): T[] {
  return [...queue, item]
}

export function removeTop<T>(queue: readonly T[]): T[] {
  return queue.slice(1)
}

export function reinsertFront<T>(queue: readonly T[], item: T): T[] {
  return [item, ...queue]
}

/** Progress is a fraction in [0, 1]; an empty deck has no progress to show. */
export function progressOf(done: number, remaining: number): number {
  const completed = Math.max(0, done)
  const total = completed + Math.max(0, remaining)
  return total ? completed / total : 0
}
