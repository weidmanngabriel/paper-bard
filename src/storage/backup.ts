import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { AppSettings, AudioItem, AudioSource, AudioType } from '../domain/types'
import { clampVolume, DEFAULT_SETTINGS } from '../domain/types'
import { extensionForMimeType, safeFileStem } from '../domain/audioFile'

interface BackupItem extends Omit<AudioItem, 'audioBlob'> {
  audioPath: string
}

interface BackupManifest {
  schemaVersion: 1
  exportedAt: string
  settings: AppSettings
  items: BackupItem[]
}

interface ItemArchiveManifest {
  schemaVersion: 1
  kind: 'audio-item'
  exportedAt: string
  item: BackupItem
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

export async function createItemArchive(item: AudioItem): Promise<Blob> {
  const audioPath = `audio/${item.id}.${extensionForMimeType(item.mimeType)}`
  const { audioBlob: _audioBlob, ...metadata } = item
  void _audioBlob
  const manifest: ItemArchiveManifest = {
    schemaVersion: 1,
    kind: 'audio-item',
    exportedAt: new Date().toISOString(),
    item: { ...metadata, audioPath },
  }
  const files: Record<string, Uint8Array> = {
    [audioPath]: new Uint8Array(await item.audioBlob.arrayBuffer()),
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  }
  return new Blob([new Uint8Array(zipSync(files, { level: 6 }))], { type: 'application/zip' })
}

export function audioDownloadName(item: Pick<AudioItem, 'name' | 'mimeType'>): string {
  return `${safeFileStem(item.name)}.${extensionForMimeType(item.mimeType)}`
}

export function itemArchiveDownloadName(item: Pick<AudioItem, 'name'>): string {
  return `${safeFileStem(item.name)}.paperbard`
}

function isAudioType(value: unknown): value is AudioType {
  return value === 'music' || value === 'ambience' || value === 'soundEffect'
}

function isAudioSource(value: unknown): value is AudioSource {
  return value === 'imported' || value === 'recorded'
}

async function unzip(file: Blob, error: string): Promise<Record<string, Uint8Array>> {
  try {
    return unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error(error)
  }
}

function readManifest<T>(files: Record<string, Uint8Array>, error: string): T {
  const manifestFile = files['manifest.json']
  if (!manifestFile) throw new Error('Im Backup fehlt manifest.json.')
  try {
    return JSON.parse(strFromU8(manifestFile)) as T
  } catch {
    throw new Error(error)
  }
}

function hydrateItem(entry: BackupItem, files: Record<string, Uint8Array>, error: string): AudioItem {
  if (
    !entry ||
    typeof entry.id !== 'string' ||
    typeof entry.name !== 'string' ||
    !entry.name.trim() ||
    !isAudioType(entry.type) ||
    !isAudioSource(entry.source) ||
    typeof entry.audioPath !== 'string' ||
    !files[entry.audioPath]
  ) {
    throw new Error(error)
  }
  const bytes = files[entry.audioPath]
  const blob = new Blob([new Uint8Array(bytes)], { type: typeof entry.mimeType === 'string' ? entry.mimeType : 'application/octet-stream' })
  return {
    id: entry.id,
    name: entry.name.trim(),
    type: entry.type,
    audioBlob: blob,
    mimeType: typeof entry.mimeType === 'string' ? entry.mimeType : blob.type,
    originalFileName: typeof entry.originalFileName === 'string' ? entry.originalFileName : undefined,
    durationMs: Math.max(0, Number(entry.durationMs) || 0),
    sizeBytes: blob.size,
    volume: clampVolume(entry.volume),
    loop: Boolean(entry.loop),
    tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    source: entry.source,
  }
}

export async function parseBackup(file: Blob): Promise<{ items: AudioItem[]; settings: AppSettings }> {
  const files = await unzip(file, 'Die Datei ist kein gültiges Paper-Bard-Backup.')
  const manifest = readManifest<BackupManifest>(files, 'Das Backup-Manifest ist beschädigt.')

  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.items)) {
    throw new Error('Diese Backup-Version wird nicht unterstützt.')
  }

  const ids = new Set<string>()
  const items = manifest.items.map((entry) => {
    if (ids.has(entry?.id)) throw new Error('Das Backup enthält ungültige Einträge.')
    const item = hydrateItem(entry, files, 'Das Backup enthält ungültige Einträge.')
    ids.add(item.id)
    return item
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

export async function parseItemArchive(file: Blob): Promise<AudioItem> {
  const files = await unzip(file, 'Die Datei ist keine gültige Paper-Bard-Datei.')
  const manifest = readManifest<ItemArchiveManifest>(files, 'Das Paper-Bard-Manifest ist beschädigt.')
  if (!manifest || manifest.schemaVersion !== 1 || manifest.kind !== 'audio-item') {
    throw new Error('Diese Paper-Bard-Datei wird nicht unterstützt.')
  }
  return hydrateItem(manifest.item, files, 'Die Paper-Bard-Datei enthält einen ungültigen Eintrag.')
}
