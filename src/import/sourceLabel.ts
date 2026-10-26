import type { Contact } from '@/domain/types'

/** Provider evidence comes only from PRODID, never the extension or other fields. */
export function sourceLabel(contact: Contact): string {
  if (contact.source !== 'vcf') return { csv: 'CSV file', picker: 'Phone contacts', demo: 'Demo' }[contact.source]
  const prodId = /(?:^|\r?\n)(?:[^:;.\r\n]+\.)?PRODID(?:;[^:\r\n]*)?:([^\r\n]*(?:(?:\r?\n)[ \t][^\r\n]*)*)/i
    .exec(contact.raw)?.[1].replace(/\r?\n[ \t]/g, '') ?? ''
  if (/Apple Inc\./i.test(prodId)) return 'Apple Contacts'
  if (/Google (?:Inc\.|Contacts)/i.test(prodId)) return 'Google Contacts'
  if (/Outlook/i.test(prodId)) return 'Outlook'
  return 'vCard file'
}
