# PR-1: veilige opschoning van historische artefacten

Status: voorbereid, niet als destructieve delete uitgevoerd in deze API-sessie. De GitHub-repo API die hier beschikbaar is ondersteunt create/update, maar geen directe bestandsswijzing via DELETE. Deze PR legt daarom het veilige, goed te keuren opschoonplan vast en geeft een expliciete "delete set" die na goedkeuring in een repositoryomgeving met delete-ondersteuning kan worden toegepast.

## Doel

Het repository kleiner en overzichtelijker maken zonder functionaliteit te verliezen. De scope is beperkt tot historische artefacten, dubbele modules en niet meer gebruikte documenten die niet door de actieve app of tests worden geladen.

## Voorwaarde voor uitvoering

- Geen actieve imports, routes, assets, service workers, tests of documentatie mogen worden gebroken
- Geen databaseobjecten of gebruikersgegevens mogen worden verwijderd
- Geen module-eigenaarschap mag worden gewijzigd zonder expliciet akkoord
- Alleen bestanden die aantoonbaar niet meer worden gebruikt worden verwijderd

## Veiligste eerste delete-set (voorstel)

### A. Veilig direct te verwijderen

- `index.ts` — leeg bestand, geen inhoud, geen imports
- `js/app.js` — duplicaat van root `app.js`, niet in `index.html` gebruikt
- `js/importer.js` — duplicaat van root `importer.js`, niet in `index.html` gebruikt
- `js/prices.js` — duplicaat van root `prices.js`, niet in `index.html` gebruikt
- `js/sources.js` — duplicaat van root `sources.js`, niet in `index.html` gebruikt
- `js/store.js` — duplicaat van root `store.js`, niet in `index.html` gebruikt
- `js/sync.js` — duplicaat van root `sync.js`, niet in `index.html` gebruikt
- `js/utils.js` — duplicaat van root `utils.js`, niet in `index.html` gebruikt
- `styles-2026-09-18.css` — historische stijlversie, niet gekoppeld in `index.html`
- `beleggen-ontwerpdossier.bundle` — bundel voor ontwerpdossier, geen runtime role
- `samen-thuis-rc1-prs.bundle` — bundel artifact, geen runtime role
- `samen-thuis-update-v16.js` — historische migratiehelper, niet actief in current flow
- `patches/` — historische patch-archieven; geen runtime use
- `docs/personal-ecosystem-voeding.patch` — historisch/architectuurpatch, geen runtime use
- `beschrijvingen/` — doublure van `docs/pr/`
- `beschrijvingen-definitief/` — doublure van `docs/pr/`
- `AUTO_EN_WEER.md` — historische note, geen runtime role
- `AUTO_V16_FUELNEST.md` — historische note
- `BRANDSTOFRADAR_V15.md` — historische note
- `CBS_FIX_V141.md` — historische note
- `DESIGN_V23.md` — historische note
- `GRATIS_PRIJZEN.md` — historische prijsnota, geen runtime use
- `INSTALLATIE_BETA.md` — beta-instructie, geen runtime role
- `INTEGRATIE-STATUS.md` — historische statusversie, niet actueel
- `LEESMIJ-v26-challenges.md` — historisch projectdocument
- `LEESMIJ.md` — historisch document
- `OPEN_DATA_BRONNEN.md` — historische referentielijst, geen runtime role
- `PR-beleggen-ontwerpdossier.md` — historisch ontwerpdossier
- `SLIM_SPAREN.md` — historisch document
- `SPORT-TRAINING.md` — obsolete ontwerpdocument
- `UPDATE_V17.md` — historical update note
- `UPGRADE_NAV5_SYNC.md` — old migration memo
- `UPLOAD_MANIFEST.md` — historical upload note

### B. Verwijderen na gerichte tests

- `sportcoach-core.js` — compat layer; eigenaarschap nog niet formeel overgedragen
- `sportcoach.js` — compat layer; eigenaarschap nog niet formeel overgedragen
- `sportcoach.css` — compat layer; eigenaarschap nog niet formeel overgedragen
- `samen-thuis-update-v26-challenges.js` — legacy challenge compat; eigenaarschap nog niet formeel overgedragen
- `weather-extras.js` — alleen verwijderen na bevestiging dat het niet gekoppeld is aan actieve route of dataflow

## Bewaren en niet verwijderen (actieve kern)

- `app.js`
- `data-core.js`
- `household-sync-core.js`
- `account-sync.js`
- `budget-ledger-core.js`
- `finance-plan-core.js`
- `finance-ui.js`
- `food-facts-core.js`
- `nutrition-core.js`
- `osta-exchange-core.js`
- `sw.js`
- `manifest.webmanifest`
- `css/*`
- `docs/*`
- `supabase/*`
- `e2e/*`
- `*.test.js`

## Verificatie vóór daadwerkelijke verwijdering

Bij elke verwijdering moet worden gecontroleerd:

- Imports in `index.html`, `app.js`, `nav-core.js`, `search.js`, `service worker` en route-configuratie
- Event listeners en registraties
- dynamische imports, module registration, navigation hooks
- build/deploy references
- GitHub Pages asset references
- tests en e2e scripts

## Naleving

Deze PR is opgesteld als eerste, veilige, goedkeurbare stap in de opruiming, zonder destructieve database- of gebruikersgegevenswijzigingen.

Na goedkeuring van deze delete-set kan dezelfde lijst in een omgeving met echte delete-capabilities worden uitgevoerd, zonder dat de kern van Samen Thuis wordt aangetast.
