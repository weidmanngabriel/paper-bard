import { CloudRain, Music2, Pause, Play, Repeat2, Sparkles, Square, Trees, Volume2, VolumeX } from 'lucide-react'
import { useApp, useAudioSnapshot } from '../app/AppContext'
import type { AudioItem, AudioType, PlaybackInstance } from '../domain/types'
import { AUDIO_TYPE_LABELS } from '../domain/types'
import { errorMessage } from '../app/format'

const GROUPS: { type: AudioType; icon: typeof Music2; description: string }[] = [
  { type: 'music', icon: Music2, description: 'Stimmung und Dramaturgie' },
  { type: 'ambience', icon: Trees, description: 'Orte, Wetter und Umgebung' },
  { type: 'soundEffect', icon: Sparkles, description: 'Schnelle Akzente im Spiel' },
]

export function SessionView() {
  const { items, engine, setMessage } = useApp()
  const snapshot = useAudioSnapshot()
  const run = (task: Promise<void>) => task.catch((error) => setMessage(errorMessage(error)))

  return (
    <main className="page session-page">
      <section className="hero session-hero">
        <div>
          <p className="eyebrow">Live-Mischung</p>
          <h1>Deine Session</h1>
          <p>Atmosphäre aufbauen. Den Moment treffen.</p>
        </div>
        <div className="live-indicator" data-active={snapshot.instances.some((instance) => instance.state === 'playing')}>
          <span /> {snapshot.instances.filter((instance) => instance.state === 'playing').length} aktiv
        </div>
      </section>

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
      ) : GROUPS.map((group) => {
        const groupItems = items.filter((item) => item.type === group.type)
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
                ? <EffectPad key={item.id} item={item} instances={snapshot.instances.filter((entry) => entry.audioItemId === item.id)} />
                : <TrackCard key={item.id} item={item} instance={snapshot.instances.find((entry) => entry.audioItemId === item.id)} />)}
            </div>
          </section>
        )
      })}
    </main>
  )
}

function TrackCard({ item, instance }: { item: AudioItem; instance?: PlaybackInstance }) {
  const { engine, setMessage } = useApp()
  const playing = instance?.state === 'playing'
  const paused = instance?.state === 'paused'
  const control = engine.getItemControl(item)
  const toggle = () => {
    const task = playing ? Promise.resolve(engine.pauseItem(item.id)) : paused ? engine.resumeItem(item.id) : engine.play(item)
    void task.catch((error) => setMessage(errorMessage(error)))
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
            <button className="icon-button small" data-active={control.loop} onClick={() => engine.setItemLoop(item, !control.loop)} aria-label="Loop umschalten"><Repeat2 /></button>
            <button className="icon-button small" data-active={control.muted} onClick={() => engine.setItemMuted(item, !control.muted)} aria-label="Stumm umschalten">{control.muted ? <VolumeX /> : <Volume2 />}</button>
            <button className="icon-button small" onClick={() => { void engine.stopItem(item.id) }} disabled={!instance} aria-label={`${item.name} stoppen`}><Square /></button>
          </div>
        </div>
        <input aria-label={`Lautstärke ${item.name}`} className="thin-range" type="range" min="0" max="1" step="0.01" value={control.volume} onChange={(event) => engine.setItemVolume(item, Number(event.target.value))} />
      </div>
    </article>
  )
}

function EffectPad({ item, instances }: { item: AudioItem; instances: PlaybackInstance[] }) {
  const { engine, setMessage } = useApp()
  const playingCount = instances.filter((instance) => instance.state === 'playing').length
  const control = engine.getItemControl(item)
  return (
    <article className="effect-pad" data-playing={playingCount > 0}>
      <button className="effect-trigger" onClick={() => { void engine.play(item).catch((error) => setMessage(errorMessage(error))) }}>
        <span className="effect-play"><Play /></span>
        <strong>{item.name}</strong>
        <small>{playingCount ? `${playingCount}× aktiv` : item.tags[0] ?? 'Bereit'}</small>
      </button>
      <div className="effect-controls">
        <button className="icon-button small" data-active={control.loop} onClick={() => engine.setItemLoop(item, !control.loop)} aria-label="Loop umschalten"><Repeat2 /></button>
        <button className="icon-button small" data-active={control.muted} onClick={() => engine.setItemMuted(item, !control.muted)} aria-label="Stumm umschalten">{control.muted ? <VolumeX /> : <Volume2 />}</button>
        <input aria-label={`Lautstärke ${item.name}`} type="range" min="0" max="1" step="0.01" value={control.volume} onChange={(event) => engine.setItemVolume(item, Number(event.target.value))} />
        <button className="icon-button small" onClick={() => { void engine.stopItem(item.id) }} disabled={!instances.length} aria-label="Effekt stoppen"><Square /></button>
      </div>
    </article>
  )
}
