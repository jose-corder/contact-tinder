import type { ContactWithDecision } from '@/db/repo'

export function deleteListText(rows: ContactWithDecision[]): string {
  const deleted = rows.filter(({ decision }) => decision.bucket === 'delete')
    .sort((a, b) => a.contact.displayName.localeCompare(b.contact.displayName))
  const lines = deleted.map(({ contact: c }) => [c.displayName, c.org, c.phones[0]?.value, c.emails[0]?.value]
    .filter(Boolean).map((part) => part!.replace(/[\r\n]+/g, ' ')).join(' — '))
  return [`Delete list — ${deleted.length} contacts — ${new Date().toISOString().slice(0, 10)}`, ...lines].join('\n') + '\n'
}
