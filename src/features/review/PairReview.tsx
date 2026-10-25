import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ContactWithDecision } from '@/db/repo'
import type { DuplicatePair } from '@/import/duplicates'
import { Button, Chip, Frame, InlineNotice, ScrollFallback, Skeleton, TopBar } from '@/ui'
import { matchesSearch } from './model'
import { uiDecisionLabels } from './labels'
import PossibleDuplicates from './PossibleDuplicates'

/** A separate workspace: no ordinary rows, tab selection or bulk mutation scope. */
export default function PairReview({ pairs, rows, backTo, error, onRetry, recovery }: {
  pairs: DuplicatePair[]; rows?: ContactWithDecision[]; backTo: string; error?: string; onRetry: () => void; recovery?: ReactNode
}) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<string[]>([])
  const byId = new Map((rows ?? []).map(row => [row.contact.id, row]))
  const members = (pair: DuplicatePair) => [byId.get(pair.a.id), byId.get(pair.b.id)].filter((row): row is ContactWithDecision => !!row)
  const labels = (row: ContactWithDecision) => [...(!row.decision.bucket ? ['Unsorted'] : []), ...uiDecisionLabels(row.decision)]
  const options = [...new Set(pairs.flatMap(pair => members(pair).flatMap(labels)))].sort()
  const visible = pairs.filter(pair => {
    const both = members(pair)
    return both.some(row => matchesSearch(row, search)) && filters.every(value => both.some(row => labels(row).includes(value)))
  })
  return <ScrollFallback><Frame>
    <h1 id="review-pairs-heading" tabIndex={-1} className="sr-only">Review possible duplicates</h1>
    <TopBar title="Review" backTo="/" />
    <Link to={backTo} className="hit-44 inline-flex items-center underline">Back to list</Link>
    {recovery}
    <label className="flex min-h-12 items-center border-b border-rule">
      <input type="search" aria-label="Search both contacts in each pair" placeholder="Search both contacts in each pair"
        className="min-w-0 flex-1 bg-transparent py-3 t-body" value={search} onChange={event => setSearch(event.target.value)} />
    </label>
    <div aria-label="Filter both contacts in each pair" className="flex flex-wrap gap-2 py-3">
      {options.map(value => <Chip key={value} label={value} selected={filters.includes(value)} onClick={() =>
        setFilters(previous => previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value])} />)}
      {(search || filters.length > 0) && <Button variant="ghost" onClick={() => { setSearch(''); setFilters([]) }}>Clear search and filters</Button>}
    </div>
    {error ? <InlineNotice tone="error">{error}<Button variant="ghost" onClick={onRetry}>Retry</Button></InlineNotice>
      : !rows ? <div role="status" aria-label="Loading pairs"><Skeleton className="h-32" /></div>
        : <PossibleDuplicates pairs={visible} filtered={!!search || filters.length > 0} />}
  </Frame></ScrollFallback>
}
