# Migratiehandleiding

## 1. Database-hardening (lokaal/staging)

`20261113000000_database_rate_limits_and_privileges.sql` voegt PostgreSQL-rate-limiting toe voor de gevoelige huishoud-RPC's, trekt onnodige API-rechten en ruime default privileges in, en zet bestaande SECURITY DEFINER-functies op een lege `search_path`. De limiter gebruikt een token bucket per gebruiker en RPC-actie; configuratie en opschoning staan in `docs/LOCAL_STAGING.md`. De bijbehorende handmatige rollback verwijdert alleen de rate-limitlaag en herstelt de eerdere RPC-antwoorden; privilege- en `search_path`-hardening blijven actief.

Deze migratie en tests zijn uitsluitend bedoeld voor lokale/staging-validatie. Geen productie-SQL, `db push`, deployment of wijziging aan live Supabase-projecten is uitgevoerd. Lokale resultaten bewijzen geen productiestatus.

## 2. Clientmigratie (automatisch, niet-destructief)

| Van | Naar | Hoe | Terug |
|---|---|---|---|
| Geen `nutrition` | `nutrition = { version: 1, products: [], recipes: [] }` | Pas bij openen van Voeding (`normalizeStore`) | Oudere app-versie negeert het veld; `migrateData` behoudt het |
| `meals[]` zonder `recipeId` | Optioneel `recipeId` na koppelen | Alleen door gebruikersactie | Veld wordt door oudere versies genegeerd |
| Service worker `samen-thuis-v36-finance` | `samen-thuis-v37-voeding` | Nieuwe SW installeert en verwijdert oude cache bij activatie | Vorige `sw.js` terugzetten |

Oude back-ups (zonder `nutrition`) zijn volledig herstelbaar. Nieuwe back-ups met `nutrition` zijn herstelbaar in oudere versies (veld blijft bewaard maar is daar niet zichtbaar).

## 3. Edge Functions (code gewijzigd, deploy vereist akkoord)

`grocery-prices` en `data-sources` gebruiken nu `supabase/functions/_shared/guard.ts`. Activeren gebeurt pas bij redeploy:

```bash
# Alleen na expliciet akkoord van de eigenaar (geen productiewijziging zonder toestemming).
npx supabase secrets set ALLOWED_ORIGINS=https://kesga44-jpg.github.io
npx supabase functions deploy grocery-prices
npx supabase functions deploy data-sources
```

Gevolg: aanbiedingen, NED en Tankerkoenig werken alleen nog voor gebruikers met een persoonlijk account (aangemeld). De app stuurt automatisch het sessietoken mee; zonder sessie verschijnt "Aanmelden vereist". Terugdraaien: vorige functieversie opnieuw deployen (git-tag vóór deze wijziging).

Open vraag: of de Supabase-gateway met JWT-verificatie aan de CORS-preflight (`OPTIONS` zonder token) doorlaat, is niet geverifieerd. Als niet: bewust besluit nodig om `--no-verify-jwt` te houden; de functie blijft dan via de eigen JWT-controle afgeschermd.

## 4. Regels voor toekomstige migraties (ongewijzigd, centraal)

1. Additief en herhaalbaar; rollback in `supabase/rollbacks/` (niet in `supabase/migrations/`).
2. RLS aan in dezelfde migratie; `revoke all from anon, authenticated`; minimale grants.
3. `security definer` met `set search_path = ''`; bestaande RPC's zijn in de migratie gehard.
4. SQL-tests in `migrations-pg.test.js` en de lokale Supabase-test (`docs/LOCAL_STAGING.md`): de eerste gebruikt een beperkte stub zonder brede default privileges; de tweede controleert de PostgreSQL 15-platformdefaults en effectieve grants voor de `postgres`-migratie-eigenaar na de zeven migraties. De Supabase `supabase_admin`-defaults blijven een expliciet gedocumenteerde platformbeperking.
5. Vóór uitvoering op project A: groen isolatierapport, verse back-up database + opslag met geslaagde hersteltest, expliciet akkoord (centraal ADR 0001/0010).

De lokale tests wijzigen geen productiebeleid of productieomgeving. Ze voeren het handmatige Phase-3-script of de handmatige rollback niet uit. De lokale Supabase-test controleert de ingetrokken extra rechten en default privileges; zie `docs/LOCAL_STAGING.md` § 13.

## 5. Openstaande databasehandelingen (niet uitgevoerd, vereisen goedkeuring)

| ID | Handeling | Voorwaarde |
|---|---|---|
| DB-1 | `supabase/manual/phase3_revoke_anon_household_data.sql` (R1) | Beide gebruikers op accountsync; verse back-up met hersteltest; akkoord vlak vóór uitvoering |
| DB-2 | `search_path` van bestaande SECURITY DEFINER-functies naar `''` | Additief geïmplementeerd; alleen lokaal getest. Productietoepassing blijft buiten scope en vereist aparte toestemming. |
