import { vcfText, type ExportFile } from './vcf'
import { yieldToBrowser } from '@/import/progress'

export function fileStub(group: ExportFile): File {
  return new File([], group.filename, { type: 'text/vcard' })
}

/** Only the selected files are materialized. Large books yield within and between files. */
export async function prepareVcards(groups: ExportFile[], largeBook = false): Promise<File[]> {
  const files: File[] = []
  for (const group of groups) {
    const parts: string[] = []
    for (let offset = 0; offset < group.rows.length; offset += 200) {
      const part = vcfText(group.rows.slice(offset, offset + 200))
      parts.push(part.endsWith('\n') ? part : part + '\r\n')
      if (largeBook || group.rows.length > 1000) await yieldToBrowser()
    }
    files.push(new File(parts, group.filename, { type: 'text/vcard' }))
    if (largeBook && group !== groups.at(-1)) await yieldToBrowser()
  }
  return files
}
