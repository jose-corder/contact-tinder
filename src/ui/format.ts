import { parsePhoneNumberFromString } from 'libphonenumber-js'

/** Readable UTC calendar date; accepts timestamps, ISO dates and compact vCard REV dates. */
export function formatDate(value: Date | string | number): string {
  const normalized = typeof value === 'string'
    ? value.replace(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/, (_, y, m, d, h, min, s, z) =>
      `${y}-${m}-${d}${h ? `T${h}:${min}:${s}${z || 'Z'}` : ''}`)
    : value
  const date = normalized instanceof Date ? normalized : new Date(normalized)
  return Number.isNaN(date.getTime()) ? (typeof value === 'string' ? value : 'Unknown date')
    : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

/** Format international numbers without guessing a country; preserve local/unsupported values. */
export function formatPhone(value: string): string {
  if (!value.trim().startsWith('+')) return value
  try {
    const phone = parsePhoneNumberFromString(value, { extract: false })
    return phone?.isValid() ? phone.formatInternational() : value
  } catch { return value }
}
