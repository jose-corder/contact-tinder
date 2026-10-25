import { IconCheck } from '@/ui/icons'
import { cx } from '@/ui'
import type { homeProgress } from './progress'

export default function ProgressOverview({ progress, total, unsorted = 0 }: { progress: ReturnType<typeof homeProgress>; total: number; unsorted?: number }) {
  const circumference = 2 * Math.PI * 32
  return <section aria-label="Sorting progress" className="my-5 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 lg:col-start-1">
    <div className="relative h-[72px] w-[72px] shrink-0" role="progressbar" aria-label="Overall completion"
      aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={progress.completed + ' of ' + total + ' fully sorted'}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <circle cx="36" cy="36" r="32" stroke="var(--progress-track)" strokeWidth="1.5" />
        <circle cx="36" cy="36" r="32" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (total ? progress.completed / total : 0))} transform="rotate(-90 36 36)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-serif t-heading tabular">{progress.percent}%</span>
    </div>
    <div className="min-w-0 flex-1">
      <h2 className="mb-3 font-serif t-heading">{progress.percent}% fully sorted.</h2>
      <ol aria-label="Sorting passes" className="grid grid-cols-3 gap-2">
        {progress.steps.map((step, index) => {
          const done = step.done === step.total && (step.total > 0 || !progress.current || index < progress.steps.indexOf(progress.current))
          const current = progress.current?.pass === step.pass
          return <li key={step.pass} aria-current={current ? 'step' : undefined} className={cx(!done && !current && 'text-ink-2')}>
            <span className="flex items-center gap-1 t-meta">
              {done ? <IconCheck size={14} /> : <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full border border-control', current && 'bg-ink')} />}
              {step.title}
            </span>
            <span className="mt-1 block t-meta text-ink-2 tabular">{step.done} / {step.total}</span>
          </li>
        })}
      </ol>
    </div>
    {progress.classified !== progress.completed && <p className="col-span-2 t-meta text-ink-2 tabular">{progress.classified} classified, {progress.completed} fully sorted</p>}
    {unsorted > 0 && <p className="col-span-2 t-meta text-ink-2 tabular">{unsorted} waiting in Review</p>}
  </section>
}
