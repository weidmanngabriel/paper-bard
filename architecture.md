# Paper Bard – Architektur

## Plattform und Stack

Paper Bard ist eine rein clientseitige Progressive Web App auf Basis von React, TypeScript und Vite. Zielplattformen sind aktuelles iOS/iPadOS Safari und Android Chrome. Desktop-Browser werden ohne eigene Kompatibilitätsgarantie unterstützt.

- React UI mit Context und Hooks
- React-unabhängige AudioEngine
- IndexedDB über `idb`
- MediaRecorder für Aufnahmen
- `.paperbard`-Einzelarchive über `fflate`
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
- `itemArchive`: Export und validierter Import einzelner `.paperbard`-Dateien
- `app`: React Context, Navigation und mobile Ansichten

Die UI greift nicht direkt auf Browser-Audio-Nodes oder IndexedDB zu.

## Datenmodell

`AudioItem` enthält ID, Name, Kategorie, Blob, MIME-Typ, optionalen ursprünglichen Dateinamen, Dauer, Dateigröße, Lautstärke, Loop, Tags, Erstellungszeit und Quelle (`imported` oder `recorded`).

`PlaybackInstance` ist flüchtig und enthält eine eigene Instanz-ID, AudioItem-ID, Zustand, Position, Lautstärke, Mute und Loop. Musik und Ambience besitzen höchstens eine Instanz pro AudioItem. Soundeffekte dürfen mehrere parallele Instanzen besitzen.

`Settings` enthält Master-Standardlautstärke und Fade-Dauer. Die Session-Mischung wird nicht dauerhaft gespeichert. Änderungen an Lautstärke, Mute und Loop bleiben innerhalb der laufenden App-Session auch nach Stop erhalten, bis die App neu geladen wird.

IndexedDB heißt `paper-bard` und enthält die Stores `audioItems` und `settings`. Schemaänderungen erhöhen die Datenbankversion und benötigen eine Migration.

## Audiowiedergabe

Musik und Ambience verwenden weiterhin native `HTMLAudioElement`-Instanzen mit Blob-URLs, werden für die Lautstärkeregelung aber nach Möglichkeit über `MediaElementAudioSourceNode` und einen eigenen GainNode in den gemeinsamen Web-Audio-Master geroutet. Dadurch funktionieren Track- und Master-Lautstärke auch auf iOS, wo `HTMLAudioElement.volume` nicht zuverlässig programmatisch regelbar ist. Falls dieser Web-Audio-Pfad nicht verfügbar ist, bleibt die bisherige direkte Element-Lautstärke als Fallback bestehen.

Die effektive Master-Lautstärke verwendet weiterhin eine quadratische Kennlinie. Der angezeigte Master-Wert bleibt 0–100 %, wird für die Audio-Ausgabe aber quadriert, damit Änderungen im mittleren und unteren Bereich deutlich hörbar sind. Die zusätzliche Web-Audio-Routing-Schicht kann die Hintergrundwiedergabe auf einzelnen mobilen Plattformen beeinflussen; zuverlässige Live-Mischung hat für das MVP Vorrang.

Soundeffekte verwenden primär `AudioBufferSourceNode` und eigene GainNodes. Jeder Tap erzeugt eine unabhängige Instanz. Dekodierte Buffer werden begrenzt zwischengespeichert. Falls Web Audio nicht gestartet oder nach einer Unterbrechung nicht wieder aktiviert werden kann, fällt die Engine auf native Audioelemente zurück.

Die AudioEngine veröffentlicht unveränderliche Snapshots an React und bietet Play, Pause, Resume, Stop, Stop All, Pause/Resume All, Loop, Mute sowie Track- und Master-Lautstärke. Objekt-URLs, Nodes und Ereignishandler werden bei Ende, Stop und Löschen freigegeben.

Bei `visibilitychange`, `pageshow` und einer Benutzeraktion gleicht die Engine ihren Zustand mit den Browser-Elementen ab. Media Session steuert Pause/Resume All, wenn die Plattform die API unterstützt. Hintergrundwiedergabe bleibt eine Best-Effort-Funktion des Betriebssystems.

## Import, Aufnahme und Einzeldatei-Export

Importe werden vor dem Speichern über ein temporäres Audioelement geprüft. Nicht abspielbare Dateien und Quota-Fehler werden als verständliche Anwendungsfehler ausgegeben.

MediaRecorder wählt zur Laufzeit den ersten unterstützten MIME-Typ aus MP4/AAC und WebM/Opus. Nach dem Stop wird der Blob über eine Objekt-URL vorgehört und erst nach Bestätigung gespeichert.

Einzelne Einträge lassen sich zusätzlich als `.paperbard` laden. Dieses ZIP enthält ein Manifest mit `schemaVersion: 1`, der Kennzeichnung `kind: "audio-item"`, allen Eintrags-Metadaten und einer Audiodatei unter `audio/`. Der Library-Import validiert das Archiv vollständig und legt den Eintrag mit einer neuen ID an; vorhandene Library-Daten und Einstellungen bleiben dabei unverändert. Die bisherige Endung `.paper-bard` bleibt für den Einzelimport lesbar.

## PWA und Deployment

Der Service Worker speichert nur App-Shell und statische Assets. Audiodateien verbleiben in IndexedDB. Eine neue Version wird angeboten und nicht während einer laufenden Session erzwungen.

Das Manifest verwendet Standalone-Modus, Maskable Icons und mobile Theme-Farben. Die Oberfläche berücksichtigt CSS Safe Areas und nutzt mindestens 48 px große Touch-Ziele. Das iPhone 13 Mini mit 375 × 812 CSS-Pixeln ist die kleinste Referenzgröße.

GitHub Actions führt Tests und den Produktionsbuild aus und veröffentlicht `dist` über GitHub Pages.

## Prüfung

Unit-Tests decken AudioEngine, parallele Instanzen, Statuswechsel, Lautstärkerouting und Ressourcenfreigabe ab. Storage- und Archivtests prüfen Blobs und ungültige `.paperbard`-Dateien. UI-Tests decken Import, Aufnahme, Löschen und Session-Steuerung ab.

Die manuelle Abnahme erfolgt auf einem iPhone 13 Mini mit aktuellem iOS und mindestens einem aktuellen Android-Smartphone. Geprüft werden Installation, Flugmodus, Hoch- und Querformat, parallele Wiedergabe, Mikrofon, Sperrbildschirm, App-Wechsel und wiederholtes Öffnen der PWA.
