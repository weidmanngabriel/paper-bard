# Paper Bard

Paper Bard ist ein lokales, offline nutzbares Soundboard für Pen-&-Paper-Sessions. Musik, Atmosphären und Soundeffekte werden direkt auf dem Gerät gespeichert und gemischt.

## Entwicklung

```bash
npm install
npm run dev
```

Tests und Produktionsbuild:

```bash
npm test
npm run build
```

Die mobilen Browser-Tests laufen mit `npm run test:e2e` und benötigen ein installiertes Playwright-Chromium.

Die App wird bei Änderungen auf `main` automatisch auf GitHub Pages veröffentlicht. Produktanforderungen stehen in [concept.md](concept.md), technische Entscheidungen in [architecture.md](architecture.md).
