import { defaultCountry as regionCountry } from './region'
import Papa from 'papaparse'
import type { Contact, EmailEntry, PhoneEntry } from '@/domain/types'
import { makeContact } from './contact'
import { csvDetails } from './csvDetails'

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
      const match = known.map((name) => entries.find(([key, value]) => key.toLowerCase() === name && value.trim())).find(Boolean)
        ?? entries.find(([key, value]) => fuzzy?.test(key) && value.trim())
      if (match) used.add(match[0])
      return match?.[1].trim()
    }
    const givenName = get(['first name', 'given name'], /first|given/i)
    const familyName = get(['last name', 'family name'], /last|family/i)
    const middleName = get(['middle name', 'additional name'], /middle/i)
    const company = get(['organization', 'organization name', 'organization 1 - name', 'company'], /org|company/i)
    const department = get(['department', 'organization department', 'organization 1 - department'])
    const org = [company, department].filter(Boolean).join(' · ') || undefined
    const title = get(['organization title', 'organization 1 - title', 'job title'], /title|job/i)
    const notes = get(['notes', 'note'], /note/i)
    const fallbackName = entries.find(([key, value]) => /name/i.test(key) && !/org|company|phonetic|nickname/i.test(key) && value.trim())
    const name = get(['name', 'full name', 'display name'])
      || [givenName, middleName, familyName].filter(Boolean).join(' ')
      || (fallbackName && (used.add(fallbackName[0]), fallbackName[1].trim()))
    const phones: PhoneEntry[] = []
    const emails: EmailEntry[] = []
    for (const [header, cell] of entries) {
      if (/e-?mail|phone|tel|mobile/i.test(header) && /(?:label|type|display name)\s*$/i.test(header)) used.add(header)
      if (!cell.trim() || /(?:label|type|display name)\s*$/i.test(header)) continue
      const isEmail = /e-?mail/i.test(header)
      const isPhone = !isEmail && /phone|tel|mobile/i.test(header)
      if (!isEmail && !isPhone) continue
      used.add(header)
      const stem = header.replace(/value\s*$/i, '')
      const explicitType = /value\s*$/i.test(header) ? get([`${stem}label`.toLowerCase(), `${stem}type`.toLowerCase()]) : undefined
      const type = explicitType || (/mobile/i.test(header) ? 'CELL' : /business|work/i.test(header) ? 'WORK' : /home/i.test(header) ? 'HOME' : undefined)
      for (const value of cell.split(/\s*:::\s*/).map((v) => v.trim()).filter(Boolean)) {
        if (isEmail) emails.push({ value, type })
        else phones.push({ value, type })
      }
    }
    const details = csvDetails(entries.filter(([key, value]) => !used.has(key) && value.trim()), middleName)
    const contact = makeContact({ displayName: name, givenName, familyName, org, title, notes, phones, emails,
      ...(details.length ? { details } : {}) }, 'csv', defaultCountry)
    return contact
}
