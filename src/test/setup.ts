import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { vi } from 'vitest'

vi.stubGlobal('Blob', NodeBlob)

Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:test-${Math.random()}`) })
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => `id-${Math.random()}` } })
}
