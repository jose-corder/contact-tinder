import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Frame, TopBar, cx } from '@/ui'
import { IconUpload } from '@/ui/icons'
import { importContacts, importDemo, previewFiles, commitPreview, type ImportResult, type ImportPreview as Preview, type ImportProgress } from '@/import'
import { toast } from '@/ui/toast'
import { isContactPickerSupported, pickContacts } from '@/import/contactPicker'
import HowToExport from './HowToExport'
import ImportPreview, { ImportProgressView } from './ImportPreview'

export default function ImportScreen() {
  const navigate = useNavigate()
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  async function run(operation: () => Promise<ImportResult | Preview>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setErrors([])
    setResult(null)
    setProgress({ phase: 'reading', parsed: 0 })
    try {
      const next = await operation()
      if ('contacts' in next) setPreview(next.total ? next : null)
      else {
        setResult(next)
        setPreview(null)
        if (next.total) toast(`${next.added.toLocaleString()} imported · ${next.merged.toLocaleString()} merged`)
      }
      setErrors(next.errors)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setErrors([error instanceof Error ? error.message : 'Unable to import contacts. Please try again.'])
      }
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  function loadFiles(files: File[]) {
    if (files.length && !preview) void run(() => previewFiles(files, setProgress))
  }

  return (
    <Frame className="bg-paper text-ink">
      <TopBar title="Import" backTo="/" />
      <main className="pb-6" aria-busy={busy}>
        <div className="py-8 text-center">
          <p className="eyebrow mb-3 text-ink-2">Your address book, considered</p>
          <h1 className="font-serif text-[38px] leading-tight tracking-tight">Bring your contacts.</h1>
          <p className="mt-3 text-sm text-ink-2">Nothing leaves this device.</p>
        </div>

        <label
          className={cx('relative flex min-h-48 flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-rule px-5 py-8 text-center focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-ink',
            dragging ? 'bg-paper-2' : 'bg-paper', busy ? 'opacity-50' : 'cursor-pointer hover:bg-paper-2')}
          onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            if (!busy) loadFiles(Array.from(event.dataTransfer.files))
          }}
        >
          <input
            type="file" multiple disabled={busy || !!preview}
            accept=".vcf,.vcard,.csv,text/vcard,text/x-vcard,text/csv"
            aria-label="Choose contact files"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
            onChange={(event) => {
              loadFiles(Array.from(event.currentTarget.files ?? []))
              event.currentTarget.value = ''
            }}
          />
          <IconUpload size={28} />
          <span className="font-serif text-2xl">Choose a contact file</span>
          <span className="text-sm text-ink-2">vCard or CSV · or drop files here</span>
        </label>

        <div className="mt-4 flex flex-col items-center gap-2">
          {isContactPickerSupported() && (
            <Button variant="outline" full disabled={busy || !!preview} onClick={() => void run(async () => importContacts(await pickContacts(), setProgress))}>
              Pick from phone
            </Button>
          )}
          <Button variant="ghost" disabled={busy || !!preview} onClick={() => void run(() => importDemo(setProgress))}>Try with 40 demo contacts</Button>
        </div>

        <div aria-live="polite" aria-atomic="true">
          {busy && progress && <ImportProgressView progress={progress} />}
          {preview && <ImportPreview preview={preview} busy={busy}
            onConfirm={() => void run(() => commitPreview(preview, setProgress))}
            onCancel={() => { setPreview(null); setErrors([]) }} />}
          {result && result.total > 0 && (
            <section className="mt-6 rounded-[20px] border border-rule bg-paper-2 p-5 text-center">
              <h2 className="mb-5 font-serif text-2xl">{result.added} imported · {result.merged} merged</h2>
              <Button full size="lg" onClick={() => navigate('/deck/triage')}>Start triage</Button>
            </section>
          )}
        </div>
        {errors.length > 0 && (
          <ul role="alert" className="mt-4 space-y-2 break-words text-sm text-stamp-delete">
            {errors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        )}
        <HowToExport />
      </main>
    </Frame>
  )
}
