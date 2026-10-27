import { dateText, formatAddress, type ContactDetail, type PostalAddress } from './details'

/**
 * CSV columns the core mapping does not use, kept as contact details. Understands Google Contacts'
 * numbered groups ("Address 1 - City", "Website 1 - Value") and Outlook's "Home Street" layout;
 * anything else is kept under its own column name.
 */
const clean = (value: string | undefined) => value?.trim() || undefined
const cleanLabel = (value: string | undefined) => clean(value)?.replace(/^\*\s*/, '').trim() || undefined
const multiple = (value: string) => value.split(/\s*:::\s*/).map(part => part.trim())
const OUTLOOK_PLACES: Record<string, string> = { home: 'Home', business: 'Work', other: 'Other' }
const RELATIONS: Record<string, string> = { spouse: 'Spouse', "manager's name": 'Manager', "assistant's name": 'Assistant',
  children: 'Child', child: 'Child', 'referred by': 'Referred by' }

function address(parts: Record<string, string>, street: string[]): { value: string; address?: PostalAddress } {
  const postal: PostalAddress = {
    street: street.map((part) => part.trim()).filter(Boolean).join(', ') || undefined,
    city: clean(parts.city), region: clean(parts.region ?? parts.state),
    postalCode: clean(parts['postal code'] ?? parts.zip), country: clean(parts.country ?? parts['country/region']),
  }
  const value = formatAddress(postal)
  return value ? { value, address: postal } : { value: clean(parts.formatted) ?? '' }
}

export function csvDetails(entries: Array<[string, string]>, middle?: string): ContactDetail[] {
  const details: ContactDetail[] = middle ? [{ kind: 'middle', value: middle }] : []
  const numbered = new Map<string, Record<string, string>>()
  const places = new Map<string, Record<string, string>>()
  const record = (map: Map<string, Record<string, string>>, key: string) => map.get(key) ?? map.set(key, {}).get(key)!
  for (const [header, cell] of entries) {
    const name = header.trim(), lower = name.toLowerCase(), value = cell.trim()
    const group = /^(address|website|relation|event|im|custom field)\s*(\d+)\s*-\s*(.+?)(_\d+)?$/i.exec(name)
    if (group) { record(numbered, `${group[1].toLowerCase()}|${group[2]}${group[4] ?? ''}`)[group[3].trim().toLowerCase()] = value; continue }
    const place = /^(home|business|other)\s+(street(?:\s*\d)?|city|state|postal code|country\/region|country|po box)$/i.exec(name)
    if (place) { record(places, place[1].toLowerCase())[place[2].toLowerCase().replace(/\s+/g, ' ')] = value; continue }
    if (/^(?:name )?prefix$/.test(lower)) details.push({ kind: 'prefix', value })
    else if (/^(?:name )?suffix$/.test(lower)) details.push({ kind: 'suffix', value })
    else if (/^nick ?name$/.test(lower)) details.push(...value.split(/\s*,\s*/).map((nickname) => ({ kind: 'nickname' as const, value: nickname })))
    else if (lower === 'birthday') details.push({ kind: 'birthday', value: dateText(value) })
    else if (lower === 'anniversary') details.push({ kind: 'anniversary', value: dateText(value) })
    else if (/web ?page|website|^url$/.test(lower)) {
      details.push(...multiple(value).map(value => ({ kind: 'website' as const, value,
        label: /personal/.test(lower) ? 'Personal' : /business/.test(lower) ? 'Work' : undefined })))
    } else if (/^(?:labels|group membership|categories)$/.test(lower)) {
      for (const label of value.split(/\s*(?::::|;)\s*/).map(cleanLabel)) {
        if (label && !/^mycontacts$/i.test(label)) details.push({ kind: 'group', value: label })
      }
    } else if (RELATIONS[lower]) details.push({ kind: 'related', value, label: RELATIONS[lower] })
    else if (lower !== 'photo') details.push({ kind: 'other', value, label: name })
  }
  for (const [key, grouped] of numbered) {
    const kind = key.split('|')[0]
    const columns = Object.entries(grouped).map(([name, value]) => [name, multiple(value)] as const)
    const count = Math.max(...columns.map(([, values]) => values.length))
    for (let index = 0; index < count; index++) {
      const parts = Object.fromEntries(columns.map(([name, values]) => [name,
        values[index] ?? (['label', 'type', 'service'].includes(name) && values.length === 1 ? values[0] : '')]))
      const label = cleanLabel(parts.label) ?? cleanLabel(parts.type)
      if (kind === 'address') {
        const found = address(parts, [parts['po box'], parts.street, parts['extended address']].filter(Boolean))
        if (found.value) details.push({ kind: 'address', label, ...found })
      } else if (!parts.value) continue
      else if (kind === 'website') details.push({ kind: 'website', value: parts.value, label })
      else if (kind === 'relation') details.push({ kind: 'related', value: parts.value, label })
      else if (kind === 'im') details.push({ kind: 'messaging', value: parts.value, label: cleanLabel(parts.service) ?? label })
      else if (kind === 'event') {
        const date = dateText(parts.value)
        details.push(/anniversary/i.test(label ?? '') ? { kind: 'anniversary', value: date }
          : /birthday/i.test(label ?? '') ? { kind: 'birthday', value: date } : { kind: 'date', value: date, label })
      } else details.push({ kind: 'other', value: parts.value, label: label ?? 'Custom field' })
    }
  }
  for (const [key, parts] of places) {
    const streets = Object.keys(parts).filter((part) => part.startsWith('street')).sort().map((part) => parts[part])
    const found = address(parts, [parts['po box'], ...streets].filter(Boolean))
    if (found.value) details.push({ kind: 'address', label: OUTLOOK_PLACES[key], ...found })
  }
  return details.filter((detail) => detail.value)
}
