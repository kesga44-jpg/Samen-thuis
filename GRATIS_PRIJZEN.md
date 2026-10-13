# PrijsProfeet in Samen Thuis β

## Huidige projectintegratie

- De Edge Function gebruikt het bestaande `GET /api/v1/search`-endpoint met `q`, `page_size` en `promotion_status=active`.
- De functie stuurt `X-API-Key` alleen als de Supabase secret `PRIJS_PROFEET_API_KEY` is ingesteld.
- De browser vraagt aanbiedingen via de Edge Function op en bevat geen provider-secret.
- De aanbiedingenzoekfunctie vraagt maximaal 20 resultaten op en cachet zoekresultaten lokaal voor 20 minuten.

Dit beschrijft de code in deze repository; het verifieert niet dat dit momenteel door de provider wordt aangeboden of toegestaan.

## Ongeverifieerde providerdetails

- De officiële pagina's `https://www.prijsprofeet.nl/supermarkt-aanbiedingen-api/` en `https://www.prijsprofeet.nl/docs` waren niet bereikbaar vanuit de onderzoeksomgeving.
- Actuele vereisten voor authenticatie, limieten, tarieven, licentie en verplichte bronvermelding zijn daarom niet onafhankelijk bevestigd.
- Controleer de actuele provider-documentatie en voorwaarden voordat je de functie inzet. Als een sleutel nodig is, configureer die uitsluitend als Supabase secret.

## Bodemprijzen en beperkingen

Samen Thuis bewaart eigen prijswaarnemingen van producten die gebruikers zelf volgen. Bij minimaal vier verschillende prijzen voor dezelfde productmatch kan de app zelf goede-prijs- en bodemprijsgrenzen afleiden. Dit is geen externe prijsgeschiedenis.

Pepper/ Pepperdeals is niet geïntegreerd. Een officiële Nederlandse API/feed of toegestane partnerintegratie kon niet worden geverifieerd; er wordt niet gescrapet. Gebruik de bestaande handmatige invoer als een aanbieding niet via PrijsProfeet beschikbaar is.
