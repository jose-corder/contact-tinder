export type ExportPlatform = 'iphone' | 'android' | 'desktop'

export function exportPlatform(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints): ExportPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)) return 'iphone'
  return /Android/i.test(userAgent) ? 'android' : 'desktop'
}

export function platformHint(platform: ExportPlatform): string {
  if (platform === 'iphone') return 'Share → save to Files → open the .vcf to add to Contacts. Or Share → AirDrop to a Mac.'
  if (platform === 'android') return 'Download → open the file → Contacts imports it.'
  return 'Download, then import at contacts.google.com or icloud.com.'
}
