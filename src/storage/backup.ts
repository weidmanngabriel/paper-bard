import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { AppSettings, AudioItem, AudioSource, AudioType } from '../domain/types'
import { clampVolume, DEFAULT_SETTINGS } from '../domain/types'
import { extensionForMimeType } from '../domain/audioFile'

interface BackupItem extends Omit<AudioItem, 'audioBlob'> {
  audioPath: string
}

interface BackupManifest {
  schemaVersion: 1
  exportedAt: string
  settings: AppSettings
  items: BackupItem[]
}

export async function createBackup(items: AudioItem[], settings: AppSettings): Promise<Blob> {
  const files: Record<string, Uint8Array> = {}
  const manifestItems: BackupItem[] = []

  for (const item of items) {
    const audioPath = `audio/${item.id}.${extensionForMimeType(item.mimeType)}`
    files[audioPath] = new Uint8Array(await item.audioBlob.arrayBuffer())
    const { audioBlob: _audioBlob, ...metadata } = item
    void _audioBlob
    manifestItems.push({ ...metadata, audioPath })
  }

  const manifest: BackupManifest = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings,
    items: manifestItems,
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  const zipped = zipSync(files, { level: 6 })
  return new Blob([new Uint8Array(zipped)], { type: 'application/zip' })
}

function isAudioType(value: unknown): value is AudioType {
  return value === 'music' || value === 'ambience' || value === 'soundEffect'
}

function isAudioSource(value: unknown): value is AudioSource {
  return value === 'imported' || value === 'recorded'
}

export async function parseBackup(file: Blob): Promise<{ items: AudioItem[]; settings: AppSettings }> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('Die Datei ist kein gültiges Paper-Bard-Backup.')
  }

  const manifestFile = files['manifest.json']
  if (!manifestFile) throw new Error('Im Backup fehlt manifest.json.')

  let manifest: BackupManifest
  try {
    manifest = JSON.parse(strFromU8(manifestFile)) as BackupManifest
  } catch {
    throw new Error('Das Backup-Manifest ist beschädigt.')
  }

  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.items)) {
    throw new Error('Diese Backup-Version wird nicht unterstützt.')
  }

  const ids = new Set<string>()
  const items = manifest.items.map((entry): AudioItem => {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      ids.has(entry.id) ||
      typeof entry.name !== 'string' ||
      !entry.name.trim() ||
      !isAudioType(entry.type) ||
      !isAudioSource(entry.source) ||
      typeof entry.audioPath !== 'string' ||
      !files[entry.audioPath]
    ) {
      throw new Error('Das Backup enthält ungültige Einträge.')
    }
    ids.add(entry.id)
    const bytes = files[entry.audioPath]
    const blob = new Blob([new Uint8Array(bytes)], { type: entry.mimeType || 'application/octet-stream' })
    return {
      id: entry.id,
      name: entry.name.trim(),
      type: entry.type,
      audioBlob: blob,
      mimeType: entry.mimeType || blob.type,
      originalFileName: entry.originalFileName,
      durationMs: Math.max(0, Number(entry.durationMs) || 0),
      sizeBytes: blob.size,
      volume: clampVolume(entry.volume),
      loop: Boolean(entry.loop),
      tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
      source: entry.source,
    }
  })

  const settings = manifest.settings ?? DEFAULT_SETTINGS
  return {
    items,
    settings: {
      masterVolume: clampVolume(settings.masterVolume),
      fadeDurationMs: Math.max(0, Math.min(5000, Number(settings.fadeDurationMs) || DEFAULT_SETTINGS.fadeDurationMs)),
    },
  }
}
