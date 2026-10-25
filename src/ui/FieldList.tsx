import { CopyButton } from './feedback'

export interface Field { label: string; value: string; href?: string; copy?: boolean }
function safeHref(href?: string): string | undefined {
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return undefined
  try {
    const url = new URL(href)
    return ['https:', 'http:', 'tel:', 'mailto:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

/** Values stay readable and selectable; copying is opt-in. */
export function FieldList({ fields }: { fields: Field[] }) {
  return <dl className="field-list">
    {fields.map((field, index) => {
      const href = safeHref(field.href)
      const external = href?.startsWith('http')
      return <div className="field-row" key={`${field.label}:${index}`}>
        <dt className="t-meta text-ink-2 break-words">{field.label}</dt>
        <dd className="m-0 flex min-w-0 items-start gap-2 t-body">
          {href ? <a className="hit-44 min-w-0 flex-1 content-center break-all underline underline-offset-4"
            href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{field.value}</a>
            : <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{field.value}</span>}
          {field.copy && <CopyButton value={field.value} label={field.label} />}
        </dd>
      </div>
    })}
  </dl>
}
