import { useEffect, useState } from 'react'
import { HardDrive, Info, RotateCcw, Trash2 } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { storageEstimate } from '../storage/database'
import { errorMessage, formatBytes } from '../app/format'

export function SettingsView() {
  const { items, settings, updateSettings, removeAll, setMessage } = useApp()
  const [estimate, setEstimate] = useState({ usage: 0, quota: 0 })

  const refreshEstimate = () => { void storageEstimate().then(setEstimate).catch(() => undefined) }
  useEffect(refreshEstimate, [items])

  const change = (partial: Partial<typeof settings>) => {
    void updateSettings({ ...settings, ...partial }).catch((error) => setMessage(errorMessage(error)))
  }

  const clear = async () => {
    if (!items.length || !window.confirm('Die gesamte Library und alle laufenden Wiedergaben löschen? Dieser Schritt kann nicht rückgängig gemacht werden.')) return
    try {
      await removeAll()
      setMessage('Library gelöscht.')
    } catch (error) { setMessage(errorMessage(error)) }
  }

  const percent = estimate.quota ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0

  return (
    <main className="page settings-page">
      <section className="hero compact-hero"><div><p className="eyebrow">Paper Bard</p><h1>Einstellungen</h1><p>Deine App, deine Bühne.</p></div></section>

      <section className="settings-section">
        <h2>Wiedergabe</h2>
        <div className="settings-card">
          <label className="field range-field"><span>Master-Standardlautstärke <strong>{Math.round(settings.masterVolume * 100)} %</strong></span><input type="range" min="0" max="1" step="0.01" value={settings.masterVolume} onChange={(event) => change({ masterVolume: Number(event.target.value) })} /></label>
          <label className="field"><span>Standard-Fade</span><select value={settings.fadeDurationMs} onChange={(event) => change({ fadeDurationMs: Number(event.target.value) })}><option value="0">Aus</option><option value="150">Sehr kurz · 0,15 s</option><option value="350">Kurz · 0,35 s</option><option value="750">Weich · 0,75 s</option><option value="1500">Lang · 1,5 s</option></select></label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Lokaler Speicher</h2>
        <div className="settings-card storage-card">
          <div className="storage-heading"><div className="section-icon"><HardDrive /></div><div><strong>{formatBytes(estimate.usage)} belegt</strong><span>{estimate.quota ? `von ungefähr ${formatBytes(estimate.quota)}` : 'Speicherlimit wird vom Gerät verwaltet'}</span></div></div>
          <div className="storage-bar"><span style={{ width: `${percent}%` }} /></div>
          <small>Alle Audiodateien bleiben ausschließlich auf diesem Gerät.</small>
        </div>
      </section>

      <section className="settings-section">
        <h2>Gefahrenzone</h2>
        <button className="settings-action destructive-card" onClick={() => { void clear() }} disabled={!items.length}><span className="section-icon"><Trash2 /></span><span><strong>Library löschen</strong><small>Alle {items.length} lokalen Einträge entfernen</small></span></button>
      </section>

      <section className="about-note"><Info /><p><strong>Offline und privat.</strong> Paper Bard sendet keine Audiodateien an einen Server. Hintergrundwiedergabe hängt von iOS oder Android ab.</p></section>
      <button className="text-button" onClick={() => change({ masterVolume: 0.85, fadeDurationMs: 350 })}><RotateCcw /> Standards wiederherstellen</button>
    </main>
  )
}
