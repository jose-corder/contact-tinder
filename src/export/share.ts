function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  document.body.append(anchor)
  try { anchor.click() } finally {
    anchor.remove()
    // Give the browser time to begin reading the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export function canShareFiles(files: File[]): boolean {
  try { return files.length > 0 && typeof navigator.share === 'function' && !!navigator.canShare?.({ files }) }
  catch { return false }
}

export function fileAction(files: File[]): 'Share' | 'Download' {
  return canShareFiles(files) ? 'Share' : 'Download'
}

export async function shareOrDownload(files: File[], title = 'Contacts.'): Promise<'shared' | 'downloaded' | 'fallback'> {
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, title })
      return 'shared'
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') throw error
      files.forEach(downloadFile)
      return 'fallback'
    }
  }
  files.forEach(downloadFile)
  return 'downloaded'
}

export function downloadText(filename: string, text: string, mime: string): void {
  downloadFile(new File([text], filename, { type: mime }))
}
