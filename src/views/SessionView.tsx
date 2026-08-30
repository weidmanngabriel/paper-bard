import { useState, type FormEvent } from 'react'
import { CloudRain, Music2, Pause, Play, Plus, Repeat2, Settings2, Sparkles, Square, Trash2, Trees, Volume2, VolumeX, X } from 'lucide-react'
import { useApp, useAudioSnapshot } from '../app/AppContext'
import type { AudioItem, AudioType, PlaybackInstance, Scene, SceneItemSettings } from '../domain/types'
import { AUDIO_TYPE_LABELS } from '../domain/types'
import { errorMessage } from '../app/format'

const GROUPS: { type: AudioType; icon: typeof Music2; description: string }[] = [
  { type: 'music', icon: Music2, description: 'Stimmung und Dramaturgie' },
  { type: 'ambience', icon: Trees, description: 'Orte, Wetter und Umgebung' },
  { type: 'soundEffect', icon: Sparkles, description: 'Schnelle Akzente im Spiel' },
]

export function SessionView() {
  const { items, scenes, engine, setMessage, addScene, updateScene, removeScene } = useApp()
  const snapshot = useAudioSnapshot()
  const [activeSceneId, setActiveSceneId] = useState<string>()
  const [editingScene, setEditingScene] = useState<Scene>()
  const run = (task: Promise<void>) => task.catch((error) => setMessage(errorMessage(error)))
  const activeScene = scenes.find((scene) => scene.id === activeSceneId)
  const visibleItems = activeScene
    ? items.filter((item) => activeScene.items.some((entry) => entry.audioItemId === item.id))
    : items

  const applyScene = (scene?: Scene) => {
    setActiveSceneId(scene?.id)
    if (!scene) return
    for (const settings of scene.items) {
      const item = items.find((entry) => entry.id === settings.audioItemId)
      if (!item) continue
      engine.setItemVolume(item, settings.volume)
      engine.setItemMuted(item, settings.muted)
      engine.setItemLoop(item, settings.loop)
    }
  }

  const createScene = async () => {
    const name = window.prompt('Wie soll die Szene heißen?')?.trim()
    if (!name) return
    const scene: Scene = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      items: items.map((item) => {
        const control = engine.getItemControl(item)
        return { audioItemId: item.id, ...control }
      }),
    }
    try {
      await addScene(scene)
      applyScene(scene)
      setEditingScene(scene)
    } catch (error) {
      setMessage(errorMessage(error))
    }
  }

  const saveControl = (item: AudioItem, control: Omit<SceneItemSettings, 'audioItemId'>) => {
    if (!activeScene) return
    const nextScene = {
      ...activeScene,
      items: activeScene.items.map((entry) => entry.audioItemId === item.id ? { audioItemId: item.id, ...control } : entry),
    }
    void updateScene(nextScene).catch((error) => setMessage(errorMessage(error)))
  }

  const deleteActiveScene = async () => {
    if (!activeScene || !window.confirm(`Szene „${activeScene.name}“ löschen?`)) return
    try {
      await removeScene(activeScene.id)
      setActiveSceneId(undefined)
    } catch (error) {
      setMessage(errorMessage(error))
    }
  }

  return (
    <main className="page session-page">
      <section className="hero session-hero">
        <div>
          <p className="eyebrow">Live-Mischung</p>
          <h1>Deine Session</h1>
          <p>{activeScene ? `Szene: ${activeScene.name}` : 'Atmosphäre aufbauen. Den Moment treffen.'}</p>
        </div>
        <div className="live-indicator" data-active={snapshot.instances.some((instance) => instance.state === 'playing')}>
          <span /> {snapshot.instances.filter((instance) => instance.state === 'playing').length} aktiv
        </div>
      </section>

      {items.length > 0 && (
        <section className="audio-group" aria-label="Szenen">
          <div className="section-heading">
            <div className="section-icon"><Sparkles /></div>
            <div><h2>Szenen</h2><p>Mit einem Tap zwischen deinen Soundsets wechseln.</p></div>
          </div>
          <div className="hero-actions" style={{ justifyContent: 'flex-start' }}>
            <button className={`button ${activeScene ? 'secondary' : 'primary'} compact`} onClick={() => applyScene(undefined)}>Alle Sounds</button>
            {scenes.map((scene) => (
              <button key={scene.id} className={`button ${scene.id === activeSceneId ? 'primary' : 'secondary'} compact`} onClick={() => applyScene(scene)}>{scene.name}</button>
            ))}
            <button className="button secondary compact" onClick={() => { void createScene() }}><Plus /> Szene</button>
            {activeScene && <button className="icon-button small" onClick={() => setEditingScene(activeScene)} aria-label="Szene bearbeiten"><Settings2 /></button>}
            {activeScene && <button className="icon-button small" onClick={() => { void deleteActiveScene() }} aria-label="Szene löschen"><Trash2 /></button>}
          </div>
        </section>
      )}

      <section className="master-panel" aria-label="Master-Steuerung">
        <div className="master-volume">
          <Volume2 aria-hidden="true" />
          <label>
            <span>Master <strong>{Math.round(snapshot.masterVolume * 100)} %</strong></span>
            <input aria-label="Master-Lautstärke" type="range" min="0" max="1" step="0.01" value={snapshot.masterVolume} onChange={(event) => engine.setMasterVolume(Number(event.target.value))} />
          </label>
        </div>
        <div className="master-actions">
          <button className="button secondary compact" onClick={() => snapshot.globallyPaused ? run(engine.resumeAll()) : engine.pauseAll()} disabled={!snapshot.instances.length}>
            {snapshot.globallyPaused ? <Play /> : <Pause />} {snapshot.globallyPaused ? 'Weiter' : 'Pause'}
          </button>
          <button className="button danger compact" onClick={() => run(engine.stopAll())} disabled={!snapshot.instances.length}>
            <Square /> Stop All
          </button>
        </div>
      </section>

      {items.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon"><CloudRain /></div>
          <h2>Noch ist es still</h2>
          <p>Importiere Musik, Atmosphären oder Effekte in deine Library.</p>
          <button className="button primary" onClick={() => { window.location.hash = '/library' }}>Zur Library</button>
        </section>
      ) : visibleItems.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon"><Sparkles /></div>
          <h2>Diese Szene ist leer</h2>
          <p>Füge die Sounds hinzu, die du in dieser Szene brauchst.</p>
          {activeScene && <button className="button primary" onClick={() => setEditingScene(activeScene)}><Settings2 /> Sounds auswählen</button>}
        </section>
      ) : GROUPS.map((group) => {
        const groupItems = visibleItems.filter((item) => item.type === group.type)
        if (!groupItems.length) return null
        const Icon = group.icon
        return (
          <section className="audio-group" key={group.type}>
            <div className="section-heading">
              <div className="section-icon"><Icon /></div>
              <div><h2>{AUDIO_TYPE_LABELS[group.type]}</h2><p>{group.description}</p></div>
            </div>
            <div className={group.type === 'soundEffect' ? 'effect-grid' : 'track-list'}>
              {groupItems.map((item) => group.type === 'soundEffect'
                ? <EffectPad key={item.id} item={item} instances={snapshot.instances.filter((entry) => entry.audioItemId === item.id)} onControlChange={(control) => saveControl(item, control)} />
                : <TrackCard key={item.id} item={item} instance={snapshot.instances.find((entry) => entry.audioItemId === item.id)} onControlChange={(control) => saveControl(item, control)} />)}
            </div>
          </section>
        )
      })}

      {editingScene && (
        <SceneEditor
          scene={editingScene}
          items={items}
          onCancel={() => setEditingScene(undefined)}
          onSave={async (scene) => {
            await updateScene(scene)
            setEditingScene(undefined)
            if (scene.id === activeSceneId) applyScene(scene)
          }}
        />
      )}
    </main>
  )
}

