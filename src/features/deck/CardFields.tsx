import type { Contact } from '@/domain/types'

export function CardFields({ contact, full, hold }: { contact: Contact; full?: boolean; hold: (value: string) => void }) {
  const phones = full ? contact.phones : contact.phones.slice(0, 2)
  const emails = full ? contact.emails : contact.emails.slice(0, 2)
  return <>
    <dl className="grid shrink-0 grid-cols-[76px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2 text-[15px]">
      {full && [['Given name', contact.givenName], ['Family name', contact.familyName], ['Role', contact.title], ['Org', contact.org]].map(([label, value]) => value && <Field key={label} label={label!} value={value} full />)}
      {phones.map((phone, index) => <Field key={'phone-' + index} label={friendlyType(phone.type, 'Phone')} value={phone.value} phone full={full} href={full ? 'tel:' + (phone.e164 || phone.value) : undefined} onHold={() => hold(phone.value)} />)}
      {emails.map((email, index) => <Field key={'email-' + index} label={friendlyType(email.type, 'Email')} value={email.value} full={full} />)}
      {full && extraFields(contact.raw).map(([label, value], index) => <Field key={index} label={label} value={value} full />)}
    </dl>
    {contact.notes && <p className={'break-words text-[15px] text-ink-2 ' + (full ? 'whitespace-pre-wrap' : 'line-clamp-2')}>{contact.notes}</p>}
  </>
}

function Field({ label, value, phone, full, href, onHold }: { label: string; value: string; phone?: boolean; full?: boolean; href?: string; onHold?: () => void }) {
  return <><dt className="eyebrow truncate text-ink-2" title={label}>{label}</dt><dd className={'min-w-0 ' + (full ? 'break-words whitespace-pre-wrap ' : 'truncate ') + (phone ? 'tabular min-h-11 min-w-11 content-center' : '')} title={value} onPointerDown={onHold} onContextMenu={phone ? (event) => event.preventDefault() : undefined}>
    {href ? <a href={href} className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4" onClick={(event) => event.stopPropagation()}>{value}</a> : value}
  </dd></>
}

/** Show fields preserved by the importer but not projected onto Contact (addresses, dates, URLs…). */
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

/** Turn vCard TYPE params (CELL, INTERNET, pref, voice...) into a short human label. */
export function friendlyType(type: string | undefined, fallback: string): string {
  const t = (type ?? '').toLowerCase().split(/[,;\s]+/).filter((p) => p && !['internet', 'pref', 'voice', 'x-mobile'].includes(p))
  const map: Record<string, string> = { cell: 'Mobile', mobile: 'Mobile', iphone: 'Mobile', main: 'Main', work: 'Work', home: 'Home', fax: 'Fax', other: fallback }
  const first = t[0]
  if (!first) return fallback
  return map[first] ?? first.charAt(0).toUpperCase() + first.slice(1)
}
