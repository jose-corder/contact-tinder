import { afterEach, describe, expect, it, vi } from 'vitest'
import Papa from 'papaparse'
import { csvText } from '@/export/csv'
import { SHEET_HEADERS } from '@/export/sheet'
import { deleteListText } from '@/export/deleteList'
import { row } from './fixtures'

afterEach(() => vi.useRealTimers())
describe('text exports', () => {
  it('exports CSV headers and all fields with readable labels', () => {
    const r = row('ana', { bucket: 'work', workStatus: 'current', workTypes: ['client'], customTags: ['vip', 'local'] })
    Object.assign(r.contact, { displayName: 'Ana, Lane', givenName: 'Ana', familyName: 'Lane', org: 'Studio', title: 'Lead',
      phones: [{ value: '111' }, { value: '222' }], emails: [{ value: 'a@example.com' }], notes: 'Line 1\nLine 2' })
    const parsed = Papa.parse<string[]>(csvText([r])).data
    expect(parsed[0]).toEqual(SHEET_HEADERS)
    const record = Object.fromEntries(SHEET_HEADERS.map((header, i) => [header, parsed[1][i]]))
    expect(record).toMatchObject({ Name: 'Ana, Lane', Bucket: 'Work', 'Work status': 'Current', 'Work types': 'Client', Tags: 'vip; local',
      'Given name': 'Ana', 'Family name': 'Lane', Organization: 'Studio', Department: '', Title: 'Lead' /* Finding #15 */,
      'Phone 1': '111', 'Phone 2': '222', 'Phone 3': '', 'Email 1': 'a@example.com', 'Email 2': '',
      Notes: 'Line 1\nLine 2', Source: 'CSV file', Added: '1970-01-01T00:00:00.000Z' })
    expect(Papa.parse(csvText([]), { skipEmptyLines: true }).data).toHaveLength(1)
  })
  it('sorts delete contacts by name and omits missing phone/email parts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T12:00:00Z'))
    const z = row('Zoe', { bucket: 'delete' })
    const a = row('Ana', { bucket: 'delete' })
    a.contact.org = 'Studio'
    a.contact.phones = [{ value: '123' }]
    a.contact.emails = [{ value: 'a@example.com' }]
    expect(deleteListText([z, row('Work', { bucket: 'work' }), a])).toBe('Delete list — 2 contacts — 2026-10-24\nAna — Studio — 123 — a@example.com\nZoe\n')
  })
})
