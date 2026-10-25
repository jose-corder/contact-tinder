import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Frame, TopBar, cx } from '@/ui'
import { IconUpload } from '@/ui/icons'
import { importContacts, importDemo, previewFiles, commitPreview, type ImportResult, type ImportPreview as Preview, type ImportProgress } from '@/import'
import { isContactPickerSupported, pickContacts } from '@/import/contactPicker'
import HowToExport from './HowToExport'
import ImportPreview, { ImportProgressView } from './ImportPreview'

type Phase = 'choose' | 'preview' | 'importing' | 'done' | 'error'

export default function ImportScreen() {
  const navigate = useNavigate()
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
    <main className="pb-6" aria-busy={phase === 'importing'}>
      <div className={cx('text-center', phase === 'choose' ? 'py-8' : 'py-4')}>
        <p className="mb-3 text-sm text-ink-2">Import a vCard or CSV export</p>
        <h1 ref={heading} tabIndex={-1} className={cx('font-serif leading-tight tracking-tight', phase === 'choose' ? 'text-[38px]' : 'text-[24px]')}>Bring your contacts.</h1>
        {phase === 'choose' && <p className="mt-3 text-sm text-ink-2">Your contacts are processed here. Nothing is uploaded.</p>}
      </div>
      <p aria-live="polite" aria-atomic="true" role="status" className={phase === 'done' ? 'my-4 text-center font-serif text-2xl' : 'sr-only'}>
        {phase === 'importing' && progress ? progress.phase + ': ' + progress.parsed.toLocaleString() + ' contacts ' +
          ({ reading: 'read', parsing: 'parsed', deduping: 'checked', saving: 'saved' }[progress.phase])
          : phase === 'done' && result ? `${result.added} contacts added · ${result.merged} duplicate entries merged` : ''}
      </p>
      {phase === 'choose' && <>
        <label className={cx('relative flex min-h-48 flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-rule px-5 py-8 text-center focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-ink cursor-pointer hover:bg-paper-2', dragging ? 'bg-paper-2' : 'bg-paper')}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); loadFiles(Array.from(event.dataTransfer.files)) }}>
          <input type="file" multiple accept=".vcf,.vcard,.csv,text/vcard,text/x-vcard,text/csv" aria-label="Choose contact files"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => { loadFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = '' }} />
          <IconUpload size={28} />
          <span className="font-serif text-2xl">Choose a contact file</span>
          <span className="text-sm text-ink-2">Contact file (vCard (.vcf)) or CSV (.csv)<span className="hidden [@media(pointer:fine)]:inline"> · or drop files here</span></span>
        </label>
        <div className="mt-4 flex flex-col items-center gap-2">
          {isContactPickerSupported() && <Button variant="outline" full onClick={() => void run(async () => importContacts(await pickContacts(), setProgress))}>Pick from phone</Button>}
          <Button variant="ghost" onClick={() => void run(() => importDemo(setProgress))}>Try 40 sample contacts</Button>
          <p className="text-center text-xs text-ink-2">Samples will be added to this app.</p>
        </div>
        <HowToExport />
      </>}
      {phase === 'preview' && preview && <>
        <p className="break-words text-sm text-ink-2">{selected}</p>
        <ImportPreview preview={preview} busy={false} onConfirm={() => void run(() => commitPreview(preview, setProgress))} onCancel={reset} />
      </>}
      {phase === 'importing' && progress && <ImportProgressView progress={progress} />}
      {phase === 'done' && result && <section className="rounded-[20px] border border-rule bg-paper-2 p-5 text-center">
        {result.possibleDuplicates.length > 0 && <p className="mb-4 text-sm text-ink-2">{result.possibleDuplicates.length} possible duplicates kept apart</p>}
        {result.storageNote && <p className="mb-4 text-sm text-ink-2">{result.storageNote}</p>}
        <Button full size="lg" onClick={() => navigate('/deck/triage')}>Start triage</Button>
        <Button full variant="ghost" onClick={reset}>Import another</Button>
      </section>}
      {phase === 'error' && <section className="rounded-[20px] border border-rule p-5">
        <h2 className="font-serif text-2xl">Import needs another try</h2>
        <ul role="alert" className="my-3 space-y-2 break-words text-sm text-ink">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>
        <Button full onClick={() => retry.current && void run(retry.current)}>Retry</Button>
        <Button full variant="ghost" onClick={reset}>Choose another file</Button>
      </section>}
      {phase !== 'error' && errors.length > 0 && <ul role="alert" className="mt-4 space-y-2 break-words text-sm text-ink-2">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    </main>
  </Frame>
}
