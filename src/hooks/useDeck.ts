import { useEffect, useRef, useState } from 'react'
import { counts, deckContacts, saveDecision, type ContactWithDecision } from '@/db/repo'
import { applySwipe, isInDeck, toggleChip as changeChip, toggleCustomTag } from '@/domain/taxonomy'
import { enqueueSkipped, progressOf, reinsertFront, removeTop } from '@/domain/decks'
import type { Decision, Direction, Pass, PersonalType, WorkType } from '@/domain/types'
import { useUndo } from './useUndo'

export function useDeck(pass: Pass) {
  const [queue, setQueue] = useState<ContactWithDecision[]>([])
  const [draft, setDraft] = useState<Decision>()
  const [done, setDone] = useState(0)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [returning, setReturning] = useState<{ id: string; direction: Direction }>()
  const busy = useRef(false)
  const generation = useRef(0)
  const history = useUndo(({ item, prevDecision, direction }) => {
    const stillQueued = queue.some((row) => row.contact.id === item.contact.id)
    if (!stillQueued) setDone((value) => Math.max(0, value - 1))
    setQueue(reinsertFront(queue.filter((row) => row.contact.id !== item.contact.id), { ...item, decision: prevDecision }))
    setDraft(prevDecision)
    setReturning({ id: item.contact.id, direction })
  })

  useEffect(() => {
    const version = ++generation.current
    setLoading(true)
    setError(undefined)
    setDone(0)
    setEmpty(false)
    setQueue([])
    setDraft(undefined)
    setReturning(undefined)
    history.clear()
    busy.current = false
    setPending(false)
    void Promise.all([deckContacts(pass), counts()]).then(([items, summary]) => {
      if (generation.current !== version) return
      const population = pass === 'triage' ? summary.total : summary.bucket[pass]
      setQueue(items)
      setDraft(items[0]?.decision)
      setDone(Math.max(0, population - items.length))
      setEmpty(summary.total === 0)
      setLoading(false)
    }).catch(() => {
      if (generation.current !== version) return
      setError('Could not load contacts. Please reopen this deck.')
      setLoading(false)
    })
    return () => { generation.current++ }
  }, [pass, history.clear])

  const swipe = async (direction: Direction) => {
    const item = queue[0]
    if (!item || !draft || busy.current) return
    busy.current = true
    setPending(true)
    setError(undefined)
    setReturning(undefined)
    const version = generation.current
    const decision = applySwipe(draft, pass, direction)
    const stays = direction === 'down' && isInDeck(decision, pass)
    const rest = removeTop(queue)
    const nextQueue = stays ? enqueueSkipped(rest, { ...item, decision }) : rest
    setQueue(nextQueue)
    setDraft(nextQueue[0]?.decision)
    if (!stays) setDone((value) => value + 1)
    try {
      await saveDecision(decision)
      if (version === generation.current) history.push({ item, prevDecision: item.decision, direction })
      return { item, decision }
    } catch {
      if (version !== generation.current) return
      setQueue(queue)
      setDraft(draft)
      if (!stays) setDone((value) => value - 1)
      setReturning({ id: item.contact.id, direction })
      setError('Could not save. Your card is back; please try again.')
    } finally {
      if (version === generation.current) {
        busy.current = false
        setPending(false)
      }
    }
  }
  const undo = async () => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(undefined)
    const version = generation.current
    try { return await history.undo() }
    catch { if (version === generation.current) setError('Could not undo. Please try again.') }
    finally {
      if (version === generation.current) {
        busy.current = false
        setPending(false)
      }
    }
  }
  return {
    top: queue[0], next: queue[1], remaining: queue.length, done, total: done + queue.length,
    progress: progressOf(done, queue.length), draft, loading, empty, pending, error, returning,
    finished: !loading && !queue.length && !empty && !error && !pending,
    canUndo: history.canUndo && !pending, swipe, undo,
    toggleChip: (key: WorkType | PersonalType) => {
      if (!busy.current) setDraft((value) => value && changeChip(value, pass, key))
    },
    toggleTag: (tag: string) => {
      if (!busy.current) setDraft((value) => value && toggleCustomTag(value, tag))
    },
  }
}
