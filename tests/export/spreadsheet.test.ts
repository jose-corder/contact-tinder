import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import { emptyDecision, type Contact, type Decision } from '@/domain/types'
import { csvText } from '@/export/csv'
import { SHEET_HEADERS, sheetRow } from '@/export/sheet'
import { buildVcard } from '@/export/vcf'
import { parseCsv } from '@/import/csv'
import { parseVcf } from '@/import/vcard'

const record = (contact: Contact, decision: Partial<Decision> = {}) =>
  Object.fromEntries(SHEET_HEADERS.map((header, i) => [header, sheetRow({ contact, decision: { ...emptyDecision(contact.id, 0), ...decision } })[i]]))

const APPLE = [
  'BEGIN:VCARD', 'VERSION:3.0', 'PRODID:-//Apple Inc.//iPhone OS 18.0//EN',
  'N:Lane;Ana;Marie;Dr.;PhD', 'FN:Dr. Ana Marie Lane PhD', 'NICKNAME:Annie', 'ORG:Studio;Design', 'TITLE:Lead',
  'item1.TEL;type=pref;type=CELL;type=VOICE:+1 (202) 555-0101', 'TEL;type=WORK;type=FAX:+12025550102',
  'item2.TEL:+12025550103', 'item2.X-ABLabel:_$!<Assistant>!$_',
  'EMAIL;type=INTERNET;type=HOME;type=pref:ana@example.com', 'EMAIL;type=INTERNET;type=WORK:ana@studio.test',
  'item3.ADR;type=HOME;type=pref:;;1 Main St;Springfield;IL;62701;USA', 'item3.X-ABADR:us',
  'ADR;type=WORK:;;9 Office Rd;Chicago;IL;60601;USA',
  'item4.URL:https://ana.example', 'item4.X-ABLabel:_$!<HomePage>!$_',
  'BDAY;X-APPLE-OMIT-YEAR=1604:1604-05-12',
  'item5.X-ABDATE:2015-06-20', 'item5.X-ABLabel:_$!<Anniversary>!$_',
  'item6.X-ABRELATEDNAMES:Sam Lane', 'item6.X-ABLabel:_$!<Spouse>!$_',
  'X-SOCIALPROFILE;type=twitter;x-user=analane:https://twitter.com/analane',
  'IMPP;X-SERVICE-TYPE=Skype;type=HOME:skype:ana.lane',
  'X-PHONETIC-FIRST-NAME:AH-nah', 'CATEGORIES:Friends,Book club', 'NOTE:Met at the fair',
  'PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQ', 'END:VCARD', '',
].join('\r\n')

