import { useCallback, useEffect, useRef, useState } from 'react'
import { saveDecision, type ContactWithDecision } from '@/db/repo'
import type { Decision, Direction } from '@/domain/types'

export interface UndoEntry {
  item: ContactWithDecision
  prevDecision: Decision
  direction: Direction
}

export function useUndo(restore: (entry: UndoEntry) => void) {
  const stack = useRef<UndoEntry[]>([])
  const pending = useRef(false)
  const generation = useRef(0)
  const [size, setSize] = useState(0)
  useEffect(() => () => { generation.current++ }, [])
  const clear = useCallback(() => {
    generation.current++
    stack.current = []
    setSize(0)
  }, [])
  const push = (entry: UndoEntry) => {
    stack.current = [...stack.current, entry].slice(-20)
    setSize(stack.current.length)
  }
  const undo = async (): Promise<Direction | undefined> => {
    const entry = stack.current.at(-1)
    if (!entry || pending.current) return
    pending.current = true
    const version = generation.current
    try {
      await saveDecision(entry.prevDecision)
      if (version !== generation.current) return
      stack.current.pop()
      setSize(stack.current.length)
      restore(entry)
      return entry.direction
    } finally {
      pending.current = false
    }
  }
  return { push, undo, clear, canUndo: size > 0 }
}
