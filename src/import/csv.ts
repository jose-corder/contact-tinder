import { defaultCountry as regionCountry } from './region'
import Papa from 'papaparse'
import type { Contact, EmailEntry, PhoneEntry } from '@/domain/types'
import { makeContact } from './contact'
import { csvDetails } from './csvDetails'
import { uniqueDetails } from './details'
import { emailKey, phoneKey } from './dedupe'

export function parseCsv(text: string, defaultCountry: string = regionCountry()): Contact[] {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true, skipEmptyLines: true, transformHeader: (header) => header.trim(),
  })
  const error = parsed.errors.find((e) => e.code !== 'UndetectableDelimiter')
  if (error) throw new Error(`CSV ${error.row === undefined ? '' : `row ${error.row + 2}: `}${error.message}`)
  return parsed.data.flatMap((row) => { const contact = csvContact(row, defaultCountry); return contact ? [contact] : [] })
}

export function csvContact(row: Record<string, string>, defaultCountry: string = regionCountry()): Contact | undefined {
    const entries = Object.entries(row).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    const used = new Set<string>()
    const get = (known: string[], fuzzy?: RegExp) => {
      const match = known.map((name) => entries.find(([key, value]) => key.trim().toLowerCase() === name && value.trim())).find(Boolean)
        ?? entries.find(([key, value]) => fuzzy?.test(key.trim()) && value.trim())
      if (match) used.add(match[0])
      return match?.[1].trim()
    }
    const givenName = get(['first name', 'given name'], /^(?:contact\s+)?(?:first|given)(?:\s+name)?$/i)
    const familyName = get(['last name', 'family name'], /^(?:contact\s+)?(?:last|family)(?:\s+name)?$/i)
    const middleName = get(['middle name', 'additional name'], /^(?:contact\s+)?middle(?:\s+name)?$/i)
    const company = get(['organization', 'organization name', 'organization 1 - name', 'company'], /^(?:org|company)(?:\s+name)?$/i)
    const department = get(['department', 'organization department', 'organization 1 - department'])
    const org = [company, department].filter(Boolean).join(' · ') || undefined
    const title = get(['organization title', 'organization 1 - title', 'job title'], /^(?:title|job|job role)$/i)
    const notes = get(['notes', 'note'], /^(?:personal|contact)\s+notes?$/i)
    const fallbackName = entries.find(([key, value]) => /^(?:contact|person)\s+name$/i.test(key.trim()) && value.trim())
    const name = get(['name', 'full name', 'display name'])
      || [givenName, middleName, familyName].filter(Boolean).join(' ')
      || (fallbackName && (used.add(fallbackName[0]), fallbackName[1].trim()))
    const phones: PhoneEntry[] = []
    const emails: EmailEntry[] = []
    const seenPhones = new Set<string>(), seenEmails = new Set<string>()
    for (const [header, cell] of entries) {
      const suffix = /_\d+$/.exec(header.trim())?.[0] ?? ''
      const base = header.trim().slice(0, suffix ? -suffix.length : undefined)
      const metadataColumn = /(?:label|type|display name)$/i.test(base)
      const isEmail = /\be-?mail\b/i.test(base) && /(?:e-?mail(?:\s*\d+)?|address(?:\s*\d+)?|value|label|type|display name)$/i.test(base)
      const isPhone = !isEmail && /\b(?:phone|tel|telephone|mobile|fax|pager)\b/i.test(base)
        && /(?:phone|tel|telephone|mobile|fax|pager|number|value|label|type)(?:\s*\d+)?$/i.test(base)
      if (!isEmail && !isPhone) continue
      used.add(header)
      if (!cell.trim() || metadataColumn) continue
      const stem = base.replace(/value$/i, '')
      const explicitType = /value$/i.test(base) ? get([`${stem}label${suffix}`.toLowerCase(), `${stem}type${suffix}`.toLowerCase()]) : undefined
      const types = explicitType?.split(/\s*:::\s*/)
      const inferredType = [/business|work/i.test(base) ? 'WORK' : /home/i.test(base) ? 'HOME' : undefined,
        /fax/i.test(base) ? 'FAX' : /pager/i.test(base) ? 'PAGER' : /mobile/i.test(base) ? 'CELL' : undefined].filter(Boolean).join(',') || undefined
      for (const [index, value] of cell.split(/\s*:::\s*/).map((v) => v.trim()).entries()) {
        if (!value) continue
        const type = (types?.length === 1 ? types[0] : types?.[index]) || inferredType
        const key = (isEmail ? emailKey(value) : phoneKey(value, defaultCountry)) ?? value.toLowerCase()
        const seen = isEmail ? seenEmails : seenPhones
        if (seen.has(key)) continue
        seen.add(key)
        if (isEmail) emails.push({ value, type })
        else phones.push({ value, type })
      }
    }
    const details = uniqueDetails(csvDetails(entries.filter(([key, value]) => !used.has(key) && value.trim()), middleName))
    const contact = makeContact({ displayName: name, givenName, familyName, org, title, notes, phones, emails,
      ...(details.length ? { details } : {}) }, 'csv', defaultCountry)
    return contact
}
