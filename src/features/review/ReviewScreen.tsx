import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions } from '@/db/repo'
import { Button, Empty, Frame, InlineNotice, Skeleton, TopBar, useMediaQuery } from '@/ui'
import { IconSearch } from '@/ui/icons'
import Filters from './Filters'
import ReviewList from './ReviewList'
import RowSheet from './RowSheet'
import BulkBar from './BulkBar'
import ReviewTabs from './ReviewTabs'
import { inTab, matchesSearch, type ReviewTab } from './model'
import { prepareReswipe } from './reswipe'

export default function ReviewScreen() {
  const [retry, setRetry] = useState(0)
  const data = useLiveQuery(async () => {
    try { return { rows: await allWithDecisions(), error: '' } }
    catch { return { rows: undefined, error: 'Could not load contacts. Try again.' } }
  }, [retry])
  const rows = data?.rows
  const desktop = useMediaQuery('(min-width: 1024px)')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab')
  const tab: ReviewTab = requestedTab === 'work' || requestedTab === 'personal' || requestedTab === 'unsorted' ? requestedTab : 'delete'
  const tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1)
  const [segment, setSegment] = useState('all')
  const [types, setTypes] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string>()
  const [selection, setSelection] = useState<{ scope: string; ids: Set<string> }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scope = JSON.stringify([tab, segment, types, tags, search])
  const selecting = selection?.scope === scope
  const selected = selecting ? selection.ids : new Set<string>()
  const baseRows = useMemo(() => (rows ?? []).filter(row => inTab(row, tab)), [rows, tab])
  const filtered = useMemo(() => baseRows.filter(row => {
    const d = row.decision
    const available: string[] = tab === 'work' ? d.workTypes : tab === 'personal' ? d.personalTypes : []
    return (segment === 'all' || (tab === 'work' ? d.workStatus : d.relation) === segment) &&
      types.every(type => available.includes(type)) && tags.every(tag => d.customTags.includes(tag)) && matchesSearch(row, search)
  }).sort((a, b) => a.contact.displayName.localeCompare(b.contact.displayName)), [baseRows, tab, segment, types, tags, search])
  const activeFilters = segment !== 'all' || types.length > 0 || tags.length > 0 || !!search
  const clearSelection = () => setSelection(undefined)
  const clearFilters = () => { clearSelection(); setSegment('all'); setTypes([]); setTags([]); setSearch('') }
  const openRow = rows?.find(({ contact }) => contact.id === openId)
  const selectedRows = filtered.filter(({ contact }) => selected.has(contact.id))
  const toggleFilter = (values: string[], value: string) => values.includes(value) ? values.filter(v => v !== value) : [...values, value]
  const toggleSelection = useCallback((id: string) => setSelection(previous => {
    const ids = new Set(previous?.scope === scope ? previous.ids : [])
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    return { scope, ids }
  }), [scope])
  const longPress = useCallback((id: string) => setSelection(previous => ({ scope,
    ids: new Set(previous?.scope === scope ? previous.ids : []).add(id),
  })), [scope])
  return <Frame className="lg:max-w-[960px]">
    <h1 className="sr-only">Review contacts</h1>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="min-w-0">
        <TopBar title="Review" backTo="/" right={<span className="flex items-center gap-3">
          <span>{rows?.length ?? '…'}</span>
          <button className="hit-44 min-h-11 min-w-11 px-2 underline underline-offset-4" disabled={!rows}
            onClick={() => selecting ? clearSelection() : setSelection({ scope, ids: new Set() })}>{selecting ? 'Cancel' : 'Select'}</button>
        </span>} />
        <ReviewTabs value={tab} onChange={value => { clearFilters(); setOpenId(undefined); setParams({ tab: value }, { replace: true }) }}
          options={(['delete', 'work', 'personal', 'unsorted'] as ReviewTab[]).map(value => ({ value,
            label: value.charAt(0).toUpperCase() + value.slice(1), count: (rows ?? []).filter(row => inTab(row, value)).length,
          }))} />
        <label className="sticky top-0 z-10 flex min-h-12 items-center gap-2 border-b border-rule bg-paper">
          <IconSearch size={18} />
          <input type="search" aria-label={'Search in ' + tabLabel} placeholder={'Search in ' + tabLabel + ' (' + baseRows.length + ')'}
            value={search} onChange={event => { clearSelection(); setSearch(event.target.value) }} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-offset-2" />
        </label>
        <div role="tabpanel" id={'review-' + tab} aria-labelledby={'review-' + tab + '-tab'}>
          <Filters tab={tab} rows={baseRows} segment={segment} types={types} tags={tags} active={activeFilters} onClear={clearFilters}
            onSegment={value => { clearSelection(); setSegment(value); setTags([]) }}
            onType={value => { clearSelection(); setTypes(toggleFilter(types, value)) }} onTag={value => { clearSelection(); setTags(toggleFilter(tags, value)) }} />
          {tab === 'delete' && <InlineNotice tone="info">Delete marks a list. Your phone's contacts stay unchanged.</InlineNotice>}
          <div className="py-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <p className="t-meta text-ink-2 tabular" role="status">{filtered.length} of {baseRows.length} match</p>
              {filtered.length > 0 && <Button variant="ghost" loading={busy} onClick={async () => {
                setBusy(true); setError('')
                try {
                  const { pass, ids } = await prepareReswipe(filtered, tab)
                  navigate('/deck/' + pass, { state: { only: ids } })
                } catch { setError('Could not open the deck. Nothing was changed. Please try again.') }
                finally { setBusy(false) }
              }}>Sort again</Button>}
            </div>
            {filtered.length > 0 && <p className="t-meta text-right text-ink-2">Nothing changes until you swipe.</p>}
            {error && <InlineNotice tone="error">{error}</InlineNotice>}
          </div>
          {data?.error ? <InlineNotice tone="error">{data.error}<Button variant="ghost" onClick={() => setRetry(value => value + 1)}>Retry</Button></InlineNotice> :
            !rows ? <div role="status" aria-label="Loading contacts" className="space-y-3 py-6">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div> :
              <ReviewList key={scope} rows={filtered} tab={tab} filtered={activeFilters} selecting={selecting} selected={selected} onOpen={setOpenId}
                onToggle={toggleSelection} onLongPress={longPress} onClear={clearFilters} />}
          {selecting && <div aria-hidden="true" className="h-64 shrink-0" />}
        </div>
      </div>
      {desktop && <aside aria-label="Selected contact" className="min-w-0">
        {openRow ? <RowSheet key={openRow.contact.id} row={openRow} pane onClose={() => setOpenId(undefined)} /> :
          <Empty title="Choose a contact."><p>{openId ? 'This contact is no longer in the app.' : 'Select a row to review its classification and details.'}</p></Empty>}
      </aside>}
    </div>
    {!desktop && openRow && <RowSheet key={openRow.contact.id} row={openRow} onClose={() => setOpenId(undefined)} />}
    {!desktop && openId && rows && !openRow && <InlineNotice tone="info">This contact is no longer in the app.<Button variant="ghost" onClick={() => setOpenId(undefined)}>Dismiss</Button></InlineNotice>}
    {selecting && <BulkBar key={scope} rows={selectedRows} total={baseRows.length} resultCount={filtered.length} tabLabel={tabLabel} onClear={clearSelection}
      onSelectAll={() => setSelection({ scope, ids: new Set(filtered.map(({ contact }) => contact.id)) })} />}
  </Frame>
}
