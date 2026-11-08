# PR 7: Voeding: voedingsplanning, Open Food Facts en receptkopieën uit Osta

- **Branch:** `pr/7-voeding` · **Basis:** `pr/6-sync-samenvoegen` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 18 files changed, 2078 insertions(+), 7 deletions(-)

## Doel en wijziging
Nieuwe pagina Voeding (Meer → Huishouden) met *Voeding bij het weekmenu*, *Receptkopieën uit Osta*, *Productinformatie* en *Osta en recepten uitwisselen*. Volgens ADR 0001 (geaccepteerd): Osta is de primaire plek voor recepten; Samen Thuis importeert/exporteert alleen, toont receptinhoud alleen-lezen en legt alleen voedingsannotaties vast. OFF alleen na klik, met limieten, cache en onbekend ≠ 0. Gegevens in het bestaande versleutelde onderdeel `nutrition`.

## Bestanden
```
A css/nutrition.css
A docs/adr/0001-voedingsplanning-in-samen-thuis.md
A docs/personal-ecosystem-voeding.patch
A e2e/smoke.mjs
A food-facts-core.js
A food-facts-core.test.js
M index.html
M nav-core.js
A nutrition-core.js
A nutrition-core.test.js
A nutrition-integration.test.js
A nutrition.js
A osta-exchange-core.js
A osta-exchange-core.test.js
M search-core.js
M sw.js
A test-fixtures/recipes/osta-gedeeld.txt
A test-fixtures/recipes/schema-org.json
```

## Risico
Middel: nieuwe functie en nieuw sync-onderdeel; geen databasewijziging.

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 340 · geslaagd 336 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
Centrale docs-PR in `personal-ecosystem` (`docs/personal-ecosystem-voeding.patch`). OFF API usage form (D-12).

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

## Controle bij publicatie (8 november 2026)

- **Commit:** `b14f124`, precies 1 commit, geen merges. Basis: `pr/6-sync-samenvoegen`.
- **Wijzigingen:** 18 files changed, 2078 insertions(+), 7 deletions(-). Geen bestanden in `supabase/migrations/`.
- **Patch:** patch-ID gelijk aan `patches/PR-7-*.patch`.
- **Eigen testrun:** `node --check app.js && node --test *.test.js`, als niet-root in een schone omgeving zonder globale bibliotheken, met PostgreSQL 16. Resultaat: tests 340 · geslaagd 332 · mislukt 0 · overgeslagen 8.

### Bekende beperkingen
- Overgeslagen tests: `RC_VALIDATION.md` en de testregel hierboven noemen 4 overgeslagen tests. In een schone omgeving, en op GitHub CI, zijn het er **8**. De 4 extra zijn PDF-importtests die `pdfjs-dist` globaal nodig hebben.
- `docs/personal-ecosystem-voeding.patch` is bedoeld voor de repository `personal-ecosystem` en wordt in deze repository nergens toegepast.

### Afhankelijkheden
Bouwt voort op PR 6 (`pr/6-sync-samenvoegen`). Merge na PR 6; daarna deze PR rebasen op `main`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
