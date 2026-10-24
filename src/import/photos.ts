export const MAX_PHOTO_BYTES = 2 * 1024 * 1024

/** Display thumbnail only. The original photo remains untouched in Contact.raw. */
export async function resizePhoto(blob: Blob): Promise<Blob | undefined> {
  if (blob.size > MAX_PHOTO_BYTES) return undefined
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return blob
  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(blob)
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= 512) return blob
    const scale = 512 / longest
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    const context = canvas.getContext('2d')
    if (!context || typeof canvas.convertToBlob !== 'function') return blob
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  } catch {
    // Safari versions with incomplete canvas support, and damaged images.
    return blob
  } finally { bitmap?.close() }
}
