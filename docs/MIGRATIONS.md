# Migratiehandleiding

## 1. Deze wijzigingsset: geen databasewijziging

Er is **geen** nieuwe SQL-migratie, tabel, bucket of policy toegevoegd. Alle nieuwe gegevens (`nutrition`, `meals[].recipeId`) staan in de bestaande versleutelde huishoudopslag. Er is niets uitgevoerd op Supabase-project A of B.

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
3. `security definer` met `set search_path = ''` (let op: bestaande functies gebruiken nog `public`, zie `docs/SECURITY.md` S-6).
4. SQL-tests in `migrations-pg.test.js` en de lokale Supabase-test (`docs/LOCAL_STAGING.md`): de eerste gebruikt een beperkte stub zonder brede default privileges; de tweede controleert de PostgreSQL 15-platformdefaults en effectieve grants na de zes migraties.
5. Vóór uitvoering op project A: groen isolatierapport, verse back-up database + opslag met geslaagde hersteltest, expliciet akkoord (centraal ADR 0001/0010).

De lokale tests wijzigen geen migratie, productiebeleid of productieomgeving. Ze voeren het handmatige Phase-3-script niet uit. De lokale Supabase-test rapporteert bestaande extra rechten die uit Supabase-defaultprivileges voortkomen; zie `docs/LOCAL_STAGING.md` § 13.

## 5. Openstaande databasehandelingen (niet uitgevoerd, vereisen goedkeuring)

| ID | Handeling | Voorwaarde |
|---|---|---|
| DB-1 | `supabase/manual/phase3_revoke_anon_household_data.sql` (R1) | Beide gebruikers op accountsync; verse back-up met hersteltest; akkoord vlak vóór uitvoering |
| DB-2 (voorstel) | `search_path` van bestaande security-definer-functies naar `''` | Nieuwe migratie + SQL-tests; zelfde voorwaarden |
