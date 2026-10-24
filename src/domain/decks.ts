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
