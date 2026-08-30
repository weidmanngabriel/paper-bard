import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, AudioItem, Scene } from '../domain/types'
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
  scenes: {
    key: string
    value: Scene
    indexes: { 'by-createdAt': string }
  }
}

let databasePromise: Promise<IDBPDatabase<PaperBardDB>> | undefined

function database(): Promise<IDBPDatabase<PaperBardDB>> {
  databasePromise ??= openDB<PaperBardDB>('paper-bard', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const items = db.createObjectStore('audioItems', { keyPath: 'id' })
        items.createIndex('by-createdAt', 'createdAt')
        items.createIndex('by-type', 'type')
        db.createObjectStore('settings')
      }
      if (oldVersion < 2) {
        const scenes = db.createObjectStore('scenes', { keyPath: 'id' })
        scenes.createIndex('by-createdAt', 'createdAt')
      }
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

export async function getAllScenes(): Promise<Scene[]> {
  const db = await database()
  return db.getAllFromIndex('scenes', 'by-createdAt')
}

export async function saveScene(scene: Scene): Promise<void> {
  const db = await database()
  await db.put('scenes', scene)
}

export async function deleteScene(id: string): Promise<void> {
  const db = await database()
  await db.delete('scenes', id)
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
  const transaction = db.transaction(['audioItems', 'scenes'], 'readwrite')
  await Promise.all([
    transaction.objectStore('audioItems').clear(),
    transaction.objectStore('scenes').clear(),
    transaction.done,
  ])
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
