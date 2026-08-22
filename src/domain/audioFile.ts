const RECORDING_TYPES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

export function preferredRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

export async function inspectAudioBlob(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob)
  try {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = url
    const duration = await new Promise<number>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Die Audiodatei konnte nicht gelesen werden.')), 15_000)
      audio.onloadedmetadata = () => {
        window.clearTimeout(timer)
        resolve(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0)
      }
      audio.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('Dieses Audioformat wird auf dem Gerät nicht unterstützt.'))
      }
    })
    audio.removeAttribute('src')
    audio.load()
    return duration
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('aac') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('webm')) return 'webm'
  return 'audio'
}
