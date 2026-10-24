export interface ImportProgress {
  parsed: number
  total?: number
  phase: 'reading' | 'parsing' | 'deduping' | 'saving'
}

export type OnProgress = (progress: ImportProgress) => void

export const CHUNK_SIZE = 200

export async function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) await scheduler.yield()
  else await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
