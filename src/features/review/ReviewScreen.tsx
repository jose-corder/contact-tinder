import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions, counts, saveDecisions } from '@/db/repo'
import { Button, Frame, Segmented, TopBar } from '@/ui'
import { IconSearch } from '@/ui/icons'
import Filters from './Filters'
import ReviewList from './ReviewList'
import RowSheet from './RowSheet'
import BulkBar from './BulkBar'
import { inTab, matchesSearch, resetForReview, type ReviewTab } from './model'

export default function ReviewScreen() {
  const rows = useLiveQuery(() => allWithDecisions(), [])
  const totals = useLiveQuery(counts)
  const navigate = useNavigate()
  const [tab, setTab] = useState<ReviewTab>('delete')
  const [segment, setSegment] = useState('all')
  const [types, setTypes] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string>()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(new Set<string>())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const baseRows = (rows ?? []).filter((row) => inTab(row, tab))
  const segmentRows = baseRows.filter(({ decision: d }) => segment === 'all' || (tab === 'work' ? d.workStatus : d.relation) === segment)
  const filtered = segmentRows.filter((row) => {
    const d = row.decision
    const available: string[] = tab === 'work' ? d.workTypes : tab === 'personal' ? d.personalTypes : []
    return types.every((type) => available.includes(type)) && tags.every((tag) => d.customTags.includes(tag)) && matchesSearch(row, search)
  })
  const openRow = rows?.find(({ contact }) => contact.id === openId)
  const selectedRows = (rows ?? []).filter(({ contact }) => selected.has(contact.id))
  const toggleFilter = (values: string[], value: string) => values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
  const clearSelection = () => { setSelecting(false); setSelected(new Set()) }
  const toggleSelection = (id: string) => setSelected((previous) => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return <Frame>
    <TopBar title="Review" backTo="/" right={<span className="flex items-center gap-3">
      <span>{totals?.total ?? 0}</span>
      <button className="h-10 underline underline-offset-4" onClick={() => selecting ? clearSelection() : setSelecting(true)}>{selecting ? 'Cancel' : 'Select'}</button>
    </span>} />
    <Segmented<ReviewTab> className="justify-between !gap-1 [&>button]:text-[13px]" value={tab} onChange={(value) => {
      setTab(value); setSegment('all'); setTypes([]); setTags([])
    }} options={[
      { value: 'delete', label: 'Delete', count: totals?.bucket.delete ?? 0 },
      { value: 'work', label: 'Work', count: totals?.bucket.work ?? 0 },
      { value: 'personal', label: 'Personal', count: totals?.bucket.personal ?? 0 },
      { value: 'unsorted', label: 'Unsorted', count: (rows ?? []).filter((row) => inTab(row, 'unsorted')).length },
    ]} />
    <div className="py-3">
      <Filters tab={tab} rows={segmentRows} segment={segment} types={types} tags={tags}
        onSegment={(value) => { setSegment(value); setTags([]) }}
        onType={(value) => setTypes(toggleFilter(types, value))} onTag={(value) => setTags(toggleFilter(tags, value))} />
      {filtered.length > 0 && <Button variant="ghost" className="mt-2 px-0! text-sm" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try {
          const reset = resetForReview(filtered, tab)
          await saveDecisions(reset.decisions)
          navigate(`/deck/${reset.pass}`)
        } catch { setError('Could not reset these contacts. Please try again.') }
        finally { setBusy(false) }
      }}>Re-swipe these</Button>}
    </div>
    <label className="sticky top-0 z-10 flex min-h-12 items-center gap-2 border-b border-rule bg-paper">
      <IconSearch size={18} />
      <input type="search" aria-label="Search name, company, phone, email" placeholder="Search name, company, phone, email"
        value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-[13px] outline-offset-2" />
    </label>
    {error && <p role="alert" className="my-3 text-sm">{error}</p>}
    {!rows ? <p role="status" className="py-6">Loading contacts…</p> :
      <ReviewList rows={filtered} selecting={selecting} selected={selected} onOpen={setOpenId} onToggle={toggleSelection}
        onLongPress={(id) => { setSelecting(true); setSelected((prev) => new Set(prev).add(id)) }} />}
    {selecting && <div aria-hidden="true" className="h-32 shrink-0" />}
    {openRow && <RowSheet key={openRow.contact.id} row={openRow} onClose={() => setOpenId(undefined)} />}
    {selecting && <BulkBar rows={selectedRows} onClear={clearSelection} />}
  </Frame>
}
