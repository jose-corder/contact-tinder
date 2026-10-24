import { IconCheck } from '@/ui/icons'
import { cx } from '@/ui'
import type { homeProgress } from './progress'

export default function ProgressOverview({ progress, total }: { progress: ReturnType<typeof homeProgress>; total: number }) {
  const circumference = 2 * Math.PI * 44
  return <section aria-label="Sorting progress" className="mb-6">
    <div className="mb-6 flex items-center gap-5">
      <div className="relative h-24 w-24 shrink-0" role="progressbar" aria-label="Overall completion"
        aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
          <circle cx="48" cy="48" r="44" stroke="var(--rule)" strokeWidth="1.5" />
          <circle cx="48" cy="48" r="44" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - (total ? progress.completed / total : 0))} transform="rotate(-90 48 48)" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-serif text-[26px] tabular">{progress.percent}%</span>
      </div>
      <div><h2 className="font-serif text-2xl">A little more clarity.</h2><p className="mt-2 text-sm text-ink-2 tabular">{progress.completed} of {total} contacts sorted</p></div>
    </div>
    <ol aria-label="Sorting passes" className="grid grid-cols-3 border-t border-rule">
      {progress.steps.map((step, index) => {
        const done = step.done === step.total && (step.total > 0 || !progress.current || index < progress.steps.indexOf(progress.current))
        const current = progress.current?.pass === step.pass
        return <li key={step.pass} aria-current={current ? 'step' : undefined} className={cx('relative pt-3', !done && !current && 'text-ink-2')}>
          <span className={cx('absolute -top-[4px] left-0 h-[7px] w-[7px] rounded-full border bg-paper', done || current ? 'border-ink' : 'border-rule')} />
          <span className="flex items-center gap-1.5 text-[13px]">{done && <IconCheck size={14} />}{step.title}</span>
          <span className="mt-1 block text-xs text-ink-2 tabular">{step.done} / {step.total}</span>
        </li>
      })}
    </ol>
  </section>
}
