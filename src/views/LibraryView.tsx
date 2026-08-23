import { useRef, useState } from 'react'
import { Download, FileArchive, FileAudio, MoreVertical, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { AudioForm, formValueFor, type AudioFormValue } from '../components/AudioForm'
import { useApp } from '../app/AppContext'
import { createAudioItem, type AudioItem } from '../domain/types'
import { inspectAudioBlob } from '../domain/audioFile'
import { audioDownloadName, createItemArchive, itemArchiveDownloadName, parseItemArchive } from '../storage/backup'
import { errorMessage, formatBytes, formatDuration } from '../app/format'

interface PendingImport { file: File; durationMs: number }

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function isItemArchive(file: File): boolean {
  return file.name.toLowerCase().endsWith('.paper-bard')
}

export function LibraryView() {
  const { items, addItem, updateItem, removeItem, setMessage } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingImport[]>([])
  const [editing, setEditing] = useState<AudioItem>()
  const [busy, setBusy] = useState(false)

  const selectFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const accepted: PendingImport[] = []
    for (const file of Array.from(files)) {
      try {
        if (isItemArchive(file)) {
          const archivedItem = await parseItemArchive(file)
          await addItem({ ...archivedItem, id: crypto.randomUUID() })
          setMessage(`${archivedItem.name} wurde erneut importiert.`)
          continue
        }
        accepted.push({ file, durationMs: await inspectAudioBlob(file) })
      } catch (error) {
        setMessage(`${file.name}: ${errorMessage(error)}`)
      }
    }
    setPending(accepted)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const current = pending[0]
  const saveImport = async (value: AudioFormValue) => {
    if (!current) return
    try {
      await addItem(createAudioItem(current.file, {
        ...value,
        source: 'imported',
        originalFileName: current.file.name,
        durationMs: current.durationMs,
      }))
      setPending((queue) => queue.slice(1))
      setMessage(`${value.name} wurde importiert.`)
    } catch (error) {
      setMessage(errorMessage(error))
    }
  }

  const edit = async (value: AudioFormValue) => {
    if (!editing) return
    try {
      await updateItem({ ...editing, ...value })
      setEditing(undefined)
      setMessage('Änderungen gespeichert.')
    } catch (error) {
      setMessage(errorMessage(error))
    }
  }

  const remove = async (item: AudioItem) => {
    if (!window.confirm(`„${item.name}“ wirklich löschen?`)) return
    try {
      await removeItem(item.id)
      setMessage('Audio gelöscht.')
    } catch (error) {
      setMessage(errorMessage(error))
    }
  }

  const downloadAudio = (item: AudioItem) => {
    triggerDownload(item.audioBlob, audioDownloadName(item))
    setMessage(`${item.name} wurde als Audiodatei geladen.`)
  }

  const downloadArchive = async (item: AudioItem) => {
    try {
      triggerDownload(await createItemArchive(item), itemArchiveDownloadName(item))
      setMessage(`${item.name} wurde als Paper-Bard-Datei geladen.`)
    } catch (error) {
      setMessage(errorMessage(error))
    }
  }

  return (
    <main className="page">
      <section className="hero compact-hero">
        <div><p className="eyebrow">Deine Sammlung</p><h1>Library</h1><p>Alles, was deine Geschichten hörbar macht.</p></div>
        <button className="button primary" disabled={busy} onClick={() => inputRef.current?.click()}><Upload /> {busy ? 'Prüfe …' : 'Importieren'}</button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="audio/*,.paper-bard" multiple onChange={(event) => { void selectFiles(event.target.files) }} />
      </section>

      {items.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon"><FileAudio /></div>
          <h2>Deine Bühne ist leer</h2>
          <p>Importiere mehrere Audiodateien oder nimm deinen ersten Effekt auf.</p>
          <div className="empty-actions">
            <button className="button primary" onClick={() => inputRef.current?.click()}><Plus /> Audio importieren</button>
            <button className="button secondary" onClick={() => { window.location.hash = '/record' }}>Etwas aufnehmen</button>
          </div>
        </section>
      ) : (
        <section className="library-list" aria-label="Audiodateien">
          <div className="list-summary"><strong>{items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}</strong><span>{formatBytes(items.reduce((sum, item) => sum + item.sizeBytes, 0))}</span></div>
          {items.map((item) => (
            <article className="library-item" key={item.id}>
              <div className={`file-badge type-${item.type}`}><FileAudio /></div>
              <div className="library-info">
                <h3>{item.name}</h3>
                <p>{item.type === 'soundEffect' ? 'Soundeffekt' : item.type === 'music' ? 'Musik' : 'Ambience'} · {formatDuration(item.durationMs)} · {formatBytes(item.sizeBytes)}</p>
                {!!item.tags.length && <div className="tags">{item.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
              </div>
              <details className="item-menu">
                <summary className="icon-button" aria-label="Menü"><MoreVertical /></summary>
                <div className="popover">
                  <button onClick={() => downloadAudio(item)}><Download /> Audiodatei laden</button>
                  <button onClick={() => { void downloadArchive(item) }}><FileArchive /> Als Paper Bard Datei laden</button>
                  <button onClick={() => setEditing(item)}><Pencil /> Bearbeiten</button>
                  <button className="destructive" onClick={() => { void remove(item) }}><Trash2 /> Löschen</button>
                </div>
              </details>
            </article>
          ))}
        </section>
      )}

      {current && <AudioForm
        key={current.file.name}
        title={`${current.file.name}${pending.length > 1 ? ` (${pending.length} Dateien)` : ''}`}
        submitLabel={pending.length > 1 ? 'Speichern & weiter' : 'Importieren'}
        initial={{ name: current.file.name.replace(/\.[^.]+$/, ''), type: 'soundEffect', volume: 1, loop: false, tags: [] }}
        onSubmit={saveImport}
        onCancel={() => setPending([])}
      />}
      {editing && <AudioForm title={editing.name} initial={formValueFor(editing)} onSubmit={edit} onCancel={() => setEditing(undefined)} />}
    </main>
  )
}
