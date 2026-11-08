# PR 2: R4: extern BrainyQuote-script verwijderd

- **Branch:** `pr/2-r4-brainyquote` · **Basis:** `pr/1-sw-precache` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 5 files changed, 78 insertions(+), 13 deletions(-)

## Doel en wijziging
Het script van brainyquote.com draaide in de pagina met toegang tot ontsleutelde gegevens en sessietokens (R4, roadmap PR-7). Verwijderd; de citaatkaart toont een lokale "gedachte van de dag" (eigen teksten). Een eventueel opgehaalde RSS-tekst wordt alleen als ge-escapete tekst getoond.

## Bestanden
```
M app.js
M index.html
M quotes-core.js
M quotes-core.test.js
M sw.js
```

## Risico
Laag. Citaat verandert van bron.

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 267 · geslaagd 263 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
Geen.

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

## Controle bij publicatie (8 november 2026)

- **Commit:** `f51182d`, precies 1 commit, geen merges. Basis: `pr/1-sw-precache`.
- **Wijzigingen:** 5 files changed, 78 insertions(+), 13 deletions(-). Geen bestanden in `supabase/migrations/`.
- **Patch:** patch-ID gelijk aan `patches/PR-2-*.patch`.
- **Eigen testrun:** `node --check app.js && node --test *.test.js`, als niet-root in een schone omgeving zonder globale bibliotheken, met PostgreSQL 16. Resultaat: tests 267 · geslaagd 259 · mislukt 0 · overgeslagen 8.

### Bekende beperkingen
- Overgeslagen tests: `RC_VALIDATION.md` en de testregel hierboven noemen 4 overgeslagen tests. In een schone omgeving, en op GitHub CI, zijn het er **8**. De 4 extra zijn PDF-importtests die `pdfjs-dist` globaal nodig hebben.

### Afhankelijkheden
Bouwt voort op PR 1 (`pr/1-sw-precache`). Merge na PR 1; daarna deze PR rebasen op `main`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
