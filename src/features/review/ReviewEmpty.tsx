import { Link } from 'react-router'
import { Button, Empty } from '@/ui'
import type { ReviewTab } from './model'

export default function ReviewEmpty({ tab, filtered, onClear }: { tab: ReviewTab; filtered: boolean; onClear?: () => void }) {
  return <Empty title={filtered ? 'No matching contacts.' : 'Nothing here yet.'}>
    <p>{filtered ? 'Try another search or clear your filters.' : {
      delete: 'Contacts marked Delete will gather here for review.', work: 'Contacts sorted into Work will appear here.',
      personal: 'Contacts sorted into Personal will appear here.', unsorted: 'Not classified or skipped twice. These contacts will appear here.',
    }[tab]}</p>
    {filtered ? <Button variant="ghost" onClick={onClear}>Clear search and filters</Button> :
      <Link className="hit-44 mt-3 inline-flex items-center underline" to="/import">Import contacts</Link>}
  </Empty>
}
