# Samen Thuis β v1.5 — Brandstofradar

## Ingebouwd
- Vaste gebieden: Rotterdam, Nieuwerkerk aan den IJssel, Utrecht, Delft, Obdam,
  Oud-Beijerland/omgeving, Fijnaart, België nabij Fijnaart en Duitsland (Emmerich/Kleve).
- CBS: nieuwste Nederlandse daggemiddelde.
- fuel-prices.eu Free: actuele landreferenties/min/max voor o.a. Nederland en België.
- Eigen tankhistorie: prijzen die Kees/Daphne zelf invoeren worden per plaats gebruikt.
- Duitsland: actuele E5/E10/diesel-stations via Tankerkönig, max. 25 km, op gebruikersactie.
- Externe knoppen naar ANWB en DirectLease voor actuele Nederlandse stationprijzen.

## Eenmalig voor Duitsland
Maak een gratis Tankerkönig API-key aan en zet hem in Supabase:
Edge Functions → Secrets → Add secret
Naam: TANKERKOENIG_API_KEY
Waarde: jouw key

Deploy daarna opnieuw de Edge Function:
supabase/functions/data-sources/index.ts

De key hoort NIET in GitHub.

## Beperking Nederland/België
Er is in deze versie bewust geen ongedocumenteerde ANWB/DirectLease/Fuelbay API ingebouwd.
Zonder toegestane gratis station-level API toont de radar voor NL/BE:
1. officiële/gratis landreferentie;
2. eigen tankwaarnemingen;
3. knoppen naar ANWB/DirectLease voor live stationprijzen.

Zo voorkomen we scraping of afhankelijkheid van een private endpoint.
