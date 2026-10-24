import type { ContactWithDecision } from '@/db/repo'
import { emptyDecision, type Contact, type Decision } from '@/domain/types'

export function contact(id: string, displayName = id): Contact {
  return { id, displayName, phones: [], emails: [], raw: '', source: 'csv', importedAt: 0, phoneKeys: [], emailKeys: [] }
}
export function row(id: string, decision: Partial<Decision> = {}): ContactWithDecision {
  return { contact: contact(id), decision: { ...emptyDecision(id, 0), ...decision } }
}
