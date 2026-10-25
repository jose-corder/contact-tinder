import { useState, type ReactNode } from 'react'
import { IconButton } from './index'
import { IconCopy } from './icons'
import { toast } from './toast'
import { toneColors, type ChipTone } from './tones'

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
  const [busy, setBusy] = useState(false)
  return <IconButton type="button" size={44} label={`Copy ${label}`} disabled={busy} onClick={async () => {
    setBusy(true)
    try { await navigator.clipboard.writeText(value); toast('Copied') }
    catch { toast('Could not copy. Try selecting the text.', { tone: 'delete' }) }
    finally { setBusy(false) }
  }}><IconCopy /></IconButton>
}
