import type { Contact } from '@/domain/types'
import { emailKey, phoneKey } from './dedupe'
import { metadata, rawCards } from './metadata'
import { structured } from './vcard'
import { binaryProperty, decodeQuotedPrintable, logicalLines, property, unescapeValue } from './vcardCodec'

/**
 * Everything on a contact beyond the core projection (name, org, phones, emails, notes): addresses,
 * dates, websites, social profiles, related people and vendor fields. vCard contacts are read from
 * their source cards on demand; CSV and phone-picker contacts store the same shape at import time.
 */
export type DetailKind = 'prefix' | 'middle' | 'suffix' | 'nickname' | 'address' | 'birthday' | 'anniversary' | 'date'
  | 'website' | 'social' | 'messaging' | 'related' | 'group' | 'other'

export interface PostalAddress { street?: string; city?: string; region?: string; postalCode?: string; country?: string }

export interface ContactDetail {
  kind: DetailKind
  value: string
  label?: string
  address?: PostalAddress
}

type Prop = NonNullable<ReturnType<typeof property>>

const decoded = (prop: Prop) => prop.params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE'
  ? decodeQuotedPrintable(prop.value, prop.params.get('CHARSET')?.[0]) : prop.value

const LOCATIONS = ['home', 'work', 'other', 'school']
const WORDS: Record<string, string> = {
  home: 'home', work: 'work', other: 'other', school: 'school', cell: 'mobile', mobile: 'mobile', iphone: 'iPhone',
  main: 'main', fax: 'fax', pager: 'pager', text: 'text', textphone: 'textphone', video: 'video', car: 'car',
  isdn: 'ISDN', bbs: 'BBS', modem: 'modem', msg: 'message', personal: 'personal', business: 'work',
}
const IGNORED = new Set(['voice', 'pref', 'internet', 'x400', 'dom', 'intl', 'postal', 'parcel'])
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/** "WORK,CELL" → "Work mobile"; "HOME;FAX" → "Home fax"; custom labels pass through. */
export function humanLabel(types: readonly string[]): string {
  const location: string[] = [], kinds: string[] = []
  for (const type of types.flatMap((value) => value.split(/[,;]/))) {
    const trimmed = type.trim().replace(/^x-/i, ''), lower = trimmed.toLowerCase()
    if (!trimmed || IGNORED.has(lower) || /^pref=?\d*$/.test(lower)) continue
    const word = WORDS[lower] ?? (/^[A-Z0-9_-]+$/.test(trimmed) ? lower.replace(/^x-/, '').replace(/[_-]+/g, ' ') : trimmed)
    const target = LOCATIONS.includes(lower) || lower === 'business' ? location : kinds
    if (![...location, ...kinds].some(existing => existing.toLowerCase() === word.toLowerCase())) target.push(word)
  }
  const words = [...location, ...kinds].join(' ')
  return /^[a-z]/.test(words) && !words.startsWith('iPhone') ? capitalize(words) : words
}

function groupLabels(props: Prop[]): Map<string, string> {
  return new Map(props.filter((prop) => prop.group && prop.name === 'X-ABLABEL')
    .map((prop) => [prop.group!, unescapeValue(decoded(prop)).replace(/^_\$!<|>!\$_$/g, '').trim()]))
}

function cardProps(contact: Contact): Array<{ props: Prop[]; labels: Map<string, string> }> {
  return rawCards(contact).map((raw) => {
    const props = logicalLines(raw).map(property).filter((prop): prop is Prop => !!prop)
    return { props, labels: groupLabels(props) }
  })
}

const labelFor = (prop: Prop, labels: Map<string, string>) =>
  (prop.group && labels.get(prop.group)) || humanLabel(prop.params.get('TYPE') ?? [])

export interface LabeledValue { value: string; label: string }

