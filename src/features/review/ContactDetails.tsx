import type { Contact } from '@/domain/types'
import { CopyButton, formatDate, formatPhone } from '@/ui'
import { friendlyType } from '@/features/deck/CardFields'
import { sourceLabel } from '@/import/sourceLabel'
import { emailHref, phoneHref } from './safeLinks'
import { rawFields } from './rawFields'
export default function ContactDetails({ contact }: { contact: Contact }) {
  const values = [
    ...contact.phones.map(phone => ({ label: ['Phone', friendlyType(phone.type, 'Phone')].filter((v, i, all) => all.indexOf(v) === i).join(' · '), value: phone.value, display: formatPhone(phone.value), href: phoneHref(phone.value, phone.e164) })),
    ...contact.emails.map(email => ({ label: ['Email', friendlyType(email.type, 'Email')].filter((v, i, all) => all.indexOf(v) === i).join(' · '), value: email.value, display: email.value, href: emailHref(email.value) })),
  ]
  return <section aria-label="Contact values" className="border-y border-rule py-3">
    <dl className="space-y-3 pb-4 t-body">
      {values.map(({ label, value, display, href }, index) => <div key={index} className="flex items-center justify-between gap-3">
        <div className="min-w-0"><dt className="t-meta text-ink-2">{label}</dt><dd>{href ?
          <a className="hit-44 inline-flex items-center break-all underline" href={href}>{display}</a> : <span className="break-all">{display}</span>}</dd></div>
        <CopyButton value={value} label={value} />
      </div>)}
    </dl>
    <details>
      <summary className="hit-44 flex cursor-pointer items-center t-body">All fields</summary>
      <dl className="space-y-3 pb-4 t-body">
      {Object.entries({ 'Given name': contact.givenName, 'Family name': contact.familyName, Title: contact.title,
        Organization: contact.org, Notes: contact.notes, Source: sourceLabel(contact), Added: formatDate(contact.importedAt), Updated: contact.rev ? formatDate(contact.rev) : undefined,
      }).filter(([, value]) => value).map(([label, value]) => <div key={label}>
        <dt className="t-meta text-ink-2">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd>
      </div>)}
        {rawFields(contact.raw).map(({ label, value, href }, index) => <div key={index}>
          <dt className="t-meta text-ink-2">{label}</dt><dd className="whitespace-pre-wrap break-words">{href
            ? <a className="hit-44 inline-flex items-center break-all underline" href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value}</dd>
        </div>)}
      </dl>
      {contact.raw && <details><summary className="hit-44 flex cursor-pointer items-center t-meta">Original contact record</summary>
        <pre className="whitespace-pre-wrap break-all pb-4 t-meta">{contact.raw}</pre>
      </details>}
    </details>
  </section>
}
