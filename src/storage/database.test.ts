import { beforeEach, describe, expect, it } from 'vitest'
import { clearLibrary, getAllAudioItems, resetDatabaseForTests, saveAudioItem } from './database'
import type { AudioItem } from '../domain/types'

const sample: AudioItem = {
  id: 'door-1',
  name: 'Tür',
  type: 'soundEffect',
  audioBlob: new Blob(['sound'], { type: 'audio/webm' }),
  mimeType: 'audio/webm',
  durationMs: 500,
  sizeBytes: 5,
  volume: 1,
  loop: false,
  tags: ['door'],
  createdAt: '2026-01-01T00:00:00.000Z',
  source: 'recorded',
}

beforeEach(async () => {
  await resetDatabaseForTests()
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('paper-bard')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

describe('IndexedDB Storage', () => {
  it('speichert und löscht AudioItems', async () => {
    await saveAudioItem(sample)
    expect((await getAllAudioItems())[0]).toMatchObject({ id: 'door-1', name: 'Tür' })
    await clearLibrary()
    expect(await getAllAudioItems()).toEqual([])
  })
})
