# Implementatiestatus en resterende aandachtspunten

Releasekandidaat **26.0-rc1** (2026-11-08). Basis: `main` @ `4da8078`. Niets gepusht of gemerged; geleverd als ZIP met afzonderlijke PR-branches (git-bundle) en patches.

## 1. Legenda

| Label | Betekenis |
|---|---|
| **Geïmplementeerd** | Code staat in deze set |
| **Getest** | Geautomatiseerde test in `*.test.js` (CI) |
| **Lokaal getest** | In een echte browser (Chromium via `e2e/*.mjs`), zonder live diensten |
| **Productiegeverifieerd** | Gecontroleerd tegen live diensten/productie — **niets in deze set** |
| **Nog niet geïmplementeerd** | Onderzocht of voorbereid, geen code |
| **Nog niet goedgekeurd** | Vereist besluit van de eigenaar vóór bouwen of activeren |

## 2. Statusmatrix

| Onderdeel | Geïmpl. | Getest | Lokaal getest | Productie | Opmerking |
|---|---|---|---|---|---|
| Service worker: volledige precache, cacheversiebeheer, `scripts/sync-sw-assets.mjs` | ✅ | ✅ | ✅ offline | ❌ | PR 1 |
| R4 BrainyQuote-script verwijderd, lokale gedachte van de dag | ✅ | ✅ | ✅ | ❌ | PR 2 (roadmap PR-7) |
| R5 CDN exact gepind + SRI, geverifieerde pdf.js-import | ✅ | ✅ | ✅ met npm-bestanden (import-browsertest 9/9, incl. manipulatietest) | ❌ | PR 3; **live CDN nog niet gecontroleerd** (`verify-sri.mjs`, `E2E_LIVE_CDN=1`) |
| R3 SheetJS-upgrade | ❌ | — | — | — | Prioriteit 3 |
| Documentimport en scan (PDF, DOCX, XLSX, XLS, OCR) | ✅ bestaand | ⚠️ 4 Node-tests overgeslagen | ✅ in Chromium | ❌ | Niet afgerond tot de live-CDN-run groen is |
| Open-Meteo bronvermelding | ✅ | ✅ | ✅ | ❌ | PR 4 |
| R7 Edge Functions: JWT, CORS-allowlist, limieten | ✅ code | ✅ (guard in Node) | ❌ niet in Deno/Supabase | ❌ | PR 5; prioriteit 4: testen in eigen project, daarna deploy na akkoord |
| **Sync: wijzigingen van beide huisgenoten automatisch samenvoegen** | ✅ | ✅ | ✅ oude code-sync (2 browsers, nagebootste tabel) | ❌ | PR 6; accountroute alleen met nagebootste cloud getest |
| Voeding: OFF, receptkopieën uit Osta, voedingsberekening, weekmenu | ✅ | ✅ | ✅ zonder netwerk | ❌ **OFF nooit live aangeroepen** | PR 7; architectuur gecorrigeerd (ADR 0001, geaccepteerd) |
| Documentatie, CI | ✅ | — | — | ❌ | PR 8; CI niet op GitHub gedraaid |
| Database, RLS, Storage, Supabase-configuratie | geen wijziging | bestaande SQL-tests groen | — | — | Prioriteit 2: onderzoek, geen wijziging zonder akkoord + back-up |
| CSP | ❌ | — | — | — | Prioriteit 5; voorstel in `docs/SECURITY.md` |
| Web Push | ❌ | — | — | — | Prioriteit 6; Hub-eigendom vastleggen |
| Energie (NED/evcc) | bestaand, ongewijzigd | — | — | — | Prioriteit 7; eigenaar vastleggen |
| Opruimen verouderde bestanden | ❌ (niets verwijderd) | — | — | — | Prioriteit 8; aparte PR |
| WebLLM/Ollama, OAuth 2.1 | ❌ | — | — | — | Niet goedgekeurd / Hub-spike |
| Sport & Training | ongewijzigd | bestaand | — | — | Centrale ADR 0002: alleen fixes |

## 3. PR-stapel (ADR 0011: één onderwerp per PR)

