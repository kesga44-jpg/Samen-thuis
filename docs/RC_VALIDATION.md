# Test- en validatierapport 26.0-rc1

Datum 2026-11-08. Omgeving: Linux, Node 22.23, PostgreSQL 16 (SQL-tests als niet-root), Chromium via Playwright. **Geen internettoegang tot externe diensten** (jsDelivr, Open Food Facts, Open-Meteo, Supabase): alle externe verzoeken zijn in browsertests geblokkeerd of nagebootst.

## 1. Unit- en integratietests per PR (gestapeld)

Elke branch is apart uitgecheckt en volledig getest (`node --check app.js && node --test *.test.js`).

| Stap | Tests | Geslaagd | Mislukt | Overgeslagen |
|---|---|---|---|---|
| main (basis) | 260 | 256 | 0 | 4 |
| PR 1 sw-precache | 264 | 260 | 0 | 4 |
| PR 2 r4-brainyquote | 267 | 263 | 0 | 4 |
| PR 3 r5-cdn-sri | 273 | 269 | 0 | 4 |
| PR 4 open-meteo-bron | 275 | 271 | 0 | 4 |
| PR 5 r7-edge-guard | 284 | 280 | 0 | 4 |
| PR 6 sync-samenvoegen | 295 | 291 | 0 | 4 |
| PR 7 voeding | 340 | 336 | 0 | 4 |
| PR 8 docs-ci | 347 | 343 | 0 | 4 |

Overgeslagen (4, op elke stap): `import-readers.test.js` — XLSX/XLS (2×), DOCX en OCR, omdat `xlsx`, `mammoth` en Tesseract geen Node-afhankelijkheid van de repo zijn. **Niet als afgerond beschouwd**; zie § 2.

## 2. Browsertests (Chromium)

| Test | Stand | Resultaat | Wat dit bewijst | Wat niet |
|---|---|---|---|---|
| `e2e/smoke.mjs` | Eindstand, geen internet | 35/35 | Start zonder JS-fouten op 375/768/1280 px; Voeding-hub en subpagina's; product opslaan; recept importeren met voorbeeld; geen horizontale scroll; geen extern script; offline laden via service worker | Echte OFF-respons |
| `e2e/sync-merge.mjs` | Eindstand, nagebootste `household_data` | 9/9 | Twee apparaten (oude code-sync): gelijktijdige toevoegingen samengevoegd zonder keuze; terugkeren naar de app haalt nieuwe wijzigingen op; echt conflict vraagt keuze; "Beide samenvoegen" werkt | Echte Supabase; accountsync in de browser (alleen unit-scenario's met nagebootste cloud) |
| `e2e/import-browser.mjs` | Eindstand, jsDelivr-URL's lokaal beantwoord uit npm-pakketten | 9/9 | PDF (geverifieerde pdf.js-import), DOCX, XLSX (alle werkbladen), XLS, OCR afbeelding, gescande PDF; gemanipuleerde mammoth en pdf.js worden geweigerd | Live jsDelivr (`E2E_LIVE_CDN=1`) — **nog te draaien**; tesseract-worker/core/taaldata hebben geen SRI |

## 3. Overige controles

| Controle | Resultaat |
|---|---|
| Scope per PR (`git diff --name-only` tussen opeenvolgende branches) | Alleen bestanden van het eigen onderwerp (zie `docs/pr/PR-*.md`) |
| Eindstand versus werkstand | Alleen verwachte verschillen: `?v=`-versies, cachenaam, versie in `sport-training-integration.test.js` |
| Geheimen in ZIP (service-role, `sb_secret_`, JWT-achtige strings, privésleutels, tokens) | Geen; alleen controleregels in tests en één nep-JWT in `edge-guard.test.js` |
| Supabase/database | Niets uitgevoerd, geen migratie toegevoegd |

## 4. Niet getest (eerlijk)

- Live: Open Food Facts, Open-Meteo, jsDelivr (SRI-hashes), Supabase (Auth, REST, Edge Functions).
- Edge Functions in Deno/Supabase-runtime (alleen `guard.ts` in Node).
- Accountsync met echte Supabase en twee echte accounts.
- Echte iPhone/Android-apparaten (alleen Chromium-viewportemulatie).
- CI op GitHub (workflow alleen lokaal nagelopen).

## 5. Beveiligingsbevindingen (samenvatting)

Opgelost in deze set: R4, R5 (restrisico tesseract-worker/taaldata), R7 in code. Open: R1 (`household_data` anon, DB-1), R3 (SheetJS), S-6 (`search_path`), S-7 (CSP). Details: `docs/SECURITY.md`.
