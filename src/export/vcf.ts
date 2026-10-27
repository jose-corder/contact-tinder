import type { ContactWithDecision } from '@/db/repo'
import type { Contact } from '@/domain/types'
import { escapeText, foldLine, sourceCategories, complementaryLines, utf8LiteralCharsets } from './vcardLines'
import { missingEntries } from './mergedFields'
import { metadata } from '@/import/metadata'
import type { ContactDetail, DetailKind } from '@/import/details'
import { decisionLabels, isUnsorted, PASS_ORDER, BUCKET_META, WORK_STATUS_META, WORK_TYPE_META, PERSONAL_RELATION_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'

export function buildVcard(contact: Contact, labels: string[]): string {
  const allLabels = [...new Set([...sourceCategories(contact), ...labels])]
  const categories = `CATEGORIES:${allLabels.map(escapeText).join(',')}`
  if (contact.raw) {
    const newline = contact.raw.includes('\r\n') ? '\r\n' : '\n'
    let removing = false
    const lines = utf8LiteralCharsets(contact.raw).split(/\r\n|\n|\r/).filter((line) => {
      if (/^[ \t]/.test(line)) return !removing
      removing = /^(?:[^:;.]+\.)?CATEGORIES(?:;[^:]*)?:/i.test(line)
      return !removing
    })
    const end = lines.findIndex((line) => /^END:VCARD[ \t]*$/i.test(line))
    const extras = complementaryLines(contact)
    const missing = missingEntries({ ...contact, raw: contact.raw + newline + extras.join(newline) })
    if (end >= 0) lines.splice(end, 0,
      ...extras,
      ...missing.phones.map((p) => foldLine(`TEL;TYPE=${safeType(p.type, 'CELL')}:${escapeText(p.e164 || p.value)}`)),
      ...missing.emails.map((e) => foldLine(`EMAIL;TYPE=${safeType(e.type, 'INTERNET')}:${escapeText(e.value)}`)),
      ...(allLabels.length ? [foldLine(categories)] : []))
    return lines.join(newline)
  }
  const details = metadata(contact).details ?? []
  const first = (kind: DetailKind) => escapeText(details.find((detail) => detail.kind === kind)?.value ?? '')
  const groups = details.filter((detail) => detail.kind === 'group').map((detail) => detail.value)
  const notes = [contact.notes, ...details.filter((detail) => detail.kind === 'other'
    || (['birthday', 'anniversary', 'date'].includes(detail.kind) && !vcardDate(detail.value)))
    .map((detail) => `${detail.label ?? (detail.kind === 'other' ? 'Other' : detail.kind[0].toUpperCase() + detail.kind.slice(1))}: ${detail.value}`)]
  const extraLabels = [...new Set([...groups, ...allLabels])]
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${escapeText(contact.familyName ?? '')};${escapeText(contact.givenName ?? '')};${first('middle')};${first('prefix')};${first('suffix')}`,
    `FN:${escapeText(contact.displayName)}`,
    `ORG:${(contact.org ?? '').split(' · ').map(escapeText).join(';')}`, `TITLE:${escapeText(contact.title ?? '')}`,
    ...detailLines(details, contact),
    `NOTE:${escapeText(notes.filter(Boolean).join('\n'))}`,
    `REV:${escapeText(contact.rev ?? new Date(contact.importedAt).toISOString())}`,
    `UID:${escapeText(contact.id)}`,
    extraLabels.length === allLabels.length ? categories : `CATEGORIES:${extraLabels.map(escapeText).join(',')}`, 'END:VCARD',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/** "1990-05-12" stays; a yearless "May 12" becomes the vCard partial date "--05-12". */
function vcardDate(value: string): string | undefined {
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value.trim())
  const partial = /^--(\d{2})-?(\d{2})$/.exec(value.trim())
  const named = /^([A-Za-z]+) (\d{1,2})$/.exec(value.trim())
  const year = full ? +full[1] : 2000
  const month = full ? +full[2] : partial ? +partial[1] : named ? MONTHS.indexOf(named[1].toLowerCase()) + 1 : 0
  const day = full ? +full[3] : partial ? +partial[2] : named ? +named[2] : 0
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return undefined
  return `${full ? full[1] + '-' : '--'}${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Details stored for CSV and phone-picker contacts, written the way Apple and Google Contacts read them. */
function detailLines(details: ContactDetail[], contact: Contact): string[] {
  const lines: string[] = []
  let item = 0
  const labeled = (line: string, label: string | undefined) => {
    if (!label) return lines.push(line)
    item++
    lines.push(`item${item}.${line}`, `item${item}.X-ABLabel:${escapeText(label)}`)
  }
  for (const p of contact.phones) labeled(`TEL;TYPE=${safeType(p.type, 'CELL')}:${escapeText(p.e164 || p.value)}`,
    p.type && !/^[a-z0-9,-]+$/i.test(p.type) ? p.type : undefined)
  for (const e of contact.emails) labeled(`EMAIL;TYPE=${safeType(e.type, 'INTERNET')}:${escapeText(e.value)}`,
    e.type && !/^[a-z0-9,-]+$/i.test(e.type) ? e.type : undefined)
  const nicknames = details.filter((detail) => detail.kind === 'nickname').map((detail) => escapeText(detail.value))
  if (nicknames.length) lines.push(`NICKNAME:${nicknames.join(',')}`)
  for (const detail of details) {
    const value = escapeText(detail.value)
    const token = detail.label && /^[a-z0-9-]+$/i.test(detail.label) ? detail.label : undefined
    const type = token ? `;TYPE=${token}` : ''
    if (detail.kind === 'address') {
      const address = Object.values(detail.address ?? {}).some((part) => part?.trim()) ? detail.address! : { street: detail.value }
      labeled(`ADR${type}:;;${[address.street, address.city, address.region, address.postalCode, address.country].map((part) => escapeText(part ?? '')).join(';')}`, detail.label)
    } else if (detail.kind === 'birthday' && vcardDate(detail.value)) lines.push(`BDAY:${vcardDate(detail.value)}`)
    else if ((detail.kind === 'anniversary' || detail.kind === 'date') && vcardDate(detail.value)) {
      labeled(`X-ABDATE:${vcardDate(detail.value)}`, detail.kind === 'anniversary' ? '_$!<Anniversary>!$_' : detail.label ?? 'Other')
    } else if (detail.kind === 'website') labeled(`URL:${value}`, detail.label)
    else if (detail.kind === 'social') labeled(`X-SOCIALPROFILE${type}:${value}`, detail.label)
    else if (detail.kind === 'messaging') labeled(`IMPP${token ? `;X-SERVICE-TYPE=${token}` : ''}:${/^[a-z][a-z0-9+.-]*:/i.test(detail.value) ? '' : 'x-apple:'}${value}`, detail.label)
    else if (detail.kind === 'related') labeled(`X-ABRELATEDNAMES:${value}`, detail.label ?? 'Other')
  }
  return lines
}

function safeType(type: string | undefined, fallback: string): string {
  return type?.replace(/[^a-zA-Z0-9,-]/g, '').split(',').filter(Boolean).join(',') || fallback
}

export interface ExportFile { filename: string; rows: ContactWithDecision[]; description: string; colors: string[] }

export function cleanFile(rows: ContactWithDecision[]): ExportFile {
  return { filename: 'contacts-clean.vcf', rows: rows.filter(({ decision }) => decision.bucket !== 'delete'),
    description: 'Everything except Delete, including unsorted contacts.', colors: [] }
}

export function isUnsortedRow({ decision }: ContactWithDecision): boolean {
  return !decision.bucket || PASS_ORDER.some((pass) => isUnsorted(decision, pass))
}

export function groupFiles(rows: ContactWithDecision[]): ExportFile[] {
  const groups: ExportFile[] = []
  const add = (filename: string, match: (row: ContactWithDecision) => boolean, description: string, colors: string[] = []) => {
    const matches = rows.filter(match)
    if (matches.length) groups.push({ filename: `${filename}.vcf`, rows: matches, description, colors })
  }
  add('all-contacts', () => true, 'Everything · includes Delete')
  add('delete', ({ decision: d }) => d.bucket === 'delete', 'Delete', [BUCKET_META.delete.color])
  add('work', ({ decision: d }) => d.bucket === 'work', 'Work', [BUCKET_META.work.color])
  for (const status of ['old', 'current', 'potential'] as const) {
    add(`work-${status}`, ({ decision: d }) => d.bucket === 'work' && d.workStatus === status,
      `Work · ${WORK_STATUS_META[status].label}`, [BUCKET_META.work.color, WORK_STATUS_META[status].color])
  }
  for (const [type, slug] of [['client', 'client'], ['vendor', 'vendor'], ['relationship', 'relationship'], ['namedrop', 'name-drop-flex']] as const) {
    add(`work-${slug}`, ({ decision: d }) => d.bucket === 'work' && d.workTypes.includes(type), `Work · ${WORK_TYPE_META[type].uiLabel}`, [BUCKET_META.work.color])
  }
  add('personal', ({ decision: d }) => d.bucket === 'personal', 'Personal', [BUCKET_META.personal.color])
  for (const relation of Object.keys(PERSONAL_RELATION_META) as Array<keyof typeof PERSONAL_RELATION_META>) {
    add(`personal-${relation}`, ({ decision: d }) => d.bucket === 'personal' && d.relation === relation,
      `Personal · ${PERSONAL_RELATION_META[relation].label}`, [BUCKET_META.personal.color, PERSONAL_RELATION_META[relation].color])
  }
  for (const [type, slug] of [['acquaintance', 'acquaintance'], ['neighbor', 'neighbor'], ['service', 'service-provider']] as const) {
    add(`personal-${slug}`, ({ decision: d }) => d.bucket === 'personal' && d.personalTypes.includes(type), `Personal · ${PERSONAL_TYPE_META[type].label}`, [BUCKET_META.personal.color])
  }
  add('unsorted', isUnsortedRow, 'Unsorted')
  const used = new Set<string>()
  const tagged = new Map<string, ContactWithDecision[]>()
  for (const row of rows) for (const tag of new Set(row.decision.customTags)) {
    const members = tagged.get(tag) ?? []
    members.push(row)
    tagged.set(tag, members)
  }
  const tags = [...tagged.keys()].sort()
  for (const tag of tags) {
    const slug = tag.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tag'
    let unique = slug
    let suffix = 2
    while (used.has(unique)) unique = `${slug}-${suffix++}`
    used.add(unique)
    groups.push({ filename: `tag-${unique}.vcf`, rows: tagged.get(tag)!, description: `Tagged ${tag}`, colors: [] })
  }
  return groups
}

export function vcfText(rows: ContactWithDecision[]): string {
  return rows.map(({ contact, decision }, index) => {
    const card = buildVcard(contact, decisionLabels(decision))
    return index < rows.length - 1 && !card.endsWith('\n') ? card + (card.includes('\r\n') ? '\r\n' : '\n') : card
  }).join('')
}
