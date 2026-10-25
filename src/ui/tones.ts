export type ChipTone = 'delete' | 'work' | 'personal' | 'skip' | 'old' | 'current' | 'potential' | 'ink'

export const toneColors: Record<ChipTone, { fill: string; on: string }> = {
  delete: { fill: 'var(--stamp-delete)', on: 'var(--on-delete)' },
  work: { fill: 'var(--stamp-work)', on: 'var(--on-work)' },
  personal: { fill: 'var(--stamp-personal)', on: 'var(--on-personal)' },
  skip: { fill: 'var(--stamp-skip)', on: 'var(--on-skip)' },
  old: { fill: 'var(--status-old)', on: 'var(--on-status-old)' },
  current: { fill: 'var(--status-current)', on: 'var(--on-status-current)' },
  potential: { fill: 'var(--status-potential)', on: 'var(--on-status-potential)' },
  ink: { fill: 'var(--ink)', on: 'var(--paper)' },
}
