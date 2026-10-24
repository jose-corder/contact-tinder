import { useCallback, useState } from 'react'
import type { Pass } from '@/domain/types'

/** Shared by the coach and tests that exercise an already-onboarded deck. */
export function markCoachSeen(pass: Pass) {
  try { window.localStorage.setItem('ct.coach.' + pass, 'seen') } catch { /* private storage */ }
}
function hasSeen(pass: Pass) {
  try { return window.localStorage.getItem('ct.coach.' + pass) === 'seen' } catch { return false }
}
export function useCoach(pass: Pass) {
  const [dismissed, setDismissed] = useState<Pass[]>([])
  const dismiss = useCallback(() => {
    markCoachSeen(pass)
    setDismissed((current) => current.includes(pass) ? current : [...current, pass])
  }, [pass])
  return { visible: !dismissed.includes(pass) && !hasSeen(pass), dismiss }
}
