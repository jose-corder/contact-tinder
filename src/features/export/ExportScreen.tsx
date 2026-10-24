import { useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions } from '@/db/repo'
import { Button, Empty, Frame, IconButton, TopBar } from '@/ui'
import { IconDownload } from '@/ui/icons'
import { groupFiles, vcfText } from '@/export/vcf'
import { csvText } from '@/export/csv'
import { deleteListText } from '@/export/deleteList'
import { backupJson } from '@/export/json'
import { downloadText, shareOrDownload } from '@/export/share'
import RestoreInput from './RestoreInput'

export default function ExportScreen() {
  const rows = useLiveQuery(() => allWithDecisions(), [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const files = groupFiles(rows ?? [])
  async function run(action: () => void | Promise<unknown>) {
    setBusy(true)
    setMessage('')
    try { await action() } catch (error) {
      setMessage(error instanceof Error && error.name === 'AbortError' ? 'Sharing cancelled.' : 'Could not export. Please try again.')
    } finally { setBusy(false) }
  }
  return (
    <Frame>
      <TopBar title="Export" backTo="/" />
      <h1 className="my-6 font-serif text-[40px] leading-tight">Take it with you.</h1>
      {!rows ? <p role="status">Loading contacts…</p> : rows.length === 0 ? <Empty title="No contacts yet.">
        <Link to="/import" className="underline underline-offset-4">Import contacts</Link>
      </Empty> : <>
        <table className="mb-8 w-full border-collapse font-sans text-[13px] tabular">
          <caption className="sr-only">Available vCard files</caption>
          <thead className="sr-only"><tr><th>File</th><th>Contacts</th><th>Download</th></tr></thead>
          <tbody>{files.map((file) => <tr key={file.filename} className="border-b border-rule">
            <td className="max-w-[230px] break-words py-3 pr-2">{file.filename}</td>
            <td className="px-2 text-right text-ink-2">{file.rows.length}</td>
            <td className="py-2 text-right"><IconButton label={`Download ${file.filename}`} size={40} disabled={busy}
              onClick={() => void run(() => downloadText(file.filename, vcfText(file.rows), 'text/vcard'))}><IconDownload /></IconButton></td>
          </tr>)}</tbody>
        </table>
        <div className="space-y-3">
          <Button full disabled={busy} onClick={() => void run(async () => {
            const result = await shareOrDownload(files.map((file) => new File([vcfText(file.rows)], file.filename, { type: 'text/vcard' })))
            setMessage(result === 'shared' ? 'vCards shared.' : 'vCard downloads started.')
          })}>Share all vCards</Button>
          <Button full variant="outline" disabled={busy} onClick={() => void run(() => downloadText('all-contacts.csv', csvText(rows), 'text/csv'))}>Everything as CSV</Button>
          <Button full variant="outline" disabled={busy} onClick={() => void run(() => downloadText('delete-list.txt', deleteListText(rows), 'text/plain'))}>Delete list (.txt)</Button>
          <Button full variant="outline" disabled={busy} onClick={() => void run(async () => downloadText('contacts-backup.json', await backupJson(), 'application/json'))}>Backup (.json)</Button>
        </div>
      </>}
      <div className="mt-3"><RestoreInput /></div>
      {message && <p role="status" className="mt-3 text-sm text-ink-2">{message}</p>}
      <p className="my-6 text-sm text-ink-2">Browsers can't edit your phone's address book. Delete the contacts in delete-list.txt yourself, or import the cleaned vCards after clearing the originals.</p>
    </Frame>
  )
}
