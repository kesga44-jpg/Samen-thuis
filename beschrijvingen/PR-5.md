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

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
