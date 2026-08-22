export function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent > 1 ? 1 : 0)} ${units[exponent]}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Der lokale Speicher reicht für diese Datei nicht aus.'
  }
  return error instanceof Error ? error.message : 'Etwas ist schiefgegangen.'
}