type ControlValue = Omit<SceneItemSettings, 'audioItemId'>

function TrackCard({ item, instance, onControlChange }: { item: AudioItem; instance?: PlaybackInstance; onControlChange: (control: ControlValue) => void }) {
  const { engine, setMessage } = useApp()
  const playing = instance?.state === 'playing'
  const paused = instance?.state === 'paused'
  const control = engine.getItemControl(item)
  const toggle = () => {
    const task = playing ? Promise.resolve(engine.pauseItem(item.id)) : paused ? engine.resumeItem(item.id) : engine.play(item)
    void task.catch((error) => setMessage(errorMessage(error)))
  }
  const changeVolume = (volume: number) => {
    engine.setItemVolume(item, volume)
    onControlChange({ ...engine.getItemControl(item) })
  }
  const changeMuted = (muted: boolean) => {
    engine.setItemMuted(item, muted)
    onControlChange({ ...engine.getItemControl(item) })
  }
  const changeLoop = (loop: boolean) => {
    engine.setItemLoop(item, loop)
    onControlChange({ ...engine.getItemControl(item) })
  }

  return (
    <article className="track-card" data-playing={playing}>
      <button className="transport-button" onClick={toggle} aria-label={playing ? `${item.name} pausieren` : `${item.name} abspielen`}>
        {playing ? <Pause /> : <Play />}
      </button>
      <div className="track-main">
        <div className="track-title-row">
          <div><h3>{item.name}</h3><span className="status-label">{playing ? 'Spielt' : paused ? 'Pausiert' : 'Bereit'}</span></div>
          <div className="inline-actions">
            <button className="icon-button small" data-active={control.loop} onClick={() => changeLoop(!control.loop)} aria-label="Loop umschalten"><Repeat2 /></button>
            <button className="icon-button small" data-active={control.muted} onClick={() => changeMuted(!control.muted)} aria-label="Stumm umschalten">{control.muted ? <VolumeX /> : <Volume2 />}</button>
            <button className="icon-button small" onClick={() => { void engine.stopItem(item.id) }} disabled={!instance} aria-label={`${item.name} stoppen`}><Square /></button>
          </div>
        </div>
        <input aria-label={`Lautstärke ${item.name}`} className="thin-range" type="range" min="0" max="1" step="0.01" value={control.volume} onChange={(event) => changeVolume(Number(event.target.value))} />
      </div>
    </article>
  )
}

