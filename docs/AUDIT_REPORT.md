# Samen Thuis — auditrapport (baseline, 2026-11-09)

## Scope en beperkingen

Deze audit is een statische repository-audit van de primaire Vanilla-JS PWA, documentatie, tests/CI, API- en Edge Function-code, Supabase-migraties en recente PR-/commitgeschiedenis op `main` bij commit `4c4e53c34b508af292624cc9b8df55d90b2aeff2`.

Dit is geen runtime-test, geen live API-test, geen productie-Supabase-test, geen echte iPhone/iPad-test en geen test op een live huishouden of een echte database. Er zijn geen productiegegevens of Supabase-instellingen gewijzigd.

Belangrijk: deze audit maakt een duidelijk onderscheid tussen:
- bewezen feiten uit de repository,
- vermoedelijke of risicovolle zaken,
- zaken die nog getest moeten worden voordat ze als acceptabel kunnen worden beschouwd.

## Onderzochte basis

Gecontroleerde bronnen:
- `README.md`
- `index.html`
- `app.js`
- `data-core.js`
- `household-sync-core.js`
- `account-sync.js`
- `prices.js` en `offers-core.js`
- `food-facts-core.js`, `nutrition-core.js`, `osta-exchange-core.js`
- `finance-plan-core.js`, `budget-ledger-core.js`, `finance-ui.js`
- `supabase/schema.sql`
- `supabase/migrations/...`
- `supabase/functions/_shared/guard.ts`
- `supabase/functions/grocery-prices/index.ts`
- `supabase/functions/data-sources/index.ts`
- `docs/*.md`
- `.github/workflows/tests.yml`
- recente PR- en commitbeschrijvingen in de repositorycontext

## Conclusie in één zin

Het project is een functionerende, deels uitgebreide lokale PWA met duidelijke documentatie en tests, maar het bevat meerdere risico’s in cloud- en data-security, migratie/legacy-synchronisatie en provider-integraties die nog niet live zijn geverifieerd. De juiste aanpak is om eerst de bewezen risico’s te verminderen, daarna pas nieuwe API’s toe te voegen.

## 1. Wat ontbreekt of niet meer aanpasbaar is

### 1.1 Bewezen ontbrekende of ongebruikte onderdelen

- Geen live verificatie van de productie-Supabase-configuratie en RLS.
  Bewijs: `docs/API_INTEGRATIONS.md`, `docs/SECURITY.md`, `docs/MIGRATIONS.md` en `supabase/schema.sql` stellen expliciet dat live API’s, RLS en projectconfiguratie niet zijn gecontroleerd. De schema-setup bevat `anon`-policies op `household_data` met `using (true)` en `with check (true)`. Dit is bestand in code, maar niet veilig genoeg in productie.

- Geen eenduidige actieve “beta” vs “primaire app”-structuur.
  Bewijs: `index.html` gebruikt klassieke rootbestanden, terwijl een `js/`-map ES-modulevarianten bevat (`js/sources.js`, `js/prices.js`, `js/app.js` mogelijk). De repository heeft meerdere parallelle structuren. Dit maakt onderhoud en verwijzing onduidelijk.

- Geen vrijgegeven, geverifieerde API-status voor alle externe providers.
  Bewijs: de documentatie noemt meerdere providers (Open-Meteo, Open Food Facts, RDW, CBS, PrijsProfeet, Tankerkoenig, sport-training, Web Push, etc.) met wisselende status. Een aantal zijn “geprepareerd” of “niet live getest”, niet “actief en veilig”.

- Geen live-validated deploy van Edge Function security.
  Bewijs: `supabase/functions/_shared/guard.ts` en `docs/MIGRATIONS.md` zeggen dat deploy pas na akkoord gebeurt, maar dat gateway/CORS-preflight zonder JWT nog niet is geverifieerd.

### 1.2 Niet meer goed aanpasbaar zonder extra onderzoek

- Legacy en account-sync naast elkaar.
  Deze toestand is functioneel in code, maar het is niet veilig om “als het werkt” te behandelen. De app heeft legacy `household_data` en nieuwe `household_state`-route; routing hangt af van opt-in, actuele migratie en lokale toestand.

- De app bevat meerdere historische, design- en prototypebestanden die niet duidelijk van de actieve code zijn gescheiden.
  De repo bevat bundles, patches, oude CSS- en documentbestanden. Deze kunnen niet zonder referentiecontrole veilig worden verwijderd.

- Autonome/marketplace-integraties zonder echte live contractcheck zijn gevoelig voor drift.
  Een providercontract kan zonder waarschuwing wijzigen, zonder dat repositorycode dat opmerkt.

## 2. Welke bestaande functionaliteit nog goed werkt

### 2.1 Beweren we op basis van code en documenten

