import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { AudioItem, AudioSource, AudioType } from '../domain/types'
import { clampVolume } from '../domain/types'
import { extensionForMimeType, safeFileStem } from '../domain/audioFile'

interface ArchivedItem extends Omit<AudioItem, 'audioBlob'> {
  audioPath: string
}

interface ItemArchiveManifest {
  schemaVersion: 1
  kind: 'audio-item'
  exportedAt: string
  item: ArchivedItem
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
  if (!manifestFile) throw new Error('In der Paper-Bard-Datei fehlt manifest.json.')
  try {
    return JSON.parse(strFromU8(manifestFile)) as T
  } catch {
    throw new Error(error)
  }
}

function hydrateItem(entry: ArchivedItem, files: Record<string, Uint8Array>, error: string): AudioItem {
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

export async function parseItemArchive(file: Blob): Promise<AudioItem> {
  const files = await unzip(file, 'Die Datei ist keine gültige Paper-Bard-Datei.')
  const manifest = readManifest<ItemArchiveManifest>(files, 'Das Paper-Bard-Manifest ist beschädigt.')
  if (!manifest || manifest.schemaVersion !== 1 || manifest.kind !== 'audio-item') {
    throw new Error('Diese Paper-Bard-Datei wird nicht unterstützt.')
  }
  return hydrateItem(manifest.item, files, 'Die Paper-Bard-Datei enthält einen ungültigen Eintrag.')
}
