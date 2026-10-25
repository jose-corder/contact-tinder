import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { readPossibleDuplicates } from '@/import/duplicates'
import { Link, useNavigate } from 'react-router'
import { Button, Frame, InlineNotice, TopBar, cx } from '@/ui'
import { IconUpload } from '@/ui/icons'
import { importContacts, importDemo, previewFiles, commitPreview, type ImportResult, type ImportPreview as Preview, type ImportProgress } from '@/import'
import { isContactPickerSupported, pickContacts } from '@/import/contactPicker'
import HowToExport from './HowToExport'
import ImportPreview, { ImportProgressView } from './ImportPreview'
import { useImportAnnouncement } from './useImportAnnouncement'

type Phase = 'choose' | 'preview' | 'importing' | 'done' | 'error'

export default function ImportScreen() {
  const navigate = useNavigate()
  const pairs = useLiveQuery(readPossibleDuplicates)
  const unresolved = pairs?.filter(pair => !pair.resolved).length ?? 0
  const locked = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const retry = useRef<(() => Promise<ImportResult | Preview>) | null>(null)
  const [phase, setPhase] = useState<Phase>('choose')
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selected, setSelected] = useState('')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const announcement = useImportAnnouncement(progress, phase === 'importing')
  const title = { choose: 'Bring your contacts.', preview: 'Review your import', importing: 'Importing contacts', done: 'Import complete', error: 'Import needs another try' }[phase]

  useEffect(() => { if (phase !== 'choose') heading.current?.focus() }, [phase])
  function reset() { setPhase('choose'); setPreview(null); setResult(null); setErrors([]); setSelected('') }

  async function run(operation: () => Promise<ImportResult | Preview>) {
    if (locked.current) return
    locked.current = true
    retry.current = operation
    setPhase('importing')
    setErrors([])
    setProgress({ phase: 'reading', parsed: 0 })
    try {
      const next = await operation()
      setErrors(next.errors)
      if (!next.total) {
        setErrors(next.errors.length ? next.errors : ['No contacts were found. Choose another contact file.'])
        setPhase('error')
      } else if ('contacts' in next) { setPreview(next); setPhase('preview') }
      else { setResult(next); setPreview(null); setPhase('done') }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') reset()
      else { setErrors([error instanceof Error ? error.message : 'Unable to import contacts. Please try again.']); setPhase('error') }
    } finally { locked.current = false }
  }

  function loadFiles(files: File[]) {
    if (!files.length || phase !== 'choose') return
    setSelected(files.map((file) => file.name).join(', '))
    void run(() => previewFiles(files, setProgress))
  }

  return <Frame className="bg-paper text-ink">
    <TopBar title="Import" backTo="/" />
    <main className="pb-6">
      <div className={cx('text-center', phase === 'choose' ? 'py-8' : 'py-4')}>
        <p className="mb-3 t-body text-ink-2">Import a vCard or CSV export</p>
        <h1 ref={heading} tabIndex={-1} className={cx('font-serif tracking-tight', phase === 'choose' ? 't-display' : 't-title')}>{title}</h1>
        {phase === 'choose' && <p className="mt-3 t-body text-ink-2">Your contacts are processed here. Nothing is uploaded.</p>}
      </div>
      <div aria-atomic="true" className={phase === 'done' ? 'my-4 space-y-2' : 'sr-only'}>
        <InlineNotice tone="info">{phase === 'importing' ? announcement : phase === 'done' && result ? <>
          <p>{result.added} contacts added · {result.merged} duplicate entries merged</p>
          {result.possibleDuplicates.length > 0 && <p>{result.possibleDuplicates.length} possible duplicates kept apart</p>}
          {result.storageNote && <p>{result.storageNote}</p>}
        </> : ''}</InlineNotice>
      </div>
      {phase === 'choose' && <>
        <label className={cx('relative flex min-h-48 flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-rule px-5 py-8 text-center focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-ink cursor-pointer hover:bg-paper-2', dragging ? 'bg-paper-2' : 'bg-paper')}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); loadFiles(Array.from(event.dataTransfer.files)) }}>
          <input type="file" multiple accept=".vcf,.vcard,.csv,text/vcard,text/x-vcard,text/csv" aria-label="Choose contact files"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => { loadFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = '' }} />
          <IconUpload size={28} />
          <span className="font-serif t-title">Choose a contact file</span>
          <span className="t-body text-ink-2">Contact file (vCard (.vcf)) or CSV (.csv)<span className="hidden [@media(pointer:fine)]:inline"> · or drop files here</span></span>
        </label>
        <div className="mt-4 flex flex-col items-center gap-2">
          {isContactPickerSupported() && <Button variant="outline" full onClick={() => void run(async () => importContacts(await pickContacts(), setProgress))}>Pick phone contacts</Button>}
          <Button variant="ghost" onClick={() => void run(() => importDemo(setProgress))}>Try 40 sample contacts</Button>
          <p className="text-center t-meta text-ink-2">Samples will be added to this app.</p>
        </div>
        <HowToExport />
      </>}
      {phase === 'preview' && preview && <>
        <p className="break-words t-body text-ink-2">{selected}</p>
        <ImportPreview preview={preview} busy={false} onConfirm={() => void run(() => commitPreview(preview, setProgress))} onCancel={reset} />
      </>}
      {phase === 'importing' && progress && <ImportProgressView progress={progress} />}
      {phase === 'done' && result && <section className="rounded-[20px] border border-rule bg-paper-2 p-5 text-center">
        {unresolved > 0 && <Link to="/review?dupes=1" className="mb-4 inline-flex min-h-11 items-center t-body underline underline-offset-4">Review possible duplicates ({unresolved})</Link>}
        <p className="mb-3 t-body">Next, sort contacts into Work, Personal, or Delete.</p>
        <Button full size="lg" onClick={() => navigate('/deck/triage')}>Sort contacts</Button>
        <Button full variant="ghost" onClick={reset}>Import another file</Button>
      </section>}
      {phase === 'error' && <section className="rounded-[20px] border border-rule p-5">
        <InlineNotice tone="error"><ul className="my-3 space-y-2 break-words t-body">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></InlineNotice>
        <Button full onClick={() => retry.current && void run(retry.current)}>Retry import</Button>
        <Button full variant="ghost" onClick={reset}>Choose another file</Button>
      </section>}
      {phase !== 'error' && errors.length > 0 && <InlineNotice tone="error"><ul className="mt-4 space-y-2 break-words t-body">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></InlineNotice>}
    </main>
  </Frame>
}
