# Paper Bard – Architektur

## Plattform und Stack

Paper Bard ist eine rein clientseitige Progressive Web App auf Basis von React, TypeScript und Vite. Zielplattformen sind aktuelles iOS/iPadOS Safari und Android Chrome. Desktop-Browser werden ohne eigene Kompatibilitätsgarantie unterstützt.

- React UI mit Context und Hooks
- React-unabhängige AudioEngine
- IndexedDB über `idb`
- MediaRecorder für Aufnahmen
- ZIP-Backups über `fflate`
- Service Worker und Manifest über `vite-plugin-pwa`
- statisches Hosting unter `/paper-bard/` auf GitHub Pages
- Hash-Navigation ohne serverseitige Redirects

Grundfluss:

```text
React UI ──> AudioEngine ──> HTML Audio / Web Audio ──> Output
React UI ──> Storage Layer ──> IndexedDB
```

## Module

- `domain`: gemeinsame Typen, Standardwerte und Validierung
- `storage`: versionierte IndexedDB-Zugriffe und atomare Ersetzungen
- `audio`: AudioEngine und plattformspezifische Wiedergabe
- `backup`: ZIP-Export und validierter Import
- `app`: React Context, Navigation und mobile Ansichten

Die UI greift nicht direkt auf Browser-Audio-Nodes oder IndexedDB zu.

## Datenmodell

`AudioItem` enthält ID, Name, Kategorie, Blob, MIME-Typ, optionalen ursprünglichen Dateinamen, Dauer, Dateigröße, Lautstärke, Loop, Tags, Erstellungszeit und Quelle (`imported` oder `recorded`).

`PlaybackInstance` ist flüchtig und enthält eine eigene Instanz-ID, AudioItem-ID, Zustand, Position, Lautstärke, Mute und Loop. Musik und Ambience besitzen höchstens eine Instanz pro AudioItem. Soundeffekte dürfen mehrere parallele Instanzen besitzen.

`Settings` enthält Master-Standardlautstärke und Fade-Dauer. Die Session-Mischung wird nicht dauerhaft gespeichert.

IndexedDB heißt `paper-bard` und enthält die Stores `audioItems` und `settings`. Schemaänderungen erhöhen die Datenbankversion und benötigen eine Migration.

## Audiowiedergabe

Musik und Ambience verwenden native `HTMLAudioElement`-Instanzen mit Blob-URLs. Das vermeidet die vollständige Dekodierung langer Dateien und bietet auf mobilen Geräten die beste Chance auf Hintergrundwiedergabe. Die effektive Lautstärke ist Track-Lautstärke × Master-Lautstärke.

Soundeffekte verwenden primär `AudioBufferSourceNode` und eigene GainNodes. Jeder Tap erzeugt eine unabhängige Instanz. Dekodierte Buffer werden begrenzt zwischengespeichert. Falls Web Audio nicht gestartet oder nach einer Unterbrechung nicht wieder aktiviert werden kann, fällt die Engine auf native Audioelemente zurück.

Die AudioEngine veröffentlicht unveränderliche Snapshots an React und bietet Play, Pause, Resume, Stop, Stop All, Pause/Resume All, Loop, Mute sowie Track- und Master-Lautstärke. Objekt-URLs, Nodes und Ereignishandler werden bei Ende, Stop und Löschen freigegeben.

Bei `visibilitychange`, `pageshow` und einer Benutzeraktion gleicht die Engine ihren Zustand mit den Browser-Elementen ab. Media Session steuert Pause/Resume All, wenn die Plattform die API unterstützt. Hintergrundwiedergabe bleibt eine Best-Effort-Funktion des Betriebssystems.

## Import, Aufnahme und Backup

Importe werden vor dem Speichern über ein temporäres Audioelement geprüft. Nicht abspielbare Dateien und Quota-Fehler werden als verständliche Anwendungsfehler ausgegeben.

MediaRecorder wählt zur Laufzeit den ersten unterstützten MIME-Typ aus MP4/AAC und WebM/Opus. Nach dem Stop wird der Blob über eine Objekt-URL vorgehört und erst nach Bestätigung gespeichert.

Ein ZIP-Backup enthält `manifest.json` mit `schemaVersion: 1`, Einstellungen, Metadaten und getrennte Dateien unter `audio/`. Beim Import wird das gesamte Archiv geprüft. Erst danach ersetzt eine IndexedDB-Transaktion Library und Einstellungen. Bei einem Fehler bleiben vorhandene Daten unverändert.

Einzelne Einträge lassen sich zusätzlich als `.paper-bard` laden. Dieses ZIP enthält ein Manifest mit `schemaVersion: 1`, der Kennzeichnung `kind: "audio-item"`, allen Eintrags-Metadaten und einer Audiodatei unter `audio/`. Der Library-Import validiert das Archiv vollständig und legt den Eintrag mit einer neuen ID an; vorhandene Library-Daten und Einstellungen bleiben dabei unverändert.

## PWA und Deployment

Der Service Worker speichert nur App-Shell und statische Assets. Audiodateien verbleiben in IndexedDB. Eine neue Version wird angeboten und nicht während einer laufenden Session erzwungen.

Das Manifest verwendet Standalone-Modus, Maskable Icons und mobile Theme-Farben. Die Oberfläche berücksichtigt CSS Safe Areas und nutzt mindestens 48 px große Touch-Ziele. Das iPhone 13 Mini mit 375 × 812 CSS-Pixeln ist die kleinste Referenzgröße.

GitHub Actions führt Tests und den Produktionsbuild aus und veröffentlicht `dist` über GitHub Pages.

## Prüfung

Unit-Tests decken AudioEngine, parallele Instanzen, Statuswechsel und Ressourcenfreigabe ab. Storage- und Backup-Tests prüfen Blobs, Transaktionen und ungültige Archive. UI-Tests decken Import, Aufnahme, Löschen und Session-Steuerung ab.

Die manuelle Abnahme erfolgt auf einem iPhone 13 Mini mit aktuellem iOS und mindestens einem aktuellen Android-Smartphone. Geprüft werden Installation, Flugmodus, Hoch- und Querformat, parallele Wiedergabe, Mikrofon, Sperrbildschirm, App-Wechsel und wiederholtes Öffnen der PWA.
