let persistRequested = false

/** Storage hints must never turn an already-committed import into a reported failure. */
export async function storageAfterImport(): Promise<string | undefined> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!persistRequested && storage?.persist) {
    persistRequested = true
    try { void storage.persist().catch(() => {}) } catch { /* Optional API. */ }
  }
  try {
    const estimate = await storage?.estimate?.()
    if (estimate?.quota && (estimate.usage ?? 0) / estimate.quota > 0.8) {
      return 'Device storage is getting full. A backup from Export can help keep your work safe.'
    }
  } catch { /* Estimates are optional. */ }
  return undefined
}