describe('spreadsheet rows', () => {
  it('lists every field of an iPhone contact with phone, email and address labels', () => {
    const [contact] = parseVcf(APPLE, 'vcf', 'US')
    expect(record(contact, { bucket: 'personal', relation: 'family', customTags: ['vip'] })).toMatchObject({
      Name: 'Dr. Ana Marie Lane PhD', Bucket: 'Personal', Relation: 'Family', Tags: 'vip',
      Prefix: 'Dr.', 'Given name': 'Ana', 'Middle name': 'Marie', 'Family name': 'Lane', Suffix: 'PhD', Nickname: 'Annie',
      Organization: 'Studio', Department: 'Design', Title: 'Lead',
      'Phone 1': '+1 (202) 555-0101', 'Phone 1 label': 'Mobile', 'Phone 2 label': 'Work fax', 'Phone 3 label': 'Assistant',
      'Email 1': 'ana@example.com', 'Email 1 label': 'Home', 'Email 2 label': 'Work',
      'Address label': 'Home', Street: '1 Main St', City: 'Springfield', Region: 'IL', 'Postal code': '62701', Country: 'USA',
      'More addresses': 'Work: 9 Office Rd, Chicago, IL, 60601, USA',
      Birthday: 'May 12', Anniversary: '2015-06-20', Websites: 'HomePage: https://ana.example',
      'Social profiles': 'Twitter: analane', Messaging: 'Skype: ana.lane', 'Related people': 'Spouse: Sam Lane',
      Groups: 'Friends; Book club', Notes: 'Met at the fair', 'Other details': 'Phonetic first name: AH-nah',
      Photo: 'Yes', Source: 'Apple Contacts',
    })
  })

  it('reads the extra fields Android stores as X-ANDROID-CUSTOM', () => {
    const [contact] = parseVcf(['BEGIN:VCARD', 'VERSION:2.1', 'FN:Bob', 'TEL;CELL:555-0100',
      'X-ANDROID-CUSTOM:vnd.android.cursor.item/nickname;Bobby;1;;;;;;;;;;;;;',
      'X-ANDROID-CUSTOM:vnd.android.cursor.item/relation;Jane;14;;;;;;;;;;;;;',
      'X-ANDROID-CUSTOM:vnd.android.cursor.item/contact_event;2010-09-01;1;;;;;;;;;;;;;',
      'X-ANDROID-CUSTOM:vnd.android.cursor.item/contact_event;1984-02-03;3;;;;;;;;;;;;;', 'END:VCARD'].join('\n'), 'vcf', 'US')
    expect(record(contact)).toMatchObject({ Bucket: 'Unsorted', Nickname: 'Bobby', 'Related people': 'Spouse: Jane',
      Anniversary: '2010-09-01', Birthday: '1984-02-03', 'Phone 1 label': 'Mobile', 'Other details': '' })
  })

  it('keeps Google Contacts CSV columns and writes them back into the clean vCard', () => {
    const csv = [
      'First Name,Middle Name,Last Name,Nickname,Organization Name,Organization Title,Birthday,Notes,Labels,'
        + 'E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value,Address 1 - Label,Address 1 - Formatted,'
        + 'Address 1 - Street,Address 1 - City,Address 1 - Region,Address 1 - Postal Code,Address 1 - Country,'
        + 'Website 1 - Label,Website 1 - Value,Relation 1 - Label,Relation 1 - Value,Event 1 - Label,Event 1 - Value,'
        + 'Custom Field 1 - Label,Custom Field 1 - Value',
      'Ana,Q,Lane,Annie,Studio,Lead,1990-05-12,Note,* myContacts ::: Book club,Work,ana@studio.test,Mobile,+12025550101,'
        + 'Home,"1 Main St, Springfield",1 Main St,Springfield,IL,62701,USA,Blog,https://ana.example,Sister,Bea,'
        + 'Anniversary,2015-06-20,Shirt size,M',
    ].join('\n')
    const [contact] = parseCsv(csv, 'US')
    expect(record(contact)).toMatchObject({ Name: 'Ana Q Lane', 'Middle name': 'Q', Nickname: 'Annie',
      'Phone 1 label': 'Mobile', 'Email 1 label': 'Work', 'Address label': 'Home', Street: '1 Main St', City: 'Springfield',
      Country: 'USA', Birthday: '1990-05-12', Anniversary: '2015-06-20', Websites: 'Blog: https://ana.example',
      'Related people': 'Sister: Bea', Groups: 'Book club', 'Other details': 'Shirt size: M', Notes: 'Note', Source: 'CSV file' })
    const card = buildVcard(contact, ['Personal'])
    expect(card).toContain('N:Lane;Ana;Q;;')
    expect(card).toContain('NICKNAME:Annie')
    expect(card).toContain('ADR;TYPE=Home:;;1 Main St;Springfield;IL;62701;USA')
    expect(card).toContain('BDAY:1990-05-12')
    expect(card).toMatch(/item\d\.X-ABDATE:2015-06-20\r\nitem\d\.X-ABLabel:_\$!<Anniversary>!\$_/)
    expect(card).toMatch(/item\d\.URL:https:\/\/ana\.example\r\nitem\d\.X-ABLabel:Blog/)
    expect(card).toMatch(/item\d\.X-ABRELATEDNAMES:Bea\r\nitem\d\.X-ABLabel:Sister/)
    expect(card).toContain('NOTE:Note\\nShirt size: M')
    expect(card).toContain('CATEGORIES:Book club,Personal')
    // Exported cards import back with the same details.
    expect(record(parseVcf(card, 'vcf', 'US')[0])).toMatchObject({ Street: '1 Main St', Birthday: '1990-05-12',
      Anniversary: '2015-06-20', 'Related people': 'Sister: Bea', Websites: 'Blog: https://ana.example' })
  })

  it('groups Outlook address columns and related people', () => {
    const [contact] = parseCsv(['First Name,Last Name,Mobile Phone,Business Street,Business Street 2,Business City,'
      + 'Business State,Business Postal Code,Business Country/Region,Spouse,Web Page,Gender',
    'Ana,Lane,555-0100,One Way,Suite 5,Chicago,IL,60601,United States,Sam,https://studio.test,Female'].join('\n'), 'US')
    expect(record(contact)).toMatchObject({ 'Phone 1 label': 'Mobile', 'Address label': 'Work', Street: 'One Way, Suite 5',
      City: 'Chicago', Region: 'IL', 'Postal code': '60601', Country: 'United States', 'Related people': 'Spouse: Sam',
      Websites: 'https://studio.test', 'Other details': 'Gender: Female' })
  })

  it('writes a UTF-8 CSV that Excel opens with accents intact and formulas neutralised', () => {
    const [contact] = parseVcf('BEGIN:VCARD\nFN:=André\nTEL:+12025550101\nEND:VCARD', 'vcf', 'US')
    const text = csvText([{ contact, decision: emptyDecision(contact.id, 0) }])
    expect(text.startsWith('﻿Name,Bucket,')).toBe(true)
    const [parsed] = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data
    expect(parsed.Name).toBe("'=André")
  })
})
