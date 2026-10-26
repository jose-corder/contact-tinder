import { useSyncExternalStore } from 'react'

type Modality = 'pointer' | 'keyboard'
let lastInput: Modality = 'pointer'
const listeners = new Set<() => void>()
const update = (modality: Modality) => {
  if (lastInput === modality) return
  lastInput = modality
  listeners.forEach(listener => listener())
}
// Track before a sheet mounts, including an asynchronous swipe-to-open transition.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => update('pointer'), true)
  window.addEventListener('keydown', event => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey) update('keyboard')
  }, true)
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useLastInputModality() {
  return useSyncExternalStore(subscribe, () => lastInput, () => 'pointer' as const)
}
