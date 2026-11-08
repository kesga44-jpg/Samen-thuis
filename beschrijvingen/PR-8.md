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

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
