import type { Contact } from '@/domain/types'
import { phoneHref, emailHref } from '@/features/review/safeLinks'
import { readRawFields } from '@/import/rawFields'
import { rawCards } from '@/import/metadata'
import { FieldList, type Field } from '@/ui'

/** #42/#46: shared field presentation and all preserved source records. */
export function CardFields({ contact }: { contact: Contact }) {
  const fields: Field[] = [
    ...[['Given name', contact.givenName], ['Family name', contact.familyName], ['Role', contact.title], ['Org', contact.org]]
      .flatMap(([label, value]) => value ? [{ label: label!, value }] : []),
    ...contact.phones.map(phone => ({ label: friendlyType(phone.type, 'Phone'), value: phone.value,
      href: phoneHref(phone.value, phone.e164), copy: true })),
    ...contact.emails.map(email => ({ label: friendlyType(email.type, 'Email'), value: email.value,
      href: emailHref(email.value), copy: true })),
    ...(contact.notes ? [{ label: 'Notes', value: contact.notes }] : []),
    ...readRawFields(contact).map(field => ({ ...field, copy: true })),
  ]
  return <>
    <FieldList fields={fields} />
    {rawCards(contact).filter(Boolean).map((raw, index) => <details key={index} className="border-t border-rule pt-2">
      <summary className="hit-44 cursor-pointer content-center t-meta">Original record {index + 1}</summary>
      <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] t-meta select-text">{raw}</pre>
    </details>)}
  </>
}

export function friendlyType(type: string | undefined, fallback: string): string {
  const t = (type ?? '').toLowerCase().split(/[,;\s]+/).filter((p) => p && !['internet', 'pref', 'voice', 'x-mobile'].includes(p))
  const map: Record<string, string> = { cell: 'Mobile', mobile: 'Mobile', iphone: 'Mobile', main: 'Main', work: 'Work', home: 'Home', fax: 'Fax', other: fallback }
  const first = t[0]
  return !first ? fallback : map[first] ?? first.charAt(0).toUpperCase() + first.slice(1)
}
