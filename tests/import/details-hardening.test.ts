import { describe, expect, it } from 'vitest'
import { contactDetails, dateText, humanLabel, labeledEntries, uniqueDetails } from '@/import/details'
import { parseVcf } from '@/import/vcard'
import { property } from '@/import/vcardCodec'
import { readRawFields } from '@/import/rawFields'
import { mergeContacts } from '@/import/dedupe'

const card = (fields: string) => parseVcf(`BEGIN:VCARD\nVERSION:4.0\nFN:Renée 王 😀\nEMAIL:test@example.test\n${fields}\nEND:VCARD`)[0]

describe('vCard detail hardening', () => {
  it('splits nickname lists before unescaping punctuation', () => {
    expect(contactDetails(card(String.raw`NICKNAME:Last\, First,小王,semi\;colon`))).toEqual([
      { kind: 'nickname', value: 'Last, First' }, { kind: 'nickname', value: '小王' }, { kind: 'nickname', value: 'semi;colon' },
    ])
  })

  it('keeps quoted commas and decodes RFC 6868 parameter escapes', () => {
    const prop = property('ADR;TYPE="home,pref";LABEL="1 Main St, Apt 2^nCity ^\'West^\' ^^":;;;;;;')!
    expect(prop.params.get('TYPE')).toEqual(['home', 'pref'])
    expect(prop.params.get('LABEL')).toEqual(['1 Main St, Apt 2\nCity "West" ^'])
    expect(contactDetails(card('ADR;TYPE=home;LABEL="1 Main St, Apt 2^nCity":;;;;;;'))).toEqual([
      { kind: 'address', value: '1 Main St, Apt 2\nCity', label: 'Home' },
    ])
  })

  it('decodes quoted printable details and Apple labels, including grouped core types', () => {
    const contact = card('item1.tel:2025550101\nITEM1.x-ablabel;CHARSET=ISO-8859-1;ENCODING=QUOTED-PRINTABLE:Caf=E9\n'
      + 'ADR;CHARSET=ISO-8859-1;ENCODING=QUOTED-PRINTABLE:;;Rue du Caf=E9;Paris;;;France\n'
      + 'X-ABRELATEDNAMES;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Ren=C3=A9e\nNOTE;ENCODING=QUOTED-PRINTABLE:line=0Abreak')
    expect(contact.phones[0].type).toBe('Café')
    expect(labeledEntries(contact).phones[0].label).toBe('Café')
    expect(contactDetails(contact)).toContainEqual(expect.objectContaining({ kind: 'address', value: 'Rue du Café, Paris, France' }))
    expect(contactDetails(contact)).toContainEqual(expect.objectContaining({ kind: 'related', value: 'Renée' }))
    expect(contact.notes).toBe('line\nbreak')
  })

  it.each(['20230230', '19000229', '00000512', '--0230'])('preserves invalid calendar date %s verbatim', (value) => {
    expect(dateText(value)).toBe(value)
  })

  it('retains a real 1604 year and honours explicit omit-year and text values', () => {
    expect(dateText('16040512')).toBe('1604-05-12')
    expect(dateText('20000512', '2000')).toBe('May 12')
    expect(dateText('--0229')).toBe('February 29')
    expect(contactDetails(card('BDAY;VALUE=text:19900512'))).toContainEqual({ kind: 'birthday', value: '19900512' })
  })

  it.each([
    [['x-custom', 'X-CUSTOM'], 'Custom'], [['HOME', 'home', 'CELL', 'mobile', 'pref'], 'Home mobile'],
    [['pref', 'PREF=1'], ''], [['x-自宅'], '自宅'], [['HOME;FAX'], 'Home fax'],
  ] as const)('normalizes type tokens %j', (types, expected) => {
    expect(humanLabel(types)).toBe(expected)
  })

  it('keeps same-valued distinct custom fields while deduplicating whitespace variants', () => {
    expect(uniqueDetails([
      { kind: 'other', label: 'Shirt size', value: ' M ' }, { kind: 'other', label: 'shirt SIZE ', value: 'm' },
      { kind: 'other', label: 'Glove size', value: 'M' },
    ])).toEqual([{ kind: 'other', label: 'Shirt size', value: ' M ' }, { kind: 'other', label: 'Glove size', value: 'M' }])
  })

  it('keeps address structure when the first equal address is only formatted', () => {
    expect(uniqueDetails([{ kind: 'address', value: 'Paris' },
      { kind: 'address', value: 'Paris', label: 'Home', address: { city: 'Paris' } }])).toEqual([
      { kind: 'address', value: 'Paris', label: 'Home', address: { city: 'Paris' } },
    ])
  })

  it('ignores binary fields in details and UI, retaining vendor text and URI relations', () => {
    const contact = card('X-BINARY;ENCODING=b:YWJj\nX-DATA;VALUE=binary:YWJj\nKEY:secret\nLOGO:data:image/png;base64,YWJj\nSOUND:YWJj\n'
      + 'X-LARGE:' + 'a'.repeat(10000) + '\nX-MS-TEXT:Résumé\nX-GOOGLE-TEXT:שלום\nRELATED:urn:uuid:abc\nRELATED;VALUE=text:文\nitem99.X-ABLabel:Orphan')
    expect(contactDetails(contact).map(d => d.value)).toEqual(['Résumé', 'שלום', 'urn:uuid:abc', '文'])
    expect(readRawFields(contact).map(d => d.value)).toEqual(['Résumé', 'שלום', 'urn:uuid:abc', '文'])
  })

  it('does not roll invalid dates forward or display omit-year placeholders in the UI', () => {
    const fields = readRawFields(card('BDAY;X-APPLE-OMIT-YEAR=2000:2000-05-12\nANNIVERSARY:2023-02-30\nX-ABDATE;VALUE=text:19900512'))
    expect(fields.map(field => field.value)).toEqual(['May 12', '2023-02-30', '19900512'])
  })

  it('keeps escaped, folded addresses and custom dates stable through repeated merges', () => {
    const a = card('item1.ADR;TYPE="home,pref":;;12 Main\\; Apt 2;Mon\n tréal;;;CA\nitem2.X-ABDATE:--0512\nitem2.X-ABLabel:Named day')
    const b = card('ADR;TYPE=home:;;12 Main\\; Apt 2;Montréal;;;CA\nANNIVERSARY:20000229')
    const merged = mergeContacts([b], [a]).toUpsert[0]
    const details = contactDetails(merged)
    expect(details.filter(d => d.kind === 'address')).toHaveLength(1)
    expect(details).toContainEqual({ kind: 'date', value: 'May 12', label: 'Named day' })
    expect(contactDetails(mergeContacts([b, a], [merged]).toUpsert[0])).toEqual(details)
  })

  it('prefers richer labels in later source cards without changing stored phone order', () => {
    const a = card('TEL;TYPE=work:2025550101\nTEL;TYPE=home:2025550102')
    const b = card('TEL;TYPE=work,fax:2025550101\nitem1.TEL:2025550102\nitem1.X-ABLabel:家')
    const merged = { ...a, rawCards: [b.raw] }
    expect(labeledEntries(merged).phones.map(p => p.label)).toEqual(['Work fax', '家'])
  })

  it('preserves differently cased website paths and messaging account identifiers', () => {
    expect(contactDetails(card('URL:https://example.test/A\nURL:https://example.test/a\nIMPP:xmpp:Alice\nIMPP:xmpp:alice'))).toHaveLength(4)
  })

  it('reads old Mac CR line endings without changing raw source text', () => {
    const raw = 'BEGIN:VCARD\rVERSION:2.1\rFN:Élodie\rNICKNAME:Élo\rEND:VCARD\r'
    const [contact] = parseVcf(raw)
    expect(contact?.raw).toBe(raw)
    expect(contactDetails(contact)).toEqual([{ kind: 'nickname', value: 'Élo' }])
  })

  it('handles 10,000 merged contacts within a generous interactive budget', () => {
    const first = card('ADR;TYPE=home:;;1 Main;東京;;;日本\nNICKNAME:仁\nURL:https://example.test')
    const second = card('ADR;TYPE=home:;;1 Main;東京;;;日本\nBDAY:--0512')
    const contacts = Array.from({ length: 10000 }, (_, index) => ({ ...first, id: String(index), rawCards: [second.raw] }))
    const start = performance.now()
    let count = 0
    for (const contact of contacts) {
      count += contactDetails(contact).length
      expect(labeledEntries(contact).emails).toHaveLength(1)
    }
    expect(count).toBe(40000)
    expect(performance.now() - start).toBeLessThan(15000)
  })
})
