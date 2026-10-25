import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { allWithDecisions } from '@/db/repo'
import { db } from '@/db/schema'
import { Button, Empty, Frame, InlineNotice, Skeleton, TopBar } from '@/ui'
import { cleanFile, groupFiles, type ExportFile } from '@/export/vcf'
import { prepareVcards, fileStub } from '@/export/prepare'
import { csvText } from '@/export/csv'
import { deleteListText } from '@/export/deleteList'
import { dbRevision } from '@/export/json'
import { exportPlatform, platformHint } from '@/export/platform'
import ExportAction from './ExportAction'

export default function ExportScreen() {
  const [attempt, setAttempt] = useState(0)
  const data = useLiveQuery(async () => {
    try { return await db.transaction('r', db.contacts, db.decisions, async () => ({ rows: await allWithDecisions(), revision: await dbRevision(), error: false })) }
    catch { return { rows: [], revision: undefined, error: true } }
  }, [attempt])
  const rows = data?.rows
  const { clean, files } = useMemo(() => ({ clean: cleanFile(rows ?? []), files: groupFiles(rows ?? []) }), [rows])
  const contactAction = (groups: ExportFile[], label: string, primary = false, compact = false) =>
    <ExportAction label={label} revision={data?.revision} primary={primary} compact={compact} disabled={!groups.some((group) => group.rows.length)}
      stubs={groups.map(fileStub)} prepare={() => prepareVcards(groups, (rows?.length ?? 0) > 1000)} />
  const textAction = (label: string, name: string, mime: string, text: () => string | Promise<string>) =>
    <ExportAction label={label} revision={data?.revision} prepareFirst={mime === 'text/csv'} downloadOnly stubs={[new File([], name, { type: mime })]}
      prepare={async () => [new File([await text()], name, { type: mime })]} />

  return <Frame>
    <TopBar title="Export" backTo="/" />
    <p className="t-body leading-relaxed text-ink-2">Delete marks a list. Your phone's contacts are unchanged until you act on it.</p>
    <h1 className="my-6 text-center font-serif t-display leading-tight">Take it with you.</h1>
    {!data ? <section aria-label="Loading exports" aria-busy="true" className="space-y-4 border-y border-rule py-5">
      <InlineNotice tone="info">Loading contacts…</InlineNotice>
      <Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" />
      <div aria-label="Loading export table" className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
    </section> : data.error ? <section className="rounded-[20px] border border-rule p-5">
      <h2 className="font-serif t-title">Contacts could not be loaded</h2>
      <InlineNotice tone="error">Try reading this app’s saved contacts again.</InlineNotice>
      <Button onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
    </section> : !rows?.length ? <Empty title="No contacts yet.">
      <p>Import a contact file to create your lists.</p>
      <Link to="/import" className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4">Import contacts</Link>
    </Empty> : <>
      <section className="mb-6 border-y border-rule py-5">
        <h2 className="font-serif t-title">Clean address book</h2>
        <p className="mt-2 t-body text-ink-2">{clean.description}</p>
        <p className="tabular my-3 t-body text-ink-2">{clean.rows.length.toLocaleString()} contacts · contacts-clean.vcf</p>
        {contactAction([clean], 'clean address book', true)}
        <p className="mt-3 t-body leading-relaxed text-ink-2">{platformHint(exportPlatform())}</p>
        <p className="mt-2 t-body leading-relaxed text-ink-2">Importing adds entries and can duplicate existing ones. Keep a backup, then clear the originals first or use Google Contacts’ merge. This file does not remove originals.</p>
        {!clean.rows.length && <InlineNotice tone="info">All contacts are on the Delete list. Move contacts to Work or Personal in Review to include them here.</InlineNotice>}
      </section>
      <section className="mb-6 rounded-[20px] border border-rule p-5">
        <h2 className="font-serif t-title">Delete list</h2>
        <p className="my-3 t-body text-ink-2">A checklist of {rows.filter((r) => r.decision.bucket === 'delete').length} contacts marked Delete. Review these names in your phone’s Contacts app and remove only the entries you intend to delete.</p>
        {textAction('delete list', 'delete-list.txt', 'text/plain', () => deleteListText(rows))}
      </section>
      <details className="border-y border-rule py-2">
        <summary className="min-h-11 cursor-pointer py-3 font-serif t-heading">More exports</summary>
        <p className="mb-4 t-body text-ink-2">Lists overlap. Import the clean address book once, or choose individual lists. Everything includes contacts marked Delete.</p>
        <table className="w-full table-fixed border-collapse t-body">
          <caption className="pb-3 text-left font-medium">Individual lists</caption>
          <thead className="sr-only"><tr><th>List and contacts</th><th>Export</th></tr></thead>
          <colgroup><col /><col className="w-[46%]" /></colgroup>
          <tbody>{files.map((group) => <tr key={group.filename} className="border-b border-rule">
            <td className="py-4 pr-3 align-top">
              <p>{group.description}</p>
              <p className="mt-1 break-words t-meta text-ink-2 [overflow-wrap:anywhere]">{group.filename}</p>
              <p className="mt-1 tabular t-meta text-ink-2">{group.rows.length.toLocaleString()} contacts</p>
            </td>
            <td className="py-3 align-top">{contactAction([group], group.filename, false, true)}</td>
          </tr>)}</tbody>
        </table>
        <div className="my-4 space-y-4">
          {contactAction(files, 'all contact files')}
          {textAction('CSV', 'all-contacts.csv', 'text/csv', () => csvText(rows))}
        </div>
      </details>
    </>}
    <Link to="/settings" className="mt-4 inline-flex min-h-11 items-center t-body underline underline-offset-4">Back up or restore app data in Settings</Link>
  </Frame>
}
