import type { Contact } from '@/domain/types'
import { CopyButton } from '@/ui'
import { sourceLabel } from '@/import/sourceLabel'
import { emailHref, phoneHref } from './safeLinks'

export function formattedDate(value: string | number): string | undefined {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
const typeLabels: Record<string, string> = { CELL: 'Mobile', HOME: 'Home', WORK: 'Work', INTERNET: 'Email', VOICE: 'Voice' }
const friendlyType = (type?: string) => type?.split(',').map(value => typeLabels[value.toUpperCase()] ?? value).join(', ')
export default function ContactDetails({ contact }: { contact: Contact }) {
  const values = [
    ...contact.phones.map(phone => ({ label: ['Phone', friendlyType(phone.type)].filter(Boolean).join(' · '), value: phone.value, href: phoneHref(phone.value, phone.e164) })),
    ...contact.emails.map(email => ({ label: ['Email', friendlyType(email.type)].filter(Boolean).join(' · '), value: email.value, href: emailHref(email.value) })),
  ]
  return <details className="border-y border-rule">
    <summary className="hit-44 flex cursor-pointer items-center t-body">Details</summary>
    <dl className="space-y-3 pb-4 t-body">
      {values.map(({ label, value, href }, index) => <div key={index} className="flex items-center justify-between gap-3">
        <div className="min-w-0"><dt className="t-meta text-ink-2">{label}</dt><dd>{href ?
          <a className="hit-44 inline-flex items-center break-all underline" href={href}>{value}</a> : <span className="break-all">{value}</span>}</dd></div>
        <CopyButton value={value} label={value} />
      </div>)}
      {Object.entries({ 'Given name': contact.givenName, 'Family name': contact.familyName, Title: contact.title,
        Notes: contact.notes, Source: sourceLabel(contact), Added: formattedDate(contact.importedAt), Updated: contact.rev ? formattedDate(contact.rev) : undefined,
      }).filter(([, value]) => value).map(([label, value]) => <div key={label}>
        <dt className="t-meta text-ink-2">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd>
      </div>)}
    </dl>
  </details>
}
