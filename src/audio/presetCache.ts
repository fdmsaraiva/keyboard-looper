// Stores decoded presets (uncompressed SF2 buffers) in IndexedDB so each
// instrument is decoded only once per device. Every call tolerates storage
// being unavailable (private mode, blocked site data) by acting as a miss.

const DB = 'piano-loop-station'
const STORE = 'decoded-presets'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getCachedPreset(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await open()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function putCachedPreset(key: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(buffer, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Caching is an optimisation only.
  }
}