/** Phones and emails in stored order, each with the richest label found on any source card. */
export function labeledEntries(contact: Contact): { phones: LabeledValue[]; emails: LabeledValue[] } {
  const country = metadata(contact).defaultCountry
  const phoneId = (value: string) => phoneKey(value, country) ?? value.trim()
  const emailId = (value: string) => emailKey(value) ?? value.trim().toLowerCase()
  type Label = { text: string; custom: boolean }
  const phoneLabels = new Map<string, Label>(), emailLabels = new Map<string, Label>()
  for (const { props, labels } of cardProps(contact)) for (const prop of props) {
    if (prop.name !== 'TEL' && prop.name !== 'EMAIL') continue
    const value = unescapeValue(decoded(prop)).trim().replace(/^(?:tel|mailto):/i, '')
    const label = labelFor(prop, labels)
    const [map, id] = prop.name === 'TEL' ? [phoneLabels, phoneId(value)] : [emailLabels, emailId(value)]
    const previous = map.get(id), custom = !!(prop.group && labels.get(prop.group))
    if (label && (!previous || (custom && !previous.custom)
      || (custom === previous.custom && label.split(/\s+/).length > previous.text.split(/\s+/).length))) map.set(id, { text: label, custom })
  }
  return {
    phones: contact.phones.map((phone) => ({ value: phone.value,
      label: phoneLabels.get(phoneId(phone.e164 || phone.value))?.text || humanLabel(phone.type ? [phone.type] : []) })),
    emails: contact.emails.map((email) => ({ value: email.value,
      label: emailLabels.get(emailId(email.value))?.text || humanLabel(email.type ? [email.type] : []) })),
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** vCard and CSV dates as ISO "1990-05-12", or "May 12" when the year is unknown. */
export function dateText(value: string, omitYear?: string): string {
  const trimmed = value.trim()
  const full = /^(\d{4})-?(\d{2})-?(\d{2})(?:T[\d:.]*(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(trimmed)
  const partial = /^--(\d{2})-?(\d{2})$/.exec(trimmed)
  const [year, month, day] = full ? [full[1], full[2], full[3]] : partial ? [undefined, partial[1], partial[2]] : []
  if (!month || !day || +month < 1 || +month > 12 || (year && +year === 0)) return trimmed
  const calendarYear = !year || year === omitYear ? 2000 : +year
  const leap = calendarYear % 4 === 0 && (calendarYear % 100 !== 0 || calendarYear % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (+day < 1 || +day > days[+month - 1]) return trimmed
  if (year && year !== omitYear) return `${year}-${month}-${day}`
  return `${MONTHS[+month - 1]} ${+day}`
}

export function formatAddress(address: PostalAddress): string {
  return [address.street, address.city, address.region, address.postalCode, address.country]
    .map((part) => part?.trim()).filter(Boolean).join(', ')
}

const MESSAGING: Record<string, string> = { 'X-AIM': 'AIM', 'X-ICQ': 'ICQ', 'X-JABBER': 'Jabber', 'X-MSN': 'MSN',
  'X-YAHOO': 'Yahoo', 'X-SKYPE': 'Skype', 'X-SKYPE-USERNAME': 'Skype', 'X-GOOGLE-TALK': 'Google Talk', 'X-GTALK': 'Google Talk',
  'X-QQ': 'QQ', 'X-GADUGADU': 'Gadu-Gadu', 'X-TWITTER': 'Twitter' }
const RELATED: Record<string, string> = { 'X-SPOUSE': 'Spouse', 'X-MANAGER': 'Manager', 'X-ASSISTANT': 'Assistant' }
const OTHER_LABELS: Record<string, string> = { GENDER: 'Gender', 'X-GENDER': 'Gender', ROLE: 'Role', TZ: 'Time zone',
  GEO: 'Location', LANG: 'Language', 'X-PHONETIC-FIRST-NAME': 'Phonetic first name', 'X-PHONETIC-MIDDLE-NAME': 'Phonetic middle name',
  'X-PHONETIC-LAST-NAME': 'Phonetic last name', 'X-PHONETIC-ORG': 'Phonetic organization', 'SORT-STRING': 'Sort as',
  'X-MAIDENNAME': 'Maiden name', 'X-ABORGANIZATION': 'Organization' }
// Structural, binary or app-internal properties a person would not recognise as contact information.
const SKIP = new Set(['BEGIN', 'END', 'VERSION', 'FN', 'PHOTO', 'REV', 'X-ABLABEL', 'UID', 'PRODID', 'ORG', 'TITLE', 'NOTE',
  'TEL', 'EMAIL', 'LABEL', 'X-ABADR', 'X-ABSHOWAS', 'LOGO', 'SOUND', 'KEY', 'X-ABUID', 'X-IMAGETYPE', 'X-IMAGEHASH',
  'X-SHARED-PHOTO-DISPLAY-PREF', 'CLIENTPIDMAP', 'SOURCE', 'KIND', 'XML', 'MAILER', 'NAME', 'X-ABPERSONFLAGS',
  'X-MS-OL-DEFAULT-POSTAL-ADDRESS', 'X-MS-CARDPICTURE', 'X-MS-OL-DESIGN', 'X-WAB-GENDER'])
const ANDROID_RELATIONS = ['', 'Assistant', 'Brother', 'Child', 'Domestic partner', 'Father', 'Friend', 'Manager', 'Mother',
  'Parent', 'Partner', 'Referred by', 'Relative', 'Sister', 'Spouse']

function androidCustom(value: string): ContactDetail | undefined {
  const [mime, data, type, custom] = structured(value).map((part) => part.trim())
  if (!data) return undefined
  if (mime.endsWith('/nickname')) return { kind: 'nickname', value: data }
  if (mime.endsWith('/relation')) return { kind: 'related', value: data, label: type === '0' ? custom || undefined : ANDROID_RELATIONS[+type] || undefined }
  if (mime.endsWith('/contact_event')) {
    if (type === '3') return { kind: 'birthday', value: dateText(data) }
    if (type === '1') return { kind: 'anniversary', value: dateText(data) }
    return { kind: 'date', value: dateText(data), label: type === '0' ? custom || undefined : 'Other' }
  }
  return undefined
}

function propDetails(prop: Prop, labels: Map<string, string>): ContactDetail[] {
  if (SKIP.has(prop.name) || binaryProperty(prop)) return []
  const raw = decoded(prop)
  const text = unescapeValue(raw).trim()
  const label = labelFor(prop, labels) || undefined
  const name = prop.name
  if (name === 'N') {
    const [, , middle, prefix, suffix] = structured(raw).map((part) => part.trim())
    return [['prefix', prefix], ['middle', middle], ['suffix', suffix]].filter(([, value]) => value)
      .map(([kind, value]) => ({ kind: kind as DetailKind, value: value! }))
  }
  if (name === 'NICKNAME') return (raw.match(/(?:\\.|[^,\\])+/g) ?? []).map(part => unescapeValue(part).trim())
    .filter(Boolean).map((value) => ({ kind: 'nickname', value }))
  if (name === 'CATEGORIES') return (raw.match(/(?:\\.|[^,\\])+/g) ?? []).map((part) => unescapeValue(part).trim())
    .filter(Boolean).map((value) => ({ kind: 'group', value }))
  if (name === 'ADR') {
    const [box, extended, street, city, region, postalCode, country] = structured(raw).map((part) => part.trim())
    const address = { street: [box, street, extended].filter(Boolean).join(', ') || undefined, city: city || undefined,
      region: region || undefined, postalCode: postalCode || undefined, country: country || undefined }
    const value = formatAddress(address)
    const formatted = prop.params.get('LABEL')?.[0]?.trim()
    return value ? [{ kind: 'address', value, label, address }] : formatted ? [{ kind: 'address', value: formatted, label }] : []
  }
  if (!text) return []
  const omitYear = prop.params.get('X-APPLE-OMIT-YEAR')?.[0]
  const date = () => prop.params.get('VALUE')?.[0]?.toLowerCase() === 'text' ? text : dateText(text, omitYear)
  if (name === 'BDAY') return [{ kind: 'birthday', value: date() }]
  if (name === 'ANNIVERSARY' || name === 'X-ANNIVERSARY') return [{ kind: 'anniversary', value: date() }]
  if (name === 'X-ABDATE') {
    return [/anniversary/i.test(label ?? '') ? { kind: 'anniversary', value: date() }
      : { kind: 'date', value: date(), label }]
  }
  if (name === 'URL') return [{ kind: 'website', value: text, label: label === 'Other' ? undefined : label }]
  if (name === 'X-SOCIALPROFILE') {
    const service = prop.params.get('TYPE')?.find((type) => !IGNORED.has(type.toLowerCase()))
    return [{ kind: 'social', value: prop.params.get('X-USER')?.[0] || text.replace(/^x-apple:/i, ''),
      label: (prop.group && labels.get(prop.group)) || (service ? capitalize(service) : undefined) }]
  }
  if (name === 'IMPP') {
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1]
    const service = prop.params.get('X-SERVICE-TYPE')?.[0] || (scheme && scheme.toLowerCase() !== 'x-apple' ? capitalize(scheme) : undefined)
    return [{ kind: 'messaging', value: text.replace(/^[a-z][a-z0-9+.-]*:/i, ''), label: (prop.group && labels.get(prop.group)) || service || label }]
  }
  if (MESSAGING[name]) return [{ kind: 'messaging', value: text, label: MESSAGING[name] }]
  if (name === 'X-ABRELATEDNAMES' || name === 'RELATED') return [{ kind: 'related', value: text.replace(/^text:/i, ''), label }]
  if (RELATED[name]) return [{ kind: 'related', value: text, label: RELATED[name] }]
  if (name === 'X-ANDROID-CUSTOM') { const detail = androidCustom(raw); return detail ? [detail] : [] }
  if (SKIP.has(name) || text.length > 500) return []
  return [{ kind: 'other', value: text, label: OTHER_LABELS[name] ?? (labels.get(prop.group ?? '') || capitalize(name.replace(/^X-/, '').toLowerCase().replace(/[_-]+/g, ' '))) }]
}

const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const identity = (detail: ContactDetail) => JSON.stringify([detail.kind,
  ['website', 'social', 'messaging'].includes(detail.kind) ? detail.value.trim() : normalized(detail.value),
  ['other', 'social', 'messaging', 'related', 'date'].includes(detail.kind) ? normalized(detail.label ?? '') : ''])

export function uniqueDetails(details: Iterable<ContactDetail>): ContactDetail[] {
  const seen = new Map<string, number>()
  const result: ContactDetail[] = []
  for (const detail of details) {
    if (!detail.value.trim()) continue
    const key = identity(detail), index = seen.get(key)
    if (index !== undefined) {
      const first = result[index]
      if ((!first.label && detail.label) || (!first.address && detail.address)) result[index] = { ...first,
        ...(!first.label && detail.label ? { label: detail.label } : {}),
        ...(!first.address && detail.address ? { address: detail.address } : {}) }
      continue
    }
    seen.set(key, result.length)
    result.push(detail)
  }
  return result
}

/** Decoded, de-duplicated details from every source card plus details stored at import. */
export function contactDetails(contact: Contact): ContactDetail[] {
  const fromCards = cardProps(contact).flatMap(({ props, labels }) => props.flatMap((prop) => propDetails(prop, labels)))
  return uniqueDetails([...fromCards, ...(metadata(contact).details ?? [])])
}
