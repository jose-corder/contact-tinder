import { describe, expect, it } from 'vitest'
import { defaultCountry } from '@/import/region'
import { phoneKey, mergeContacts } from '@/import/dedupe'
import { parseVcf } from '@/import/vcard'
import { parseCsv } from '@/import/csv'
import { parseCsvChunks, parseVcfChunks } from '@/import/parseChunks'
import { importFiles } from '@/import'
import { allContacts, resetAll } from '@/db/repo'

const card = (phone: string) => 'BEGIN:VCARD\nFN:Alex Smith\nTEL:' + phone + '\nEND:VCARD\n'

describe('import region', () => {
  it.each([['es-MX', 'MX'], ['en-GB', 'GB'], ['zh-Hant-TW', 'TW'], ['en', 'US'], ['', 'US'], ['not_a_locale', 'US'], ['en-ZZ', 'US']])('derives %s as %s', (language, country) => {
    expect(defaultCountry(language)).toBe(country)
  })
  it.each([['MX', '55 1234 5678', '+525512345678'], ['GB', '020 7946 0958', '+442079460958']])('import_threads_country_into_all_phone_keys: %s', async (country, national, international) => {
    await resetAll()
    const vcf = parseVcf(card(national), 'vcf', country)[0]
    const csv = parseCsv('Name,Phone\nAlex Smith,' + national, country)[0]
    expect(vcf.phoneKeys).toEqual([international])
    expect(csv.id).toBe(vcf.id)
    expect((await parseVcfChunks(card(national), undefined, 'vcf', country)).contacts[0].phoneKeys).toEqual([international])
    expect((await parseCsvChunks('Name,Phone\nAlex Smith,' + national, undefined, country)).contacts[0].phoneKeys).toEqual([international])
    const other = parseVcf(card('+15512345678'), 'vcf', 'US')
    expect(mergeContacts([vcf, ...parseVcf(card(international), 'vcf', country)], other, country)).toMatchObject({ added: 1, merged: 1 })
    await importFiles([new File([card(national) + card(international) + card('+15512345678')], 'country.vcf')], undefined, country)
    expect(await allContacts()).toHaveLength(2)
  })
  it('prefixes ambiguous national numbers with country', () => {
    expect(phoneKey('1234567', 'MX')).toBe('MX:1234567')
    expect(phoneKey('1234567', 'GB')).toBe('GB:1234567')
  })
})
