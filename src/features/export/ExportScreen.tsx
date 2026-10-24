import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions } from '@/db/repo'
import { Button, Empty, Frame, TopBar } from '@/ui'
import { IconDownload, IconShare } from '@/ui/icons'
import { toast } from '@/ui/toast'
import { cleanFile, groupFiles, type ExportFile } from '@/export/vcf'
import { prepareVcards, fileStub } from '@/export/prepare'
import { csvText } from '@/export/csv'
import { deleteListText } from '@/export/deleteList'
import { backupJson } from '@/export/json'
import { downloadText, fileAction, shareOrDownload } from '@/export/share'
import { exportPlatform, platformHint } from '@/export/platform'
import RestoreInput from './RestoreInput'

export default function ExportScreen() {
  const rows = useLiveQuery(() => allWithDecisions(), [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  // Memoize only memberships/counts, never contact text or photo payloads.
  const prepared = useMemo(() => {
    const groups = groupFiles(rows ?? [])
    const clean = cleanFile(rows ?? [])
    return { clean, files: groups }
  }, [rows])
  const { clean, files } = prepared
  const allFiles = files.map(fileStub)
  const allAction = fileAction(allFiles)
  const cleanAction = fileAction([fileStub(clean)])

  async function run(action: () => void | Promise<unknown>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setMessage('')
    try { await action() } catch (error) {
      const cancelled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
      setMessage(cancelled ? 'Sharing cancelled. Your files are still here.' : 'Could not export. Please try again.')
    } finally { locked.current = false; setBusy(false) }
  }
  async function send(groups: ExportFile[]) {
    setMessage('Preparing vCards…')
    const files = await prepareVcards(groups, (rows?.length ?? 0) > 1000)
    setMessage('')
    const result = await shareOrDownload(files)
    toast(result === 'fallback' ? 'Sharing failed, downloaded instead' : result === 'shared' ? 'vCards shared.' : 'vCard downloads started.')
  }
  return (
    <Frame>
      <TopBar title="Export" backTo="/" />
      <h1 className="my-6 text-center font-serif text-[40px] leading-tight">Take it with you.</h1>
      {!rows ? <p role="status">Loading contacts…</p> : rows.length === 0 ? <Empty title="No contacts yet.">
        <Link to="/import" className="underline underline-offset-4">Import contacts</Link>
      </Empty> : <>
        <section className="mb-6 border-y border-rule py-5">
          <p className="eyebrow mb-2 text-ink-2">One file, ready to keep</p>
          <h2 className="font-serif text-2xl">Clean address book</h2>
          <p className="mt-2 text-sm text-ink-2">{clean.description}</p>
          <p className="tabular my-3 text-xs text-ink-2">contacts-clean.vcf · {clean.rows.length.toLocaleString()} contacts</p>
          <Button full disabled={busy || !clean.rows.length} onClick={() => void run(() => send([clean]))}>
            {cleanAction === 'Share' ? <IconShare /> : <IconDownload />}{cleanAction} clean address book
          </Button>
        </section>
        <table className="w-full table-fixed border-collapse font-sans text-[13px] tabular">
          <caption className="pb-3 text-left eyebrow text-ink-2">Individual lists</caption>
          <thead className="sr-only"><tr><th>File</th><th>Contacts</th><th>Share or download</th></tr></thead>
          <colgroup><col /><col className="w-12" /><col className="w-[84px]" /></colgroup>
          <tbody>{files.map((group) => {
            const action = fileAction([fileStub(group)])
            return <tr key={group.filename} className="border-b border-rule">
              <td className="py-3 pr-1">
                <p className="break-words [overflow-wrap:anywhere]">{group.filename}</p>
                <div className="mt-1 flex items-start gap-1.5 text-xs text-ink-2">
                  {!!group.colors.length && <span className="mt-1 flex shrink-0 gap-1" aria-hidden="true">
                    {group.colors.map((color, index) => <span key={index} className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />)}
                  </span>}
                  <span className="break-words">{group.description}</span>
                </div>
              </td>
              <td className="px-1 text-right text-ink-2">{group.rows.length.toLocaleString()}</td>
              <td className="py-2 text-right"><button aria-label={`${action} ${group.filename}`} disabled={busy}
                className="inline-flex min-h-11 items-center gap-1 pl-2 text-xs disabled:opacity-40"
                onClick={() => void run(() => send([group]))}>
                {action === 'Share' ? <IconShare size={16} /> : <IconDownload size={16} />}{action}
              </button></td>
            </tr>
          })}</tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-ink-2">{platformHint(exportPlatform())}</p>
        <p className="mt-2 mb-6 text-xs text-ink-2">Lists overlap. Import the clean address book once, or choose individual lists.</p>
        <div className="space-y-3">
          <Button full variant="outline" disabled={busy} onClick={() => void run(() => send(files))}>{allAction} all vCards</Button>
          <Button full variant="outline" disabled={busy} onClick={() => void run(() => downloadText('all-contacts.csv', csvText(rows), 'text/csv'))}>Everything as CSV</Button>
          <Button full variant="outline" disabled={busy} onClick={() => void run(() => downloadText('delete-list.txt', deleteListText(rows), 'text/plain'))}>Delete list (.txt)</Button>
          <Button full variant="outline" disabled={busy} onClick={() => void run(async () => downloadText('contacts-backup.json', await backupJson(), 'application/json'))}>Backup (.json)</Button>
        </div>
      </>}
      <div className="mt-3"><RestoreInput /></div>
      {message && <p role="status" className="mt-3 text-sm text-stamp-delete">{message}</p>}
      <p className="my-6 text-sm text-ink-2">Browsers cannot edit your phone’s address book. Exporting does not remove anyone from Contacts. Review your Delete list there before making changes.</p>
    </Frame>
  )
}
