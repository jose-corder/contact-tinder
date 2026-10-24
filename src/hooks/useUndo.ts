import { useCallback, useEffect, useRef, useState } from 'react'
import { StaleDecisionError, type ContactWithDecision } from '@/db/repo'
import { saveDeckDecision } from './deckSession'
import { toast } from '@/ui/toast'
import type { Decision, Direction } from '@/domain/types'

export interface UndoEntry {
  item: ContactWithDecision
  prevDecision: Decision
  writtenDecision: Decision
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
      const restored = { ...entry.prevDecision, updatedAt: Math.max(Date.now(), entry.writtenDecision.updatedAt + 1) }
      await saveDeckDecision(restored, { expectedUpdatedAt: entry.writtenDecision.updatedAt })
      if (version !== generation.current) return
      stack.current.pop()
      // Earlier swipes of this same contact now expect the restored version.
      for (const older of stack.current) {
        if (older.writtenDecision.contactId === restored.contactId && older.writtenDecision.updatedAt === entry.prevDecision.updatedAt) older.writtenDecision = restored
      }
      setSize(stack.current.length)
      restore({ ...entry, prevDecision: restored })
      return entry.direction
    } catch (error) {
      if (!(error instanceof StaleDecisionError)) throw error
      if (version !== generation.current) return
      stack.current = stack.current.filter((row) => row.item.contact.id !== entry.item.contact.id)
      setSize(stack.current.length)
      toast('This contact changed elsewhere — skipped')
    } finally {
      pending.current = false
    }
  }
  const amend = (decision: Decision, expectedUpdatedAt: number) => {
    const entry = stack.current.at(-1)
    if (entry?.writtenDecision.contactId === decision.contactId && entry.writtenDecision.updatedAt === expectedUpdatedAt) entry.writtenDecision = decision
  }
  return { push, undo, clear, amend, canUndo: size > 0 }
}
