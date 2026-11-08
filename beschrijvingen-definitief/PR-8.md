# PR 8: Documentatie en CI voor 26.0-rc1

- **Branch:** `pr/8-docs-ci` · **Basis:** `pr/7-voeding` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 16 files changed, 763 insertions(+), 22 deletions(-)

## Doel en wijziging
README, CLAUDE.md/AGENTS.md, architectuur, API-register, datamodel, migratie, beveiliging, test/release, installatie, status, changelog, `.env.example`, uploadmanifest, PR-beschrijvingen, validatierapport. CI: syntaxcontrole nieuwe modules en Node ≥ 22.18. `integrations-policy.test.js` bewaakt de integratieafspraken.

## Bestanden
```
A .env.example
M .github/workflows/tests.yml
A AGENTS.md
A CHANGELOG.md
A CLAUDE.md
M INTEGRATIE-STATUS.md
M README.md
A docs/API_INTEGRATIONS.md
A docs/ARCHITECTURE.md
A docs/DATA_MODEL.md
A docs/IMPLEMENTATION_STATUS.md
A docs/INSTALLATION.md
A docs/MIGRATIONS.md
A docs/SECURITY.md
A docs/TESTING_AND_RELEASE.md
A integrations-policy.test.js
```

## Risico
Laag.

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 347 · geslaagd 343 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
Geen.

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

## Controle bij publicatie (8 november 2026)

- **Commit:** `d9de427`, precies 1 commit, geen merges. Basis: `pr/7-voeding`.
- **Wijzigingen:** 26 files changed, 1183 insertions(+), 22 deletions(-). Geen bestanden in `supabase/migrations/`.
- **Patch:** patch-ID gelijk aan `patches/PR-8-*.patch`.
- **Eigen testrun:** `node --check app.js && node --test *.test.js`, als niet-root in een schone omgeving zonder globale bibliotheken, met PostgreSQL 16. Resultaat: tests 347 · geslaagd 339 · mislukt 0 · overgeslagen 8.

### Bekende beperkingen
- Overgeslagen tests: `RC_VALIDATION.md` en de testregel hierboven noemen 4 overgeslagen tests. In een schone omgeving, en op GitHub CI, zijn het er **8**. De 4 extra zijn PDF-importtests die `pdfjs-dist` globaal nodig hebben.
- `docs/personal-ecosystem-voeding.patch` is bedoeld voor de repository `personal-ecosystem` en wordt in deze repository nergens toegepast.

### Afhankelijkheden
Bouwt voort op PR 7 (`pr/7-voeding`). Merge na PR 7; daarna deze PR rebasen op `main`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
