// Theme + haptics preferences. Stored in localStorage (per-device conveniences).
export type ThemePref = 'system' | 'light' | 'dark'

const THEME_KEY = 'ct.theme'
const HAPTICS_KEY = 'ct.haptics'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
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
}

export function initTheme() {
  applyTheme()
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

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
