export function unescapeValue(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, escaped: string) => /n/i.test(escaped) ? '\n' : escaped)
}

function splitOutsideQuotes(value: string, delimiter: string): string[] {
  const parts: string[] = []
  let quoted = false
  let start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '"' && value[i - 1] !== '\\') quoted = !quoted
    if (value[i] === delimiter && !quoted) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts
}

export function property(line: string) {
  const [header, ...values] = splitOutsideQuotes(line, ':')
  if (!values.length) return undefined
  const [name, ...parameters] = splitOutsideQuotes(header, ';')
  const params = new Map<string, string[]>()
  for (const param of parameters) {
    const equals = param.indexOf('=')
    const key = equals < 0 ? 'TYPE' : param.slice(0, equals).toUpperCase()
    const value = (equals < 0 ? param : param.slice(equals + 1)).replace(/^"|"$/g, '')
    params.set(key, [...(params.get(key) ?? []), ...value.split(',').map((v) => v.replace(/^"|"$/g, ''))])
  }
  return { name: name.split('.').pop()!.toUpperCase(), params, value: values.join(':') }
}

export function logicalLines(raw: string): string[] {
  const lines: string[] = []
  let field: ReturnType<typeof property>
  for (const line of raw.split(/\r\n|\n|\r/)) {
    const last = lines.at(-1)
    const encoding = field?.params.get('ENCODING')?.[0]?.toUpperCase()
    if (last && encoding === 'QUOTED-PRINTABLE' && last.endsWith('=')) {
      lines[lines.length - 1] = last.slice(0, -1) + line.replace(/^[ \t]/, '')
    } else if (last && /^[ \t]/.test(line)) {
      lines[lines.length - 1] += line.slice(1)
      // The property header itself may be folded before its colon.
      field ??= property(lines[lines.length - 1])
    } else if (last && field?.name === 'PHOTO' && /^(B|BASE64)$/.test(encoding ?? '') && /^[A-Za-z0-9+/=]+$/.test(line)) {
      // vCard 2.1 sometimes wraps inline base64 without a folding space.
      lines[lines.length - 1] += line
    } else {
      lines.push(line)
      field = property(line)
    }
  }
  return lines
}

export function decodeQuotedPrintable(value: string, charset = 'UTF-8'): string {
  const bytes: number[] = []
  for (let i = 0; i < value.length;) {
    if (value[i] === '=' && /^[\da-f]{2}$/i.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16))
      i += 3
    } else {
      const character = String.fromCodePoint(value.codePointAt(i)!)
      bytes.push(...new TextEncoder().encode(character))
      i += character.length
    }
  }
  try { return new TextDecoder(charset).decode(new Uint8Array(bytes)) }
  catch { return new TextDecoder('UTF-8').decode(new Uint8Array(bytes)) }
}

export function photoBlob(value: string, params: Map<string, string[]>): Blob | undefined {
  if (/^https?:/i.test(value)) return undefined
  const data = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/i.exec(value)
  const encoding = params.get('ENCODING')?.[0] ?? ''
  if (!data && !/^(b|base64)$/i.test(encoding)) return undefined
  const format = params.get('TYPE')?.find((type) => /^(jpe?g|png|image\/)/i.test(type))?.toLowerCase()
  const mime = data?.[1] ?? params.get('MEDIATYPE')?.[0]
    ?? (format?.includes('/') ? format : format === 'png' ? 'image/png' : 'image/jpeg')
  try {
    const binary = atob((data?.[2] ?? value).replace(/\s/g, ''))
    if (!binary.length) return undefined
    return new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: mime })
  } catch { return undefined }
}
