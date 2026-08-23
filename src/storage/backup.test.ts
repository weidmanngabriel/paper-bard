import { describe, expect, it } from 'vitest'
import { audioDownloadName, createBackup, createItemArchive, itemArchiveDownloadName, parseBackup, parseItemArchive } from './backup'
import type { AudioItem } from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'

function item(): AudioItem {
  return {
    id: 'forest-1',
    name: 'Wald bei Nacht',
    type: 'ambience',
    audioBlob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' }),
    mimeType: 'audio/mpeg',
    originalFileName: 'forest.mp3',
    durationMs: 12_000,
    sizeBytes: 4,
    volume: 0.7,
    loop: true,
    tags: ['forest', 'night'],
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'imported',
  }
}

describe('Backup', () => {
  it('erhält Metadaten, Einstellungen und Audiodaten', async () => {
    const backup = await createBackup([item()], DEFAULT_SETTINGS)
    const restored = await parseBackup(backup)
    expect(restored.settings).toEqual(DEFAULT_SETTINGS)
    expect(restored.items).toHaveLength(1)
    expect(restored.items[0]).toMatchObject({ id: 'forest-1', name: 'Wald bei Nacht', loop: true, tags: ['forest', 'night'] })
    expect(Array.from(new Uint8Array(await restored.items[0].audioBlob.arrayBuffer()))).toEqual([1, 2, 3, 4])
  })

  it('lehnt ungültige Archive verständlich ab', async () => {
    await expect(parseBackup(new Blob(['kein zip']))).rejects.toThrow('kein gültiges Paper-Bard-Backup')
  })

  it('exportiert einen einzelnen Eintrag mit Metadaten und Audiodaten', async () => {
    const archive = await createItemArchive(item())
    const restored = await parseItemArchive(archive)
    expect(restored).toMatchObject({ id: 'forest-1', name: 'Wald bei Nacht', type: 'ambience', loop: true, tags: ['forest', 'night'] })
    expect(Array.from(new Uint8Array(await restored.audioBlob.arrayBuffer()))).toEqual([1, 2, 3, 4])
  })

  it('lehnt ungültige Paper-Bard-Dateien verständlich ab', async () => {
    await expect(parseItemArchive(new Blob(['kein zip']))).rejects.toThrow('keine gültige Paper-Bard-Datei')
  })

  it('erstellt sichere Download-Dateinamen', () => {
    expect(audioDownloadName({ name: 'Wald / Nacht', mimeType: 'audio/mpeg' })).toBe('Wald - Nacht.mp3')
    expect(itemArchiveDownloadName({ name: 'Wald / Nacht' })).toBe('Wald - Nacht.paperbard')
  })
})
