import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import type { AppSettings, AudioItem, AudioSnapshot, Scene } from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'
import {
  clearLibrary,
  deleteAudioItem,
  deleteScene,
  getAllAudioItems,
  getAllScenes,
  getSettings,
  saveAudioItem,
  saveScene,
  saveSettings,
} from '../storage/database'

interface AppContextValue {
  items: AudioItem[]
  scenes: Scene[]
  settings: AppSettings
  engine: AudioEngine
  loading: boolean
  message?: string
  setMessage: (message?: string) => void
  addItem: (item: AudioItem) => Promise<void>
  updateItem: (item: AudioItem) => Promise<void>
  removeItem: (id: string) => Promise<void>
  addScene: (scene: Scene) => Promise<void>
  updateScene: (scene: Scene) => Promise<void>
  removeScene: (id: string) => Promise<void>
  updateSettings: (settings: AppSettings) => Promise<void>
  removeAll: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<AudioEngine | null>(null)
  engineRef.current ??= new AudioEngine()
  const engine = engineRef.current
  const [items, setItems] = useState<AudioItem[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    let active = true
    Promise.all([getAllAudioItems(), getAllScenes(), getSettings()])
      .then(([storedItems, storedScenes, storedSettings]) => {
        if (!active) return
        setItems(storedItems)
        setScenes(storedScenes)
        setSettings(storedSettings)
        engine.setDefaults(storedSettings.masterVolume, storedSettings.fadeDurationMs)
      })
      .catch(() => setMessage('Die lokalen Daten konnten nicht geladen werden.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [engine])

  const value = useMemo<AppContextValue>(() => ({
    items,
    scenes,
    settings,
    engine,
    loading,
    message,
    setMessage,
    addItem: async (item) => {
      await saveAudioItem(item)
      setItems((current) => [item, ...current])
    },
    updateItem: async (item) => {
      await saveAudioItem(item)
      setItems((current) => current.map((entry) => entry.id === item.id ? item : entry))
    },
    removeItem: async (id) => {
      await engine.stopItem(id)
      await deleteAudioItem(id)
      const affectedScenes = scenes.filter((scene) => scene.items.some((entry) => entry.audioItemId === id))
      await Promise.all(affectedScenes.map((scene) => saveScene({
        ...scene,
        items: scene.items.filter((entry) => entry.audioItemId !== id),
      })))
      setScenes((current) => current.map((scene) => ({
        ...scene,
        items: scene.items.filter((entry) => entry.audioItemId !== id),
      })))
      setItems((current) => current.filter((item) => item.id !== id))
    },
    addScene: async (scene) => {
      await saveScene(scene)
      setScenes((current) => [...current, scene])
    },
    updateScene: async (scene) => {
      await saveScene(scene)
      setScenes((current) => current.map((entry) => entry.id === scene.id ? scene : entry))
    },
    removeScene: async (id) => {
      await deleteScene(id)
      setScenes((current) => current.filter((scene) => scene.id !== id))
    },
    updateSettings: async (nextSettings) => {
      await saveSettings(nextSettings)
      setSettings(nextSettings)
      engine.setDefaults(nextSettings.masterVolume, nextSettings.fadeDurationMs)
    },
    removeAll: async () => {
      await engine.stopAll()
      await clearLibrary()
      setItems([])
      setScenes([])
    },
  }), [engine, items, loading, message, scenes, settings])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp muss innerhalb des AppProviders verwendet werden.')
  return context
}

export function useAudioSnapshot(): AudioSnapshot {
  const { engine } = useApp()
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
}
