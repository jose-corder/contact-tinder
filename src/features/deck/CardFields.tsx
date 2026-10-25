import type { Contact } from '@/domain/types'
import { phoneHref, emailHref } from '@/features/review/safeLinks'
import { formatPhone } from '@/ui/format'
import { CopyButton } from '@/ui'

export function CardFields({ contact, full, hold }: { contact: Contact; full?: boolean; hold: (value: string) => void }) {
  const phones = full ? contact.phones : contact.phones.slice(0, 2)
  const emails = full ? contact.emails : contact.emails.slice(0, 2)
  return <>
    <dl className="deck-full-fields grid shrink-0 gap-3 t-body">
      {full && [['Given name', contact.givenName], ['Family name', contact.familyName], ['Role', contact.title], ['Org', contact.org]].map(([label, value]) => value && <Field key={label} label={label!} value={value} />)}
      {phones.map((phone, index) => <Field key={'phone-' + index} label={friendlyType(phone.type, 'Phone')} value={phone.value}
        display={formatPhone(phone.value)} href={full ? phoneHref(phone.value, phone.e164) : undefined} copy={full} onHold={full ? undefined : () => hold(phone.value)} />)}
      {emails.map((email, index) => <Field key={'email-' + index} label={friendlyType(email.type, 'Email')} value={email.value}
        href={full ? emailHref(email.value) : undefined} copy={full} />)}
      {full && extraFields(contact.raw).map(([label, value], index) => <Field key={index} label={label} value={value} />)}
    </dl>
    {contact.notes && <p className="break-words whitespace-pre-wrap t-body text-ink-2">{contact.notes}</p>}
  </>
}

function Field({ label, value, display = value, href, copy, onHold }: { label: string; value: string; display?: string; href?: string; copy?: boolean; onHold?: () => void }) {
  return <div className="min-w-0">
    <dt className="t-meta text-ink-2">{label}</dt>
    <dd className="flex min-w-0 items-center gap-2" onPointerDown={onHold}>
      <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
        {href ? <a href={href} className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4" onClick={(event) => event.stopPropagation()}>{display}</a> : display}
      </span>
      {copy && <CopyButton value={value} label={`${label.toLowerCase()} ${value}`} />}
    </dd>
  </div>
}

/** Show fields preserved by the importer but not projected onto Contact. */
function extraFields(raw: string): [string, string][] {
  const mapped = new Set(['BEGIN', 'END', 'VERSION', 'UID', 'PRODID', 'FN', 'N', 'ORG', 'TITLE', 'TEL', 'EMAIL', 'PHOTO', 'NOTE', 'REV'])
  const labels: Record<string, string> = { ADR: 'Address', BDAY: 'Birthday', URL: 'Website', NICKNAME: 'Nickname', ANNIVERSARY: 'Anniversary' }
  return raw.replace(/\r?\n[ \t]/g, '').split(/\r?\n/).flatMap((line) => {
    const colon = line.indexOf(':')
    if (colon < 0) return []
    const key = line.slice(0, colon).split(';')[0].split('.').at(-1)!.toUpperCase()
    if (mapped.has(key)) return []
    const value = line.slice(colon + 1).replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1').replace(/;/g, ' · ')
    return value ? [[labels[key] || key, value] as [string, string]] : []
  })
}

export function friendlyType(type: string | undefined, fallback: string): string {
  const t = (type ?? '').toLowerCase().split(/[,;\s]+/).filter((p) => p && !['internet', 'pref', 'voice', 'x-mobile'].includes(p))
  const map: Record<string, string> = { cell: 'Mobile', mobile: 'Mobile', iphone: 'Mobile', main: 'Main', work: 'Work', home: 'Home', fax: 'Fax', other: fallback }
  const first = t[0]
  return !first ? fallback : map[first] ?? first.charAt(0).toUpperCase() + first.slice(1)
}
