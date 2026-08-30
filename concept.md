# Paper Bard – Produktkonzept

## Ziel

Paper Bard ist eine installierbare, offline nutzbare App für Handy und Tablet. Während Pen-&-Paper-Sessions lassen sich Musik, Atmosphären und Soundeffekte schnell abspielen und mischen. Es gibt kein Benutzerkonto und keine Cloud-Abhängigkeit.

Die wichtigsten Zielgeräte sind aktuelle iPhones und iPads sowie Android-Smartphones und -Tablets. Die Bedienung ist für kleine Displays und Touch optimiert.

## Session

Die Session ist die Hauptansicht während des Spielens. Ohne ausgewählte Szene erscheinen alle Einträge der Library automatisch nach Musik, Ambience und Soundeffekten gruppiert.

Optional können Szenen angelegt werden. Eine Szene ist ein gespeichertes Soundset für einen Spielmoment, zum Beispiel Wald, Kampf oder Taverne. Für jede Szene lässt sich festlegen, welche Library-Einträge auf der Session-Seite sichtbar sind. Zusätzlich speichert jede Szene für ihre Sounds eigene Werte für Lautstärke, Mute und Loop.

Szenen lassen sich erstellen, umbenennen, bearbeiten und löschen. Zwischen vorhandenen Szenen kann mit einem Tap gewechselt werden. Beim Wechsel werden die gespeicherten Mix-Einstellungen der neuen Szene auf ihre Sounds angewendet. Laufende Sounds werden durch den Szenenwechsel nicht automatisch gestartet oder gestoppt. Dadurch bleibt der Wechsel kontrollierbar und unterbricht keine laufende Wiedergabe unerwartet.

Bei einer aktiven Szene werden die enthaltenen Sounds nach ihrem Verhalten gegliedert:

- **Dauerklänge**: alle Sounds, deren Loop in dieser Szene aktiviert ist
- **Einmalige Effekte**: alle Sounds, deren Loop in dieser Szene deaktiviert ist

Eine aktive Szene bietet zusätzlich „Szene starten“. Dieser Befehl startet alle Dauerklänge der Szene gleichzeitig. Bereits laufende Dauerklänge werden nicht doppelt gestartet; pausierte Dauerklänge werden fortgesetzt. Einmalige Effekte werden dabei nicht ausgelöst. Die Ansicht „Alle Sounds“ besitzt keinen eigenen Szenenstart.

Globale Steuerung:

- Master-Lautstärke mit deutlich hörbarer Regelwirkung über den gesamten Reglerbereich
- Stop All
- Pause All und Resume All

Musik und Ambience bieten jeweils:

- Play, Pause und Stop
- Loop an oder aus
- Lautstärke und Mute
- klar erkennbaren Wiedergabestatus

Mehrere Tracks dürfen gleichzeitig laufen. Lautstärke, Mute und Loop müssen während der laufenden App-Session sofort wirksam sein und auch nach Stop oder Stop All erhalten bleiben. Ohne aktive Szene setzt erst ein vollständiger Neustart der App diese Session-Werte wieder auf die in der Library gespeicherten Standards zurück. Innerhalb einer Szene werden deren Mix-Einstellungen dauerhaft lokal gespeichert.

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

Einträge können bearbeitet und gelöscht werden. Wird ein Eintrag gelöscht, wird er auch aus allen Szenen entfernt. Mögliche Tag-Vorschläge sind `combat`, `forest`, `city`, `dungeon`, `horror`, `tavern` und `weather`.

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

## Einstellungen

Für das MVP stehen zur Verfügung:

- Master-Standardlautstärke
- Standard-Fade-Dauer
- Anzeige des lokalen Speicherverbrauchs
- vollständiges Löschen der Library und der zugehörigen Szenen nach Bestätigung

## Qualitätsziele

Prioritäten:

1. zuverlässige Audiowiedergabe und hörbar funktionierende Live-Lautstärkeregelung
2. schnelle Touch-Bedienung während der Session
3. vollständige Offline-Nutzung nach Installation und Import
4. sichere lokale Speicherung
5. einfacher Dateiimport
6. einfache Mikrofonaufnahme

Musik soll bei gesperrtem Bildschirm oder App-Wechsel weiterlaufen, soweit das mobile Betriebssystem dies zulässt. Nach einer Unterbrechung darf die App keinen falschen Wiedergabestatus anzeigen und muss per Tap wieder nutzbar sein. Falls auf einer Plattform ein technischer Zielkonflikt zwischen Hintergrundwiedergabe und zuverlässiger Live-Lautstärkeregelung besteht, hat die Live-Lautstärkeregelung im MVP Vorrang.

## Nicht Teil des MVP

- Crossfades zwischen Szenen
- automatisches Starten oder Stoppen von Sounds beim Szenenwechsel
- Favoriten
- Drag-and-drop-Sortierung
- Effektgruppen
- Suche und Filter
- Trimmen oder Normalisieren von Aufnahmen
- automatische Fade-Points
- Wiederherstellung einer laufenden Session nach einem vollständigen Neustart
- Konvertierung nicht unterstützter Audioformate
