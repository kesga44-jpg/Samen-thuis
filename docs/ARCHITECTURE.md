# Architectuur Samen Thuis

Leidend: `personal-ecosystem/ARCHITECTURE.md` (goedgekeurd 2026-11-07). Dit document beschrijft alleen Samen Thuis.

## 1. Plaats in het ecosysteem

| Onderwerp | Afspraak | Bron |
|---|---|---|
| Rol | Huishouden, financiën (incl. toekomstig beleggen), boodschappen, voorraad, woning, planning, huishoud-challenges | `APP_REGISTRY.md` |
| Supabase | Project A, schema `public` (exclusief Samen Thuis), buckets `sport-training`, `profile-photos` | ADR 0001 centraal |
| Zelfstandig | Werkt offline en zonder andere apps; geen container voor Hub, Sportapp of SIDEQUEST | `ARCHITECTURE.md` § 1 |
| Stack | Vanilla JS, geen build, GitHub Pages | `ARCHITECTURE.md` § 3.2 |
| Wijzigingen | Eén PR per onderwerp, voorstel vooraf | ADR 0011 centraal |
| Sport & Training | Volledig in gebruik tot poort G-SPORT; alleen fixes | ADR 0002 centraal |
| Inbox | Blijft eigenaar huishoudmeldingen; Hub-koppeling I-9 later | ADR 0004 centraal |

## 2. Opbouw van de client

```
index.html
├─ css/*.css, styles.css, shell.css, sportcoach.css, css/nutrition.css
├─ cdn-libs.js            register externe bibliotheken (versie + SRI), geverifieerde pdf.js-import   [nieuw]
├─ *-core.js              zuivere logica (UMD, getest in Node)
│   ├─ data-core.js       opslag, herstel, conflictbeslissing (legacy-sync)
│   ├─ household-sync-core.js  accountsync per onderdeel, versiecontrole
│   ├─ food-facts-core.js Open Food Facts-client: normalisatie, cache, limieten, fouten              [nieuw]
│   ├─ nutrition-core.js  recepten, voedingsberekening met dekking, weekmenu-samenvatting             [nieuw]
│   ├─ osta-exchange-core.js  import/export recepten (Osta-tekst, schema.org, eigen formaat)          [nieuw]
│   └─ … (finance, budget-ledger, import, nav, search, sportcoach, inbox, quotes, …)
├─ app.js                 hoofdapp (render(), opslag, sync, pagina's)
├─ uitbreidingsmodules    haken op render(): challenges, account-sync, inbox, weather-extras, sportcoach, nutrition [nieuw]
├─ nav-groups.js          navigatieschil (onderbalk, hubs, subpagina's, #/route) — laatst geladen
└─ search.js              centrale zoekfunctie (Ctrl/Cmd+K)
sw.js                     service worker: precache van alle assets, network-first, offline fallback
supabase/functions/       Edge Functions (Deno): grocery-prices, data-sources, sport-training, _shared/guard.ts [nieuw]
supabase/migrations/      additieve migraties + supabase/rollbacks/
```

### Navigatie

Vijf hoofdonderdelen in de onderbalk (Vandaag, Financiën, Sport, Doelen, Meer). Lange pagina's zijn hubs met subpagina's (`NavCore.HUBS`). Nieuw: **Meer → Huishouden → Voeding** met subpagina's *Voeding bij het weekmenu*, *Receptkopieën uit Osta*, *Productinformatie*, *Osta en recepten uitwisselen*. Routes: `#/voeding`, `#/voeding/producten`, enz. De centrale zoekfunctie doorzoekt nu ook recepten (incl. ingrediënten) en producten.

## 3. Gegevens en synchronisatie

- Lokaal eerst: `localStorage['samenThuisDataV2']`. Herstelpaden (beschadigde data, back-up vóór herstel) in `data-core.js`.
- Twee syncroutes (bestaand, ongewijzigd):
  - **Legacy**: één versleutelde payload in `household_data` (anon, R1 — zie `docs/SECURITY.md`).
  - **Account**: per top-level onderdeel een versleutelde rij in `household_state`, schrijven via RPC `put_household_state` met versiecontrole. Conflict → gebruiker kiest per onderdeel; nooit stil overschrijven.
