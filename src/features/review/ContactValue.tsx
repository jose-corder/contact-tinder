import { toast } from '@/ui/toast'

export default function ContactValue({ label, value, href }: { label: string; value: string; href: string }) {
  return <div className="flex items-center justify-between gap-3">
    <div className="min-w-0"><dt className="text-ink-2">{label}</dt><dd><a href={href} className="inline-flex min-h-11 items-center break-all underline underline-offset-4">{value}</a></dd></div>
    <button type="button" aria-label={`Copy ${value}`} className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={async () => {
      try { await navigator.clipboard.writeText(value); toast('Copied') }
      catch { toast('Could not copy. Touch and hold the value to copy it.') }
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" />
      </svg>
    </button>
  </div>
}
