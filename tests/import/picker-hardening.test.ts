import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickContacts } from '@/import/contactPicker'
import { metadata } from '@/import/metadata'

afterEach(() => { vi.unstubAllGlobals() })
describe('picker hardening', () => {
  it('ignores malformed entries and fields while preserving valid values', async () => {
    const photo = new Blob(['photo'])
    vi.stubGlobal('navigator', { contacts: { select: vi.fn().mockResolvedValue([
      null, 7, { name: [null, 7, 'Ada'], tel: [false, '2025550101'], email: [null, 'ada@example.com'],
        address: [null, { addressLine: [3, ' One '], city: 7, country: '日本' }], icon: [null, {}, new Blob([]), photo] },
      { name: 'invalid', tel: 7, address: {}, icon: 'invalid' },
    ]) } })
    const contacts = await pickContacts()
    expect(contacts).toHaveLength(1)
    expect(contacts[0]).toMatchObject({ displayName: 'Ada', photo, phones: [{ value: '2025550101' }], emails: [{ value: 'ada@example.com' }] })
    expect(metadata(contacts[0]).details).toEqual([expect.objectContaining({ kind: 'address', value: 'One, 日本' })])
  })

  it('stores repeated country-only addresses once and ignores empty icons', async () => {
    vi.stubGlobal('navigator', { contacts: { select: vi.fn().mockResolvedValue([
      { name: ['Ada'], address: [{ country: ' México ' }, { country: 'México' }, {}], icon: [new Blob([])] },
    ]) } })
    const [contact] = await pickContacts()
    expect(contact.photo).toBeUndefined()
    expect(metadata(contact).details).toEqual([expect.objectContaining({ kind: 'address', value: 'México', address: expect.objectContaining({ country: 'México' }) })])
  })
})
