import { motionProps } from './motion'
import { motion } from 'framer-motion'
import { useId, useRef } from 'react'
import { useMediaQuery } from './useMediaQuery'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  count?: number
  /** Panel should use role="tabpanel" and aria-labelledby={`${panelId}-tab`}. */
  panelId?: string
}

export function Segmented<T extends string>({ options, value, onChange, className = '' }: {
  options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; className?: string
}) {
  const id = useId()
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const selected = Math.max(0, options.findIndex((option) => option.value === value))
  return <div role="tablist" className={`flex gap-5 border-b border-rule ${className}`}>
    {options.map((option, index) => {
      const active = option.value === value
      return <button key={option.value} type="button" role="tab"
        ref={(node) => { tabs.current[index] = node }}
        id={option.panelId ? `${option.panelId}-tab` : `${id}-${option.value}`}
        aria-controls={option.panelId} aria-selected={active} tabIndex={index === selected ? 0 : -1}
        onClick={() => onChange(option.value)}
        onKeyDown={(event) => {
          let next: number
          switch (event.key) {
            case 'ArrowLeft': next = (index - 1 + options.length) % options.length; break
            case 'ArrowRight': next = (index + 1) % options.length; break
            case 'Home': next = 0; break
            case 'End': next = options.length - 1; break
            default: return
          }
          event.preventDefault()
          onChange(options[next].value)
          tabs.current[next]?.focus({ preventScroll: true })
        }}
        className={`hit-44 relative -mb-px flex h-11 items-center justify-center gap-1.5 font-sans t-body transition-colors ${active ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}>
        {option.label}
        {option.count !== undefined && <span className="tabular t-meta text-ink-2">{option.count}</span>}
        {active && <motion.span aria-hidden="true" layoutId={reduced ? undefined : `${id}-underline`}
          {...motionProps(reduced)}
          className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" />}
      </button>
    })}
  </div>
}
