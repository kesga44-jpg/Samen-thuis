# PR 4: Open-Meteo: verplichte bronvermelding

- **Branch:** `pr/4-open-meteo-bron` · **Basis:** `pr/3-r5-cdn-sri` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 4 files changed, 28 insertions(+), 5 deletions(-)

## Doel en wijziging
De Open-Meteo-licentie (CC BY 4.0) vereist bronvermelding met link bij elke weergave. Toegevoegd bij dashboardweer, weerpagina en luchtkwaliteit/pollen.

## Bestanden
```
M app.js
M index.html
M sw.js
A weather-attribution.test.js
```

## Risico
Laag.

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 275 · geslaagd 271 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
Geen.

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

## Controle bij publicatie (8 november 2026)

- **Commit:** `67dc1b4`, precies 1 commit, geen merges. Basis: `pr/3-r5-cdn-sri`.
- **Wijzigingen:** 4 files changed, 28 insertions(+), 5 deletions(-). Geen bestanden in `supabase/migrations/`.
- **Patch:** patch-ID gelijk aan `patches/PR-4-*.patch`.
- **Eigen testrun:** `node --check app.js && node --test *.test.js`, als niet-root in een schone omgeving zonder globale bibliotheken, met PostgreSQL 16. Resultaat: tests 275 · geslaagd 267 · mislukt 0 · overgeslagen 8.

### Bekende beperkingen
- Overgeslagen tests: `RC_VALIDATION.md` en de testregel hierboven noemen 4 overgeslagen tests. In een schone omgeving, en op GitHub CI, zijn het er **8**. De 4 extra zijn PDF-importtests die `pdfjs-dist` globaal nodig hebben.

### Afhankelijkheden
Bouwt voort op PR 3 (`pr/3-r5-cdn-sri`). Merge na PR 3; daarna deze PR rebasen op `main`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
