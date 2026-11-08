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

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
