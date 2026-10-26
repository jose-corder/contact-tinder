import type { Contact } from '@/domain/types'
import { CopyButton, FieldList, formatDate, formatPhone, type Field } from '@/ui'
import { friendlyType } from '@/features/deck/CardFields'
import { readRawFields } from '@/import/rawFields'
import { rawCards } from '@/import/metadata'
import { sourceLabel } from '@/import/sourceLabel'
import { emailHref, phoneHref } from './safeLinks'
import './RowSheet.css'

/** #23: essential identity remains ahead of all classification controls. */
export function ContactIdentity({ contact }: { contact: Contact }) {
  const phone = contact.phones[0], email = contact.emails[0]
  const values = [
    { label: 'Name', value: contact.displayName, display: contact.displayName, href: undefined },
    ...(phone ? [{ label: 'Phone', value: phone.value, display: formatPhone(phone.value), href: phoneHref(phone.value, phone.e164) }] : []),
    ...(email ? [{ label: 'Email', value: email.value, display: email.value, href: emailHref(email.value) }] : []),
  ]
  return <section aria-label="Contact identity" className="review-identity">
    {values.map(({ label, value, display, href }) => <div key={label} className="review-identity-row">
      <div className="min-w-0">
        {label === 'Name' ? <h2 className="break-words font-serif t-title">{display}</h2> : href ?
          <a className="hit-44 inline-flex items-center break-all underline t-body" href={href}>{display}</a> :
          <span className="break-all t-body">{display}</span>}
      </div>
      <CopyButton value={value} label={value} />
    </div>)}
    {contact.org && <p className="mt-2 break-words t-meta text-ink-2">{contact.org}</p>}
  </section>
}

/** #46: the shared reader includes extras from every merged source record. */
export function ContactFields({ contact }: { contact: Contact }) {
  const fields: Field[] = [
    ...contact.phones.map(phone => ({ label: [...new Set(['Phone', friendlyType(phone.type, 'Phone')])].join(' · '), value: phone.value,
      href: phoneHref(phone.value, phone.e164), copy: true })),
    ...contact.emails.map(email => ({ label: [...new Set(['Email', friendlyType(email.type, 'Email')])].join(' · '), value: email.value,
      href: emailHref(email.value), copy: true })),
    ...Object.entries({ 'Given name': contact.givenName, 'Family name': contact.familyName, Title: contact.title,
      Organization: contact.org, Notes: contact.notes, Source: sourceLabel(contact), Added: formatDate(contact.importedAt),
      Updated: contact.rev ? formatDate(contact.rev) : undefined,
    }).flatMap(([label, value]) => value ? [{ label, value }] : []),
    ...readRawFields(contact),
  ]
  return <details className="border-y border-rule">
    <summary className="hit-44 flex cursor-pointer items-center t-body">All fields</summary>
    <FieldList fields={fields} />
    {rawCards(contact).map((raw, index) => <details key={index}>
      <summary className="hit-44 flex cursor-pointer items-center t-meta">Original contact record {index + 1}</summary>
      <pre className="whitespace-pre-wrap break-all pb-4 t-meta">{raw}</pre>
    </details>)}
  </details>
}
