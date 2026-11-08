# Samen Thuis β – open databronnen

Ingebouwd: PrijsProfeet, Open Food Facts v3, Open Prices, Open-Meteo, RDW Open Data, CBS pompprijzen, Nationaal Energie Dashboard en data.overheid.nl.

## NED activeren
Maak een gratis NED API-key en zet hem alleen als Supabase secret:

    npx supabase secrets set NED_API_KEY=JOUW_NED_KEY
    npx supabase secrets set ALLOWED_ORIGINS=https://kesga44-jpg.github.io
    npx supabase functions deploy data-sources

> Sinds PR-8 (R7) controleert de functie zelf de gebruikers-JWT, CORS-origin, verzoekgrootte en een limiet per gebruiker
> (`supabase/functions/_shared/guard.ts`). Deploy **zonder** `--no-verify-jwt`. Alleen als de CORS-preflight dan aantoonbaar
> door de gateway wordt geweigerd, is `--no-verify-jwt` een bewuste keuze van de eigenaar; de functie blijft dan via de
> eigen JWT-controle afgeschermd. Niet uitvoeren zonder akkoord (geen productiewijziging zonder toestemming).

## Folders
Er is geen betrouwbare officiële gratis open API gevonden die hetzelfde brede niet-supermarkt-folderaanbod als AlleFolders aanbiedt. Daarom is bewust geen scraper ingebouwd. Supermarktaanbiedingen lopen via PrijsProfeet.

## Privacy
Weer gebruikt alleen de coördinaten die je zelf invult. RDW krijgt alleen het kenteken dat je zelf opslaat. Externe bronnen worden op verzoek geladen.
