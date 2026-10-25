import { useEffect, useRef, useState } from 'react'
import { StaleDecisionError } from '@/db/repo'
import { dismissToast, toast } from '@/ui/toast'
import { clearDeckScope, loadDeck, saveDeckDecision, type DeckItem, type DeckScope } from './deckSession'
import { applySwipe, isInDeck, toggleCustomTag } from '@/domain/taxonomy'
import { enqueueSkipped, progressOf, reinsertFront, removeTop, toggleDeckType } from '@/domain/decks'
import type { Decision, Direction, Pass, PersonalRelation, PersonalType, WorkType } from '@/domain/types'
import { useUndo } from './useUndo'

export function useDeck(pass: Pass) {
  const [queue, setQueue] = useState<DeckItem[]>([])
  const [scopeLabel, setScopeLabel] = useState<string>()
  const scope = useRef<DeckScope | null>(null)
  const initialSkips = useRef(new Map<string, number>())
  const completedIds = useRef(new Set<string>())
  const refreshRequested = useRef(false)
  const [refresh, setRefresh] = useState(0)
  const [draft, setDraft] = useState<Decision>()
  const [done, setDone] = useState(0)
  const initialDone = useRef(0)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [returning, setReturning] = useState<{ id: string; direction: Direction }>()
  const busy = useRef(false)
  const generation = useRef(0)
  const history = useUndo(({ item, prevDecision, direction }) => {
    completedIds.current.delete(item.contact.id)
    const stillQueued = queue.some((row) => row.contact.id === item.contact.id)
    if (!stillQueued) setDone((value) => Math.max(0, value - 1))
    setQueue(reinsertFront(queue.filter((row) => row.contact.id !== item.contact.id), { ...item, decision: prevDecision, persisted: true }))
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
    dismissToast()
    scope.current = null
    completedIds.current.clear()
    setScopeLabel(undefined)
    busy.current = false
    setPending(false)
    void loadDeck(pass).then(({ items, summary, scope: activeScope }) => {
      if (generation.current !== version) {
        // Cleanup can precede the initial read. StrictMode's replacement setup
        // increments again, so only a genuinely abandoned load clears its scope.
        if (generation.current === version + 1 && activeScope) void clearDeckScope(activeScope).catch(() => {})
        return
      }
      scope.current = activeScope
      initialSkips.current = new Map(items.map((item) => [item.contact.id, item.decision.skips[pass]]))
      setScopeLabel(activeScope ? `${items.length} selected` : undefined)
      const population = activeScope ? items.length : pass === 'triage' ? summary.total : summary.bucket[pass]
      setQueue(items)
      setDraft(items[0]?.decision)
      initialDone.current = Math.max(0, population - items.length)
      setDone(initialDone.current)
      setEmpty(summary.total === 0)
      setLoading(false)
    }).catch(() => {
      if (generation.current !== version) return
      setError('Could not load contacts. Please reopen this deck.')
      setLoading(false)
    })
    return () => {
      generation.current++
      history.clear()
      dismissToast()
      if (scope.current) void clearDeckScope(scope.current).catch(() => {})
    }
  }, [pass, history.clear])

  useEffect(() => {
    const visible = () => {
      if (document.visibilityState !== 'visible') return
      // Reconcile on every return, including a brief visit to another editing tab.
      refreshRequested.current = true
      setRefresh((value) => value + 1)
    }
    document.addEventListener('visibilitychange', visible)
    return () => document.removeEventListener('visibilitychange', visible)
  }, [])

  useEffect(() => {
    if (!refreshRequested.current || loading || pending) return
    refreshRequested.current = false
    let active = true
    let settled = false
    const version = generation.current
    void loadDeck(pass, scope.current).then(({ items, summary }) => {
      if (!active || version !== generation.current) return
      if (busy.current) { refreshRequested.current = true; return }
      settled = true
      const fresh = new Map(items.filter((item) => !completedIds.current.has(item.contact.id)).map((item) => [item.contact.id, item]))
      const retained = queue.flatMap((item) => {
        const latest = fresh.get(item.contact.id)
        fresh.delete(item.contact.id)
        return latest ? [latest] : []
      })
      const reconciled = [...retained, ...fresh.values()]
      setQueue(reconciled)
      const sameTop = queue[0]?.contact.id === reconciled[0]?.contact.id &&
        queue[0]?.persisted === reconciled[0]?.persisted &&
        (!queue[0]?.persisted || queue[0]?.decision.updatedAt === reconciled[0]?.decision.updatedAt)
      if (!sameTop) setDraft(reconciled[0]?.decision)
      setEmpty(summary.total === 0)
      history.clear()
      dismissToast()
    }).catch(() => { settled = true; if (active) setError('Could not refresh contacts. Please reopen this deck.') })
    return () => { active = false; if (!settled) refreshRequested.current = true }
  // Queue edits during a refresh cancel its snapshot and request a fresh one.
  }, [refresh, loading, pending, pass, queue, history.clear])

  const finished = !loading && !queue.length && !empty && !error && !pending
  useEffect(() => {
    if (!loading && !queue.length && !pending && scope.current) {
      void clearDeckScope(scope.current).catch(() => setError('Could not clear this selection. Please reopen the deck.'))
    }
  }, [loading, queue.length, pending])

  const swipe = async (direction: Direction, completion?: Decision) => {
    const item = queue[0]
    if (!item || !draft || busy.current) return
    busy.current = true
    setPending(true)
    setError(undefined)
    setReturning(undefined)
    const version = generation.current
    const now = Math.max(Date.now(), item.decision.updatedAt + 1)
    const decision = completion ? { ...completion, updatedAt: now } : applySwipe(draft, pass, direction, now)
    const stays = direction === 'down' && (scope.current?.mode === 'reclassify'
      ? decision.skips[pass] - (initialSkips.current.get(item.contact.id) ?? 0) < 2 : isInDeck(decision, pass))
    const rest = removeTop(queue)
    const nextQueue = stays ? enqueueSkipped(rest, { ...item, decision, persisted: true }) : rest
    setQueue(nextQueue)
    setDraft(nextQueue[0]?.decision)
    if (!stays) { completedIds.current.add(item.contact.id); setDone((value) => value + 1) }
    try {
      await saveDeckDecision(decision, { expectedUpdatedAt: item.persisted ? item.decision.updatedAt : null })
      if (version !== generation.current) return
      history.push({ item, prevDecision: item.decision, writtenDecision: decision, direction })
      return { item, decision }
    } catch (error) {
      if (version !== generation.current) return
      if (error instanceof StaleDecisionError) {
        completedIds.current.add(item.contact.id)
        setQueue(rest)
        setDraft(rest[0]?.decision)
        if (stays) setDone((value) => value + 1)
        toast('This contact changed elsewhere — skipped')
        return
      }
      setQueue(queue)
      completedIds.current.delete(item.contact.id)
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
    sessionDone: Math.max(0, done - initialDone.current), sessionTotal: Math.max(0, done - initialDone.current) + queue.length, scoped: !!scope.current,
    progress: progressOf(done, queue.length), draft, loading, empty, pending, error, returning, scopeLabel,
    finished, amendUndo: history.amend,
    canUndo: history.canUndo && !pending, swipe, undo,
    completePersonal: () => pass === 'personal' && draft?.relation ? swipe('right', draft) : Promise.resolve(undefined),
    setRelation: (relation: PersonalRelation) => {
      if (!busy.current) setDraft((value) => value && { ...value, relation, updatedAt: Date.now() })
    },
    toggleChip: (key: WorkType | PersonalType) => {
      if (!busy.current) setDraft((value) => value && toggleDeckType(value, pass, key))
    },
    toggleTag: (tag: string) => {
      if (!busy.current) setDraft((value) => value && toggleCustomTag(value, tag))
    },
  }
}
