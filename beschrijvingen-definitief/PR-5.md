# PR 5: R7: Edge Functions afschermen

- **Branch:** `pr/5-r7-edge-guard` · **Basis:** `pr/4-open-meteo-bron` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 9 files changed, 287 insertions(+), 29 deletions(-)

## Doel en wijziging
`grocery-prices` en `data-sources` stonden open (CORS `*`, geen JWT, `--no-verify-jwt`). Nieuw `_shared/guard.ts`: gebruikers-JWT via `/auth/v1/user`, CORS-allowlist (`ALLOWED_ORIGINS`), 8 kB-limiet, limiet per gebruiker, geen interne foutdetails. De app stuurt het sessietoken mee. Deploy-instructies zonder `--no-verify-jwt`.

## Bestanden
```
M INSTALLATIE_BETA.md
M OPEN_DATA_BRONNEN.md
M app.js
A edge-guard.test.js
M index.html
A supabase/functions/_shared/guard.ts
M supabase/functions/data-sources/index.ts
M supabase/functions/grocery-prices/index.ts
M sw.js
```

## Risico
Middel na deploy: zonder persoonlijk account geen aanbiedingen/NED. Mergen zonder deploy verandert niets aan productie.

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 284 · geslaagd 280 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
Deploy pas na test in een eigen/staging-project (preflight met gateway-JWT, D-4) en expliciet akkoord.

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

## Controle bij publicatie (8 november 2026)

- **Commit:** `83bc74e`, precies 1 commit, geen merges. Basis: `pr/4-open-meteo-bron`.
- **Wijzigingen:** 9 files changed, 287 insertions(+), 29 deletions(-). Geen bestanden in `supabase/migrations/`.
- **Patch:** patch-ID gelijk aan `patches/PR-5-*.patch`.
- **Eigen testrun:** `node --check app.js && node --test *.test.js`, als niet-root in een schone omgeving zonder globale bibliotheken, met PostgreSQL 16. Resultaat: tests 284 · geslaagd 276 · mislukt 0 · overgeslagen 8.

### Bekende beperkingen
- Overgeslagen tests: `RC_VALIDATION.md` en de testregel hierboven noemen 4 overgeslagen tests. In een schone omgeving, en op GitHub CI, zijn het er **8**. De 4 extra zijn PDF-importtests die `pdfjs-dist` globaal nodig hebben.
- Deze PR wijzigt Edge Function-code (`supabase/functions/`). Mergen rolt niets uit; de Edge Functions worden apart gedeployed, pas na akkoord.

### Afhankelijkheden
Bouwt voort op PR 4 (`pr/4-open-meteo-bron`). Merge na PR 4; daarna deze PR rebasen op `main`. Edge Functions apart deployen na akkoord.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
