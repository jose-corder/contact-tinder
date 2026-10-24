// A deliberately conservative address subset: unsupported formats remain copyable text.
const EMAIL = /^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/
export function emailHref(value: string): string | undefined {
  if (/\s/.test(value) || value.length > 254 || value.split('@')[0].length > 64 || !EMAIL.test(value)) return undefined
  return `mailto:${encodeURIComponent(value)}`
}

const DIAL = /^\+?[0-9*#]+(?:;ext=[0-9]+)?$/
export function phoneHref(value: string, e164?: string): string | undefined {
  // Strip visual separators only; never remove arbitrary URI parameters or controls.
  const dial = value.replace(/[ ().-]/g, '')
  if (/\s/.test(dial) || !DIAL.test(dial) || !/[0-9]/.test(dial)) return undefined
  const target = !dial.includes(';ext=') && e164 && !/\s/.test(e164) && /^\+[0-9]+$/.test(e164) ? e164 : dial
  return `tel:${target}`
}
