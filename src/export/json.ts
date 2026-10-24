import { dumpAll, restoreAll, type Dump } from '@/db/repo'

type RecordValue = Record<string, unknown>
const object = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string')
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optionalString = (value: unknown) => value === undefined || typeof value === 'string'
const choice = (value: unknown, choices: string[]) => value === undefined || (typeof value === 'string' && choices.includes(value))
const choices = (value: unknown, allowed: string[]) => strings(value) && value.every((v) => allowed.includes(v))

function validContact(value: unknown): boolean {
  if (!object(value)) return false
  const entries = (v: unknown) => Array.isArray(v) && v.every((e: unknown) => object(e) && typeof e.value === 'string' && optionalString(e.type) && optionalString(e.e164))
  return typeof value.id === 'string' && value.id.length > 0 && typeof value.displayName === 'string'
    && ['givenName', 'familyName', 'org', 'title', 'notes', 'rev'].every((key) => optionalString(value[key]))
    && entries(value.phones) && entries(value.emails) && typeof value.raw === 'string'
    && typeof value.source === 'string' && ['vcf', 'csv', 'picker', 'demo'].includes(value.source)
    && finite(value.importedAt) && !Number.isNaN(new Date(value.importedAt).getTime())
    && strings(value.phoneKeys) && strings(value.emailKeys)
}

function validDecision(value: unknown): boolean {
  if (!object(value) || !object(value.skips)) return false
  const skips = value.skips
  return typeof value.contactId === 'string' && value.contactId.length > 0
    && choice(value.bucket, ['delete', 'work', 'personal'])
    && choice(value.workStatus, ['old', 'current', 'potential'])
    && choices(value.workTypes, ['client', 'vendor', 'relationship', 'namedrop'])
    && choice(value.relation, ['friend', 'family', 'ex'])
    && choices(value.personalTypes, ['acquaintance', 'neighbor', 'service'])
    && strings(value.customTags) && finite(value.updatedAt)
    && ['triage', 'work', 'personal'].every((key) => finite(skips[key]) && Number.isInteger(skips[key]) && skips[key] >= 0)
}

function validDump(value: unknown): value is Dump {
  return object(value) && value.version === 1 && typeof value.exportedAt === 'string'
    && Array.isArray(value.contacts) && value.contacts.every(validContact)
    && Array.isArray(value.decisions) && value.decisions.every(validDecision)
}

export async function backupJson(): Promise<string> {
  return JSON.stringify(await dumpAll(), null, 2)
}

export async function restoreJson(text: string): Promise<{ contacts: number; decisions: number }> {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('This file is not valid JSON.') }
  if (!validDump(parsed)) throw new Error('Invalid backup. Choose a Contacts. version 1 backup with valid contacts and decisions.')
  await restoreAll(parsed)
  return { contacts: parsed.contacts.length, decisions: parsed.decisions.length }
}
