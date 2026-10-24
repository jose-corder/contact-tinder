import type { Contact } from '@/domain/types'
import { emailKey, phoneKey } from '@/import/dedupe'
import { decodeQuotedPrintable, logicalLines, property, unescapeValue } from '@/import/vcardCodec'

/** Preserve the richer raw card while exporting numbers/addresses supplied by its duplicates. */
export function missingEntries(contact: Contact) {
  const relevant: string[] = []
  let keep = false
  for (const line of contact.raw.split(/\r\n|\n|\r/)) {
    if (!/^[ \t]/.test(line)) keep = /^(?:[^:;.]+\.)?(?:TEL|EMAIL)(?:;|:)/i.test(line)
    if (keep) relevant.push(line)
  }
  const phones = new Set<string>()
  const emails = new Set<string>()
  const phoneIdentity = (value: string) => phoneKey(value) ?? value.trim()
  const emailIdentity = (value: string) => emailKey(value) ?? value.trim().toLowerCase()
  for (const line of logicalLines(relevant.join('\n'))) {
    const prop = property(line)
    if (!prop) continue
    const value = unescapeValue(prop.params.get('ENCODING')?.[0]?.toUpperCase() === 'QUOTED-PRINTABLE'
      ? decodeQuotedPrintable(prop.value, prop.params.get('CHARSET')?.[0]) : prop.value)
    if (prop.name === 'TEL') phones.add(phoneIdentity(value.replace(/^tel:/i, '')))
    if (prop.name === 'EMAIL') emails.add(emailIdentity(value.replace(/^mailto:/i, '')))
  }
  return {
    phones: contact.phones.filter((entry) => !phones.has(phoneIdentity(entry.value))),
    emails: contact.emails.filter((entry) => !emails.has(emailIdentity(entry.value))),
  }
}
