# PR 1: Service worker: volledige precache en versiebeheer

- **Branch:** `pr/1-sw-precache` · **Basis:** `main` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 3 files changed, 86 insertions(+), 3 deletions(-)

## Doel en wijziging
Precache bevatte niet alle scripts uit `index.html` (o.a. `rewards-core.js` ontbrak), waardoor de app offline onvolledig kon zijn. Nieuw: `scripts/sync-sw-assets.mjs` genereert de lijst uit `index.html`; `sw-assets.test.js` bewaakt volledigheid, bestaan van bestanden, offline-fallback en opruimen van oude caches.

## Bestanden
```
A scripts/sync-sw-assets.mjs
A sw-assets.test.js
M sw.js
```

## Risico
Laag. Alleen de cachelijst en cachenaam veranderen.

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 264 · geslaagd 260 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
Geen.

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
