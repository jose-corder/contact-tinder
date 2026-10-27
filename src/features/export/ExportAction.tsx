import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, InlineNotice } from '@/ui'
import { dbRevision } from '@/export/json'
import { canShareFiles, downloadFiles, fileAction, shareOrDownload } from '@/export/share'
import { yieldToBrowser } from '@/import/progress'
import { packageFiles } from '@/export/zip'

/** Generic contract for Review BulkBar. Pass dbRevision(); key the component by selected IDs when the selection changes. */
export interface ExportActionProps {
  files: () => Promise<File[]>
  label: string
  revision: string | undefined
}
interface PresentationProps {
  disabled?: boolean; primary?: boolean; downloadOnly?: boolean; compact?: boolean; prepareFirst?: boolean
}
/** Compatibility for existing export callers while they adopt the generic files prop. */
interface LegacyProps extends PresentationProps {
  label: string; prepare: () => Promise<File[]>; stubs: File[]; revision?: string
}
export function ExportAction(props: (ExportActionProps & PresentationProps) | LegacyProps) {
  const { label, disabled, primary, downloadOnly = false, compact = false, revision } = props
  const generic = 'files' in props
  const prepare = generic ? props.files : props.prepare
  const prepareFirst = props.prepareFirst ?? generic
  const stubs = generic ? [] : props.stubs.length > 1
    ? [new File([], 'contacts-export.zip', { type: 'application/zip' })] : props.stubs
  const liveRevision = useLiveQuery(async () => revision ?? await dbRevision(), [revision])
  const currentRevision = revision ?? liveRevision
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState<{ files: File[]; revision: string } | null>(null)
  const [stale, setStale] = useState(false)
  const [downloadInstead, setDownloadInstead] = useState(false)
  const locked = useRef(false)
  const action = downloadOnly || downloadInstead ? 'Download' : fileAction(ready?.files ?? stubs)
  const multiple = (!generic && props.stubs.length > 1) || ready?.files[0]?.name === 'contacts-export.zip'

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
        prepared = { files: await packageFiles(await prepare()), revision: before }
      }
      if (await dbRevision() !== prepared.revision) { invalidate(); return }
      const files = prepared.files
      if (action === 'Share' && !canShareFiles(files)) {
        setReady(prepared); setDownloadInstead(true)
        setMessage('These files are ready to download. Sharing is unavailable for this export.')
      } else if (!ready && (stale || prepareFirst || (action === 'Share' && navigator.userActivation?.isActive === false))) {
        setReady(prepared); setStale(false)
        const readyAction = downloadOnly || downloadInstead ? 'Download' : fileAction(files)
        setMessage(`Ready to ${readyAction.toLowerCase()}.`)
      } else {
        if (action === 'Download') {
          await downloadFiles(files)
          setMessage('Download started.')
        } else {
          await shareOrDownload(files, 'Contacts.', false)
          setMessage('Shared.')
        }
        setReady(null); setStale(false); setDownloadInstead(false)
      }
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
        setReady(prepared); setMessage('Sharing cancelled. Your files are still here.')
      } else if (prepared && action === 'Share') {
        setReady(prepared); setDownloadInstead(true)
        setMessage('Could not share. Download the prepared file instead.')
      } else { setFailed(true); setMessage('Could not export. Try again using the button above.') }
    } finally { locked.current = false; setBusy(false) }
  }

  const buttonLabel = stale ? 'Prepare ' + label : !ready && prepareFirst ? 'Prepare ' + label
    : downloadInstead ? 'Download prepared file'
      : ready && action === 'Share' ? 'Share ready file' : action + ' ' + (multiple ? 'contacts-export.zip' : label)
  return <div>
    <Button full variant={primary ? 'primary' : 'outline'} loading={busy} disabled={disabled} onClick={() => void run()}
      className={compact ? 'h-auto min-h-11 whitespace-normal px-2 t-meta' : undefined}>{buttonLabel}</Button>
    <div className="mt-2 space-y-2 break-words">
      {multiple && <InlineNotice tone="info">All files are included in contacts-export.zip.</InlineNotice>}
      {message && <InlineNotice tone={failed ? 'error' : 'info'}>{message}</InlineNotice>}
    </div>
  </div>
}

export default ExportAction
