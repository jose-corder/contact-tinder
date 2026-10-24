// Theme + haptics preferences. Stored in localStorage (per-device conveniences).
export type ThemePref = 'system' | 'light' | 'dark'

const THEME_KEY = 'ct.theme'
const HAPTICS_KEY = 'ct.haptics'

// Use window.localStorage explicitly: in Node-based test runners the bare global can be
// Node's own experimental storage, which is not the page's.
function store(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

function read(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    store()?.setItem(key, value)
  } catch {
    /* private mode etc. */
  }
}

export function getThemePref(): ThemePref {
  const v = read(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function setThemePref(pref: ThemePref) {
  write(THEME_KEY, pref)
  applyTheme(pref)
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  syncThemeColor()
}

/** Override the system media hints when the user chooses a manual theme. */
export function syncThemeColor() {
  const pref = document.documentElement.getAttribute('data-theme')
  const dark = pref === 'dark' || (pref !== 'light' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = dark ? '#121110' : '#F4EFE6'
    meta.removeAttribute('media')
  })
}

let stopThemeListener: (() => void) | undefined
export function initTheme() {
  stopThemeListener?.()
  applyTheme()
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener('change', syncThemeColor)
  stopThemeListener = () => media?.removeEventListener('change', syncThemeColor)
  return stopThemeListener
}

export function hapticsEnabled(): boolean {
  return read(HAPTICS_KEY) !== 'off'
}

export function setHapticsEnabled(on: boolean) {
  write(HAPTICS_KEY, on ? 'on' : 'off')
}

/** Short haptic tick (10 ms default). No-op when unsupported, disabled, or reduced motion is on. */
export function haptic(ms = 10) {
  if (!hapticsEnabled()) return
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* ignore */
  }
}

const FOLLOWUP_KEY = 'ct.followup'

/** Show the status/type sheet right after a Work or Personal swipe in triage (default on). */
export function followUpEnabled(): boolean {
  return read(FOLLOWUP_KEY) !== 'off'
}

export function setFollowUpEnabled(on: boolean) {
  write(FOLLOWUP_KEY, on ? 'on' : 'off')
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
