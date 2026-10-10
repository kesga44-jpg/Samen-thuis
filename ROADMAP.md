# Samen Thuis — roadmap

## Gereed

- Local-first dashboard en pagina's voor taken, agenda, challenges, programma's, weekmenu, boodschappen, acties, voorraad, woning, auto, budget, date ideeën, reizen, extra's en instellingen.
- Dashboardonderdelen tonen, verbergen en ordenen.
- Lokale JSON-back-up en herstel; bestaande localStorage-sleutel blijft behouden.
- Prijzen importeren en exporteren.
- Optionele Open-Meteo-weerweergave en BrainyQuote-feed met lokale cache.
- Optionele versleutelde Supabase-synchronisatie (zie de beperkingen en setup in `ARCHITECTURE.md`).
- Licht/donker thema, responsieve styling, feedbackmeldingen en reduced-motion ondersteuning.
- API-foutafhandeling, back-upvalidatie en unit-tests.
- Basis offline-cache voor statische bestanden via een service worker.

## Nog te doen

- Veilige Supabase-authenticatie en toegangsbeleid voordat synchronisatie voor meerdere gebruikers wordt ingezet.
- Pushnotificaties en eventueel een native mobiele wrapper, als daar behoefte aan ontstaat.
- Uitbreiding van paginafuncties en geautomatiseerde browser-/toegankelijkheidstests.
