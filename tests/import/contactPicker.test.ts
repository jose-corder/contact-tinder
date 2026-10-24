import { afterEach, describe, expect, it, vi } from 'vitest'
import { isContactPickerSupported, pickContacts } from '@/import/contactPicker'

afterEach(() => { vi.unstubAllGlobals() })

describe('contact picker', () => {
  it('detects unsupported devices and gives a useful error', async () => {
    vi.stubGlobal('navigator', {})
    expect(isContactPickerSupported()).toBe(false)
    await expect(pickContacts()).rejects.toThrow('Import a file instead')
  })

  it('requests supported fields, normalizes keys and skips empty results', async () => {
    const select = vi.fn().mockResolvedValue([
      { name: ['Ada'], tel: ['555.123.4567'], email: [' ADA@EXAMPLE.COM '] },
      { email: ['other@example.com'] }, {},
    ])
    vi.stubGlobal('navigator', { contacts: { select } })
    expect(isContactPickerSupported()).toBe(true)
    const contacts = await pickContacts()
    expect(select).toHaveBeenCalledWith(['name', 'email', 'tel'], { multiple: true })
    expect(contacts).toHaveLength(2)
    expect(contacts[0]).toMatchObject({ displayName: 'Ada', source: 'picker', raw: '', phoneKeys: ['+15551234567'], emailKeys: ['ada@example.com'] })
    expect(contacts[1].displayName).toBe('other@example.com')
    expect((await pickContacts())[0].id).toBe(contacts[0].id)
  })

  it('propagates cancellation to the screen', async () => {
    vi.stubGlobal('navigator', { contacts: { select: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) } })
    await expect(pickContacts()).rejects.toMatchObject({ name: 'AbortError' })
  })
})
