import Papa from 'papaparse'
import type { ContactWithDecision } from '@/db/repo'
import { BUCKET_META, WORK_STATUS_META, WORK_TYPE_META, PERSONAL_RELATION_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'

export function csvText(rows: ContactWithDecision[]): string {
  return Papa.unparse({
    fields: ['Name', 'Given name', 'Family name', 'Organization', 'Title', 'Phones', 'Emails', 'Phone 1', 'Phone 2', 'Phone 3', 'Email 1', 'Email 2', 'Bucket', 'Work status', 'Work types', 'Relation', 'Personal types', 'Tags', 'Notes', 'Source', 'Added'],
    data: rows.map(({ contact: c, decision: d }) => [
      c.displayName, c.givenName ?? '', c.familyName ?? '', c.org ?? '', c.title ?? '',
      c.phones.map((p) => p.value).join('; '), c.emails.map((e) => e.value).join('; '),
      ...[0, 1, 2].map((index) => c.phones[index]?.value ?? ''),
      ...[0, 1].map((index) => c.emails[index]?.value ?? ''),
      d.bucket ? BUCKET_META[d.bucket].label : '',
      d.bucket === 'work' && d.workStatus ? WORK_STATUS_META[d.workStatus].label : '',
      d.bucket === 'work' ? d.workTypes.map((t) => WORK_TYPE_META[t].label).join('; ') : '',
      d.bucket === 'personal' && d.relation ? PERSONAL_RELATION_META[d.relation].label : '',
      d.bucket === 'personal' ? d.personalTypes.map((t) => PERSONAL_TYPE_META[t].label).join('; ') : '',
      d.customTags.join('; '), c.notes ?? '', c.source, new Date(c.importedAt).toISOString(),
    ]),
  }, { escapeFormulae: true })
}
