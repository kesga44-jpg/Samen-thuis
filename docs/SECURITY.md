# Beveiliging en gegevensbescherming Samen Thuis

Centraal: `personal-ecosystem/SECURITY.md` (dreigingsmodel, maatregelen R1–R17). Hieronder de audit van 2026-11-08 op de branch `verbeteringen/2026-11-zip` (basis `main` @ `4da8078`).

**Methode:** code en SQL gelezen, statische zoekopdrachten, heuristische scan op niet-ge-escapete interpolaties, unit-tests, lokale browsertest (Playwright, zonder internet). **Niet gedaan:** live Supabase-project bevragen, productie-RLS controleren, penetratietest, volledige handmatige review van alle 8.700 regels `app.js`.

**Classificatie:** *Aantoonbaar* = vastgesteld in code/SQL van deze repo. *Vermoedelijk* = risico afhankelijk van productie of niet volledig onderzocht.

## 1. Bevindingen

| # | Bevinding | Soort | Ernst | Status in deze set |
|---|---|---|---|---|
| R1 | `household_data` in `supabase/schema.sql`: `anon` mag lezen, invoegen en bijwerken (`using (true)`). Vertrouwelijkheid hangt af van de huishoudcode; integriteit niet beschermd. Of productie nog zo staat is onbekend. | Aantoonbaar (repo-SQL); productie onbekend | Hoog | **Niet gewijzigd.** Fase-3-script bestaat; uitvoering vereist akkoord (DB-1). Accountsync blijft de veilige route. |
| R4 | Extern BrainyQuote-script draaide in de pagina met toegang tot ontsleutelde data en tokens. | Aantoonbaar | Hoog | **Opgelost:** script verwijderd; lokale gedachte van de dag; RSS alleen als ge-escapete tekst. Test: `cdn-libs.test.js`, `quotes-core.test.js`. |
| R5 | CDN-bibliotheken zonder SRI; `tesseract.js@5` niet gepind. | Aantoonbaar | Middel | **Opgelost** voor hoofdbestanden: exact gepind + SHA-384 (`cdn-libs.js`); pdf.js via fetch + hashcontrole + blob-import. Restrisico: tesseract laadt zelf worker/taaldata zonder SRI. Hashes berekend uit npm-pakketten; **niet tegen live jsDelivr geverifieerd** → `node scripts/verify-sri.mjs` vóór merge. |
| R3 | SheetJS 0.18.5 met bekende kwetsbaarheden (o.a. CVE-2024-22363). | Aantoonbaar | Middel | **Open.** Upgrade alleen via `cdn.sheetjs.com`; bestand niet bereikbaar in deze omgeving om een hash te berekenen. Wel nu gepind + SRI. |
| R7 | Edge Functions `grocery-prices` en `data-sources`: geen JWT-controle, CORS `*`, gedeployed met `--no-verify-jwt` → open proxy op NED/PrijsProfeet-quota. | Aantoonbaar | Middel | **Opgelost in code** (`_shared/guard.ts`: gebruikers-JWT via `/auth/v1/user`, CORS-allowlist, 8 kB-limiet, 20–30 verzoeken/min/gebruiker, foutmeldingen zonder interne details). **Actief pas na redeploy** (akkoord). |
| S-1 | `sport-training` Edge Function: CORS `*` (wel JWT verplicht, geeft altijd 503). | Aantoonbaar | Laag | Niet gewijzigd (Sport: alleen fixes; geen datatoegang). |
| S-2 | Sessie (`samenThuisPersonalAuthV1`) en huishoudcode staan onversleuteld in `localStorage`; XSS zou ze kunnen lezen. | Aantoonbaar (bestaande audittest) | Middel | Ongewijzigd; risico verkleind door R4/R5. CSP voorgesteld (S-7). |
| R6 | Mogelijk gedeelde origin `kesga44-jpg.github.io` met Coach. | Vermoedelijk | Middel | Ongewijzigd; hosting-URL niet geverifieerd. |
| S-3 | XSS: heuristische scan vond geen aantoonbare injectie; gevonden gevallen zijn `textContent`, `confirm()` of al ge-escaped. Nieuwe Voeding-UI escapet alle externe gegevens (OFF, imports) — getest met kwaadaardige productnaam/URL. | Vermoedelijk laag (niet volledig geaudit) | — | Nieuwe code getest: `nutrition-integration.test.js`. |
| S-4 | Inputvalidatie nieuwe functies: barcode (cijfers + GTIN-controle), zoekterm ≥ 3 tekens/max 80, importbestand max 500 kB, recepten/producten begrensd, alleen `https://`-bron-URL's, stuurtekens verwijderd. Edge: tekst opgeschoond (`cleanText`). | Aantoonbaar | — | Getest. |
| S-5 | Uploads: buckets privé met grootte- en MIME-limiet en RLS (bestaand). Voeding gebruikt geen uploads. | Aantoonbaar (repo-SQL) | — | Ongewijzigd. |
| S-6 | Bestaande `security definer`-functies gebruiken `set search_path = public` i.p.v. `''` (centrale regel). Misbruik vereist CREATE-recht in `public`; op Supabase niet geverifieerd. | Vermoedelijk | Laag | Voorstel DB-2 (migratie, akkoord nodig). |
| S-7 | Geen Content-Security-Policy. | Aantoonbaar | Middel | Voorstel (§ 3); niet ingevoerd omdat niet alle paden in een echte browser met live diensten getest konden worden. |
| S-8 | Rate limiting: Supabase Auth heeft eigen limieten; Edge Functions nu per gebruiker (best-effort, per instantie, niet duurzaam). OFF client-side begrensd. | Aantoonbaar | — | Restrisico: limiet per instantie. |
| S-9 | Offline opslag: alle huishouddata onversleuteld in `localStorage` (bewuste keuze, offline-first). Wie toegang heeft tot het ontgrendelde apparaat/browserprofiel leest alles. De nieuwe sync-basiskopieën (`samenThuisSyncBaseV1`, `samenThuisAccountSyncBaseValuesV1`, `samenThuisPreMergeBackup`) vallen in dezelfde klasse; ze gaan nooit naar de server. | Aantoonbaar | Middel | Ongewijzigd; documenteren aan gebruikers. |
| S-12 | Automatisch samenvoegen bij sync: geen stille overschrijving (veldconflict → keuze), versiecontrole server-side ongewijzigd (`put_household_state` resp. voorwaardelijke `PATCH` op `updated_at`), herstelde back-up nooit automatisch samengevoegd, kopie vóór samenvoegen. | Aantoonbaar (tests + browsertest legacyroute) | — | Nieuw; accountroute alleen met nagebootste cloud getest. |
| S-10 | Back-ups: JSON-export onversleuteld; bevat financiële gegevens en (huishoud)sportgegevens. App waarschuwt bij export (bestaand). Server-back-ups (ADR 0010/0014) nog niet ingericht. | Aantoonbaar | Middel | Ongewijzigd; PR-3 wacht op ontwerpgoedkeuring. |
| R15 | Gezondheidsgegevens (Sport & Training) in gedeelde huishoudpayload; partner kan ze lezen. | Aantoonbaar | Middel | Ongewijzigd (ADR 0002: Sportapp neemt over na G-SPORT). Voeding voegt geen gezondheidsgegevens toe. |
| S-11 | Secrets: alleen de publishable key in de frontend; geen service-role of API-keys in repo (gescand, getest). `.env.example` bevat alleen placeholders. | Aantoonbaar | — | Getest: `integrations-policy.test.js`, `security-audit.test.js`. |

