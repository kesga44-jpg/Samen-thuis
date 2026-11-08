# CLAUDE.md — Samen Thuis

De centrale regels in `personal-ecosystem/CLAUDE.md` gelden hier volledig. Bij strijd wint de strengste regel. Bij twijfel: stoppen en vragen.

## Altijd eerst lezen

1. `personal-ecosystem/DECISIONS.md`, `docs/adr/` (centraal) en `docs/adr/` (deze repo).
2. `personal-ecosystem/APP_REGISTRY.md` en `DATA_OWNERSHIP.md`.
3. Deze repo: `README.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/IMPLEMENTATION_STATUS.md`.

## Vaste afspraken voor deze repo

- Vanilla JavaScript, geen buildstap, klassieke `<script>`-tags. Geen React, TypeScript of Tailwind in de app. (Edge Functions zijn Deno/TypeScript.)
- Nieuwe logica in een zuivere `*-core.js` (UMD-patroon, testbaar in Node) + dunne UI-module die zich aan `render()` haakt (zie `sportcoach.js`, `nutrition.js`). Laden vóór `nav-groups.js`.
- Gegevens blijven in `samenThuisDataV2`. Nieuwe velden additief op het hoogste niveau; `migrateData` behoudt onbekende velden. Nooit gegevens wissen of hernoemen.
- Elk top-level veld wordt automatisch een versleuteld sync-onderdeel (`household-sync-core.js`). Apparaatgebonden caches (bijv. Open Food Facts) horen in een eigen `localStorage`-sleutel, niet in `data`.
- Alle HTML uit gegevens via `esc()`. Externe gegevens (API's, imports) zijn onbetrouwbaar.
- Externe scripts alleen via `cdn-libs.js` (exacte versie + SRI). Nieuwe bibliotheek: hash berekenen en `node scripts/verify-sri.mjs` draaien.
- Netwerkverzoeken naar externe API's alleen na een gebruikersactie; nooit zoeken-tijdens-typen bij Open Food Facts.
- Geen Web Push, geen WebLLM/Ollama, geen nieuwe externe API zonder akkoord (zie `docs/API_INTEGRATIONS.md`).
- Sport & Training: alleen fixes, geen nieuwe functies (centrale ADR 0002).
- Service worker: bij elke asset-wijziging `?v=` verhogen en `node scripts/sync-sw-assets.mjs samen-thuis-vNN-onderwerp` draaien; `sw-assets.test.js` bewaakt de lijst.
- Voeding: Osta is primair voor recepten (ADR 0001). Geen formulier of code die receptinhoud maakt of bewerkt; alleen import/export en voedingsannotaties.
- Sync: nooit stil overschrijven. Automatisch samenvoegen alleen zonder veldconflict (`household-sync-core.js`).
- Supabase: geen migratie uitvoeren op project A. Migraties schrijven + lokaal testen mag, met rollback in `supabase/rollbacks/`.

## Testen vóór "klaar"

```bash
node --check app.js
node --test *.test.js            # SQL-tests: PostgreSQL 14–16 en niet-root-gebruiker
node e2e/smoke.mjs               # optioneel, vereist Playwright + Chromium
node scripts/verify-sri.mjs      # bij bibliotheekwijzigingen, vereist internet
```

## Werkwijze

Eén onderwerp per PR, voorstel vooraf, eigenaar merget (centrale ADR 0011). Rapporteer volgens het centrale format (Gewijzigd / Waarom / Getest / Niet getest / Risico's).
