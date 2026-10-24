import type { Contact, ContactSource, EmailEntry, PhoneEntry } from '@/domain/types'
import { defaultCountry as regionCountry } from './region'
import { makeContact } from './contact'
import { decodeQuotedPrintable, logicalLines, photoBlob, property, unescapeValue } from './vcardCodec'

export function structured(value: string): string[] {
  const parts = ['']
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) parts[parts.length - 1] += value[i] + value[++i]
    else if (value[i] === ';') parts.push('')
    else parts[parts.length - 1] += value[i]
  }
  return parts.map(unescapeValue)
}

function normalizeRev(value: string): string {
  const expanded = value.replace(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z|[+-]\d{2}:?\d{2})?)?$/i,
    (_, y: string, m: string, d: string, h?: string, min?: string, s?: string, zone?: string) =>
      `${y}-${m}-${d}${h ? `T${h}:${min}:${s}${zone || 'Z'}` : ''}`)
  const date = new Date(expanded)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

export function parseVcf(text: string, source: ContactSource = 'vcf', defaultCountry: string = regionCountry()): Contact[] {
  const contacts: Contact[] = []
  // Capture from the original string, including its line endings and folds.
  const cards = text.replace(/^\uFEFF/, '').matchAll(/^BEGIN:VCARD[ \t]*\r?\n[\s\S]*?^END:VCARD[ \t]*(?:\r?\n|$)/gim)
  for (const [raw] of cards) {
    const fields: Record<string, string> = {}
    const phones: PhoneEntry[] = []
    const emails: EmailEntry[] = []
    let photo: Blob | undefined
    const lines = logicalLines(raw)
    const labels = new Map<string, string>()
    for (const line of lines) {
      const prop = property(line)
      if (prop?.group && prop.name === 'X-ABLABEL') labels.set(prop.group, unescapeValue(prop.value).replace(/^_\$!<|>!\$_$/g, ''))
    }
    for (const line of lines) {
      const prop = property(line)
      if (!prop) continue
      const { name, params } = prop
      let value = prop.value
      if (params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE') {
        value = decodeQuotedPrintable(value, params.get('CHARSET')?.[0])
      }
      const decoded = unescapeValue(value).trim()
      const type = (prop.group && labels.get(prop.group)) || params.get('TYPE')?.[0]
      if (name === 'N') {
        const [family, given] = structured(value)
        fields.familyName = family?.trim()
        fields.givenName = given?.trim()
      } else if (name === 'ORG') fields.org = structured(value).map((part) => part.trim()).filter(Boolean).join(' · ')
      else if (name === 'TEL' && decoded) phones.push({ value: decoded.replace(/^tel:/i, ''), type })
      else if (name === 'EMAIL' && decoded) emails.push({ value: decoded.replace(/^mailto:/i, ''), type })
      else if (name === 'PHOTO') photo ??= photoBlob(value, params)
      else if (name === 'FN') fields.displayName = decoded
      else if (name === 'TITLE') fields.title = decoded
      else if (name === 'NOTE') fields.notes = [...new Set([fields.notes, unescapeValue(value)].filter(Boolean))].join('\n')
      else if (name === 'UID') fields.uid = decoded
      else if (name === 'REV') fields.rev = normalizeRev(decoded)
    }
    const contact = makeContact({ ...fields, phones, emails, photo, raw }, source, defaultCountry)
    if (contact) contacts.push(contact)
  }
  return contacts
}
