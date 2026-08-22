import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import type { AudioItem, AudioType } from '../domain/types'
import { AUDIO_TYPE_LABELS, TAG_SUGGESTIONS } from '../domain/types'

export interface AudioFormValue {
  name: string
  type: AudioType
  volume: number
  loop: boolean
  tags: string[]
}

interface AudioFormProps {
  initial: AudioFormValue
  title: string
  submitLabel?: string
  onSubmit: (value: AudioFormValue) => void | Promise<void>
  onCancel: () => void
}

export function formValueFor(item: AudioItem): AudioFormValue {
  return { name: item.name, type: item.type, volume: item.volume, loop: item.loop, tags: item.tags }
}

export function AudioForm({ initial, title, submitLabel = 'Speichern', onSubmit, onCancel }: AudioFormProps) {
  const [value, setValue] = useState(initial)
  const [tagText, setTagText] = useState(initial.tags.join(', '))
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!value.name.trim()) return
    setBusy(true)
    try {
      await onSubmit({
        ...value,
        name: value.name.trim(),
        tags: [...new Set(tagText.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
      })
    } finally {
      setBusy(false)
    }
  }

  const addTag = (tag: string) => {
    const tags = new Set(tagText.split(',').map((entry) => entry.trim()).filter(Boolean))
    tags.add(tag)
    setTagText([...tags].join(', '))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="audio-form-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Audio bearbeiten</p>
            <h2 id="audio-form-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Schließen"><X /></button>
        </div>

        <label className="field">
          <span>Name</span>
          <input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} autoFocus required />
        </label>

        <label className="field">
          <span>Kategorie</span>
          <select value={value.type} onChange={(event) => setValue({ ...value, type: event.target.value as AudioType })}>
            {(Object.keys(AUDIO_TYPE_LABELS) as AudioType[]).map((type) => <option key={type} value={type}>{AUDIO_TYPE_LABELS[type]}</option>)}
          </select>
        </label>

        <label className="field range-field">
          <span>Standardlautstärke <strong>{Math.round(value.volume * 100)} %</strong></span>
          <input type="range" min="0" max="1" step="0.01" value={value.volume} onChange={(event) => setValue({ ...value, volume: Number(event.target.value) })} />
        </label>

        <label className="switch-row">
          <span>
            <strong>Loop</strong>
            <small>Datei standardmäßig wiederholen</small>
          </span>
          <input type="checkbox" checked={value.loop} onChange={(event) => setValue({ ...value, loop: event.target.checked })} />
        </label>

        <label className="field">
          <span>Tags <small>mit Komma trennen</small></span>
          <input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="forest, weather" />
        </label>
        <div className="tag-suggestions" aria-label="Tag-Vorschläge">
          {TAG_SUGGESTIONS.map((tag) => <button type="button" key={tag} onClick={() => addTag(tag)}>+ {tag}</button>)}
        </div>

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>Abbrechen</button>
          <button type="submit" className="button primary" disabled={busy || !value.name.trim()}><Check /> {submitLabel}</button>
        </div>
      </form>
    </div>
  )
}
