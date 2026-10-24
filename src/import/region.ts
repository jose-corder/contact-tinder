import { isSupportedCountry, type CountryCode } from 'libphonenumber-js/min'

/** Use an explicit language region; a language alone does not identify a country. */
export function defaultCountry(language = typeof navigator === 'undefined' ? '' : navigator.language): CountryCode {
  try {
    const region = new Intl.Locale(language).region
    if (region && isSupportedCountry(region)) return region
  } catch { /* Missing or malformed locale. */ }
  return 'US'
}