- Versleuteling client-side: AES-GCM-256, sleutel via PBKDF2-SHA256 (250.000 iteraties) uit de huishoudcode.
- Nieuw onderdeel `nutrition` reist automatisch mee in beide routes, in back-ups en in herstel. Zie `docs/DATA_MODEL.md`.
- **Automatisch samenvoegen (nieuw):** beide routes bewaren lokaal de laatst gesynchroniseerde versie als basis. Wijzigen beide huisgenoten hetzelfde onderdeel (bijv. allebei een boodschap toevoegen), dan voegt `household-sync-core.js` (`merge3`/`mergeSection`/`mergeData`) de wijzigingen samen: lijsten op `id`, objecten per sleutel, tekstlijsten als verzameling, verwijderen aan één kant wordt gerespecteerd, gewijzigd-versus-verwijderd houdt het item. Alleen als hetzelfde veld aan beide kanten anders is gewijzigd, vraagt de app een keuze; daarbij is **Beide samenvoegen** de aanbevolen optie (bij echte veldconflicten wint dan de cloudversie, de laatst opgeslagen versie van de huisgenoot). Herstelde back-ups (`hold`) worden nooit automatisch samengevoegd. Ophalen gebeurt bij openen, bij terugkeren naar de app, bij `online` en elke 30 s zolang de app zichtbaar is.
- Gezamenlijk versus persoonlijk: huishouddata in `samenThuisDataV2`/`household_state` (leden huishouden); persoonlijke voorkeuren en profiel in `personal_preferences` (alleen eigenaar, RLS). Voeding is huishouddata; persoonlijke voeding is buiten scope (Sportapp).

## 4. Externe diensten

Volledig register: `docs/API_INTEGRATIONS.md`. Principe (centraal `INTEGRATIONS.md`): publieke API's zonder sleutel rechtstreeks uit de browser (Open-Meteo, Open Food Facts, RDW, CBS); API's met sleutel alleen via een Edge Function met JWT-controle (NED, PrijsProfeet, Tankerkoenig).

## 5. AI

Volgorde volgens centrale ADR 0008: regelgebaseerd → WebLLM → Ollama. In Samen Thuis is alleen regelgebaseerd geïmplementeerd (o.a. de handmatig te starten *Voedingscontrole*). WebLLM en Ollama zijn voor Samen Thuis niet goedgekeurd (CSP-hosts en modellicenties eerst, fase F6) en dus niet gebouwd. De Sport & Training-AI-functie blijft een placeholder die altijd 503 geeft.

## 6. Bewust niet in Samen Thuis

| Onderwerp | Eigenaar volgens centrale documentatie | Wat hier wel staat |
|---|---|---|
| Web Push / pushmeldingen | Hub (I-4, fase F6); koppeling Samen Thuis → Hub via I-9, later en opt-in | Inbox in de app (ongewijzigd) |
| Herinneringen buiten Samen Thuis | Uitgesteld (ADR 0018) | Routines, agenda, inbox |
| Technische status, energie-/externe-datadashboards | Hub (status) — energie: geen eigenaar vastgelegd | Bestaande NED-functie via Edge Function (ongewijzigd) |
| Receptenbeheer | Osta (extern) | Alleen-lezen receptkopieën via import/export + voedingsannotaties (ADR 0001 Samen Thuis) |
| Persoonlijke voeding, lichaamsgegevens | Sportapp | Voedingsplanning voor het huishouden, per portie (ADR 0001 Samen Thuis) |
| OAuth 2.1 / SSO | Alleen spike in Hub (ADR 0017); Samen Thuis doet niet mee | Eigen REST-authwrapper, ongewijzigd |
| Accountverwijdering/data-export ecosysteem | Opgeschort (ADR 0019) | Bestaande JSON-back-up |
