# API-integratieregister Samen Thuis

Centraal register: `personal-ecosystem/API_CATALOG.md` en `API_LIMITS.md`. Dit is de Samen Thuis-specifieke stand na deze wijzigingsset (2026-11-08).

**Status:** ✅ werkt in code en eerder in gebruik · 🆕 nieuw in deze set · 🔒 aangescherpt · 📄 alleen gedocumenteerd/voorbereid · ⛔ niet in Samen Thuis
**Verificatie:** "Lokaal getest" = unit-/browsertests met nagebootste antwoorden. **Geen enkele API is in deze omgeving live aangeroepen** (uitgaand verkeer naar deze hosts was geblokkeerd). Productiegedrag is dus niet geverifieerd.

## 1. Overzicht

| Dienst | Doel | Status | Sleutel | Aanroep | Limiet / afspraak | Fallback | Test |
|---|---|---|---|---|---|---|---|
| Supabase Auth/REST (project A) | Accounts, accountsync, voorkeuren, financiële bevestigingen | ✅ | Publishable key (publiek bedoeld) | Browser, gebruikers-JWT | Auth: 2 mails/uur, 30 signins/5 min/IP | Lokaal doorwerken | Bestaand + `nutrition-integration.test.js` (sync) |
| Supabase Edge `grocery-prices` (PrijsProfeet) | Aanbiedingen | 🔒 JWT + CORS-allowlist + limiet | Optioneel `PRIJS_PROFEET_API_KEY` (secret) | Browser → Edge (gebruikers-JWT) | 30/min/gebruiker (best-effort), body ≤ 8 kB | Cache 20 termen, melding | `edge-guard.test.js` |
| Supabase Edge `data-sources` (NED, Tankerkoenig) | Energiedata, Duitse brandstofprijzen | 🔒 idem | `NED_API_KEY`, `TANKERKOENIG_API_KEY` (secrets) | Browser → Edge | 20/min/gebruiker | Functie toont fout | `edge-guard.test.js` |
| Supabase Edge `sport-training` | AI-placeholder | ✅ ongewijzigd (JWT al verplicht, CORS `*`) | — | Browser → Edge | — | Altijd 503 | Bestaand |
| Open-Meteo Forecast, Air Quality, Geocoding | Weer, pollen, luchtkwaliteit | ✅ + 🆕 bronvermelding | Geen | Browser | Cache 30 min (bestaand); geen achtergrondpolling | Laatste cache + "offline" | `integrations-policy.test.js` |
| **Open Food Facts** (`world.openfoodfacts.org`) | Product, barcode, voedingswaarden, ingrediënten, allergenen | 🆕 actief in de app (stond eerder alleen in ongebruikte `sources.js`) | Geen | Browser, alleen na klik | Product max 10/min, zoeken max 6/min (OFF: 15 resp. 10/min/IP); cache 30 dagen, max 200 producten | Cache (ook verlopen) + handmatig etiket | `food-facts-core.test.js` |
| Osta | Receptenbeheer | 🆕 uitwisseling via bestanden/tekst | — | Geen netwerk | — | — | `osta-exchange-core.test.js` |
| RDW Open Data (Socrata) | Voertuig op kenteken | ✅ ongewijzigd | Geen (app-token optioneel, niet ingesteld) | Browser, op verzoek | Gedeelde throttling-pool | Handmatig | `integrations-policy.test.js` (geen nieuwe koppeling) |
| CBS StatLine, data.overheid.nl | Pompprijzen, datasets | ✅ ongewijzigd (alleen in ongebruikte `sources.js`/beta) | Geen | — | — | — | — |
| BrainyQuote | Citaat van de dag | 🔒 extern **script verwijderd** (R4); RSS-tekst optioneel, ge-escaped | Geen | Browser | 1×/dag | Lokale gedachte van de dag | `quotes-core.test.js`, `cdn-libs.test.js` |
| jsDelivr CDN (pdf.js 4.10.38, mammoth 1.12.2, SheetJS 0.18.5, tesseract.js 5.1.1) | Universele import | 🔒 exact gepind + SHA-384 (R5) | — | Browser, bij import | — | Melding "bibliotheek niet geladen" | `cdn-libs.test.js` |
| Web Push | Meldingen | ⛔ | — | — | — | Inbox in de app | `integrations-policy.test.js` |
| WebLLM / Ollama | Lokale AI | ⛔ (nog niet goedgekeurd voor Samen Thuis) | — | — | — | Regelgebaseerd | `integrations-policy.test.js` |
| Betaalde AI-API's | — | ⛔ uitgesloten (ADR 0008) | — | — | — | — | `integrations-policy.test.js` |

