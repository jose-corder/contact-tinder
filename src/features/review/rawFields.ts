import { formatDate } from '@/ui/format'

const core = new Set(['BEGIN', 'END', 'VERSION', 'FN', 'N', 'ORG', 'TITLE', 'TEL', 'EMAIL', 'NOTE', 'REV', 'PHOTO'])
const labels: Record<string, string> = { ADR: 'Address', BDAY: 'Birthday', URL: 'Website', NICKNAME: 'Nickname', ANNIVERSARY: 'Anniversary', UID: 'Contact ID', PRODID: 'Created by' }
const unescape = (value: string) => value.replace(/\\([nN,;\\])/g, (_, char: string) => /n/i.test(char) ? '\n' : char)

export function websiteHref(value: string): string | undefined {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

/** Unfold every preserved record, including extra properties from merged vCards. */
export function rawFields(raw: string): Array<{ label: string; value: string; href?: string }> {
  return raw.replace(/\r?\n[ \t]/g, '').split(/\r?\n/).flatMap(line => {
    const colon = line.indexOf(':')
    if (colon < 0) return []
    const key = line.slice(0, colon).split(';')[0].split('.').at(-1)!.toUpperCase()
    if (core.has(key)) return []
    const original = line.slice(colon + 1)
    const value = key === 'ADR' ? original.split(/(?<!\\);/).map(unescape).filter(Boolean).join(' · ')
      : ['BDAY', 'ANNIVERSARY'].includes(key) ? formatDate(unescape(original)) : unescape(original)
    return [{ label: labels[key] ?? key, value, href: key === 'URL' ? websiteHref(value) : undefined }]
  })
}