## 2. Privacy van financiële en persoonlijke gegevens

- Financiële gegevens verlaten het apparaat alleen versleuteld (sync) of als door de gebruiker gemaakte back-up.
- Externe diensten krijgen alleen: coördinaten (Open-Meteo), kenteken (RDW), zoekterm (PrijsProfeet via Edge, OFF), barcode (OFF). Nooit financiële of gezondheidsgegevens.
- Geen AI-dienst buiten het apparaat; de Voedingscontrole is regelgebaseerd en draait lokaal.
- Gezamenlijk versus persoonlijk: huishouddata (leden), persoonlijke voorkeuren (`personal_preferences`, alleen eigenaar). Voeding is huishouddata zonder persoonsgegevens.

## 3. Voorstel Content-Security-Policy (niet ingevoerd)

Als `<meta http-equiv>` in `index.html` (GitHub Pages ondersteunt geen headers). Eerst een week testen in een aparte branch.

```
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self' https://vwfuetxgapzfivydzhxc.supabase.co https://api.open-meteo.com https://air-quality-api.open-meteo.com https://geocoding-api.open-meteo.com https://world.openfoodfacts.org https://opendata.rdw.nl https://cdn.jsdelivr.net https://www.brainyquote.com https://tessdata.projectnaptha.com;
worker-src 'self' blob: https://cdn.jsdelivr.net;
frame-ancestors 'none'; base-uri 'self'; form-action 'self';
```

`frame-ancestors` werkt niet via `<meta>`; `'unsafe-inline'` voor stijlen is nodig door inline `style`-attributen. Hosts van tesseract-taaldata niet geverifieerd.

## 4. Melden

Privé via GitHub Security Advisories van deze repository; geen publiek issue.
