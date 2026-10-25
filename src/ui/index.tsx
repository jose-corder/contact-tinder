// UI primitives. Keep these dumb and styled with tokens from index.css.
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { IconChevronLeft } from './icons'
import { toneColors, type ChipTone } from './tones'
export { Sheet, type SheetProps } from './Sheet'
export { SheetFooterActions, type SheetFooterActionsProps } from './SheetFooterActions'
export { SheetConfirm, type SheetConfirmProps } from './SheetConfirm'
export { RecoveryBar, type RecoveryBarProps } from './RecoveryBar'
export { useRecoveryStore, recoveryStore, type RecoveryEntry, type StoredRecoveryEntry } from './recoveryStore'
export { Segmented, type SegmentedOption } from './Segmented'
export { InlineNotice, LabelDot, CopyButton } from './feedback'
export type { ChipTone } from './tones'
export { useMediaQuery } from './useMediaQuery'
export { RadioGroup, type RadioOption, type RadioGroupProps } from './RadioGroup'
export { motionProps } from './motion'
export { formatDate, formatPhone } from './format'
export { ErrorBoundary } from './ErrorBoundary'
export { toast, dismissToast, Toaster, ToastDock, useToastHeight, type ToastHandle, type ToastOptions, type ToastTone } from './toast'
export { useConstrainedViewport, type ConstrainedViewport } from './useConstrainedViewport'
export { ScrollFallback, type ScrollFallbackProps } from './ScrollFallback'
export { useScreenContext } from './useScreenContext'
export { FieldList, type Field } from './FieldList'
export { useLongPressCopy, type LongPressCopyOptions } from './useLongPressCopy'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

// ----- layout -----

/** Page wrapper: 440px max, 20px gutters, safe-area aware. */
export function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('ui-frame mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5', className)}
      style={{
        paddingLeft: 'max(20px, env(safe-area-inset-left))',
        paddingRight: 'max(20px, env(safe-area-inset-right))',
      }}
    >
      {children}
    </div>
  )
}

export interface TopBarProps {
  title: string
  /** Right side, e.g. "142 / 913" */
  right?: ReactNode
  /** 0..1 fills the 2px progress hairline; omit to hide it. */
  progress?: number
  /** Where the back chevron goes; omit to hide. */
  backTo?: string
}

export function TopBar({ title, right, progress, backTo }: TopBarProps) {
  return (
    <header className="mb-4">
      <div className="ui-topbar flex h-11 items-center justify-between">
        <div className="flex items-center gap-2">
          {backTo && (
            <Link to={backTo} aria-label="Back" className="hit-44 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:text-ink">
              <IconChevronLeft />
            </Link>
          )}
          <span className="eyebrow t-eyebrow">{title}</span>
        </div>
        {right !== undefined && <span className="tabular t-meta text-ink-2">{right}</span>}
      </div>
      <div className={cx('relative h-px w-full', progress === undefined ? 'bg-rule' : 'bg-progress-track')}>
        {progress !== undefined && (
          <div
            className="absolute -top-px left-0 h-[2px] bg-ink transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        )}
      </div>
    </header>
  )
}

export function Rule({ className }: { className?: string }) {
  return <div className={cx('w-full border-t border-rule', className)} />
}

// ----- buttons -----

type ButtonVariant = 'primary' | 'outline' | 'ghost'
type ButtonSize = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', full, loading, disabled, children, className, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(
        'hit-44 relative inline-flex items-center justify-center gap-2 rounded-full font-sans t-body font-medium transition-colors duration-150 active:scale-[0.98] disabled:opacity-40',
        size === 'md' ? 'h-11 px-5' : 'h-13 px-6',
        variant === 'primary' && 'bg-ink text-paper hover:opacity-90',
        variant === 'outline' && 'border border-control bg-transparent text-ink hover:bg-paper-2',
        variant === 'ghost' && 'bg-transparent text-ink-2 hover:text-ink',
        full && 'w-full',
        className,
      )}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <>
        <span aria-hidden="true" className="invisible inline-flex items-center gap-2">{children}</span>
        <span aria-hidden="true" className="button-spinner absolute size-4 rounded-full border border-current border-r-transparent" />
      </> : children}
      {loading && <VisuallyHidden>{children}</VisuallyHidden>}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  caption?: string
  size?: number
  /** CSS color for the glyph (and border on hover). */
  color?: string
}

/** Round hairline-bordered button for the action bar. */
export function IconButton({ label, caption, size = 56, color, className, style, children, ...rest }: IconButtonProps) {
  const button = (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'hit-44 inline-flex items-center justify-center rounded-full border border-control bg-paper-2 transition-transform duration-150 active:scale-[0.98] disabled:opacity-40',
        className,
      )}
      style={{ width: size, height: size, color: color ?? 'var(--ink)', ...style } as CSSProperties}
      {...rest}
    >
      {children}
    </button>
  )
  return caption ? <span className="inline-flex flex-col items-center gap-1.5">{button}<span className="eyebrow t-eyebrow">{caption}</span></span> : button
}

// ----- chips -----

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onToggle'> {
  label: string
  selected?: boolean
  /** Fill color when selected. Defaults to ink. */
  color?: string
  /** Semantic selected fill and accessible foreground; takes precedence over color. */
  tone?: ChipTone
}

export function Chip({ label, selected, tone, color = 'var(--ink)', className, style, ...rest }: ChipProps) {
  const fill = tone ? toneColors[tone].fill : color
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'chip-hit min-w-0 max-w-full inline-flex h-9 items-center rounded-full border px-3.5 font-sans t-meta transition-colors duration-150 select-none',
        selected ? 'border-transparent text-paper' : 'border-control bg-transparent text-ink hover:bg-paper-2',
        className,
      )}
      style={{ ...(selected ? { background: fill, borderColor: fill, ...(tone ? { color: toneColors[tone].on } : {}) } : {}), ...style } as CSSProperties}
      {...rest}
    >
      <span className="chip-label">{label}</span>
    </button>
  )
}

// ----- avatar -----

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, photo, size = 72 }: { name: string; photo?: Blob; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!photo) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(photo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-rule bg-paper"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={cx('font-serif text-ink', size * 0.36 <= 14 ? 'serif-small' : size * 0.36 < 32 && 'serif-text')}
          style={{ fontSize: size * 0.36, letterSpacing: '0.02em', ...(size * 0.36 >= 32 ? { fontVariationSettings: "'opsz' 144" } : {}) }}>
          {initialsOf(name)}
        </span>
      )}
    </div>
  )
}

// ----- misc -----

export function VisuallyHidden({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('sr-only', className)} {...props} />
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cx('skeleton rounded bg-paper-2', className)} {...props} />
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <h2 className="font-serif serif-text t-title text-ink">{title}</h2>
      {children && <div className="mt-3 max-w-[280px] t-body text-ink-2">{children}</div>}
    </div>
  )
}
