import type { ReactNode } from 'react'

export interface SheetSectionProps { title: string; children: ReactNode; help?: ReactNode }

/** Shared classification rhythm for follow-up and review row sheets. */
export function SheetSection({ title, children, help }: SheetSectionProps) {
  return <section className="sheet-section">
    <div className="t-eyebrow text-ink-2">{title}</div>
    {children}
    {help && <p className="sheet-section-help t-meta text-ink-2">{help}</p>}
  </section>
}
