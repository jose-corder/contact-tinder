import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseVcf } from '@/import/vcard'
import { hash } from '@/import/hash'

const fixture = (name: string) => readFileSync(resolve('tests/import/fixtures', `${name}.vcf`), 'utf8')

describe('vCard imports', () => {
  it('decodes iCloud groups, quoted types, photo and folded note while preserving original CRLF', () => {
    const text = fixture('icloud')
    const [contact] = parseVcf('\uFEFF' + text)
    expect(contact).toMatchObject({
      displayName: 'Ada Lovelace', givenName: 'Ada', familyName: 'Lovelace',
      org: 'Analytical; Engines', title: 'Mathematician', rev: '2024-03-15T12:00:00.000Z', source: 'vcf',
      phones: [{ value: '+1 (555) 123-4567', type: 'CELL', e164: '+15551234567' }],
      emails: [{ value: 'Ada@Example.com', type: 'HOME' }],
      phoneKeys: ['+15551234567'], emailKeys: ['ada@example.com'],
    })
    expect(contact.photo?.type).toBe('image/jpeg')
    expect(contact.photo?.size).toBeGreaterThan(0)
    expect(contact.notes).toBe('First line\nA long note that is folded onto the next line, with punctuation.')
    expect(contact.raw).toBe(text)
    expect(contact.raw).toContain('\r\n folded onto')
    expect(contact.id).toBe(hash('uid:icloud-ada'))
  })

  it('reads multiple Google cards and escaped structured values without UIDs', () => {
    const contacts = parseVcf(fixture('google'))
    expect(contacts).toHaveLength(2)
    expect(contacts[0]).toMatchObject({ displayName: 'Jane Doe, Jr.', familyName: 'Doe, Jr.', org: 'Studio, Inc.' })
    expect(contacts[0].notes).toBe('Comma, semicolon; slash\\ and newline\ndone')
    expect(contacts[1].displayName).toBe('Luis Rivera')
    expect(contacts.map((c) => c.raw).join('')).toBe(fixture('google'))
  })

  it('decodes Outlook 2.1 UTF-8 quoted printable and soft line breaks', () => {
    const [contact] = parseVcf(fixture('outlook'))
    expect(contact).toMatchObject({
      displayName: 'José García', givenName: 'José', familyName: 'García', org: 'Café',
      notes: 'Primera línea\nsegunda', phones: [{ value: '+1 202 555 0199', type: 'CELL' }],
      emails: [{ value: 'jose@example.com', type: 'INTERNET' }],
    })
    expect(contact.raw).toContain('Garc=\n=C3=ADa')
  })

  it('decodes v4 data URI photos and tel URIs', () => {
    const [contact] = parseVcf(fixture('v4'))
    expect(contact).toMatchObject({ displayName: 'Lin Chen', org: 'Fieldwork', phones: [{ value: '+442079460958' }] })
    expect(contact.photo?.type).toBe('image/png')
    expect(contact.photo?.size).toBeGreaterThan(0)
  })

  it('decodes a JPEG data URI and a folded property header', () => {
    const jpeg = fixture('icloud').match(/PHOTO[^:]*:([^\r\n]+)/)![1]
    const [contact] = parseVcf(`BEGIN:VCARD\nVERSION:4.0\nFN:Photo\nPHOTO:data:image/jpeg;base64,${jpeg}\nTEL;TYPE=\n CELL:2025550123\nEND:VCARD`)
    expect(contact.photo?.type).toBe('image/jpeg')
    expect(contact.photo?.size).toBeGreaterThan(0)
    expect(contact.phones[0].type).toBe('CELL')
  })

  it.each(['icloud', 'google', 'outlook', 'v4'])('produces stable ids and raw round trips for %s', (name) => {
    const first = parseVcf(fixture(name))
    const second = parseVcf(first.map((c) => c.raw).join(''))
    expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id))
    expect(second.map((c) => c.raw)).toEqual(first.map((c) => c.raw))
  })

  it('applies every display name fallback and skips empty cards', () => {
    const fields = ['N:Family;Given;Middle;Dr.;III', 'ORG:An organization', 'EMAIL:a@b.test', 'TEL:5551234567', 'NOTE:Empty']
    const text = fields.map((field) => `BEGIN:VCARD\nVERSION:3.0\n${field}\nEND:VCARD`).join('\n')
    expect(parseVcf(text, 'demo').map((c) => [c.displayName, c.source])).toEqual([
      ['Given Family', 'demo'], ['An organization', 'demo'], ['a@b.test', 'demo'], ['5551234567', 'demo'],
    ])
  })

  it('ignores remote or corrupt photos and keeps valid fields', () => {
    for (const photo of ['PHOTO:https://example.com/private.jpg', 'PHOTO;ENCODING=b;TYPE=PNG:not base64!']) {
      const [contact] = parseVcf(`BEGIN:VCARD\nFN:Name\n${photo}\nREV:not-a-date\nEND:VCARD`)
      expect(contact.photo).toBeUndefined()
      expect(contact.rev).toBe('not-a-date')
    }
  })

  it('handles tab folding, named and bare types, and unindented 2.1 base64', () => {
    const [contact] = parseVcf('BEGIN:VCARD\nVERSION:2.1\nFN:Test\nNOTE:one\n\ttwo\nTEL;TYPE=HOME;TYPE=VOICE:2025550123\nPHOTO;ENCODING=BASE64;TYPE=PNG:\naGVsbG8=\n\nEND:VCARD')
    expect(contact.notes).toBe('onetwo')
    expect(contact.phones[0].type).toBe('HOME')
    expect(contact.photo?.size).toBe(5)
    expect(contact.photo?.type).toBe('image/png')
  })
})
