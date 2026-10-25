import type { ReactNode } from 'react'
import { IconCheck, IconCopy } from './icons'
import { toneColors, type ChipTone } from './tones'
import { useCopyFeedback } from './useCopyFeedback'

type NoticeTone = 'info' | 'error' | 'success'
const noticeColors: Record<NoticeTone, string> = {
  info: 'var(--ink-2)', error: 'var(--stamp-delete)', success: 'var(--stamp-personal)',
}

export function InlineNotice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  return <div role={tone === 'error' ? 'alert' : 'status'}
    className="border-l pl-3 font-sans t-meta" style={{ borderColor: noticeColors[tone], color: noticeColors[tone] }}>{children}</div>
}

export function LabelDot({ tone, label, size = 6 }: { tone: ChipTone | NoticeTone | 'default'; label?: string; size?: number }) {
  const color = tone === 'default' ? 'var(--ink)' : tone in noticeColors
    ? noticeColors[tone as NoticeTone] : toneColors[tone as ChipTone].fill
  return <span className="inline-flex items-center gap-1.5 t-meta text-ink-2">
    <span aria-hidden="true" className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
    {label}
  </span>
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { busy, result, copy, status, fallback } = useCopyFeedback(value)
  return <span className="inline-flex min-w-0 items-center gap-2">
    <button type="button" aria-label={`Copy ${label}`} disabled={busy} aria-busy={busy || undefined}
      className="hit-44 inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-control bg-paper-2 px-3 t-meta disabled:opacity-40"
      onClick={copy}>{result === 'Copied' ? <IconCheck /> : <IconCopy />}
      {status}
    </button>
    {fallback}
  </span>
}
