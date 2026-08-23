import { useEffect, useRef, useState } from 'react'
import { Download, HardDrive, Info, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { createBackup, parseBackup } from '../storage/backup'
import { storageEstimate } from '../storage/database'
import { errorMessage, formatBytes } from '../app/format'

export function SettingsView() {
  const { items, settings, updateSettings, removeAll, restore, setMessage } = useApp()
  const [estimate, setEstimate] = useState({ usage: 0, quota: 0 })
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const refreshEstimate = () => { void storageEstimate().then(setEstimate).catch(() => undefined) }
  useEffect(refreshEstimate, [items])

  const change = (partial: Partial<typeof settings>) => {
    void updateSettings({ ...settings, ...partial }).catch((error) => setMessage(errorMessage(error)))
  }

  const download = async () => {
    setBusy(true)
    try {
      const blob = await createBackup(items, settings)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `paper-bard-backup-${new Date().toISOString().slice(0, 10)}.paperbard`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Backup wurde erstellt.')
    } catch (error) {
      setMessage(errorMessage(error))
    } finally { setBusy(false) }
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const parsed = await parseBackup(file)
      if (!window.confirm(`Das Backup enthält ${parsed.items.length} Einträge und ersetzt alle vorhandenen Daten. Fortfahren?`)) return
      await restore(parsed.items, parsed.settings)
      setMessage('Backup erfolgreich wiederhergestellt.')
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
      if (importRef.current) importRef.current.value = ''
    }
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
        <h2>Backup</h2>
        <div className="settings-card button-stack">
          <button className="settings-action" disabled={busy} onClick={() => { void download() }}><span className="section-icon"><Download /></span><span><strong>Daten exportieren</strong><small>Library und Einstellungen als .paperbard sichern</small></span></button>
          <button className="settings-action" disabled={busy} onClick={() => importRef.current?.click()}><span className="section-icon"><Upload /></span><span><strong>.paperbard importieren</strong><small>Vorhandene Library und Einstellungen ersetzen</small></span></button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".paperbard,.zip,application/zip" onChange={(event) => { void importBackup(event.target.files?.[0]) }} />
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
