import type { Contact } from '@/domain/types'
import { formatDate } from '@/ui/format'
import { metadata, rawCards } from './metadata'
import { emailKey, phoneKey } from './dedupe'
import { structured } from './vcard'
import { dateText, type DetailKind } from './details'
import { binaryProperty, decodeQuotedPrintable, logicalLines, property, unescapeValue } from './vcardCodec'

export interface RawField {
  label: string
  value: string
  href?: string
  kind: 'phone' | 'email' | 'url' | 'date' | 'address' | 'text'
}
const skip = new Set(['BEGIN', 'END', 'VERSION', 'FN', 'N', 'PHOTO', 'REV', 'X-ABLABEL', 'KEY', 'LOGO', 'SOUND'])
const labels: Record<string, string> = { ADR: 'Address', BDAY: 'Birthday', URL: 'Website',
  NICKNAME: 'Nickname', ANNIVERSARY: 'Anniversary', UID: 'Contact ID', PRODID: 'Created by',
  TEL: 'Phone', EMAIL: 'Email', ORG: 'Organization', TITLE: 'Role', NOTE: 'Notes' }
const decoded = (prop: NonNullable<ReturnType<typeof property>>) =>
  prop.params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE'
    ? decodeQuotedPrintable(prop.value, prop.params.get('CHARSET')?.[0]) : prop.value

function dateValue(value: string, params: Map<string, string[]>): string {
  if (params.get('VALUE')?.[0]?.toLowerCase() === 'text') return value
  const normalized = dateText(value, params.get('X-APPLE-OMIT-YEAR')?.[0])
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const date = new Date(normalized + 'T00:00:00Z')
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === normalized) return formatDate(normalized)
  }
  return normalized
}

export function websiteHref(value: string): string | undefined {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

/** #42/#46: decoded, deduplicated extras from every source card, including merged records.
 * Core values already projected onto Contact are omitted; secondary differing values survive.
 * For original-record disclosure use rawCards(contact) from import/metadata alongside this reader.
 */
export function readRawFields(contact: Contact): RawField[] {
  const result: RawField[] = []
  const seen = new Set<string>()
  const country = metadata(contact).defaultCountry
  const phoneIdentity = (value: string) => phoneKey(value, country) ?? value.trim()
  const phones = new Set(contact.phones.map(phone => phoneIdentity(phone.e164 ?? phone.value)))
  const emails = new Set(contact.emails.map(email => emailKey(email.value) ?? email.value.trim()))
  for (const raw of rawCards(contact)) {
    const props = logicalLines(raw).map(property).filter(prop => !!prop)
    const groups = new Map(props.filter(prop => prop.group && prop.name === 'X-ABLABEL')
      .map(prop => [prop.group!, unescapeValue(decoded(prop)).replace(/^_\$!<|>!\$_$/g, '')]))
    for (const prop of props) {
      const key = prop.name
      if (skip.has(key) || binaryProperty(prop) || (key.startsWith('X-') && prop.value.length > 500)) continue
      const original = decoded(prop)
      let value = unescapeValue(original).trim()
      let kind: RawField['kind'] = 'text'
      let href: string | undefined
      if (key === 'ADR') { value = structured(original).filter(Boolean).join(', ') || prop.params.get('LABEL')?.[0]?.trim() || ''; kind = 'address' }
      if (key === 'BDAY' || key === 'ANNIVERSARY' || key === 'X-ABDATE') { value = dateValue(value, prop.params); kind = 'date' }
      if (key === 'URL') { kind = 'url'; href = websiteHref(value) }
      if (key === 'ORG') {
        value = structured(original).filter(Boolean).join(' · ')
        if (value === contact.org) continue
      }
      if (key === 'TITLE' && value === contact.title) continue
      if (key === 'NOTE' && value.split('\n').every(line => contact.notes?.split('\n').includes(line))) continue
      if (key === 'TEL') {
        kind = 'phone'; value = value.replace(/^tel:/i, '')
        if (phones.has(phoneIdentity(value))) continue
        if (/^\+?[\d ().-]+(?:;ext=\d+)?$/.test(value)) href = 'tel:' + value.replace(/[ ().-]/g, '')
      }
      if (key === 'EMAIL') {
        kind = 'email'; value = value.replace(/^mailto:/i, '')
        if (emails.has(emailKey(value) ?? value)) continue
        if (/^[^\s@?&#]+@[^\s@?&#]+$/.test(value)) href = 'mailto:' + encodeURIComponent(value).replace(/%40/g, '@')
      }
      const label = (prop.group && groups.get(prop.group)) || labels[key] || key
      const identity = JSON.stringify([kind, label, value])
      if (!value || seen.has(identity)) continue
      seen.add(identity)
      result.push({ label, value, kind, ...(href ? { href } : {}) })
    }
  }
  // CSV and phone-picker imports store their extra columns as details instead of a source card.
  for (const detail of metadata(contact).details ?? []) {
    const name = DETAIL_LABELS[detail.kind]
    const label = detail.kind === 'other' ? detail.label || name : detail.label ? `${name} · ${detail.label}` : name
    const href = detail.kind === 'website' ? websiteHref(detail.value) : undefined
    const kind: RawField['kind'] = detail.kind === 'address' ? 'address' : detail.kind === 'website' ? 'url' : 'text'
    const identity = JSON.stringify([kind, label, detail.value])
    if (seen.has(identity)) continue
    seen.add(identity)
    result.push({ label, value: detail.value, kind, ...(href ? { href } : {}) })
  }
  return result
}

const DETAIL_LABELS: Record<DetailKind, string> = { prefix: 'Name prefix', middle: 'Middle name', suffix: 'Name suffix',
  nickname: 'Nickname', address: 'Address', birthday: 'Birthday', anniversary: 'Anniversary', date: 'Date', website: 'Website',
  social: 'Social profile', messaging: 'Messaging', related: 'Related person', group: 'Group', other: 'Other' }
