import type { ContactWithDecision } from '@/db/repo'
import type { Contact } from '@/domain/types'
import { decisionLabels, isUnsorted, PASS_ORDER } from '@/domain/taxonomy'

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function buildVcard(contact: Contact, labels: string[]): string {
  const categories = `CATEGORIES:${labels.map(escapeText).join(',')}`
  if (contact.raw) {
    const newline = contact.raw.includes('\r\n') ? '\r\n' : '\n'
    let removing = false
    const lines = contact.raw.split(newline).filter((line) => {
      if (/^[ \t]/.test(line)) return !removing
      removing = /^(?:[^:;.]+\.)?CATEGORIES(?:;[^:]*)?:/i.test(line)
      return !removing
    })
    const end = lines.findIndex((line) => /^END:VCARD$/i.test(line))
    if (labels.length && end >= 0) lines.splice(end, 0, categories)
    return lines.join(newline)
  }
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${escapeText(contact.familyName ?? '')};${escapeText(contact.givenName ?? '')};;;`,
    `FN:${escapeText(contact.displayName)}`,
    `ORG:${escapeText(contact.org ?? '')}`, `TITLE:${escapeText(contact.title ?? '')}`,
    ...contact.phones.map((p) => `TEL;TYPE=${safeType(p.type, 'CELL')}:${escapeText(p.value)}`),
    ...contact.emails.map((e) => `EMAIL;TYPE=${safeType(e.type, 'INTERNET')}:${escapeText(e.value)}`),
    `NOTE:${escapeText(contact.notes ?? '')}`,
    `REV:${escapeText(contact.rev ?? new Date(contact.importedAt).toISOString())}`,
    `UID:${escapeText(contact.id)}`,
    categories, 'END:VCARD',
  ]
  return lines.join('\r\n') + '\r\n'
}

function safeType(type: string | undefined, fallback: string): string {
  return type?.replace(/[^a-zA-Z0-9,-]/g, '') || fallback
}

export interface ExportFile { filename: string; rows: ContactWithDecision[] }

export function isUnsortedRow({ decision }: ContactWithDecision): boolean {
  return !decision.bucket || PASS_ORDER.some((pass) => isUnsorted(decision, pass))
}

export function groupFiles(rows: ContactWithDecision[]): ExportFile[] {
  const groups: ExportFile[] = []
  const add = (filename: string, match: (row: ContactWithDecision) => boolean) => {
    const matches = rows.filter(match)
    if (matches.length) groups.push({ filename: `${filename}.vcf`, rows: matches })
  }
  add('all-contacts', () => true)
  add('delete', ({ decision: d }) => d.bucket === 'delete')
  add('work', ({ decision: d }) => d.bucket === 'work')
  for (const status of ['old', 'current', 'potential'] as const) {
    add(`work-${status}`, ({ decision: d }) => d.bucket === 'work' && d.workStatus === status)
  }
  for (const [type, slug] of [['client', 'client'], ['vendor', 'vendor'], ['relationship', 'relationship'], ['namedrop', 'name-drop-flex']] as const) {
    add(`work-${slug}`, ({ decision: d }) => d.bucket === 'work' && d.workTypes.includes(type))
  }
  add('personal', ({ decision: d }) => d.bucket === 'personal')
  for (const relation of ['friend', 'family', 'ex'] as const) {
    add(`personal-${relation}`, ({ decision: d }) => d.bucket === 'personal' && d.relation === relation)
  }
  for (const [type, slug] of [['acquaintance', 'acquaintance'], ['neighbor', 'neighbor'], ['service', 'service-provider']] as const) {
    add(`personal-${slug}`, ({ decision: d }) => d.bucket === 'personal' && d.personalTypes.includes(type))
  }
  add('unsorted', isUnsortedRow)
  const used = new Set<string>()
  const tags = [...new Set(rows.flatMap(({ decision }) => decision.customTags))].sort()
  for (const tag of tags) {
    const slug = tag.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tag'
    let unique = slug
    let suffix = 2
    while (used.has(unique)) unique = `${slug}-${suffix++}`
    used.add(unique)
    add(`tag-${unique}`, ({ decision }) => decision.customTags.includes(tag))
  }
  return groups
}

export function vcfText(rows: ContactWithDecision[]): string {
  return rows.map(({ contact, decision }, index) => {
    const card = buildVcard(contact, decisionLabels(decision))
    return index < rows.length - 1 && !card.endsWith('\n') ? card + (card.includes('\r\n') ? '\r\n' : '\n') : card
  }).join('')
}
