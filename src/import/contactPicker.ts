import type { Contact } from '@/domain/types'
import { makeContact } from './contact'

interface PickerContact {
  name?: string[]
  email?: string[]
  tel?: string[]
}

interface ContactPicker {
  select(properties: Array<'name' | 'email' | 'tel'>, options: { multiple: boolean }): Promise<PickerContact[]>
}

type PickerNavigator = Navigator & { contacts?: ContactPicker }

export function isContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as PickerNavigator).contacts?.select === 'function'
}

export async function pickContacts(): Promise<Contact[]> {
  if (!isContactPickerSupported()) throw new Error('Contact picking is not supported on this device. Import a file instead.')
  const selected = await (navigator as PickerNavigator).contacts!.select(['name', 'email', 'tel'], { multiple: true })
  return selected.flatMap((entry) => {
    const contact = makeContact({
      displayName: entry.name?.find((name) => name.trim()),
      phones: (entry.tel ?? []).map((value) => ({ value })),
      emails: (entry.email ?? []).map((value) => ({ value })),
    }, 'picker')
    return contact ? [contact] : []
  })
}
