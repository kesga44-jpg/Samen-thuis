# ADR 0001 (Samen Thuis) — Voedingsplanning in Samen Thuis, recepten in Osta

- **Status:** geaccepteerd door de eigenaar (2026-11-08). Centrale registratie in `personal-ecosystem` nog te doen (zie § Gevolgen, patch meegeleverd).
- **Vervangt:** de eerdere versie van deze ADR (voorgesteld, 2026-11-08), die receptinhoud in Samen Thuis bewerkbaar maakte en daarmee een tweede receptenbeheer begon.

## Context

Eerder gekozen rolverdeling (eigenaar):

| Onderwerp | Eigenaar |
|---|---|
| Huishoudelijke weekplanning en voedingsplanning | **Samen Thuis** |
| Receptenbeheer | **Osta** (primaire plek voor recepten) |
| Voedingsinformatie | Uitgebreid beschikbaar, gekoppeld aan producten (in Samen Thuis) |
| AI | Handmatig gestart, geen automatische wijzigingen |

Centrale documentatie (`personal-ecosystem`, peildatum 2026-11-07) wijkt hiervan af of zwijgt:

- `APP_REGISTRY.md` noemt de Sportapp eigenaar van "voeding".
- `API_CATALOG.md` noemt Open Food Facts ✅ voor Samen Thuis (productinfo, voedingswaarden via barcode).
- Osta staat nergens.

Feitelijk over Osta (onderzocht 2026-11-08, App Store-beschrijving): geen gedocumenteerde API, export of webversie; delen als tekst en importeren van websites wel; voedingswaarden zijn een betaalde Premium-functie.

## Besluit

1. **Samen Thuis beheert de voedingsplanning**: weekmenu, koppeling maaltijd → recept, voedingswaarde per portie, boodschappen uit de planning, regelgebaseerde voedingscontrole (alleen handmatig gestart).
2. **Osta blijft de primaire plek voor recepten.** Samen Thuis is geen tweede zelfstandig receptenbeheersysteem:
   - recepten komen alleen binnen via **import** (gedeelde Osta-tekst, schema.org/Recipe, eigen exportformaat);
   - er is **geen** formulier om in Samen Thuis een recept te maken;
   - de **receptinhoud** (titel, porties, ingrediënten, bereiding, tags, notities, door de bron opgegeven voedingswaarden) is in Samen Thuis alleen-lezen;
   - bij opnieuw importeren **wint de bron**; wat de bron niet meer levert, blijft behouden en wordt gemeld (geen verlies van informatie);
   - Samen Thuis mag recepten **exporteren** (eigen formaat en schema.org).
3. **Wat Samen Thuis wél bij een receptkopie vastlegt** (voedingsannotaties, eigendom Samen Thuis): productkoppeling per ingrediënt, grammen waar de bron geen gewicht geeft, aantal porties voor de planning.
4. **Productinformatie en voedingsberekeningen** horen in Samen Thuis: Open Food Facts en handmatig ingevoerde etiketten, per 100 g en per portie, met kwaliteit en het onderscheid onbekend ≠ 0.
5. **Persoonlijke voeding** (inname per persoon, dagdoelen, lichaams- en gezondheidsgegevens, dieetadvies) blijft buiten Samen Thuis (bijzondere persoonsgegevens; Sportapp volgens het centrale register).
6. **AI**: alleen regelgebaseerd en handmatig gestart. Geen automatische wijzigingen aan planning, recepten of producten. Lokale AI (WebLLM/Ollama) pas na een apart besluit.

## Dubbelen en identiteit

| Herkenning | Gevolg |
|---|---|
| Zelfde bronverwijzing (`externalRef`) of id (eigen export) | Bijwerken vanuit bron |
| Zelfde titel en ingrediënten | Ongewijzigd of bijwerken |
| Zelfde titel uit dezelfde bron, precies één kandidaat (Osta-tekst heeft geen vaste id) | Bijwerken vanuit bron |
| Alleen zelfde titel, andere bron of meerdere kandidaten | **Twijfelgeval**: standaard aparte kopie; bijwerken alleen als de gebruiker dat kiest |

## Gevolgen

- Geen nieuwe tabel, bucket of Supabase-wijziging: alles in de bestaande versleutelde huishoudopslag (onderdeel `nutrition`).
- De receptkopie in Samen Thuis kan achterlopen op Osta tot de gebruiker opnieuw importeert. Dat is bewust: geen automatische koppeling zonder API.
- Centrale documentatie aanpassen in een aparte PR in `personal-ecosystem` (meegeleverd als `docs/personal-ecosystem-voeding.patch`):
  - `APP_REGISTRY.md`: Samen Thuis eigenaar van voedingsplanning (huishouden); Sportapp eigenaar van persoonlijke voeding; Osta als externe bron.
  - `DATA_OWNERSHIP.md`: domeinregel "Voedingsplanning, receptkopieën met voedingsannotaties, productinformatie".
  - `API_CATALOG.md`: Osta (geen API) en OFF-status Samen Thuis.
- Toekomstige koppeling met de Sportapp: alleen door de gebruiker gestarte export/import (formaat `samen-thuis.recipes` of schema.org), nooit database-naar-database.

## Bewaking in code

`nutrition-integration.test.js` faalt als er een formulier voor receptinhoud terugkomt of als bewaren de receptinhoud wijzigt; `osta-exchange-core.test.js` legt "bron wint, niets verdwijnt ongemerkt" vast.
