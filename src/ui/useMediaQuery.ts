import { useMemo, useSyncExternalStore } from 'react'

/** Reactive media preference, with an SSR/unsupported-browser fallback. */
export function useMediaQuery(query: string): boolean {
  const media = useMemo(() => typeof window === 'undefined' ? undefined : window.matchMedia?.(query), [query])
  return useSyncExternalStore(
    (notify) => {
      media?.addEventListener('change', notify)
      return () => media?.removeEventListener('change', notify)
    },
    () => media?.matches ?? false,
    () => false,
  )
}
