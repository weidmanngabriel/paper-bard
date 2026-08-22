import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, AudioItem } from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'

interface PaperBardDB extends DBSchema {
  audioItems: {
    key: string
    value: AudioItem
    indexes: { 'by-createdAt': string; 'by-type': string }
  }
  settings: {
    key: 'app'
    value: AppSettings
  }
}

let databasePromise: Promise<IDBPDatabase<PaperBardDB>> | undefined

function database(): Promise<IDBPDatabase<PaperBardDB>> {
  databasePromise ??= openDB<PaperBardDB>('paper-bard', 1, {
    upgrade(db) {
      const items = db.createObjectStore('audioItems', { keyPath: 'id' })
      items.createIndex('by-createdAt', 'createdAt')
      items.createIndex('by-type', 'type')
      db.createObjectStore('settings')
    },
  })
  return databasePromise
}

export async function getAllAudioItems(): Promise<AudioItem[]> {
  const db = await database()
  const items = await db.getAllFromIndex('audioItems', 'by-createdAt')
  return items.reverse()
}

export async function saveAudioItem(item: AudioItem): Promise<void> {
  const db = await database()
  await db.put('audioItems', item)
}

export async function deleteAudioItem(id: string): Promise<void> {
  const db = await database()
  await db.delete('audioItems', id)
}

export async function getSettings(): Promise<AppSettings> {
  const db = await database()
  return (await db.get('settings', 'app')) ?? DEFAULT_SETTINGS
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await database()
  await db.put('settings', settings, 'app')
}

export async function clearLibrary(): Promise<void> {
  const db = await database()
  await db.clear('audioItems')
}

export async function replaceAllData(items: AudioItem[], settings: AppSettings): Promise<void> {
  const db = await database()
  const transaction = db.transaction(['audioItems', 'settings'], 'readwrite')
  await transaction.objectStore('audioItems').clear()
  for (const item of items) {
    await transaction.objectStore('audioItems').put(item)
  }
  await transaction.objectStore('settings').put(settings, 'app')
  await transaction.done
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  const estimate = await navigator.storage?.estimate?.()
  return { usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 }
}

export async function resetDatabaseForTests(): Promise<void> {
  const previous = databasePromise
  databasePromise = undefined
  const db = await previous
  db?.close()
}
