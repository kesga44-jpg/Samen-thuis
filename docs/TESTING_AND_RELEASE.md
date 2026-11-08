# Test- en releasehandleiding

## 1. Testsoorten

| Soort | Commando | Waar | Vereist |
|---|---|---|---|
| Unit- en integratietests | `node --test *.test.js` | Lokaal en CI | Node ≥ 22.18 (voor `edge-guard.test.js`: TypeScript-stripping) |
| SQL-semantiek (RLS, RPC's) | onderdeel van `migrations-pg.test.js` | Lokaal en CI | PostgreSQL 14–16, **niet-root**-gebruiker (`initdb` weigert root) |
| Syntax | `node --check app.js` (+ nieuwe modules in CI) | CI | — |
| Browser (mobiel/desktop, offline, Voeding) | `node e2e/smoke.mjs` | Lokaal (optioneel, niet in CI) | `npm i -g playwright && npx playwright install chromium` |
| Browser: synchronisatie tussen twee apparaten | `node e2e/sync-merge.mjs` | Lokaal | Playwright (Supabase wordt nagebootst) |
| Browser: documentimport en scan (PDF, DOCX, XLSX, XLS, OCR) | `E2E_LIVE_CDN=1 node e2e/import-browser.mjs` of `E2E_NPM_DIR=… node e2e/import-browser.mjs` | Lokaal | Playwright; live: internet; lokaal: uitgepakte npm-pakketten |
| Precache bijwerken | `node scripts/sync-sw-assets.mjs samen-thuis-vNN-onderwerp` | Bij elke asset-wijziging | — |
| SRI-hashes tegen live CDN | `node scripts/verify-sri.mjs` | Lokaal, vóór merge | Internet |

### Overgeslagen tests (verklaard)

Vier importtests worden in Node overgeslagen als `xlsx`, `mammoth` of Tesseract-taaldata niet als Node-module aanwezig zijn (`import-readers.test.js`). Die bibliotheken laadt de app in de browser vanaf het CDN; ze zijn bewust geen afhankelijkheid van de repo.

**Niet als afgerond beschouwen.** Daarom bestaat `e2e/import-browser.mjs`: dezelfde bestanden (plus `multi.xls` en `scan.pdf`) door de echte app-laders in Chromium, inclusief SRI-controle en een manipulatietest. Stand 2026-11-08: 9/9 geslaagd met lokaal geleverde npm-bestanden. **De live-CDN-stand (`E2E_LIVE_CDN=1`) is nog niet gedraaid** (geen internettoegang tot jsDelivr in de bouwomgeving) en is verplicht vóór het mergen van PR 3.

## 2. Wat de nieuwe tests dekken

| Testbestand | Onderwerp | Aantal |
|---|---|---|
| `food-facts-core.test.js` | OFF-normalisatie, onbekend ≠ 0, kJ/natrium-afleiding, kwaliteit, GTIN, limieten (product/zoeken), cache, offline-fallback, alle foutsoorten | 13 |
| `nutrition-core.test.js` | Hoeveelheden, recepten, berekening met dekking, opgegeven waarden apart, weekmenu, boodschappen, productupdate zonder verlies, robuuste normalisatie | 11 |
| `osta-exchange-core.test.js` | Osta-tekst, schema.org JSON-LD, foutformaten, voorbeeld zonder schrijven, dubbelen, herimport (bron wint, annotaties blijven, niets verdwijnt ongemerkt), twijfelgevallen, verliesvrije export/import | 10 |
| `nutrition-integration.test.js` | Opslag in `samenThuisDataV2`, back-up/herstel, accountsync (versleuteld, conflicten), privacy, zoeken, navigatie, XSS in UI, geen netwerk bij renderen, **geen zelfstandig receptenbeheer** (ADR 0001) | 11 |
| `edge-guard.test.js` | JWT verplicht, publishable key geweigerd, CORS-allowlist, preflight, 405/413/429/503, rate limiter, opschonen, app stuurt token | 9 |
| `cdn-libs.test.js` | Exacte versies + SRI, geen ongeregistreerde CDN-URL, geen extern script in `index.html`, integriteitscontrole (goed/fout/netwerk) | 6 |
| `sw-assets.test.js` | Precache = alles uit `index.html`, bestanden bestaan, nieuwe cacheversie, offline fallback, oude caches weg | 4 |
| `integrations-policy.test.js` | Open-Meteo-bronvermelding (dubbel met `weather-attribution`), geen secrets, geen betaalde/externe AI, geen Web Push, geen nieuwe energie-/Socrata-koppeling, OFF alleen lezen, geen Osta-API | 7 |
| `quotes-core.test.js` (uitgebreid) | Lokale gedachte van de dag, geen extern script in `index.html` | +3 |
| `sync-merge.test.js` | Automatisch samenvoegen: toevoegingen van beide, verschillende velden, verwijderen, tekstlijsten, zonder basis, scenario Kees/Daphne met nagebootste cloud, echt conflict, hold, race, oude code-sync | 11 |
| `weather-attribution.test.js` | Open-Meteo-bronvermelding op drie plekken, geen sleutel, cache | 2 |


`e2e/sync-merge.mjs` (9 controles): twee browsercontexten met de echte app (oude code-sync) en een nagebootste `household_data`-tabel; gelijktijdige toevoegingen worden samengevoegd, terugkeren naar de app haalt nieuwe wijzigingen op, een echt conflict vraagt een keuze, "Beide samenvoegen" werkt.

`e2e/import-browser.mjs` (9 controles): PDF via geverifieerde pdf.js-import, DOCX, XLSX (alle werkbladen), XLS, OCR van een afbeelding, gescande PDF, gemanipuleerde mammoth en pdf.js worden geweigerd.

`e2e/smoke.mjs` (35 controles): start zonder JS-fouten op 375/768/1280 px, Voeding-hub en subpagina's, product opslaan, recept importeren met voorbeeld, geen horizontale scroll, geen BrainyQuote-script, offline laden via service worker. Alle externe verzoeken worden in deze test geblokkeerd.

## 3. Release-checklist

1. Branch vanaf `main` (of de vorige PR in de stapel); nooit direct op `main`. Eén onderwerp per PR (zie `docs/IMPLEMENTATION_STATUS.md` § 3).
2. `node --test *.test.js` groen (als niet-root, met PostgreSQL).
3. Bij asset-wijziging: `?v=` in `index.html` verhoogd en `node scripts/sync-sw-assets.mjs samen-thuis-vNN-onderwerp` gedraaid (`sw-assets.test.js` controleert de lijst).
4. Bij bibliotheekwijziging: `node scripts/verify-sri.mjs` groen.
5. `node e2e/smoke.mjs` lokaal groen (aanbevolen).
6. `CHANGELOG.md` en betrokken documentatie bijgewerkt.
7. PR-beschrijving: doel, bestanden, risico, testplan, wat níet getest is.
8. Eigenaar reviewt en merget. GitHub Pages publiceert `main`.
9. Na publicatie handmatig op telefoon en laptop: app openen, verversen (nieuwe service worker), Voeding openen, één barcode opzoeken (eerste live OFF-controle), weer/pollen tonen bronvermelding.
10. Edge Functions alleen na apart akkoord deployen (`docs/MIGRATIONS.md` § 3), daarna aanbiedingen testen met en zonder aanmelding.

## 4. Terugdraaien

- Frontend: revert van de merge-commit; de nieuwe service worker wordt bij de volgende versie vervangen (verhoog `CACHE` opnieuw).
- Gegevens: `nutrition` blijft in `samenThuisDataV2` staan en wordt door oudere versies bewaard; er gaat niets verloren.
- Edge Functions: vorige versie opnieuw deployen.
