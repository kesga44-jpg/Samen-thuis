# Samen Thuis

Het gezamenlijke thuisdashboard van Kees en Daphne: planning, huishouden, weekmenu en voeding, boodschappen, voorraad, financiën, reizen, challenges en (tot poort G-SPORT) Sport & Training. Statische PWA in vanilla JavaScript, zonder buildstap; werkt offline en synchroniseert versleuteld via Supabase.

Onderdeel van het persoonlijke ecosysteem (`kesga44-jpg/personal-ecosystem`). Samen Thuis blijft een zelfstandige app; de centrale architectuur en besluiten zijn leidend.

## Snel starten

```bash
python3 -m http.server 8080      # open http://localhost:8080
node --test *.test.js            # tests (SQL-tests: PostgreSQL en niet-root)
```

Meer: [installatie en configuratie](docs/INSTALLATION.md) · [test en release](docs/TESTING_AND_RELEASE.md).

## Documentatie

| Document | Inhoud |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Opbouw, navigatie, sync, plaats in het ecosysteem |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | `samenThuisDataV2`, nieuw onderdeel `nutrition`, database |
| [docs/API_INTEGRATIONS.md](docs/API_INTEGRATIONS.md) | Register externe diensten, limieten, Osta-onderzoek |
| [docs/SECURITY.md](docs/SECURITY.md) | Beveiligingsaudit, privacy, CSP-voorstel |
| [docs/MIGRATIONS.md](docs/MIGRATIONS.md) | Client- en databasemigraties, Edge-deploy |
| [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | Wat is gebouwd/getest, PR-indeling, open besluiten |
| [docs/adr/](docs/adr/) | Besluiten specifiek voor Samen Thuis |
| [CHANGELOG.md](CHANGELOG.md) | Wijzigingen |
| [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) | Regels voor AI-assistenten |

## Belangrijkste afspraken

- Gegevens staan lokaal in `samenThuisDataV2` en reizen per onderdeel versleuteld mee in de accountsync; nieuwe velden zijn altijd additief.
- Wijzigingen van beide huisgenoten worden automatisch samengevoegd; alleen als hetzelfde veld op beide apparaten anders is gewijzigd, vraagt de app een keuze (aanbevolen: **Beide samenvoegen**). Nieuwe wijzigingen komen binnen bij openen, bij terugkeren naar de app en elke 30 seconden.
- Het budget gebruikt één financiële ledger in integer centen. Inkomstenbronnen, verdelingsregels en terugkerende vaste lasten staan in dezelfde versleutelde huishoudgegevens. Verwachte betalingen reserveren alleen saldo; een uitgave ontstaat pas na bevestiging van de daadwerkelijke betaling.
- Externe API's alleen op verzoek van de gebruiker; sleutels nooit in de frontend (alleen als Supabase-secret achter een Edge Function met JWT-controle).
- Externe bibliotheken alleen exact gepind met SRI (`cdn-libs.js`).
- Samen Thuis beheert de voedingsplanning; **Osta is de primaire plek voor recepten** (Samen Thuis importeert en exporteert alleen). Persoonlijke voeding en gezondheidsgegevens horen bij de Sportapp ([ADR 0001](docs/adr/0001-voedingsplanning-in-samen-thuis.md)).

## Stijl

De build gebruikt `styles.css` met comments per pagina en onderdeel (basis, Vandaag, Agenda, Weekmenu, Boodschappen, Huishouden, Voorraad, Reizen, Date ideeën, Woning, Budget, Instellingen, import/synchronisatie, thema's, mobiele navigatie, responsive gedrag), aangevuld met `css/*.css` per module. Onderaan `styles.css` staat één kleurcontract: lichte oppervlakken krijgen donkere tekst en donkerblauwe oppervlakken lichte tekst. De mobiele navigatie en het bewaren van de horizontale positie blijven onderdeel van de app.

## Tests en CI

GitHub Actions (`.github/workflows/tests.yml`) draait bij elke pull request en push naar `main`:

- syntaxcontrole (`app.js` en de nieuwe modules) en een controle op Node ≥ 22.18;
- `node --test *.test.js` op Node.js 22 (Ubuntu 24.04), inclusief SQL-tests op een tijdelijke lokale PostgreSQL. De workflow faalt als PostgreSQL ontbreekt, zodat die tests niet ongemerkt wegvallen;
- vier importtests (XLSX, XLS, DOCX, OCR) worden overgeslagen omdat `xlsx`, `mammoth` en Tesseract geen Node-afhankelijkheid van de repository zijn;
- de workflow heeft alleen leesrechten, gebruikt geen secrets en maakt geen verbinding met Supabase.

Optioneel lokaal: `node e2e/smoke.mjs` (Playwright; 375/768/1280 px en offline), `node e2e/sync-merge.mjs` (twee apparaten), `node e2e/import-browser.mjs` (documentimport en OCR) en `node scripts/verify-sri.mjs` (SRI-hashes tegen het CDN).