De PR's zijn **gestapeld**: elke branch bouwt voort op de vorige en bevat alleen het eigen onderwerp. Merge in deze volgorde; na elke merge de volgende PR rebasen op `main` (diff blijft gelijk). Elke stap is afzonderlijk getest (volledige suite groen, zie `docs/RC_VALIDATION.md`).

| # | Branch | Onderwerp | Bestanden (kern) | Risico | Voorwaarde vóór merge |
|---|---|---|---|---|---|
| 1 | `pr/1-sw-precache` | Service worker compleet + versiebeheer | `sw.js`, `sw-assets.test.js`, `scripts/sync-sw-assets.mjs` | Laag | — |
| 2 | `pr/2-r4-brainyquote` | Extern citaatscript weg, lokale gedachte | `index.html`, `app.js` (renderQuote), `quotes-core.js` + test | Laag | — |
| 3 | `pr/3-r5-cdn-sri` | Bibliotheken gepind + SRI, geverifieerde pdf.js | `cdn-libs.js` + test, `app.js` (laders), `index.html`, `scripts/verify-sri.mjs`, `e2e/import-browser.mjs` | Laag–middel | `node scripts/verify-sri.mjs` en `E2E_LIVE_CDN=1 node e2e/import-browser.mjs` groen |
| 4 | `pr/4-open-meteo-bron` | Open-Meteo-bronvermelding | `app.js` (3 plekken), `weather-attribution.test.js` | Laag | — |
| 5 | `pr/5-r7-edge-guard` | Edge Functions: JWT, CORS, limieten | `supabase/functions/_shared/guard.ts`, `grocery-prices`, `data-sources`, `app.js` (token meesturen), `edge-guard.test.js`, deploy-docs | Middel | Mergen mag zonder deploy (app stuurt token al mee). **Deploy alleen na test in eigen project + akkoord** |
| 6 | `pr/6-sync-samenvoegen` | Wijzigingen van huisgenoot automatisch samenvoegen | `household-sync-core.js`, `account-sync.js`, `app.js` (code-sync, conflictkaart, opslag-vol), `sync-merge.test.js`, `e2e/sync-merge.mjs` | Middel | Eerst op twee eigen apparaten proberen met een verse JSON-back-up |
| 7 | `pr/7-voeding` | Voedingsplanning, OFF, receptkopieën uit Osta | `food-facts-core.js`, `nutrition-core.js`, `osta-exchange-core.js`, `nutrition.js`, `css/nutrition.css`, `nav-core.js`, `search-core.js`, `index.html`, tests, fixtures, `e2e/smoke.mjs`, `docs/adr/0001-…` | Middel | Centrale docs-PR (`docs/personal-ecosystem-voeding.patch`) in `personal-ecosystem` |
| 8 | `pr/8-docs-ci` | Documentatie en CI | `README.md`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/*`, `.env.example`, workflow, `integrations-policy.test.js`, `UPLOAD_MANIFEST.md` | Laag | — |

Aanvullend, in een andere repository: `personal-ecosystem` branch `docs/voeding-osta-samen-thuis` (patch `docs/personal-ecosystem-voeding.patch`).

## 4. Prioriteiten (eigenaar, 2026-11-08) en stand

| Prio | Onderwerp | Actie | Stand in rc1 |
|---|---|---|---|
| 1 | Voeding | Architectuur en ADR corrigeren | ✅ ADR 0001 herschreven en geaccepteerd; code: geen recept-aanmaak, receptinhoud alleen-lezen, bron wint bij herimport, alleen voedingsannotaties; centrale patch klaar |
| 2 | Beveiliging | Database-RLS en functies onderzoeken | ⏳ Volgende stap. Bekend: R1 (`household_data` anon), S-6 (`search_path = public`). Alleen onderzoek + migratievoorstel + lokale SQL-tests; niets uitvoeren |
| 3 | Dependencies | SheetJS upgraden en SRI controleren | ⏳ SRI lokaal bewezen (manipulatietest); live-controle en SheetJS-upgrade open |
| 4 | Edge Functions | JWT en CORS testen, daarna deployen | ⏳ Code + unit-tests klaar; Deno/Supabase-test en deploy open |
| 5 | CSP | Beleid opstellen en testen | ⏳ Voorstel staat in `docs/SECURITY.md` |
| 6 | Web Push | Eigenaarschap bij Hub bepalen | ⏳ Niets gebouwd; ontwerpschets § 6 |
| 7 | Energie | Eigenaarschap vastleggen | ⏳ |
| 8 | Opruimen | Verouderde bestanden via aparte PR | ⏳ |
| — | Sync (nieuw verzoek) | Toevoegingen van de huisgenoot automatisch zien | ✅ PR 6 |

## 5. Resterende beslissingen

| # | Beslissing | Opties |
|---|---|---|
| D-1 | ~~Eigenaarschap voeding~~ | **Besloten** (ADR 0001). Nog: centrale docs-PR mergen |
| D-3 | Redeploy Edge Functions (PR 5) | Na test in eigen/staging-project; gebruikers zonder account verliezen aanbiedingen/NED |
| D-4 | Gateway-JWT aan of `--no-verify-jwt` | Hangt af van preflight-test |
| D-5 | SheetJS-versie via `cdn.sheetjs.com` | Versie kiezen, hash berekenen, import-browsertest |
| D-6 | CSP invoeren | Testbranch met voorstel |
| D-7 | Web Push: Hub-eigendom (I-4) en Samen Thuis via I-9 | Vastleggen in centrale docs |
| D-8 | Lokale AI (WebLLM/Ollama) voor voedingsplanning | Pas na apart besluit; altijd handmatig gestart |
| D-9 | Energiedashboard: eigenaar | Samen Thuis houden / Hub / stoppen |
| D-10 | DB-1: anon-toegang `household_data` intrekken (R1) | Na back-up + hersteltest; let op: oude code-sync stopt dan (accountsync vereist) |
| D-11 | DB-2: `search_path = ''` | Migratie + SQL-tests |
| D-12 | OFF API usage form; browsergebruik zonder eigen User-Agent | Eigenaar |
| D-13 | Opruim-PR | Lijst in roadmap PR-12 |
| D-14 | Sync: bij echt veldconflict met "Beide samenvoegen" wint de cloudversie | Akkoord, of liever per veld kiezen (meer UI-werk) |

## 6. Web Push — ontwerpschets (niets gebouwd)

Centraal: Hub is eigenaar (I-4, fase F6); Samen Thuis → Hub via `hub.notify()` (I-9, later, opt-in, losse PR). Als toch push vanuit Samen Thuis: opt-in per apparaat na gebruikersactie; VAPID private key alleen als Edge-secret; tabel `push_subscriptions` met RLS alleen-eigenaar en RPC-schrijven (migratie + akkoord); Edge Function met JWT; `push`-handler in `sw.js`; voorkeuren per categorie in de bestaande Inbox (veld `push`, standaard uit); uitzetten = abonnement intrekken; iOS ≥ 16.4 alleen als beginscherm-PWA.

## 7. Bekende beperkingen

- Geen externe API live aangeroepen; CDN-hashes niet tegen jsDelivr gecontroleerd; Edge Functions niet in Deno gedraaid.
- Sync: de basis voor samenvoegen ontstaat pas na de eerste geslaagde synchronisatie met de nieuwe versie. Een conflict dat al openstond vóór de update los je op met **Beide samenvoegen** (zonder basis: toevoegingen van beide blijven, maar iets dat aan één kant is verwijderd kan terugkomen).
- Sync: beide apparaten moeten de nieuwe versie hebben voor automatisch samenvoegen; een oud apparaat blijft om een keuze vragen (veilig).
- Rate limiting in Edge Functions is per instantie, niet duurzaam.
- Voedingsberekening: ml ≈ g en lepels zijn benaderingen (≈); stuks hebben geen gewicht tot je grammen invult.
- Receptkopie kan achterlopen op Osta tot je opnieuw importeert (geen Osta-API).
- Barcodescan met camera niet gebouwd.
- Bij een SRI-fout meldt de app "controleer je internetverbinding" (browsers onderscheiden een geweigerd script niet van een netwerkfout).
