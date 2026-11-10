# PrijsProfeet en prijswaarnemingen

## Integratie en voorwaarden

De productie-PWA vraagt actuele aanbiedingen via de bestaande Supabase Edge Function `grocery-prices`. Die gebruikt `GET https://www.prijsprofeet.nl/api/v1/search` met `q`, `page_size` en `promotion_status=active`; categorieën komen van `GET /api/v1/categories`. De API-key is optioneel en wordt alleen als Supabase-secret `PRIJS_PROFEET_API_KEY` gelezen. De browser bevat geen provider-key. De Edge Function stuurt een beschrijvende `User-Agent`.

De officiële [API-documentatie en OpenAPI-specificatie](https://github.com/PrijsProfeet/supermarkt-api) en de [API-voorwaarden](https://www.prijsprofeet.nl/api-voorwaarden) zijn op 2026-11-09 gecontroleerd:

- De publieke zoek-, aanbiedingen- en categorie-endpoints zijn gratis en werken zonder registratie of key. Een gratis key is optioneel.
- Zoeken en productdetails zijn beperkt tot 120 verzoeken per minuut per IP; bulk-endpoints tot 30 per minuut per IP. Een gratis key heeft volgens de voorwaarden een eigen limiet van 150 verzoeken per minuut. Limieten kunnen wijzigen en er is geen beschikbaarheidsgarantie.
- Gratis gebruik vereist zichtbare bronvermelding naar PrijsProfeet op elk scherm met de gegevens. De app toont die bron bij de aanbiedingen.
- De gratis API bevat promoties, geen volledige reguliere assortimenten en geen historische prijsreeks. `GET /api/v1/products/{id}/price-history` is Pro en wordt niet gebruikt.
- Een zoekrespons kan `approximate: true` of `unmatched_terms` bevatten. Dat is een fuzzy match, geen betrouwbare productidentiteit. Voor automatische historische grenzen worden alleen expliciet exacte zoekresultaten met productidentificatie en verpakkingsmaat gebruikt.

Bronnen zijn gecontroleerd in de providerrepository; de live API kon vanuit deze omgeving niet worden aangeroepen. Dit bevestigt dus geen actuele bereikbaarheid of productiegedrag.

## Eigen historische waarnemingen (niet-geladen bèta-tracker)

De historische tracker in `js/prices.js` gebruikt geen externe historische prijsdienst. Deze module wordt niet door `index.html` geladen; de productie-PWA toont actuele aanbiedingen en handmatige prijsreferenties, maar gebruikt deze tracker niet. De bèta-tracker bewaart eigen waarnemingen uit actuele aanbiedingen. Per nieuwe waarneming worden, als de bron ze levert, prijs, datum, bron, retailer, product-ID, EAN, verpakkingsmaat en eenheidsprijs bewaard.

Een bodemprijs of goede-prijsgrens wordt alleen berekend na minimaal vier verschillende geldige prijswaarden van dezelfde betrouwbare product- en verpakkingsmatch. Percentages alleen leveren geen prijsclassificatie op. Handmatig ingestelde grenzen blijven leidend. Ontbrekende bron-, match- of verpakkingsinformatie bij bestaande historische regels maakt die regels ongeschikt voor automatische berekening; de regels worden niet verwijderd of herschreven. Mislukte of begrensde verzoeken (429) bewaren de laatst bekende prijs en historie.

Open Prices staat in een losse barcode-opvraging in `js/sources.js`, maar die bèta-code wordt niet door `index.html` geladen. Open Prices voedt daarom geen productieprijswaarnemingen en wordt in deze wijziging niet toegevoegd. Pepper/ Pepperdeals wordt niet gescrapet; gebruik handmatige invoer wanneer een aanbieding ontbreekt.
