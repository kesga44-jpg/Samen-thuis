# Samen Thuis β installeren

## 1. Maak een aparte GitHub-repository

Aanbevolen naam:

`Samen-thuis-beta`

Upload **alle bestanden en mappen uit dit pakket** naar de root van die repository.

Gebruik niet de huidige productie-repository als je beide apps tegelijk via GitHub Pages wilt kunnen openen. Een aparte repository geeft automatisch een aparte Pages-URL en voorkomt verwarring.

## 2. Zet GitHub Pages aan

In de beta-repository:

1. **Settings**
2. **Pages**
3. **Build and deployment → Deploy from a branch**
4. Branch: **main**
5. Map: **/(root)**
6. **Save**

Na publicatie kun je de beta in Safari openen en **Zet op beginscherm** kiezen. Het icoon en de naam zijn bewust anders: `Samen Thuis β`.

## 3. Supabase tabel

Als je productie-app al met hetzelfde Supabase-project synchroniseert en `household_data` al bestaat, hoef je meestal niets te doen.

Anders: open **Supabase → SQL Editor** en voer `supabase/schema.sql` één keer uit.

De beta maakt een ander record-id dan productie, ook wanneer je dezelfde huishoudcode gebruikt.

### Persoonlijke accentkleur en dashboardindeling

Voor synchronisatie van persoonlijke voorkeuren voer je daarnaast `supabase/migrations/20261012000000_personal_preferences.sql` uit via de Supabase SQL Editor. Schakel e-mail/wachtwoordaanmelding in onder **Supabase → Authentication → Providers** en stel de Site URL/redirect-URL in op de gepubliceerde app. Iedere gebruiker meldt zich aan met een eigen account; de huishoudcode blijft uitsluitend voor gedeelde huishoudgegevens.

De migratie maakt een afzonderlijke tabel met RLS-beleid dat alleen de ingelogde gebruiker toestaat zijn eigen voorkeuren te lezen en te wijzigen. Zonder migratie of account blijven de accentkleur en dashboardindeling alleen op dit apparaat bewaard.

## 4. Prijsfunctie deployen

De supermarktprijzen worden niet rechtstreeks vanuit de browser opgehaald. Hiervoor zit een Supabase Edge Function in:

`supabase/functions/grocery-prices/index.ts`

Met de Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref vwfuetxgapzfivydzhxc
npx supabase functions deploy grocery-prices --no-verify-jwt
```

De beta gebruikt daarna automatisch:

`<jouw-supabase-url>/functions/v1/grocery-prices`

### PrijsProfeet-configuratie en verificatie

De bestaande Edge Function gebruikt het endpoint en de parameters die al in de repository aanwezig waren (`/api/v1/search`, `q`, `page_size` en `promotion_status=active`). De aanbiedingenpagina zoekt alleen na een product- of merkzoekopdracht; de browser verstuurt de aanvraag naar deze Edge Function, niet rechtstreeks naar de aanbieder.

De officiële documentatie (`https://www.prijsprofeet.nl/supermarkt-aanbiedingen-api/` en `https://www.prijsprofeet.nl/docs`) kon tijdens deze wijziging niet worden opgehaald. Daarom zijn de actuele authenticatie-eisen, API-limieten, gebruiksvoorwaarden en licentie niet onafhankelijk bevestigd. De bestaande Edge Function ondersteunt optioneel `PRIJS_PROFEET_API_KEY` als Supabase secret; voeg alleen een sleutel toe als de provider die voor het gebruikte account vereist. Zet nooit een provider-secret in de frontend of repository en controleer de actuele voorwaarden vóór productiegebruik.

De nieuwe zoekmodus vraagt maximaal 20 resultaten per zoekopdracht op en toont PrijsProfeet als bron. De app gebruikt verder dezelfde bestaande zoekintegratie voor eigen prijswaarnemingen. Dit is geen bevestiging dat een gratis abonnement of onbeperkte toegang beschikbaar is.

### Pepper

Er is geen Pepper-integratie of scraper. De officiële Nederlandse API/feed/partnerdocumentatie en de toepasselijke toegangsvoorwaarden konden niet worden geverifieerd. Aanbiedingen kunnen handmatig aan de bestaande boodschappenlijst worden toegevoegd.

## 5. Bestaande gegevens kopiëren naar beta

In je huidige productie-app:

1. maak een JSON-back-up;
2. open `Samen Thuis β`;
3. ga naar **Instellingen**;
4. kies **Productie-back-up kopiëren**;
5. selecteer de productie-back-up.

De gegevens worden omgezet naar het beta-schema. Je originele productie-app wordt niet gewijzigd.

## 6. Bodemprijzen testen

1. Ga naar **Voorraad**.
2. Voeg bijvoorbeeld `Calvé pindakaas 350g` toe.
3. `Prijs volgen` staat bij nieuwe voorraadproducten standaard aan.
4. Vul eventueel in:
   - Goede prijs: bijvoorbeeld `2.49`
   - Bodemprijs: bijvoorbeeld `1.99`
5. Sla op.
6. Kies **Prijzen vernieuwen**.

De app toont ook de productmatch. Klopt die niet, druk op het potlood en maak de zoekterm specifieker.

De pagina **Aanbiedingen** zoekt op productnaam of merk, filtert gevonden resultaten op supermarkt/categorie, sorteert op prijs/korting/einddatum en ondersteunt favorieten en toevoegen aan Boodschappen. Als de Edge Function of aanbieder ontbreekt, verschijnt een foutmelding; de app toont geen voorbeelddata als echte aanbiedingen.

## 7. Automatisch verversen

Onder **Instellingen → Voorraad & prijzen** kun je kiezen voor 6, 12, 24 of 48 uur.

Een PWA op iOS kan niet betrouwbaar zelfstandig blijven draaien wanneer hij volledig gesloten is. Daarom controleert deze beta automatisch:

- bij openen;
- wanneer de app weer actief wordt;
- wanneer internetverbinding terugkomt;
- en alleen als de vorige prijscontrole oud genoeg is.

Dat voorkomt onnodige API-calls en houdt de zichtbare prijzen actueel wanneer je de app gebruikt.

## 8. Lokale test op laptop

ES-modules werken het betrouwbaarst via HTTP. Start in de appmap bijvoorbeeld:

```bash
python3 -m http.server 8000
```

Open daarna `http://localhost:8000`.
