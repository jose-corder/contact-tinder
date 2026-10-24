import type { ReviewTab } from './model'

export default function ReviewEmpty({ tab, filtered }: { tab: ReviewTab; filtered: boolean }) {
  const guidance = filtered ? 'Try another search or clear your filters.' : {
    delete: 'Contacts marked Delete will gather here for review.',
    work: 'Sort a contact into Work to start your professional circle.',
    personal: 'Sort a contact into Personal to keep your people close.',
    unsorted: 'Your undecided and skipped contacts will appear here.',
  }[tab]
  return <div className="flex flex-1 flex-col items-center py-14 text-center">
    <svg width="104" height="80" viewBox="0 0 104 80" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="mb-5 text-ink">
      {tab === 'delete' ? <><rect x="15" y="18" width="74" height="46" rx="4" /><path d="m16 22 36 25 36-25M16 61l24-23m48 23L64 38" /></> :
        <><path d="M24 16V9h56a4 4 0 0 1 4 4v42M17 23v-7h56a4 4 0 0 1 4 4v42" /><rect x="10" y="23" width="60" height="47" rx="4" /><circle cx="27" cy="42" r="6" /><path d="M19 59c0-10 16-10 16 0m8-19h17m-17 9h12" /></>}
    </svg>
    <h2 className="font-serif text-3xl">Nothing here yet.</h2>
    <p className="mt-3 max-w-[280px] text-sm text-ink-2">{guidance}</p>
  </div>
}
