# Paper Bard – Produktkonzept

## Ziel

Paper Bard ist eine installierbare, offline nutzbare App für Handy und Tablet. Während Pen-&-Paper-Sessions lassen sich Musik, Atmosphären und Soundeffekte schnell abspielen und mischen. Es gibt kein Benutzerkonto und keine Cloud-Abhängigkeit.

Die wichtigsten Zielgeräte sind aktuelle iPhones und iPads sowie Android-Smartphones und -Tablets. Die Bedienung ist für kleine Displays und Touch optimiert.

## Session

Die Session ist die Hauptansicht während des Spielens. Alle Einträge der Library erscheinen automatisch nach Musik, Ambience und Soundeffekten gruppiert.

Globale Steuerung:

- Master-Lautstärke
- Stop All
- Pause All und Resume All

Musik und Ambience bieten jeweils:

- Play, Pause und Stop
- Loop an oder aus
- Lautstärke und Mute
- klar erkennbaren Wiedergabestatus

Mehrere Tracks dürfen gleichzeitig laufen.

Soundeffekte erscheinen als große, schnell erreichbare Tasten. Jeder Tap spielt eine neue Instanz ab, sodass derselbe Effekt mehrfach gleichzeitig laufen kann. Pro Effekt stehen außerdem Loop, Lautstärke, Mute und Stop zur Verfügung.

## Library

Die Library verwaltet alle lokal vorhandenen Audiodateien. Es können mehrere Audiodateien oder einzelne `.paperbard`-Dateien vom Gerät importiert werden.

Jeder Eintrag besitzt:

- Name
- Kategorie: Musik, Ambience oder Soundeffekt
- Standardlautstärke
- Loop standardmäßig an oder aus
- frei vergebbare Tags
- Erstellungsdatum und Quelle
- Audiodatei

Einträge können bearbeitet und gelöscht werden. Mögliche Tag-Vorschläge sind `combat`, `forest`, `city`, `dungeon`, `horror`, `tavern` und `weather`.

Jeder Eintrag lässt sich entweder als Audiodatei oder als `.paperbard`-Datei laden. Die Paper-Bard-Datei enthält die Audiodatei und die Metadaten des Eintrags und kann später als neuer Eintrag wieder importiert werden.

## Aufnahme

Neue Audiodateien können direkt über das Mikrofon aufgenommen werden:

1. Mikrofonberechtigung anfordern
2. Aufnahme starten
3. Aufnahme stoppen
4. Aufnahme vorhören
5. Namen, Kategorie, Lautstärke, Loop und Tags festlegen
6. In der Library speichern oder verwerfen

Eine Aufnahme wird anschließend genauso behandelt wie eine importierte Datei.

## Einstellungen und Datensicherung

Für das MVP stehen zur Verfügung:

- Master-Standardlautstärke
- Standard-Fade-Dauer
- Anzeige des lokalen Speicherverbrauchs
- vollständiges Löschen der Library nach Bestätigung
- Export aller lokalen Daten in eine `.paperbard`-Backup-Datei
- Import einer `.paperbard`-Backup-Datei nach Prüfung und Bestätigung

## Qualitätsziele

Prioritäten:

1. zuverlässige Audiowiedergabe
2. schnelle Touch-Bedienung während der Session
3. vollständige Offline-Nutzung nach Installation und Import
4. sichere lokale Speicherung
5. einfacher Dateiimport
6. einfache Mikrofonaufnahme

Musik soll bei gesperrtem Bildschirm oder App-Wechsel weiterlaufen, soweit das mobile Betriebssystem dies zulässt. Nach einer Unterbrechung darf die App keinen falschen Wiedergabestatus anzeigen und muss per Tap wieder nutzbar sein.

## Nicht Teil des MVP

- Scenes und Crossfades zwischen Scenes
- Favoriten
- frei konfigurierbares Session-Soundboard
- Drag-and-drop-Sortierung
- Effektgruppen
- Suche und Filter
- Trimmen oder Normalisieren von Aufnahmen
- automatische Fade-Points
- Wiederherstellung einer laufenden Session nach einem vollständigen Neustart
- Konvertierung nicht unterstützter Audioformate
