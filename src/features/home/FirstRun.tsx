import { useNavigate } from 'react-router'
import { Button } from '@/ui'
import { IconArrowRight, IconShare, IconUpload } from '@/ui/icons'

export default function FirstRun() {
  const navigate = useNavigate()
  return <section className="pb-6">
    <svg className="mx-auto mb-5" width="104" height="80" viewBox="0 0 104 80" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="14" y="19" width="76" height="48" rx="4" /><path d="m15 23 37 25 37-25M15 64l25-24m49 24L64 40M34 13V6h36v7" />
    </svg>
    <h2 className="text-center font-serif text-3xl">Room for the right people.</h2>
    <p className="mt-3 mb-7 text-center text-sm text-ink-2">Import a contact file, sort it, then export your lists.</p>
    <Button full size="lg" onClick={() => navigate('/import')}>Import contacts</Button>
    <p className="mt-3 text-center text-xs text-ink-2">Your contacts are processed here. Nothing is uploaded.</p>
    <ol className="mt-8 border-t border-rule text-sm">
      {[
        { Icon: IconUpload, text: 'Import your address book.' },
        { Icon: IconArrowRight, text: 'Swipe into Work, Personal, or Delete.' },
        { Icon: IconShare, text: 'Export your freshly sorted contacts.' },
      ].map(({ Icon, text }) => <li key={text} className="flex items-center gap-3 border-b border-rule py-4"><Icon size={18} />{text}</li>)}
    </ol>
  </section>
}
