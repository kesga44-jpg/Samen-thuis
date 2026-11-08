# PR 6: Sync: wijzigingen van beide huisgenoten automatisch samenvoegen

- **Branch:** `pr/6-sync-samenvoegen` · **Basis:** `pr/5-r7-edge-guard` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 8 files changed, 469 insertions(+), 23 deletions(-)

## Doel en wijziging
Probleem: wijzigden beide huisgenoten hetzelfde onderdeel (bijv. allebei een boodschap), dan ontstond een conflict en zag je de toevoeging van de ander pas na een handmatige keuze. Nu: 3-wegs samenvoegen tegen de laatst gesynchroniseerde versie (lijsten op id, objecten per sleutel, tekstlijsten als verzameling, verwijderen gerespecteerd, gewijzigd-versus-verwijderd houdt het item). Alleen hetzelfde veld aan beide kanten anders → keuze, met nieuwe knop **Beide samenvoegen** (cloudversie wint bij echte veldconflicten). Werkt in de oude code-sync en de accountsync. Opslag vol → basiskopie wordt opgeruimd, app valt terug op kiezen.

## Bestanden
```
M account-sync.js
M app.js
A e2e/sync-merge.mjs
M household-sync-core.js
M index.html
M sport-training-integration.test.js
M sw.js
A sync-merge.test.js
```

## Risico
Middel: raakt de synchronisatie. Serverkant ongewijzigd (versiecontrole blijft); herstelde back-ups worden nooit automatisch samengevoegd; kopie vóór samenvoegen.

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 295 · geslaagd 291 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
Eerst op twee eigen apparaten proberen met een verse JSON-back-up. Accountroute alleen met nagebootste cloud getest.

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
