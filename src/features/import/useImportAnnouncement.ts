import { useEffect, useRef, useState } from 'react'
import type { ImportProgress } from '@/import/progress'

export function phaseSentence(progress: ImportProgress): string {
  return { reading: 'Reading file', parsing: `Parsing ${progress.parsed.toLocaleString()} contacts`,
    deduping: 'Checking duplicates', saving: 'Saving' }[progress.phase]
}

/** Announce phase transitions immediately, but parsing counts at most once per second. */
export function useImportAnnouncement(progress: ImportProgress | null, active: boolean) {
  const [sentence, setSentence] = useState('')
  const last = useRef<{ phase?: ImportProgress['phase']; at: number }>({ at: 0 })
  useEffect(() => {
    if (!active || !progress) { last.current = { at: 0 }; setSentence(''); return }
    const announce = () => {
      last.current = { phase: progress.phase, at: Date.now() }
      setSentence(phaseSentence(progress))
    }
    const wait = progress.phase !== last.current.phase ? 0 : Math.max(0, 1000 - (Date.now() - last.current.at))
    if (!wait) { announce(); return }
    const timer = setTimeout(announce, wait)
    return () => clearTimeout(timer)
  }, [progress, active])
  return sentence
}
