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

export async function shareOrDownload(files: File[], title = 'Contacts.'): Promise<'shared' | 'downloaded'> {
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, title })
    return 'shared'
  }
  files.forEach(downloadFile)
  return 'downloaded'
}

export function downloadText(filename: string, text: string, mime: string): void {
  downloadFile(new File([text], filename, { type: mime }))
}
