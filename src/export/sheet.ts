import type { ContactWithDecision } from '@/db/repo'
import { BUCKET_META, WORK_STATUS_META, WORK_TYPE_META, PERSONAL_RELATION_META, PERSONAL_TYPE_META } from '@/domain/taxonomy'
import { contactDetails, labeledEntries, type ContactDetail, type DetailKind, type LabeledValue } from '@/import/details'
import { sourceLabel } from '@/import/sourceLabel'

/** One row per contact: your sorting first, then every field the contact carries. Shared by CSV and Excel. */
export interface SheetTable { headers: string[]; rows: string[][] }

export const SHEET_HEADERS = [
  'Name', 'Bucket', 'Work status', 'Work types', 'Relation', 'Personal types', 'Tags',
  'Prefix', 'Given name', 'Middle name', 'Family name', 'Suffix', 'Nickname',
  'Organization', 'Department', 'Title',
  'Phone 1', 'Phone 1 label', 'Phone 2', 'Phone 2 label', 'Phone 3', 'Phone 3 label', 'More phones',
  'Email 1', 'Email 1 label', 'Email 2', 'Email 2 label', 'More emails',
  'Address label', 'Street', 'City', 'Region', 'Postal code', 'Country', 'More addresses',
  'Birthday', 'Anniversary', 'Other dates', 'Websites', 'Social profiles', 'Messaging', 'Related people',
  'Groups', 'Notes', 'Other details', 'Photo', 'Source', 'Last edited', 'Added',
]

const join = (values: Array<string | undefined>) => [...new Set(values.map((value) => value?.trim()).filter(Boolean))].join('; ')
const withLabel = (entry: { value: string; label?: string }) => entry.label ? `${entry.label}: ${entry.value}` : entry.value
const pair = (entry: LabeledValue | undefined) => [entry?.value ?? '', entry?.label ?? '']

export function sheetRow({ contact: c, decision: d }: ContactWithDecision): string[] {
  const details = contactDetails(c)
  const of = (kind: DetailKind): ContactDetail[] => details.filter((detail) => detail.kind === kind)
  const values = (kind: DetailKind) => join(of(kind).map((detail) => detail.value))
  const labeled = (kind: DetailKind) => join(of(kind).map(withLabel))
  const { phones, emails } = labeledEntries(c)
  const [address, ...moreAddresses] = of('address')
  const [company, ...department] = c.org?.split(' · ') ?? []
  return [
    c.displayName,
    d.bucket ? BUCKET_META[d.bucket].label : 'Unsorted',
    d.bucket === 'work' && d.workStatus ? WORK_STATUS_META[d.workStatus].label : '',
    d.bucket === 'work' ? d.workTypes.map((t) => WORK_TYPE_META[t].label).join('; ') : '',
    d.bucket === 'personal' && d.relation ? PERSONAL_RELATION_META[d.relation].label : '',
    d.bucket === 'personal' ? d.personalTypes.map((t) => PERSONAL_TYPE_META[t].label).join('; ') : '',
    d.customTags.join('; '),
    values('prefix'), c.givenName ?? '', values('middle'), c.familyName ?? '', values('suffix'), values('nickname'),
    company ?? '', department.join(' · '), c.title ?? '',
    ...pair(phones[0]), ...pair(phones[1]), ...pair(phones[2]), join(phones.slice(3).map(withLabel)),
    ...pair(emails[0]), ...pair(emails[1]), join(emails.slice(2).map(withLabel)),
    address?.label ?? '', address ? address.address?.street ?? (address.address ? '' : address.value) : '',
    address?.address?.city ?? '', address?.address?.region ?? '', address?.address?.postalCode ?? '', address?.address?.country ?? '',
    join(moreAddresses.map(withLabel)),
    of('birthday')[0]?.value ?? '', values('anniversary'), labeled('date'), labeled('website'), labeled('social'),
    labeled('messaging'), labeled('related'), values('group'),
    c.notes ?? '', labeled('other'), c.photo?.size ? 'Yes' : '', sourceLabel(c), c.rev ?? '', new Date(c.importedAt).toISOString(),
  ]
}

export function sheetTable(rows: ContactWithDecision[]): SheetTable {
  return { headers: SHEET_HEADERS, rows: rows.map(sheetRow) }
}
