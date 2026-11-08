# PR 3: R5: bibliotheken exact gepind met SRI

- **Branch:** `pr/3-r5-cdn-sri` · **Basis:** `pr/2-r4-brainyquote` (gestapeld; na merge van de vorige PR rebasen op `main`)
- **Omvang:** 7 files changed, 326 insertions(+), 10 deletions(-)

## Doel en wijziging
`cdn-libs.js` registreert pdf.js 4.10.38, mammoth 1.12.2, SheetJS 0.18.5 en tesseract.js 5.1.1 (was `@5`) met SHA-384. Scriptladers zetten `integrity` + `crossorigin`; pdf.js wordt eerst gedownload, gecontroleerd en dan uit een blob geïmporteerd. Browsertest `e2e/import-browser.mjs`: PDF, DOCX, XLSX, XLS, OCR en gemanipuleerde bestanden.

## Bestanden
```
M app.js
A cdn-libs.js
A cdn-libs.test.js
A e2e/import-browser.mjs
M index.html
A scripts/verify-sri.mjs
M sw.js
```

## Risico
Laag–middel: een afwijkende hash blokkeert die import (veilig falen).

## Testplan en resultaat
- `node --test *.test.js` (niet-root, met PostgreSQL) op deze branch: tests 273 · geslaagd 269 · mislukt 0 · overgeslagen 4.
- Zie `docs/RC_VALIDATION.md` voor browsertests en wat níet getest is.

## Voorwaarden vóór merge
`node scripts/verify-sri.mjs` en `E2E_LIVE_CDN=1 node e2e/import-browser.mjs` groen (internet nodig; niet gedraaid in de bouwomgeving). SheetJS-upgrade (R3) is een aparte vervolg-PR.

## Niet in deze PR
Geen wijzigingen aan Supabase, databases, RLS, Storage of bestaande gegevens.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTXW7c38F7h8Qy7T4q3
