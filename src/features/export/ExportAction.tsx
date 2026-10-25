import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, InlineNotice } from '@/ui'
import { dbRevision } from '@/export/json'
import { canShareFiles, downloadFiles, fileAction, shareOrDownload } from '@/export/share'
import { yieldToBrowser } from '@/import/progress'

export default function ExportAction({ label, prepare, stubs, disabled, primary, downloadOnly = false, compact = false, revision, prepareFirst = false }: {
  label: string; prepare: () => Promise<File[]>; stubs: File[]; disabled?: boolean; primary?: boolean
  downloadOnly?: boolean; compact?: boolean; revision?: string; prepareFirst?: boolean
}) {
  const liveRevision = useLiveQuery(async () => revision ?? await dbRevision(), [revision])
  const currentRevision = revision ?? liveRevision
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState<{ files: File[]; revision: string } | null>(null)
  const [stale, setStale] = useState(false)
  const [downloadInstead, setDownloadInstead] = useState(false)
  const locked = useRef(false)
  const action = downloadOnly || downloadInstead ? 'Download' : fileAction(stubs)
  const multiple = action === 'Download' && stubs.length > 1

  function invalidate() {
    setReady(null); setDownloadInstead(false); setStale(true); setFailed(false)
    setMessage('Contacts changed — prepare again')
  }
  // #48: discard the artifact during render, before another gesture can send it.
  if (ready && currentRevision !== undefined && ready.revision !== currentRevision) invalidate()

  async function run() {
    if (locked.current) return
    locked.current = true
    setBusy(true); setFailed(false); setMessage(ready ? '' : 'Preparing contact file…')
    let prepared = ready
    try {
      const before = await dbRevision()
      if ((ready && ready.revision !== before) || (currentRevision && currentRevision !== before)) { invalidate(); return }
      if (!prepared) {
        await yieldToBrowser()
        prepared = { files: await prepare(), revision: before }
      }
      if (await dbRevision() !== prepared.revision) { invalidate(); return }
      const files = prepared.files
      if (action === 'Share' && !canShareFiles(files)) {
        setReady(prepared); setDownloadInstead(true)
        setMessage('These files are ready to download. Sharing is unavailable for this export.')
      } else if (!ready && (stale || prepareFirst || (action === 'Share' && navigator.userActivation?.isActive === false))) {
        setReady(prepared); setStale(false); setMessage(`Ready to ${action.toLowerCase()}.`)
      } else {
        if (action === 'Download') {
          await downloadFiles(files, (done, total) => setMessage(`Downloading ${done} of ${total} files`))
          setMessage(files.length > 1 ? `${files.length} file downloads started.` : 'Download started.')
        } else {
          await shareOrDownload(files, 'Contacts.', false)
          setMessage('Shared.')
        }
        setReady(null); setStale(false); setDownloadInstead(false)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setReady(prepared); setMessage('Sharing cancelled. Your files are still here.')
      } else if (prepared && action === 'Share') {
        setReady(prepared); setDownloadInstead(true)
        setMessage('Could not share. Download the prepared file instead.')
      } else { setFailed(true); setMessage('Could not export. Try again using the button above.') }
    } finally { locked.current = false; setBusy(false) }
  }

  const buttonLabel = stale ? 'Prepare' : !ready && prepareFirst ? `Prepare ${label}`
    : multiple ? `Download ${stubs.length} files` : downloadInstead ? 'Download instead'
      : ready && action === 'Share' ? 'Share ready file' : `${action} ${label}`
  return <div>
    <Button full variant={primary ? 'primary' : 'outline'} loading={busy} disabled={disabled} onClick={() => void run()}
      className={compact ? 'h-auto min-h-11 whitespace-normal px-2 t-meta' : undefined}>{buttonLabel}</Button>
    <div className="mt-2 space-y-2 break-words">
      {multiple && <InlineNotice tone="info">{stubs.length} files will download, one at a time.</InlineNotice>}
      {message && <InlineNotice tone={failed ? 'error' : 'info'}>{message}</InlineNotice>}
    </div>
  </div>
}