- Lokale opslag/PWA en backup/herstel: `index.html`, `data-core.js`, `sw.js`, `README.md` maken het duidelijk dat de app lokaal werkt, met lokale data en back-up/herstelpaden.
- Voedingsplanning en productinformatie: `food-facts-core.js`, `nutrition-core.js`, `nutrition.js`, `osta-exchange-core.js` zijn aanwezig; Open Food Facts-normalisatie en ingrediënten-/voedingscache zitten in de code.
- Financiële module: `finance-plan-core.js`, `budget-ledger-core.js`, `finance-ui.js` en de PR-documentatie geven aan dat de app één ledger gebruikt en dat de statuslogica is uitgebreid.
- Sync- en migratiecode: `household-sync-core.js`, `account-sync.js`, `supabase/migrations/20261014000000_household_state_sync.sql` geven een duidelijke route voor geversioneerde state-overdracht. Dit bewijst niet dat de live overname werkt, maar de code is aanwezig.
- CI en vaste tests: `.github/workflows/tests.yml` en de README geven aan dat de repository een Node-testworkflow heeft, met PostgreSQL-detectie en syntaxcheck.
- Import- en documentleessystemen: universele import is aanwezig in `import-core.js`, `import-readers.js` en testdocumentatie. Dit is een zware feature die lokaal aandacht heeft gekregen.

### 2.2 Zogenaamde “goed werkend” maar nog niet live geverifieerd

- Supabase Edge Function security guard: code zit er in, maar deploy en live gedrag zijn nog niet geverifieerd.
- PrijsProfeet-aanbiedingen en energie-/brandstof-source lookups: implementatie aanwezig, contract en live werking nog niet bevestigd.
- Geïntegreerde account- en profielsync: code aanwezig, but production RLS/auth is niet live getest.

## 3. Welke problemen prioriteit hebben

### Prioriteit 1 (direct herstellen, vóór nieuwe API’s)

1. Datasecurity / legacy privacyrisk (`R1` in docs)
   - `supabase/schema.sql` geeft `anon` full read/write access op `household_data`.
   - Dit is het grootste geconstateerde beveiligingsrisico in repo.
   - Moet worden behandeld in een aparte, goedgekeurde PR en met staging/restore-test.

2. Sync/route-conflict legacy vs account-sync
   - De app heeft beide routes tegelijkertijd; zonder juiste migratiecontrole kan data worden overschreven of verkeerd aan een huishouden gekoppeld worden.

3. Edge Function security deploy gap
   - Guard is code aanwezig, maar live tooling en actual gateway validation zijn niet bewezen.

### Prioriteit 2 (vóór nieuwe API’s)

4. Verkeerde of onduidelijke “goede prijs” status op basis van vaste korting
   - `prices.js`/`offers-core.js` mogen niet als “goede prijs” labelen op basis van een brede of niet-onderbouwde drempel.
   - Dit is functioneel maar risico op verkeerde user-facing status.

5. Unclear or split app architecture
   - Root vs `js/` structure leads to duplicate code paths and maintenance risk.

### Prioriteit 3

6. Contract- en live-verificatie voor providers
   - Open Food Facts, PrijsProfeet, Tankerkoenig, RDW, CBS, etc.

7. Remove or archive risk cleanup
   - Geen verwijdering zonder referentiecontrole.

## 4. Welke bestanden aangepast moeten worden

### 4.1 Direct / kritisch

- `supabase/schema.sql`
- `supabase/manual/phase3_revoke_anon_household_data.sql`
- `supabase/migrations/20261014000000_household_state_sync.sql`
- `docs/SECURITY.md`
- `docs/MIGRATIONS.md`
- `docs/API_INTEGRATIONS.md`
- `docs/ARCHITECTURE.md`
- `account-sync.js`
- `household-sync-core.js`
- `app.js` (voor route/hook en sync-flow, niet voor productie-API’s)

### 4.2 Functioneel en datamodel

- `prices.js`
- `offers-core.js`
- `savings-core.test.js`
- `food-facts-core.js`
- `nutrition-core.js`
- `osta-exchange-core.js`

### 4.3 Documentatie en statusmatrix

- `docs/API_INTEGRATIONS.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/SECURITY.md`
- `docs/ARCHITECTURE.md`
- `README.md`

### 4.4 Alleen na exacte check

- `js/sources.js`
- `js/prices.js`
- `js/app.js` (zoals aanwezig in de ES-module-wereld)
- `sources.js`

## 5. Welke bestanden veilig verwijderd kunnen worden

### Strikt: geen verwijderen zonder referentiecontrole

Er zijn geen bestanden die in deze audit veilig kunnen worden verwijderd. De repo bevat historische, parallelle en documentatiebestanden die mogelijk nog in PWA/offline, docs, tests of service worker worden referenced.

