import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// Node 22+ ships its own experimental `localStorage` global that is a no-op unless
// started with --localstorage-file, and it shadows jsdom's. Give tests a real in-memory one.
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() { return this.map.size }
  clear() { this.map.clear() }
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null }
  key(index: number) { return [...this.map.keys()][index] ?? null }
  removeItem(key: string) { this.map.delete(key) }
  setItem(key: string, value: string) { this.map.set(key, String(value)) }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true })
if (typeof window !== 'undefined' && window !== globalThis) {
  Object.defineProperty(window, 'localStorage', { value: globalThis.localStorage, configurable: true, writable: true })
}
