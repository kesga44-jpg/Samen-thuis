# Changelog Samen Thuis

Indeling volgens [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/). Eerdere versies staan in de losse `*_V*.md`/`UPDATE_*.md`-notities.

## [26.0-rc1] — 2026-11-08 (releasekandidaat, gesplitst in 8 PR's, niet gemerged)

### Gewijzigd ten opzichte van de eerste versie hieronder
- **Voedingsarchitectuur gecorrigeerd** (ADR 0001, geaccepteerd): Osta is de primaire plek voor recepten. Samen Thuis maakt geen recepten meer aan (formulier verwijderd), toont receptinhoud alleen-lezen ("Receptkopieën uit Osta") en legt alleen voedingsannotaties vast (productkoppeling, gram waar de bron geen gewicht geeft, porties voor planning). Bij opnieuw importeren wint de bron; wat de bron niet meer levert blijft behouden en wordt gemeld; vervallen ingrediënten en koppelingen worden genoemd. Twijfelgevallen worden standaard als aparte kopie toegevoegd.
- Centrale documentatiepatch voor `personal-ecosystem` (`docs/personal-ecosystem-voeding.patch`).

### Toegevoegd
- **Synchronisatie: wijzigingen van beide huisgenoten automatisch samenvoegen** (oude code-sync en accountsync). Alleen bij hetzelfde veld aan beide kanten anders gewijzigd vraagt de app een keuze; nieuwe knop **Beide samenvoegen** (ook voor conflicten die al openstonden). Lokale basiskopie per route; opslag vol → basis wordt opgeruimd en de app valt terug op kiezen.
- Browsertests: `e2e/sync-merge.mjs` (twee apparaten), `e2e/import-browser.mjs` (PDF, DOCX, XLSX, XLS, OCR, manipulatietest SRI).
- `scripts/sync-sw-assets.mjs`; tests `sync-merge.test.js`, `weather-attribution.test.js`; `docs/RC_VALIDATION.md`.

### Versies
- Gewijzigde scripts hebben een hogere `?v=`; service worker per PR een nieuwe cachenaam (eindstand `samen-thuis-v43-voeding`).

## [26.0] — 2026-11-08 (eerste versie, vervangen door rc1)

### Toegevoegd
- **Voeding** (Meer → Huishouden → Voeding) met vier subpagina's:
  - *Productinformatie*: Open Food Facts op barcode of naam (alleen na klik), voedingswaarden per 100 g en per portie, ingrediënten, allergenen en sporen in het Nederlands, Nutri-Score/NOVA, kwaliteitsscore met concrete tekortkomingen, handmatig product van het etiket. Ontbrekend wordt "onbekend", nooit 0.
  - *Recepten*: (in rc1 vervangen door alleen-lezen receptkopieën) ingrediënten koppelen aan producten en grammen; voedingswaarde per portie met dekking ("≥" bij onvolledige gegevens); opgegeven waarden van de bron apart zichtbaar; naar boodschappen.
  - *Voeding bij het weekmenu*: per maaltijd de waarde per portie, recept koppelen (of voorstel op titel), handmatig te starten regelgebaseerde voedingscontrole, ingrediënten van de week naar boodschappen.
  - *Osta en recepten uitwisselen*: gedeelde Osta-tekst, schema.org/Recipe JSON-LD en eigen formaat `samen-thuis.recipes` v1; altijd voorbeeld vóór opslaan; dubbelen herkend; geen verlies van voedingsinformatie; export in eigen formaat en schema.org.
- `food-facts-core.js`, `nutrition-core.js`, `osta-exchange-core.js`, `nutrition.js`, `css/nutrition.css`.
- Centrale zoekfunctie doorzoekt recepten (ook op ingrediënt) en producten.
- `cdn-libs.js`: register van externe bibliotheken met exacte versie en SHA-384; `scripts/verify-sri.mjs`.
- `supabase/functions/_shared/guard.ts`: JWT-controle, CORS-allowlist, groottelimiet, limiet per gebruiker.
- Lokale "gedachte van de dag" (eigen teksten).
- Tests: 71 nieuwe (`food-facts-core`, `nutrition-core`, `osta-exchange-core`, `nutrition-integration`, `edge-guard`, `cdn-libs`, `sw-assets`, `integrations-policy`, uitbreiding `quotes-core`); optionele browsertest `e2e/smoke.mjs`.
- Documentatie: `CLAUDE.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/API_INTEGRATIONS.md`, `docs/DATA_MODEL.md`, `docs/MIGRATIONS.md`, `docs/SECURITY.md`, `docs/TESTING_AND_RELEASE.md`, `docs/INSTALLATION.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/adr/0001-voedingsplanning-in-samen-thuis.md` (voorgesteld), `.env.example`, `UPLOAD_MANIFEST.md`.

### Gewijzigd
- Edge Functions `grocery-prices` en `data-sources` vereisen een aangemelde gebruiker en accepteren alleen toegestane origins (R7). De app stuurt het sessietoken mee. **Actief na redeploy.** Foutmeldingen bevatten geen interne details meer.
- Bibliotheken worden geladen met `integrity` en `crossorigin`; `tesseract.js` exact gepind op 5.1.1; pdf.js alleen na hashcontrole (R5).
- Service worker `samen-thuis-v37-voeding`: precachet alle assets uit `index.html` (o.a. ontbrekende `rewards-core.js`).
- Weer, weerpagina en luchtkwaliteit tonen de verplichte bronvermelding Open-Meteo (CC BY 4.0).
- Navigatie: Voeding toegevoegd aan Meer en als hub met subpagina's.
- CI: syntaxcontrole voor nieuwe modules en controle op Node ≥ 22.18.
- Deploy-instructies zonder `--no-verify-jwt` (`OPEN_DATA_BRONNEN.md`, `INSTALLATIE_BETA.md`).
- `README.md` bijgewerkt; app-versie 26.0.

### Verwijderd
- Extern BrainyQuote-script uit `index.html` (R4). De RSS-tekst blijft optioneel als ge-escapete tekst. Geen gegevens verwijderd.

### Beveiliging
- R4 opgelost, R5 grotendeels opgelost (restrisico tesseract-worker/taaldata), R7 opgelost in code. R1, R3, S-6, S-7 open (zie `docs/SECURITY.md`).

### Niet gewijzigd
- Database, migraties, RLS, Storage, Supabase-configuratie, Sport & Training, financiële logica, opslagformaat `samenThuisDataV2` (alleen additief).
