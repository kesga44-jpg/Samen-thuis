# Samen Thuis — standalone test v2

Zelfstandige, frameworkloze local-first testversie van Samen Thuis. Local-first; synchronisatie via Supabase is optioneel en staat standaard uit (Instellingen: project-URL, publishable/anon key en huishoudcode, lokaal bewaard en versleuteld verstuurd). Weer heeft een eigen pagina (Open-Meteo) en de quote komt van de BrainyQuote RSS met lokale cache. Geen externe JavaScript-bibliotheken. Het dashboard (Vandaag) is volledig samen te stellen via Instellingen (aan/uit en volgorde, lokaal bewaard). De Weer-pagina toont een 7-daagse en een uurgrafiek met temperatuur en neerslag.

## Huidige functies

- Vandaag-dashboard dat je zelf kunt samenstellen en ordenen.
- Taken, agenda, challenges (afvinken), programma's, weekmenu, boodschappen, acties, voorraad, woning, auto, budget, date ideeën, reizen en notities.
- JSON-back-up maken en terugzetten; bestaande `samenThuisV2`-localStoragegegevens blijven behouden.
- Prijzen importeren vanuit CSV-, JSON- of tekstbestanden en exporteren als CSV.
- Optioneel actuele weersinformatie en een 7-daagse/uurlijkse verwachting via Open-Meteo.
- Optionele BrainyQuote-feed met lokale cache.
- Optionele, versleutelde Supabase-synchronisatie; hiervoor is een eigen Supabase-configuratie nodig.
- Licht/donker thema en instellingen om dashboardonderdelen te tonen en te ordenen.

De app biedt geen drag-and-drop voor taken, weekmenu-widget op Vandaag, challenge-streaks of punten. De weerweergave bevat geen UV-index of zonsopkomst/-ondergang. Mobiel staat de navigatie horizontaal bovenaan; er is geen hamburger- of ondernavigatie.

## Nog niet uitgevoerd

- De app heeft geen account- of authenticatielaag voor Supabase. Zie [ARCHITECTURE.md](ARCHITECTURE.md#supabase-synchronisatie) voor de tabel, configuratie en belangrijke beveiligingsbeperkingen voordat je synchronisatie inschakelt.
- Pushnotificaties en een native mobiele wrapper zijn niet geïmplementeerd.
- De lokale back-up is bedoeld als herstelmogelijkheid; synchronisatie is optioneel en vervangt die niet.

## Testen

Open `index.html` of publiceer de repository via GitHub Pages. Voor PWA-gedrag is een HTTPS-hosting zoals GitHub Pages beter dan `file://`.

Lokale data staat onder `samenThuisV2` in localStorage. Via Instellingen kan JSON worden geëxporteerd en geïmporteerd.

## Ontwikkelen en testen

Open `index.html` of publiceer de repository via GitHub Pages. Voor service-worker- en PWA-gedrag is HTTPS-hosting nodig; `file://` ondersteunt dat niet. De eerste installatie vereist een netwerkverbinding om de statische bestanden te cachen. Weer en quotes blijven afhankelijk van hun externe diensten.

Voer unit-tests uit met `npm test` (Node.js 20 of hoger). De app zelf heeft geen bundelstap of runtime-dependencies.