Ik zou alleen verwijderen:
- oude duplicaten die exact geen referenties meer hebben,
- en alleen na een scan van HTML/JS/CSS/tests/workflows/service worker.

### Wat niet zonder audit te verwijderen is

- Top-level design-/releasebestanden
- Bundles / patches / backups / historical docs
- dubbele `prices.js` / `sources.js` in root en `js/`
- oudere CSS-varianten
- historische migratie-/rollbackbestanden die wellicht nog voor validatie relevant zijn

## 6. Welke API’s daadwerkelijk gratis en technisch bruikbaar zijn

### 6.1 Vrije, technisch haalbare en direct passend

- Open-Meteo API
  - Weather, Air Quality, Geocoding
  - Gratis en technisch geschikt voor de app
  - Bewijs: in code aanwezig, documentatie en archiveringsstatus zijn expliciet in de docs
  - Risico: live verificatie nog niet uitgevoerd, maar technisch passend.

- Open Food Facts
  - Productinformatie, barcode, voedingswaarden, ingrediënten, allergenen
  - Gratis en technisch geschikt, geen app-secret nodig
  - Bewijs: `food-facts-core.js` en `docs/API_INTEGRATIONS.md`
  - Risico: rate limits en kwaliteit moeten worden gecontroleerd.

- RDW Open Data
  - Kenteken / voertuiginformatie
  - Gratis, technisch bruikbaar
  - Behoud: alleen op verzoek, geen bulk-calls

- CBS StatLine
  - Brandstofprijzen / openbaar statistisch dataset
  - Gratis en technisch toegankelijk
  - Maar niet als echte stationprijs presenteren; dat is een keuze in de UX.

### 6.2 Technisch mogelijk, maar alleen met duidelijke voorwaarden / extra auth

- PrijsProfeet via Edge Function
  - Technisch bruikbaar, maar actuele documentatie/voorwaarden zijn niet gecontroleerd.
  - Niet veilig genoeg om “gratis en toegestaan” te claimen zonder providercheck.

- Supabase Edge Functions voor data-sources / grocery-prices
  - Niet “gratis” in de zin van publiek; afhankelijk van projectconfiguratie en auth
  - Onzeker zonder staging- en deploy-validatie.

### 6.3 Niet geschikt / niet goedgekeurd voor deze repo

- Web Push / OneSignal
- WebLLM / Ollama / betaaide AI APIs
- Geen nieuwe betaalde API’s zonder aparte goedkeuring en risico-analyse

## 7. Welke Supabase-wijzigingen noodzakelijk zijn en welke risico’s daarbij horen

### 7.1 Verplicht, maar alleen in aparte PR en na akkoord

1. Herstel van `household_data`-toegang
   - `anon`-policies moeten worden beperkt of volledig ingetrokken.
   - Dit is een databasewijziging met direct impact op legacy-sync.
   - Risico: bestaande legacy gebruikers kunnen hun sync verliezen zonder een goede migratie/backup.

2. Migratie voor accountsync / `household_state`
   - `household_state` en relevante functies (`put_household_state`, `import_legacy_household_data`) zitten in migratiecode, maar live status is onbewezen.
   - Risico: onvolledige migratie, conflict op `schema_migrations`, onduidelijk huishouden-ID-management.

3. `security definer`-functie review
   - `set search_path = public` versus `set search_path = ''` en volledige `grant/revoke` review.
   - Risico: SQL-injectie en scope-confusion.

4. RLS review per tabel
   - `household_data`, `household_state`, `personal_preferences`, eventueel andere household-related tables.
   - Risico: overbroad read access, partner- of data-leakage.

5. Secrets / keys / env management
   - Alleen Supabase Secrets, nooit in frontend of repo.
   - Risico: accidental exposure through repo or JS bundles.

### 7.2 Risico’s bij deze wijzigingen

- Legacy users kunnen hun bestaande data verliezen als migratie niet zorgvuldig back-up/restore getest is.
- Onjuiste RLS kan personen binnen een huishouden onbeperkt toegang geven.
- Een misconfigured allowlist in Edge Functions kan alle gebruikers verjagen of openstellen voor onbevoegde requests.
- Provider secrets in de repo kunnen leiden tot beveiligingsincidenten.

## 8. Gefaseerd implementatieplan

### Fase 0 — Audit en immuunsysteem
- Geen app- of databasewijzigingen in deze fase.
- Vastleggen van actuele statusmatrix in docs.
- Bevestigen welke bestanden echt actueel zijn en welke parallelle code bestaan.
- Verzamelen van referentiecontrole voor root/`js/`/bundles/schema.

