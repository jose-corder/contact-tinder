import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions, counts } from '@/db/repo'
import { Button, Frame, TopBar } from '@/ui'
import { IconSearch } from '@/ui/icons'
import Filters from './Filters'
import ReviewList from './ReviewList'
import RowSheet from './RowSheet'
import BulkBar from './BulkBar'
import ReviewTabs from './ReviewTabs'
import { inTab, matchesSearch, type ReviewTab } from './model'
import { prepareReswipe } from './reswipe'
import { toast } from '@/ui/toast'

export default function ReviewScreen() {
  const rows = useLiveQuery(() => allWithDecisions(), [])
  const totals = useLiveQuery(counts)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab: ReviewTab = requestedTab === 'work' || requestedTab === 'personal' || requestedTab === 'unsorted' ? requestedTab : 'delete'
  const [segment, setSegment] = useState('all')
  const [types, setTypes] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string>()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(new Set<string>())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const baseRows = useMemo(() => (rows ?? []).filter((row) => inTab(row, tab)), [rows, tab])
  const segmentRows = useMemo(() => baseRows.filter(({ decision: d }) => segment === 'all' || (tab === 'work' ? d.workStatus : d.relation) === segment), [baseRows, segment, tab])
  const filtered = useMemo(() => segmentRows.filter((row) => {
    const d = row.decision
    const available: string[] = tab === 'work' ? d.workTypes : tab === 'personal' ? d.personalTypes : []
    return types.every((type) => available.includes(type)) && tags.every((tag) => d.customTags.includes(tag)) && matchesSearch(row, search)
  }).sort((a, b) => a.contact.displayName.localeCompare(b.contact.displayName)), [segmentRows, tab, types, tags, search])
  const activeFilters = segment !== 'all' || types.length > 0 || tags.length > 0 || !!search
  const clearFilters = () => { setSegment('all'); setTypes([]); setTags([]); setSearch('') }
  const openRow = rows?.find(({ contact }) => contact.id === openId)
  const selectedRows = (rows ?? []).filter(({ contact }) => selected.has(contact.id))
  const toggleFilter = (values: string[], value: string) => values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
  const clearSelection = () => { setSelecting(false); setSelected(new Set()) }
  const toggleSelection = useCallback((id: string) => setSelected((previous) => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }), [])
  const longPress = useCallback((id: string) => { setSelecting(true); setSelected((previous) => new Set(previous).add(id)) }, [])
  return <Frame>
    <TopBar title="Review" backTo="/" right={<span className="flex items-center gap-3">
      <span>{totals?.total ?? 0}</span>
      <button className="min-h-11 min-w-11 px-2 underline underline-offset-4" onClick={() => selecting ? clearSelection() : setSelecting(true)}>{selecting ? 'Cancel' : 'Select'}</button>
    </span>} />
    <ReviewTabs value={tab} onChange={(value) => {
      setParams({ tab: value }, { replace: true }); setSegment('all'); setTypes([]); setTags([])
    }} options={[
      { value: 'delete', label: 'Delete', count: totals?.bucket.delete ?? 0 },
      { value: 'work', label: 'Work', count: totals?.bucket.work ?? 0 },
      { value: 'personal', label: 'Personal', count: totals?.bucket.personal ?? 0 },
      { value: 'unsorted', label: 'Unsorted', count: (rows ?? []).filter((row) => inTab(row, 'unsorted')).length },
    ]} />
    <div className="py-3">
      <Filters tab={tab} rows={baseRows} segment={segment} types={types} tags={tags} active={activeFilters} onClear={clearFilters}
        onSegment={(value) => { setSegment(value); setTags([]) }}
        onType={(value) => setTypes(toggleFilter(types, value))} onTag={(value) => setTags(toggleFilter(tags, value))} />
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
      <p className="text-xs text-ink-2 tabular" role="status">{filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'}</p>
      {filtered.length > 0 && <Button variant="ghost" className="px-0! text-[13px]!" loading={busy && filtered.length > 500} disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try {
          const { pass, ids } = await prepareReswipe(filtered, tab)
          navigate(`/deck/${pass}`, { state: { only: ids } })
        } catch { setError('Could not reset these contacts. Nothing was changed. Please try again.'); toast('Nothing was changed') }
        finally { setBusy(false) }
      }}>Re-swipe these</Button>}
      </div>
    </div>
    <label className="sticky top-0 z-10 flex min-h-12 items-center gap-2 border-b border-rule bg-paper">
      <IconSearch size={18} />
      <input type="search" aria-label="Search name, company, phone, email" placeholder="Search name, company, phone, email"
        value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-[13px] outline-offset-2" />
    </label>
    {error && <p role="alert" className="my-3 text-sm">{error}</p>}
    {!rows ? <p role="status" className="py-6">Loading contacts…</p> :
      <ReviewList key={JSON.stringify([tab, segment, types, tags, search])} rows={filtered} tab={tab} filtered={activeFilters} selecting={selecting} selected={selected} onOpen={setOpenId} onToggle={toggleSelection}
        onLongPress={longPress} />}
    {selecting && <div aria-hidden="true" className="h-32 shrink-0" />}
    {openRow && <RowSheet key={openRow.contact.id} row={openRow} onClose={() => setOpenId(undefined)} />}
    {selecting && <BulkBar rows={selectedRows} onClear={clearSelection} onSelectAll={() => setSelected(new Set(filtered.map(({ contact }) => contact.id)))} />}
  </Frame>
}
