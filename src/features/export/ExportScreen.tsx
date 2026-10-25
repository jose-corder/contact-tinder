import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions } from '@/db/repo'
import { Button, Empty, Frame, Skeleton, TopBar } from '@/ui'
import { cleanFile, groupFiles, type ExportFile } from '@/export/vcf'
import { prepareVcards, fileStub } from '@/export/prepare'
import { csvText } from '@/export/csv'
import { deleteListText } from '@/export/deleteList'
import { backupJson } from '@/export/json'
import { exportPlatform, platformHint } from '@/export/platform'
import RestoreInput from './RestoreInput'
import ExportAction from './ExportAction'

export default function ExportScreen() {
  const [attempt, setAttempt] = useState(0)
  const data = useLiveQuery(async () => {
    try { return { rows: await allWithDecisions(), error: false } }
    catch { return { rows: [], error: true } }
  }, [attempt])
  const rows = data?.rows
  const { clean, files } = useMemo(() => ({ clean: cleanFile(rows ?? []), files: groupFiles(rows ?? []) }), [rows])
  const contactAction = (groups: ExportFile[], label: string, primary = false, compact = false) =>
    <ExportAction label={label} primary={primary} compact={compact} disabled={!groups.some((group) => group.rows.length)}
      stubs={groups.map(fileStub)} prepare={() => prepareVcards(groups, (rows?.length ?? 0) > 1000)} />
  const textAction = (label: string, name: string, mime: string, text: () => string | Promise<string>) =>
    <ExportAction label={label} downloadOnly stubs={[new File([], name, { type: mime })]}
      prepare={async () => [new File([await text()], name, { type: mime })]} />

  return <Frame>
    <TopBar title="Export" backTo="/" />
    <p className="text-sm leading-relaxed text-ink-2">Delete marks a list. Your phone's contacts are unchanged until you act on it.</p>
    <h1 className="my-6 text-center font-serif text-[40px] leading-tight">Take it with you.</h1>
    {!data ? <section aria-label="Loading exports" aria-busy="true" className="space-y-4 border-y border-rule py-5">
      <p role="status" className="text-sm text-ink-2">Loading contacts…</p>
      <Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" />
      <div aria-label="Loading export table" className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
    </section> : data.error ? <section className="rounded-[20px] border border-rule p-5">
      <h2 className="font-serif text-2xl">Contacts could not be loaded</h2>
      <p role="alert" className="my-3 text-sm text-ink-2">Try reading this app’s saved contacts again.</p>
      <Button onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
    </section> : !rows?.length ? <Empty title="No contacts yet.">
      <p>Import a contact file to create your lists.</p>
      <Link to="/import" className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4">Import contacts</Link>
    </Empty> : <>
      <section className="mb-6 border-y border-rule py-5">
        <h2 className="font-serif text-2xl">Clean address book</h2>
        <p className="mt-2 text-sm text-ink-2">{clean.description}</p>
        <p className="tabular my-3 text-sm text-ink-2">{clean.rows.length.toLocaleString()} contacts · contacts-clean.vcf</p>
        {contactAction([clean], 'clean address book', true)}
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{platformHint(exportPlatform())}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">Importing adds entries and can duplicate existing ones. Keep a backup, then clear the originals first or use Google Contacts’ merge. This file does not remove originals.</p>
        {!clean.rows.length && <p className="mt-2 text-sm text-ink-2">All contacts are on the Delete list. Move contacts to Work or Personal in Review to include them here.</p>}
      </section>
      <section className="mb-6 rounded-[20px] border border-rule p-5">
        <h2 className="font-serif text-2xl">Delete list</h2>
        <p className="my-3 text-sm text-ink-2">A checklist of {rows.filter((r) => r.decision.bucket === 'delete').length} contacts marked Delete. Review these names in your phone’s Contacts app and remove only the entries you intend to delete.</p>
        {textAction('delete list', 'delete-list.txt', 'text/plain', () => deleteListText(rows))}
      </section>
      <details className="border-y border-rule py-2">
        <summary className="min-h-11 cursor-pointer py-3 font-serif text-xl">More exports</summary>
        <p className="mb-4 text-sm text-ink-2">Lists overlap. Import the clean address book once, or choose individual lists. Everything includes contacts marked Delete.</p>
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="pb-3 text-left font-medium">Individual lists</caption>
          <thead className="sr-only"><tr><th>List and contacts</th><th>Export</th></tr></thead>
          <colgroup><col /><col className="w-[46%]" /></colgroup>
          <tbody>{files.map((group) => <tr key={group.filename} className="border-b border-rule">
            <td className="py-4 pr-3 align-top">
              <p>{group.description}</p>
              <p className="mt-1 break-words text-xs text-ink-2 [overflow-wrap:anywhere]">{group.filename}</p>
              <p className="mt-1 tabular text-xs text-ink-2">{group.rows.length.toLocaleString()} contacts</p>
            </td>
            <td className="py-3 align-top">{contactAction([group], group.filename, false, true)}</td>
          </tr>)}</tbody>
        </table>
        <div className="my-4 space-y-4">
          {contactAction(files, 'all contact files')}
          {textAction('everything as CSV', 'all-contacts.csv', 'text/csv', () => csvText(rows))}
          {textAction('app backup', 'contacts-backup.json', 'application/json', backupJson)}
          <p className="text-sm text-ink-2">The JSON backup saves your contacts and sorting decisions for this app.</p>
        </div>
      </details>
    </>}
    <details className="mt-4 border-b border-rule pb-4">
      <summary className="min-h-11 cursor-pointer py-3 font-serif text-xl">Restore a backup</summary>
      <RestoreInput />
    </details>
  </Frame>
}
