import type { Contact } from '@/domain/types'
import { makeContact } from './contact'
import { formatAddress, type ContactDetail } from './details'

/**
 * Phone contacts via the Contact Picker API (navigator.contacts).
 *
 * A web page cannot read the address book by itself: the browser shows the phone's own contact
 * chooser and returns only the people the user selects (Android Chrome supports "Select all").
 * Safari on iPhone ships the API behind a feature flag (Settings › Apps › Safari › Advanced ›
 * Feature Flags › Contact Picker API); when it is off, the app explains that and falls back to a
 * contacts file exported from the Contacts app.
 */

type PickerProperty = 'name' | 'email' | 'tel' | 'address' | 'icon'

interface PickerAddress {
  addressLine?: string[]
  city?: string
  region?: string
  postalCode?: string
  country?: string
}

interface PickerContact {
  name?: string[]
  email?: string[]
  tel?: string[]
  address?: PickerAddress[]
  icon?: Blob[]
}

interface ContactPicker {
  select(properties: PickerProperty[], options: { multiple: boolean }): Promise<PickerContact[]>
  getProperties?(): Promise<PickerProperty[]>
}

type PickerNavigator = Navigator & { contacts?: ContactPicker }

export type PhoneContactsAccess =
  /** The phone's contact chooser can be opened from this page. */
  | 'available'
  /** iPhone or iPad Safari with the Contact Picker feature flag turned off. */
  | 'ios-flag-off'
  /** Desktop browsers and phones without the API: import a contacts file instead. */
  | 'unavailable'

export function isContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as PickerNavigator).contacts?.select === 'function'
}

export function isAppleMobile(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent, touchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints): boolean {
  // iPadOS reports a Mac user agent; touch support tells them apart.
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)
}

export function phoneContactsAccess(): PhoneContactsAccess {
  if (isContactPickerSupported()) return 'available'
  return isAppleMobile() ? 'ios-flag-off' : 'unavailable'
}

const WANTED: PickerProperty[] = ['name', 'tel', 'email', 'icon', 'address']

async function supportedProperties(picker: ContactPicker): Promise<PickerProperty[]> {
  try {
    const available = await picker.getProperties?.()
    if (available?.length) return WANTED.filter((property) => available.includes(property))
  } catch { /* fall through to the properties every implementation supports */ }
  return ['name', 'tel', 'email']
}

function addressDetails(addresses: PickerAddress[] | undefined): ContactDetail[] {
  return (addresses ?? []).flatMap((entry) => {
    const address = { street: (entry.addressLine ?? []).map((line) => line.trim()).filter(Boolean).join(', ') || undefined,
      city: entry.city?.trim() || undefined, region: entry.region?.trim() || undefined,
      postalCode: entry.postalCode?.trim() || undefined, country: entry.country?.trim() || undefined }
    const value = formatAddress(address)
    return value ? [{ kind: 'address' as const, value, address }] : []
  })
}

/** Opens the phone's contact chooser and converts the selection. Rejects with AbortError on cancel. */
export async function pickContacts(): Promise<Contact[]> {
  if (!isContactPickerSupported()) throw new Error('This browser cannot open your phone contacts. Import a contacts file instead.')
  const picker = (navigator as PickerNavigator).contacts!
  const selected = await picker.select(await supportedProperties(picker), { multiple: true })
  return selected.flatMap((entry) => {
    const details = addressDetails(entry.address)
    const contact = makeContact({
      displayName: entry.name?.find((name) => name.trim()),
      phones: (entry.tel ?? []).map((value) => ({ value })),
      emails: (entry.email ?? []).map((value) => ({ value })),
      photo: entry.icon?.find((icon) => icon.size > 0),
      ...(details.length ? { details } : {}),
    }, 'picker')
    return contact ? [contact] : []
  })
}
