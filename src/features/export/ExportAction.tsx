import { useRef, useState } from 'react'
import { Button } from '@/ui'
import { canShareFiles, downloadFiles, fileAction, shareOrDownload } from '@/export/share'
import { yieldToBrowser } from '@/import/progress'

export default function ExportAction({ label, prepare, stubs, disabled, primary, downloadOnly = false, compact = false }: {
  label: string; prepare: () => Promise<File[]>; stubs: File[]; disabled?: boolean; primary?: boolean; downloadOnly?: boolean; compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState<File[] | null>(null)
  const [downloadInstead, setDownloadInstead] = useState(false)
  const locked = useRef(false)
  const action = downloadOnly || downloadInstead ? 'Download' : fileAction(stubs)
  const multiple = action === 'Download' && stubs.length > 1

  async function send(files: File[], download: boolean) {
    if (download) { downloadFiles(files); setMessage('Download started.') }
    else {
      await shareOrDownload(files, 'Contacts.', false)
      setMessage('Shared.')
    }
    setReady(null)
  }

  async function run() {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setMessage(ready ? '' : 'Preparing contact file…')
    let files = ready
    try {
      if (!files) {
        // Paint preparation and the multi-download notice before materializing files.
        await yieldToBrowser()
        files = await prepare()
      }
      if (action === 'Share' && !canShareFiles(files)) {
        setReady(files)
        setDownloadInstead(true)
        setMessage('These files are ready to download. Sharing is unavailable for this export.')
      } else if (action === 'Share' && !ready && navigator.userActivation?.isActive === false) {
        setReady(files)
        setMessage('Ready to share.')
      } else await send(files, action === 'Download')
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError'
      if (cancelled) setMessage('Sharing cancelled. Your files are still here.')
      else if (files && action === 'Share') {
        setReady(files)
        setDownloadInstead(true)
        setMessage('Could not share. Download the prepared file instead.')
      } else setMessage('Could not export. Try again using the button above.')
    } finally { locked.current = false; setBusy(false) }
  }

  return <div>
    <Button full variant={primary ? 'primary' : 'outline'} loading={busy} disabled={disabled} onClick={() => void run()}
      aria-label={downloadInstead ? 'Download instead' : ready ? 'Share ready file' : `${action} ${label}`} className={compact ? 'px-2 text-sm' : undefined}>
      {downloadInstead ? 'Download instead' : ready ? 'Share ready file' : compact ? action : `${action} ${label}`}
    </Button>
    {multiple && <p className="mt-2 text-sm text-ink-2">{stubs.length} files will download</p>}
    {message && <p role="status" className="mt-2 break-words text-sm text-ink-2">{message}</p>}
  </div>
}
