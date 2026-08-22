import { useEffect, useRef, useState } from 'react'
import { Check, Circle, Mic, RotateCcw, Square } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { createAudioItem, TAG_SUGGESTIONS, type AudioType } from '../domain/types'
import { inspectAudioBlob, preferredRecordingMimeType } from '../domain/audioFile'
import { errorMessage } from '../app/format'

export function RecordView() {
  const { addItem, setMessage } = useApp()
  const recorderRef = useRef<MediaRecorder | undefined>(undefined)
  const streamRef = useRef<MediaStream | undefined>(undefined)
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState<Blob>()
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [name, setName] = useState('Neue Aufnahme')
  const [type, setType] = useState<AudioType>('soundEffect')
  const [volume, setVolume] = useState(1)
  const [loop, setLoop] = useState(false)
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!recording) return
    const interval = window.setInterval(() => setElapsed(performance.now() - startedRef.current), 100)
    return () => window.clearInterval(interval)
  }, [recording])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('Aufnahmen werden von diesem Browser nicht unterstützt.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = preferredRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
        setBlob(recorded)
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(recorded)
        })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = undefined
      }
      startedRef.current = performance.now()
      setElapsed(0)
      recorder.start(250)
      setRecording(true)
    } catch (error) {
      const message = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
        ? 'Der Mikrofonzugriff wurde nicht erlaubt.'
        : errorMessage(error)
      setMessage(message)
    }
  }

  const stop = () => {
    recorderRef.current?.stop()
    recorderRef.current = undefined
    setRecording(false)
  }

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(undefined)
    setBlob(undefined)
    setElapsed(0)
    setName('Neue Aufnahme')
    setTags('')
  }

  const save = async () => {
    if (!blob || !name.trim()) return
    setSaving(true)
    try {
      const durationMs = await inspectAudioBlob(blob)
      await addItem(createAudioItem(blob, {
        name,
        type,
        volume,
        loop,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        source: 'recorded',
        durationMs,
      }))
      discard()
      setMessage('Aufnahme in der Library gespeichert.')
      window.location.hash = '/library'
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const time = `${String(Math.floor(elapsed / 60_000)).padStart(2, '0')}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}.${Math.floor((elapsed % 1000) / 100)}`

  return (
    <main className="page record-page">
      <section className="hero compact-hero">
        <div><p className="eyebrow">Direkt vom Spieltisch</p><h1>Aufnahme</h1><p>Fange einen neuen Klang ein.</p></div>
      </section>

      {!blob ? (
        <section className="recorder-card" data-recording={recording}>
          <div className="recorder-rings"><div className="mic-circle">{recording ? <Circle fill="currentColor" /> : <Mic />}</div></div>
          <p className="record-status">{recording ? 'Aufnahme läuft' : 'Bereit zur Aufnahme'}</p>
          <div className="record-time" aria-live="polite">{time}</div>
          <p className="record-hint">{recording ? 'Halte dein Gerät nah an die Klangquelle.' : 'Du entscheidest erst nach der Vorschau, ob du speicherst.'}</p>
          {recording
            ? <button className="button danger record-button" onClick={stop}><Square /> Aufnahme stoppen</button>
            : <button className="button primary record-button" onClick={() => { void start() }}><Mic /> Aufnahme starten</button>}
        </section>
      ) : (
        <section className="record-result">
          <div className="result-heading"><div><p className="eyebrow">Vorschau</p><h2>Wie klingt es?</h2></div><span>{time}</span></div>
          {previewUrl && <audio className="audio-preview" controls src={previewUrl} />}

          <div className="record-fields">
            <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field"><span>Kategorie</span><select value={type} onChange={(event) => setType(event.target.value as AudioType)}><option value="soundEffect">Soundeffekt</option><option value="ambience">Ambience</option><option value="music">Musik</option></select></label>
            <label className="field range-field"><span>Lautstärke <strong>{Math.round(volume * 100)} %</strong></span><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
            <label className="switch-row"><span><strong>Loop</strong><small>Standardmäßig wiederholen</small></span><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} /></label>
            <label className="field"><span>Tags <small>mit Komma trennen</small></span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="door, dungeon" /></label>
            <div className="tag-suggestions">{TAG_SUGGESTIONS.map((tag) => <button key={tag} onClick={() => setTags((value) => value ? `${value}, ${tag}` : tag)}>+ {tag}</button>)}</div>
          </div>
          <div className="result-actions">
            <button className="button secondary" onClick={discard}><RotateCcw /> Verwerfen</button>
            <button className="button primary" disabled={saving || !name.trim()} onClick={() => { void save() }}><Check /> {saving ? 'Speichert …' : 'Speichern'}</button>
          </div>
        </section>
      )}
    </main>
  )
}
