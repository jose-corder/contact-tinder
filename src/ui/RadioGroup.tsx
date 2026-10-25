import { useRef } from 'react'

export interface RadioOption<T extends string> { value: T; label: string; disabled?: boolean }
export interface RadioGroupProps<T extends string> {
  label: string
  options: RadioOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  disabled?: boolean
}

/** Single-choice controls without tab panels. Arrows select and wrap; Tab leaves the group. */
export function RadioGroup<T extends string>({ label, options, value, onChange, className = '', disabled }: RadioGroupProps<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const enabled = options.flatMap((option, index) => !disabled && !option.disabled ? [index] : [])
  const selected = options.findIndex(option => option.value === value)
  const entry = enabled.includes(selected) ? selected : enabled[0]
  return <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={`flex flex-wrap gap-2 ${className}`}>
    {options.map((option, index) => <button key={option.value} type="button" role="radio"
      ref={node => { buttons.current[index] = node }} aria-checked={option.value === value}
      disabled={disabled || option.disabled} tabIndex={index === entry ? 0 : -1}
      className={`hit-44 rounded-full border border-control px-4 t-meta transition-colors ${option.value === value ? 'bg-ink text-paper' : 'bg-paper text-ink'} disabled:opacity-40`}
      onClick={() => onChange(option.value)} onKeyDown={event => {
        if (!enabled.length) return
        const position = enabled.indexOf(index)
        let next: number
        switch (event.key) {
          case 'ArrowRight': case 'ArrowDown': next = (position + 1) % enabled.length; break
          case 'ArrowLeft': case 'ArrowUp': next = (position - 1 + enabled.length) % enabled.length; break
          case 'Home': next = 0; break
          case 'End': next = enabled.length - 1; break
          default: return
        }
        event.preventDefault()
        onChange(options[enabled[next]].value)
        buttons.current[enabled[next]]?.focus({ preventScroll: true })
      }}>{option.label}</button>)}
  </div>
}
