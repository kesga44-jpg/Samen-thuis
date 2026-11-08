# Installatie en configuratie

## 1. Lokaal draaien

Geen buildstap en geen afhankelijkheden nodig.

```bash
# in de map van de uitgepakte repository
python3 -m http.server 8080        # of: npx serve .
# open http://localhost:8080
```

Een service worker werkt alleen via `http://localhost` of `https://`, niet via `file://`.

## 2. Tests

```bash
node --version                     # ≥ 22.18
node --test *.test.js              # als niet-root voor de SQL-tests (PostgreSQL 14–16 nodig)
node e2e/smoke.mjs                 # optioneel: npm i -g playwright && npx playwright install chromium
node scripts/verify-sri.mjs        # optioneel, vereist internet
```

PostgreSQL ontbreekt? Dan worden de SQL-tests overgeslagen met een melding; in CI faalt de workflow juist dan, zodat ze niet ongemerkt wegvallen.

## 3. Configuratie frontend

De frontend heeft **geen** geheime configuratie. De Supabase-project-URL en de publishable key staan in `app.js` (publiek bedoeld; RLS beschermt de gegevens). Er is geen `.env` nodig voor de app. Zie `.env.example` voor de Supabase-/Edge-variabelen die alleen buiten de frontend horen.

In de app zelf:

- **Instellingen → Account en beveiliging:** persoonlijk account (Supabase Auth). Nodig voor accountsync en, na redeploy van de Edge Functions, voor aanbiedingen/NED.
- **Instellingen → Synchronisatie:** huishoudcode (legacy) of accountsync (aanbevolen).
- **Weer:** locatie op de weerpagina.
- **Voeding:** geen configuratie; Open Food Facts vraagt geen sleutel.

## 4. Supabase en Edge Functions (alleen eigenaar, alleen na akkoord)

```bash
npx supabase login
npx supabase link --project-ref vwfuetxgapzfivydzhxc
npx supabase secrets set ALLOWED_ORIGINS=https://kesga44-jpg.github.io
npx supabase secrets set NED_API_KEY=…            # bestaand, alleen als nog niet gezet
npx supabase functions deploy grocery-prices
npx supabase functions deploy data-sources
```

Migraties staan in `supabase/migrations/` en worden **niet** automatisch uitgevoerd. Zie `docs/MIGRATIONS.md`. Gebruik nooit een service-role key in de frontend, in tests of in deze repository.

## 5. Publiceren

GitHub Pages vanaf `main` (bestaande opzet; exacte URL niet geverifieerd in deze analyse). Na publicatie: één keer verversen zodat de nieuwe service worker (`samen-thuis-v37-voeding`) actief wordt.