### Fase 1 — Data veiligheid en legacy-database
- Beperken/afschermen van `anon`-rechten op `household_data`.
- Extern extra testplan: back-up, staging, migrate, restore, legacy import.
- Alleen na akkoord van eigenaar.

### Fase 2 — Sync-route hersteld en betrouwbaar
- Legacy vs account-sync scheiden in een duidelijke matrix.
- Conflict-handling testen: lokale wijziging, remote wijziging, offline, herstel.
- Verduidelijking van which route is active per household.

### Fase 3 — Price status + API contract cleanup
- Vaste `goede prijs` drempel fixen.
- Waar nodig product-ID, EAN of vergelijkbare universele match sleutel introduceren.
- PrijsProfeet/OFF/RDW/CBS te classificeren als “gecontroleerde contracten” of “geprepareerd, niet live”.

### Fase 4 — Edge Function security deploy
- `guard.ts` deploy in staging-project.
- CORS preflight check.
- Testen met authentieke gebruikers-JWT.
- Alleen daarna in productie deployen.

### Fase 5 — Extra services toevoegen
- Alleen na Fase 1–4 groen.
- Nieuwe API’s pas toevoegen als doc + status + owner-goedkeuring + veilige fallback en rate limit bestaan.

### Fase 6 — Opschonen van repository
- Alleen na volledige referentiecontrole.
- Geen verwijdering van bestanden die nog in service worker, app, docs of tests worden gebruikt.

## Onderdeel voor “eerste herstel” vóór nieuwe API’s

Vóór het toevoegen van nieuwe API’s moet eerst worden hersteld:
1. `household_data` security problem.
2. Legacy vs account-sync route ambiguity.
3. Edge Function security deploy validation.
4. Price status logic fix.
5. Definitieve statusmatrix voor alle actieve providers.
6. Repository-structuur vastleggen: wat is actief, wat is historisch.

Pas daarna kan veilig worden gestart met aanvullende external services zoals productdata, provider-enrichment, automatisering of nieuwe third-party data.

## Bewijsmateriaal / bewijsstatus

### Bewezen in repo
- `supabase/schema.sql` heeft `anon` policies op `household_data` met `using (true)`, `with check (true)`.
- `docs/SECURITY.md` en `docs/API_INTEGRATIONS.md` zeggen dat live checks en productie-API-validatie ontbreekt.
- `docs/MIGRATIONS.md` en de migratie-SQL zeggen dat live deploy/eigenlijk gebruik pas na akkoord moet gebeuren.
- `prices.js` toont status logica die afhankelijk is van `savingsPercentage`-drempel naast expliciete drempels.
- `index.html` en `js/` map laten zien dat de repo in meerdere parallelle structuren is opgebouwd.

### Vermoedelijk / waarschijnlijk
- Legacy sync route is reëel risico, maar exact productie impact is nog niet live aangetoond.
- Provider contract drift is waarschijnlijk, maar niet in repo live geverifieerd.
- Sommige “nieuwe” features zijn functioneel aanwezig, maar onduidelijk welke code pad daadwerkelijk in gebruik is.

### Nog getest / nog te valideren
- echte Supabase projectconfiguratie,
- live Edge Function security,
- live RLS output,
- echte iPhone/iPad UI,
- gebruikelijke route per gebruiker,
- echte provider responses,
- impact van data-migration on existing users.

## Aanbevolen werkvolgorde

1. Security-fix plan voor `household_data` (apart PR, geen app-code).
2. Sync-route audit en conflict matrix (apart PR, geen productiedata).
3. Edge Function preflight + deploy in staging (geen productie).
4. Price status fix and regression tests.
5. Statusmatrix / docs / no new API claims.
6. Daarna pas nieuwe API’s en nieuwe features in afzonderlijke PR’s.

## Eindopmerking

De repository is niet “kapot” of “leeg”, maar het is wel een project met meerdere bewezen risico’s die eerst moeten worden afgedekt. De juiste aanpak is: eerst veilig, daarna uitbreiden. Daarom is de juiste prioriteit: backend security, legacy sync, deploy validation en contractverificatie vóór nieuwe data-integraties.

Het huidige rapport is een baseline-audit en dient als basis voor gefaseerde PR’s, met duidelijke scheiding tussen:
- bewezen issues,
- mogelijke issues,
- nog te testen gebieden,
- en prioriteitsvolgorde.

Ook in deze fase zijn geen app-code, Supabase-tabellen, RLS, Edge Functions of productieconfiguraties gewijzigd.

----

Geplaatst in: `docs/AUDIT_REPORT.md`

Branch: `audit/initial-findings-2026-11`

Status: auditrapport opgeslagen, klaar voor review.

Volgende stap: implementatie in gefaseerde PR’s na expliciet akkoord op elk onderdeel.
