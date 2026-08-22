export type AudioType = 'music' | 'ambience' | 'soundEffect'
export type AudioSource = 'imported' | 'recorded'

export interface AudioItem {
  id: string
  name: string
  type: AudioType
  audioBlob: Blob
  mimeType: string
  originalFileName?: string
  durationMs: number
  sizeBytes: number
  volume: number
  loop: boolean
  tags: string[]
  createdAt: string
  source: AudioSource
}

export interface AppSettings {
  masterVolume: number
  fadeDurationMs: number
}

export type PlaybackState = 'playing' | 'paused' | 'stopped'

export interface PlaybackInstance {
  id: string
  audioItemId: string
  state: PlaybackState
  volume: number
  muted: boolean
  loop: boolean
  kind: 'track' | 'effect'
}

export interface AudioSnapshot {
  instances: PlaybackInstance[]
  masterVolume: number
  globallyPaused: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  masterVolume: 0.85,
  fadeDurationMs: 350,
}

export const AUDIO_TYPE_LABELS: Record<AudioType, string> = {
  music: 'Musik',
  ambience: 'Ambience',
  soundEffect: 'Soundeffekt',
}

export const TAG_SUGGESTIONS = [
  'combat',
  'forest',
  'city',
  'dungeon',
  'horror',
  'tavern',
  'weather',
]

export function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1))
}

export function createAudioItem(
  file: Blob,
  input: Pick<AudioItem, 'name' | 'type' | 'volume' | 'loop' | 'tags' | 'source'> &
    Partial<Pick<AudioItem, 'originalFileName' | 'durationMs'>>,
): AudioItem {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type,
    audioBlob: file,
    mimeType: file.type || 'application/octet-stream',
    originalFileName: input.originalFileName,
    durationMs: input.durationMs ?? 0,
    sizeBytes: file.size,
    volume: clampVolume(input.volume),
    loop: input.loop,
    tags: [...new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
    createdAt: new Date().toISOString(),
    source: input.source,
  }
}
