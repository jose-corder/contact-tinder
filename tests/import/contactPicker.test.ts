import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAppleMobile, isContactPickerSupported, phoneContactsAccess, pickContacts } from '@/import/contactPicker'
import { metadata } from '@/import/metadata'

afterEach(() => { vi.unstubAllGlobals() })

describe('contact picker', () => {
  it('detects unsupported devices and gives a useful error', async () => {
    vi.stubGlobal('navigator', {})
    expect(isContactPickerSupported()).toBe(false)
    await expect(pickContacts()).rejects.toThrow('This browser cannot open your phone contacts. Import a contacts file instead.')
  })

  it('requests supported fields, normalizes keys and skips empty results', async () => {
    const select = vi.fn().mockResolvedValue([
      { name: ['Ada'], tel: ['555.123.4567'], email: [' ADA@EXAMPLE.COM '] },
      { email: ['other@example.com'] }, {},
    ])
    vi.stubGlobal('navigator', { contacts: { select } })
    expect(isContactPickerSupported()).toBe(true)
    const contacts = await pickContacts()
    expect(select).toHaveBeenCalledWith(['name', 'tel', 'email'], { multiple: true })
    expect(contacts).toHaveLength(2)
    expect(contacts[0]).toMatchObject({ displayName: 'Ada', source: 'picker', raw: '', phoneKeys: ['US:5551234567'] /* Finding #3: invalid national exchange is ambiguous. */, emailKeys: ['ada@example.com'] })
    expect(contacts[1].displayName).toBe('other@example.com')
    expect((await pickContacts())[0].id).toBe(contacts[0].id)
  })

  it('requests only supported properties in preferred order', async () => {
    const getProperties = vi.fn().mockResolvedValue(['email', 'name', 'address'])
    const select = vi.fn().mockResolvedValue([])
    vi.stubGlobal('navigator', { contacts: { select, getProperties } })
    expect(await pickContacts()).toEqual([])
    expect(getProperties).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledWith(['name', 'email', 'address'], { multiple: true })
  })

  it('preserves the first icon as a photo and keeps addresses as structured details', async () => {
    const photo = new Blob(['portrait'], { type: 'image/png' })
    const select = vi.fn().mockResolvedValue([{ name: ['Ada'], icon: [photo, new Blob(['other'])], address: [
      { addressLine: [' 123 Main St ', ' Apt 2 '], city: ' London ', region: ' Greater London ', postalCode: ' N1 ', country: ' UK ' },
      { addressLine: ['PO Box 4'], city: 'Oxford' },
      { addressLine: [' ', ''], city: ' ' },
    ] }])
    vi.stubGlobal('navigator', { contacts: { select,
      getProperties: vi.fn().mockResolvedValue(['address', 'icon', 'email', 'tel', 'name']),
    } })
    const [contact] = await pickContacts()
    expect(select).toHaveBeenCalledWith(['name', 'tel', 'email', 'icon', 'address'], { multiple: true })
    expect(contact.photo).toBe(photo)
    expect(contact.notes).toBeUndefined()
    expect(metadata(contact).details).toEqual([
      { kind: 'address', value: '123 Main St, Apt 2, London, Greater London, N1, UK',
        address: { street: '123 Main St, Apt 2', city: 'London', region: 'Greater London', postalCode: 'N1', country: 'UK' } },
      { kind: 'address', value: 'PO Box 4, Oxford', address: { street: 'PO Box 4', city: 'Oxford' } },
    ])
  })

  it.each(['absent', 'throws', 'empty'] as const)('falls back to basic fields when getProperties is %s', async mode => {
    const select = vi.fn().mockResolvedValue([{ name: ['Ada'] }])
    const getProperties = mode === 'absent' ? undefined : mode === 'throws'
      ? vi.fn().mockRejectedValue(new Error('Not implemented')) : vi.fn().mockResolvedValue([])
    vi.stubGlobal('navigator', { contacts: { select, getProperties } })
    const [contact] = await pickContacts()
    expect(select).toHaveBeenCalledWith(['name', 'tel', 'email'], { multiple: true })
    expect(contact.displayName).toBe('Ada')
    expect(contact.photo).toBeUndefined()
    expect(contact.notes).toBeUndefined()
  })

  it('propagates cancellation to the screen', async () => {
    vi.stubGlobal('navigator', { contacts: { select: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) } })
    await expect(pickContacts()).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('phone contacts access', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'

  it.each([
    ['iPhone', iphone, 0, true],
    ['iPad', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 5, true],
    ['iPad with a Mac user agent', mac, 5, true],
    ['desktop Mac', mac, 0, false],
    ['Mac with one touch point', mac, 1, false],
    ['Android', 'Mozilla/5.0 (Linux; Android 15)', 5, false],
  ])('detects Apple mobile on %s', (_name, ua, touchPoints, expected) => {
    expect(isAppleMobile(ua, touchPoints)).toBe(expected)
  })

  it.each([
    ['supported Android', 'Android', 5, true, 'available'],
    ['enabled iPhone', iphone, 5, true, 'available'],
    ['disabled iPhone', iphone, 5, false, 'ios-flag-off'],
    ['disabled iPad', mac, 5, false, 'ios-flag-off'],
    ['desktop Mac', mac, 0, false, 'unavailable'],
    ['unsupported Android', 'Android', 5, false, 'unavailable'],
  ])('reports access for %s', (_name, userAgent, maxTouchPoints, supported, expected) => {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints, contacts: supported ? { select: vi.fn() } : undefined })
    expect(phoneContactsAccess()).toBe(expected)
  })

  it('handles an environment without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isContactPickerSupported()).toBe(false)
    expect(isAppleMobile()).toBe(false)
    expect(phoneContactsAccess()).toBe('unavailable')
  })
})