function EffectPad({ item, instances, onControlChange }: { item: AudioItem; instances: PlaybackInstance[]; onControlChange: (control: ControlValue) => void }) {
  const { engine, setMessage } = useApp()
  const playingCount = instances.filter((instance) => instance.state === 'playing').length
  const control = engine.getItemControl(item)
  const update = (kind: 'volume' | 'muted' | 'loop', value: number | boolean) => {
    if (kind === 'volume') engine.setItemVolume(item, value as number)
    if (kind === 'muted') engine.setItemMuted(item, value as boolean)
    if (kind === 'loop') engine.setItemLoop(item, value as boolean)
    onControlChange({ ...engine.getItemControl(item) })
  }
  return (
    <article className="effect-pad" data-playing={playingCount > 0}>
      <button className="effect-trigger" onClick={() => { void engine.play(item).catch((error) => setMessage(errorMessage(error))) }}>
        <span className="effect-play"><Play /></span>
        <strong>{item.name}</strong>
        <small>{playingCount ? `${playingCount}× aktiv` : item.tags[0] ?? 'Bereit'}</small>
      </button>
      <div className="effect-controls">
        <button className="icon-button small" data-active={control.loop} onClick={() => update('loop', !control.loop)} aria-label="Loop umschalten"><Repeat2 /></button>
        <button className="icon-button small" data-active={control.muted} onClick={() => update('muted', !control.muted)} aria-label="Stumm umschalten">{control.muted ? <VolumeX /> : <Volume2 />}</button>
        <input aria-label={`Lautstärke ${item.name}`} type="range" min="0" max="1" step="0.01" value={control.volume} onChange={(event) => update('volume', Number(event.target.value))} />
        <button className="icon-button small" onClick={() => { void engine.stopItem(item.id) }} disabled={!instances.length} aria-label="Effekt stoppen"><Square /></button>
      </div>
    </article>
  )
}

function SceneEditor({ scene, items, onSave, onCancel }: { scene: Scene; items: AudioItem[]; onSave: (scene: Scene) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState(scene)
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    setBusy(true)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
    } finally {
      setBusy(false)
    }
  }
  const toggleItem = (item: AudioItem, selected: boolean) => {
    setDraft((current) => {
      if (!selected) return { ...current, items: current.items.filter((entry) => entry.audioItemId !== item.id) }
      if (current.items.some((entry) => entry.audioItemId === item.id)) return current
      return { ...current, items: [...current.items, { audioItemId: item.id, volume: item.volume, muted: false, loop: item.loop }] }
    })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="scene-editor-title">
        <div className="modal-heading">
          <div><p className="eyebrow">Szene bearbeiten</p><h2 id="scene-editor-title">{draft.name}</h2></div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Schließen"><X /></button>
        </div>
        <label className="field">
          <span>Name</span>
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
        </label>
        <div className="field">
          <span>Sounds in dieser Szene</span>
          <div className="library-list">
            {items.map((item) => {
              const selected = draft.items.some((entry) => entry.audioItemId === item.id)
              return (
                <label className="switch-row" key={item.id}>
                  <span><strong>{item.name}</strong><small>{AUDIO_TYPE_LABELS[item.type]}</small></span>
                  <input type="checkbox" checked={selected} onChange={(event) => toggleItem(item, event.target.checked)} />
                </label>
              )
            })}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>Abbrechen</button>
          <button type="submit" className="button primary" disabled={busy || !draft.name.trim()}>Speichern</button>
        </div>
      </form>
    </div>
  )
}