## 2. Open Food Facts — details

- **Endpoints:** `GET /api/v2/product/{barcode}.json?fields=…` en `GET /cgi/search.pl?search_terms=…&search_simple=1&json=1&page_size=10`. Bron: [OFF API-documentatie](https://openfoodfacts.github.io/openfoodfacts-server/api/) (gelezen 2026-11-08): product 15 req/min/IP, zoeken 10 req/min/IP, "don't use it for a search-as-you-type feature", overschrijden kan een IP-ban opleveren.
- **Velden:** `code, product_name(_nl), brands, quantity, serving_size, serving_quantity, nutriments, ingredients_text(_nl), allergens_tags, traces_tags, nutriscore_grade, nova_group, no_nutrition_data, states_tags, last_modified_t`. Geen afbeeldingen (voorkomt CC BY-SA-verplichtingen en extra verkeer).
- **Voedingswaarden:** energie (kcal), vet, verzadigd vet, koolhydraten, suikers, vezels, eiwit, zout; per 100 g/ml én per portie. Ontbreekt per portie maar zijn portiegewicht en per 100 g bekend, dan berekend en gemarkeerd als afgeleid. Energie alleen in kJ → omgerekend (÷ 4,184, afgeleid). Zout ontbreekt maar natrium bekend → × 2,5 (afgeleid).
- **Ontbrekend ≠ 0:** afwezig of leeg = `null` ("onbekend"); een expliciete 0 blijft 0. Allergenen: lege lijst = "onbekend", tenzij de ingrediëntenlijst bekend is ("geen opgegeven, controleer het etiket").
- **Kwaliteit:** score 0–100 (voedingswaarden 60 %, ingrediënten 20 %, allergenen 10 %, portie 10 %) met concrete meldingen.
- **Fouten:** `invalid` (barcode/controlecijfer), `not-found`, `rate-limit`, `server`, `network`, `timeout` (10 s). Bij netwerk-/serverfout wordt een eerder (ook verlopen) cache-exemplaar gebruikt met waarschuwing.
- **Voorwaarden:** database ODbL, inhoud DbCL; bronvermelding staat bij elke weergave. OFF vraagt een eigen `User-Agent` (`AppName/Versie (contact)`); browsers staan het zetten van die header **niet** toe en de documentatie geeft geen browserrichtlijn → *open punt*: eigenaar vult het OFF "API usage form" in en bevestigt dat browsergebruik zonder eigen User-Agent acceptabel is.
- **Privacy:** alleen de barcode of zoekterm verlaat het apparaat; geen account, geen persoonsgegevens.

## 3. Osta — onderzoek en uitwisselingscontract

- **Bevinding (2026-11-08):** Osta ("Save & Share Recipes", iPhone/iPad/Mac) noemt importeren van websites/Instagram/TikTok, delen met anderen, gedeelde boodschappenlijsten; voedingswaarden als **betaalde** Premium-functie. **Geen** API, export of webversie vermeld. Bron: App Store-pagina (id6739286231). Niet getest in de app zelf.
- **Daarom:** geen Osta-API aangenomen. Contract `samen-thuis.recipes` versie 1 (JSON), plus lezen van gedeelde Osta-tekst en schema.org/Recipe JSON-LD (de standaard die recepten-websites gebruiken en die receptenapps doorgaans importeren — of Osta schema.org-bestanden kan importeren is **niet geverifieerd**).
- **Rolverdeling (ADR 0001):** Osta is de primaire plek voor recepten. Samen Thuis importeert en exporteert alleen; geen formulier om recepten te maken, receptinhoud alleen-lezen.
- **Dubbelen:** herkend op bronverwijzing (`externalRef`), id, titel + ingrediënten, of titel uit dezelfde bron met precies één kandidaat. Alleen titel bij een andere bron of meerdere kandidaten = twijfelgeval: standaard aparte kopie, bijwerken alleen op verzoek.
- **Herimport — bron wint:** titel, porties, ingrediëntenlijst, bereiding, tags en opgegeven voedingswaarden komen uit de nieuwe import. Wat de bron niet (meer) levert, blijft behouden en wordt in het voorbeeld gemeld; vervallen ingrediënten en daarmee vervallen productkoppelingen worden expliciet genoemd. Annotaties van Samen Thuis (productkoppeling, eigen grammen, planningsporties) blijven staan.
- **Formaat v1** (`exportBundle`): `{ format, version: 1, exportedAt, app, note, recipes[ …recipe, checksum ], products[] }`. Nieuwere versies worden geweigerd met de melding "werk Samen Thuis bij".

## 4. Onderzocht en niet toegevoegd

| Onderwerp | Bevinding | Eigenaar / vervolg |
|---|---|---|
| Socrata (RDW) | Bestaande kentekenopvraging in Samen Thuis (✅ in centrale catalogus). Optioneel app-token: niet ingesteld. | Samen Thuis (bestaand). Geen nieuwe Socrata-datasets zonder akkoord. |
| NED | Bestaande functie via Edge Function `data-sources` (✅ centraal, bron alleen evcc-docs). Nu achter JWT-controle. | Samen Thuis (bestaand). Een energiedashboard is in geen app vastgelegd → **besluit nodig** (Hub toont alleen technische status). |
| evcc | Alleen genoemd als bron voor NED-documentatie; geen integratie in enige app. | Niet vastgelegd. Lokale software (eigen netwerk); als ooit gewenst: aparte ADR. |
| Open-Meteo | Hoort aantoonbaar bij Samen Thuis (Vandaag, Weer, kledingadvies, pollen). Alleen bronvermelding toegevoegd. | Samen Thuis; 🟢 Sportapp later voor buitentraining. |
| Web Push | Centraal: I-4 Hub (fase F6, VAPID-key als Edge-secret); I-9 Samen Thuis → `hub.notify()` "later, opt-in, losse PR na akkoord". Inbox heeft een push-voorkeur (standaard uit) zonder implementatie. | Hub. **Besluit nodig** of Samen Thuis eigen push krijgt of via I-9. Benodigd ontwerp in `docs/IMPLEMENTATION_STATUS.md` § 5. |
| OAuth 2.1 | Centraal ADR 0017: alleen spike in Hub; "Samen Thuis en Coach doen niet mee". | Hub. Samen Thuis: eigen sessies; tokens niet app-gebonden (restrisico B-13). |
| WebLLM / Ollama | Centraal gepland voor Sportapp/SIDEQUEST; CSP-hosts en modellicenties eerst. | Niet voor Samen Thuis zonder besluit. |

## 5. Benodigde configuratie (eigenaar)

| Item | Waar | Nodig voor |
|---|---|---|
| `ALLOWED_ORIGINS` (bijv. `https://kesga44-jpg.github.io`) | Supabase Edge Function secret | `grocery-prices`, `data-sources` na redeploy |
| `NED_API_KEY`, `TANKERKOENIG_API_KEY`, optioneel `PRIJS_PROFEET_API_KEY` | Supabase secrets (bestaand) | Bestaande functies |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Automatisch aanwezig in Supabase Edge runtime (volgens Supabase-documentatie; niet geverifieerd in dit project) | JWT-controle in `guard.ts` |
| OFF API usage form | openfoodfacts.org | Voorwaarden OFF |
| Redeploy Edge Functions | Supabase CLI, **alleen na akkoord** | PR-8 actief maken |
