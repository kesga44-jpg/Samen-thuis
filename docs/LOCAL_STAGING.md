# Lokale Supabase-staging (Docker)

Doel: de bestaande migraties en beveiligingsscripts reproduceerbaar testen op een **lokale** Supabase-stack met synthetische gegevens. Dit raakt productie niet: geen project-ref, geen productie-URL, geen keys of secrets in de repo.

## 1. Wat dit wel en niet is

| Wel | Niet |
|---|---|
| Lokale PostgreSQL 15 + Auth + Storage + Edge Runtime in Docker | Een kopie van productie |
| Zes migraties + legacy-basisschema en synthetische rechten/RLS-tests | Het Phase-3-script, productie-RLS of echte gegevens |
| Synthetische testaccounts en -rijen | Echte huishoudgegevens, echte codes of back-ups |

Lokale staging is **geen bewijs voor productie**. De productiechecks (grants, RLS, logs, plan) blijven een aparte eigenaarsvoorwaarde (zie `UPGRADE_NAV5_SYNC.md`).

## 2. Vereisten

- Docker (daemon draait; controleer met `docker info`). In deze devcontainer: `nohup dockerd >/tmp/dockerd.log 2>&1 </dev/null &` en wachten tot `docker info` slaagt.
- Node.js met `npx`. De CLI wordt niet globaal geïnstalleerd en niet in de repo gepind via `package.json`; gebruik altijd de vaste versie:

```bash
npx supabase@3.1.0 --version   # verwacht 3.1.0
```

Gepinde versies: **Supabase CLI 3.1.0**, **PostgreSQL 15** (`db.major_version = 15` in `supabase/config.toml`; de repo-tests ondersteunen 14-16). De CLI-standaard is PostgreSQL 17; die is hier bewust niet gebruikt.

## 3. Bestanden

| Bestand | Rol |
|---|---|
| `supabase/config.toml` | Alleen lokale instellingen (`project_id = samen-thuis-staging`). Geen `[functions.*]`-secties: het deploygedrag van de Edge Functions blijft ongewijzigd. |
| `supabase/migrations/*` | Ongewijzigd, 6 stuks. |
| `supabase/schema.sql` | Legacy-basisschema (`household_data` + anon-policies), idempotent. Wordt door `[db.seed]` geladen. |
| `.gitignore` | Sluit `supabase/.temp/`, `supabase/.branches/` en `.env*` uit. |

## 4. Hoe het legacy-basisschema wordt geladen

`supabase db reset` voert **alleen** `supabase/migrations/*` uit en daarna de seedbestanden uit `[db.seed] sql_paths`. Een los `schema.sql` wordt nooit automatisch uitgevoerd. Daarom wijst `sql_paths` expliciet naar `./schema.sql`.

Volgorde bij reset en eerste start:

1. 20261012 personal_preferences
2. 20261013 chalkboard (`households`, `household_members`, RPC's)
3. 20261014 household_state_sync (`household_state`, `import_legacy_household_data`)
4. 20261015 sport_training_storage
5. 20261103 personal_profiles
6. 20261104 finance_confirmations
7. **Seed:** `schema.sql` (`household_data` + 3 anon-policies)

Dat is veilig omdat alleen `import_legacy_household_data` naar `household_data` verwijst, en alleen in de functiebody (runtime, niet bij `create function`). `household_data` hoeft dus pas te bestaan als de functie wordt aangeroepen. Er zijn geen dubbele creaties: `schema.sql` gebruikt `if not exists` en raakt de migratieobjecten niet.

**Bewust niet gedaan:** het basisschema als migratie met een vroeg tijdstempel toevoegen. Zo'n bestand zou ook bij een productie-`db push` meedoen en de anon-policies kunnen terugzetten na Phase 3.

> **Waarschuwing:** gebruik nooit `supabase db push --include-seed` of `supabase link` + `db push` voor dit project. Seed bevat de legacy anon-policies.

## 5. Starten, stoppen, resetten

```bash
# Starten (eerste keer downloadt Docker-images; daarna snel)
npx supabase@3.1.0 start -x imgproxy,vector,logflare,realtime,mailpit

# Status en lokale URL's/keys (alleen lokale standaardwaarden)
npx supabase@3.1.0 status

# Alle lokale data wissen en migraties + seed opnieuw uitvoeren
npx supabase@3.1.0 db reset

# Stoppen (data blijft in Docker-volumes)
npx supabase@3.1.0 stop
# Stoppen en lokale volumes wissen
npx supabase@3.1.0 stop --no-backup
```

`db reset` en `stop --no-backup` werken uitsluitend op de lokale containers/volumes (`supabase_*_samen-thuis-staging`).

## 6. Versiecontrole

```bash
npx supabase@3.1.0 --version
docker exec -i supabase_db_samen-thuis-staging psql -U postgres -At -c "select version()"
# verwacht: PostgreSQL 15.x
```

Migraties en seed controleren:

```bash
docker exec -i supabase_db_samen-thuis-staging psql -U postgres -At \
  -c "select version from supabase_migrations.schema_migrations order by 1" \
  -c "select to_regclass('public.household_data'), to_regclass('public.household_state'), to_regclass('public.household_legacy_imports')"
```

Verwacht: 6 versies (20261012000000 ... 20261104000000) en drie bestaande tabellen.

## 7. Lokale database en Studio

- psql: `docker exec -it supabase_db_samen-thuis-staging psql -U postgres`
- Directe URL (alleen lokaal): `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio / SQL Editor: <http://127.0.0.1:54323>
- Let op: de lokale stack bindt aan alle netwerkinterfaces en Studio heeft geen authenticatie. Draai dit niet op een gedeeld of publiek netwerk.

## 8. Lokale Auth-accounts (synthetisch)

E-mailbevestiging staat lokaal uit, dus aanmelden werkt direct. Gebruik alleen `.invalid`-adressen en testwachtwoorden.

```bash
eval "$(npx supabase@3.1.0 status -o env | grep -E '^(API_URL|ANON_KEY)=')"
for u in a b c; do
  curl -s -X POST "$API_URL/auth/v1/signup" -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test-$u@staging.invalid\",\"password\":\"staging-test-1\"}" >/dev/null
done
```

Rollen: A en B vormen het testhuishouden, C is de buitenstaander. Een `db reset` verwijdert deze accounts weer. Om de app tegen de lokale stack te laten draaien moet de lokale `API_URL` en `ANON_KEY` in de app-instellingen worden gezet; zet die waarden nooit in de repo.

## 9. Logs

```bash
docker logs -f supabase_db_samen-thuis-staging     # Postgres
docker logs -f supabase_auth_samen-thuis-staging   # Auth
docker logs -f supabase_kong_samen-thuis-staging   # API-gateway/REST-verzoeken
docker ps --format '{{.Names}}' | grep samen-thuis-staging
```

## 10. Edge Functions lokaal

`supabase/functions/*` worden door de configuratie niet gewijzigd of gedeployed. Lokaal serveren is optioneel en heeft eigen lokale secrets nodig (bijv. een `supabase/functions/.env`, genegeerd door git). Gebruik daar nooit productiesecrets; de functies hebben voor staging van de huishoudtabellen geen productiegegevens nodig. Deze PR heeft het serveren niet getest.

## 11. Veelvoorkomende fouten

| Symptoom | Oorzaak | Herstel |
|---|---|---|
| `Cannot connect to the Docker daemon` | Daemon draait niet | Start `dockerd` (zie §2) en wacht op `docker info` |
| Poort 54321-54324 bezet | Andere stack of proces | `npx supabase@3.1.0 stop`, of ander proces stoppen |
| Image pull duurt lang of faalt | Geen/trage verbinding | Opnieuw proberen; het blijft lokaal |
| `relation "public.household_data" does not exist` bij gebruik van de import-RPC | Seed niet uitgevoerd | `db reset` (laadt `schema.sql`) |
| Migratie faalt halverwege | Gedeeltelijke staat | `db reset` herstelt volledig; er is geen productiedata |
| Oude PostgreSQL-versie na wijziging van `major_version` | Bestaand volume | `stop --no-backup`, daarna opnieuw `start` |
| Studio bereikbaar voor anderen | Binding aan 0.0.0.0 | Niet op gedeeld netwerk draaien |

## 12. Wat deze omgeving nog niet test

- Het Phase-3-script, `legacy_row_allow` of een rollback/noodprocedure.
- Productiegrants, productie-RLS, logs, plannen of gedrag.
- Twee echte apparaten/accounts, offline gedrag en herstel in de app.
- De Edge Functions lokaal.

## 13. Rechten- en migratietests

Na `start` of `db reset` draait de lokale integratietest binnen één transactie; de fixture-rijen en testaccounts worden aan het eind teruggedraaid:

```bash
node --test supabase-local.test.js
```

De test controleert dat de stack PostgreSQL 15 gebruikt, de seed `household_data` heeft geladen, platform-defaults bestaan en migraties de bedoelde toegangsweg gebruiken. De Supabase-defaultprivileges geven nieuwe tabellen in `public` standaard alle tabelrechten aan `anon`, `authenticated` en `service_role`, en nieuwe functies `EXECUTE` aan die rollen. Dit zijn platformdefaults, niet grants uit deze zes migraties. De teststub voor de losse PostgreSQL-tests bootst die ruime defaults juist niet na; daardoor kunnen die tests niet slagen door impliciete rechten.

De lokale stack toont ook bestaande extra rechten die niet door deze test-PR worden aangepast: `anon` houdt via de defaults onder meer `DELETE`/`TRUNCATE` op de legacytabel `household_data`, en `authenticated` heeft zulke extra rechten op `personal_preferences`. De test meldt deze afwijkingen als waarschuwing. `TRUNCATE` wordt niet door RLS afgeschermd. Dit is een lokale bevinding, geen controle van productie.

`migrations-pg.test.js` test daarnaast de SQL-semantiek in een aparte tijdelijke database met een niet-superuser-eigenaar die `BYPASSRLS` heeft. De PostgreSQL-versie kan expliciet gekozen worden:

```bash
runuser -u postgres -- env PG_BIN=/usr/lib/postgresql/14/bin node --test migrations-pg.test.js
runuser -u postgres -- env PG_BIN=/usr/lib/postgresql/16/bin node --test migrations-pg.test.js
```

De runner selecteert standaard de eerste aanwezige versie in volgorde 16, 15, 14. De PG14/16-commando's zijn afzonderlijke tests; de volledige Supabase-stack is hier uitsluitend op PostgreSQL 15 getest. Geen van deze commando's voert het Phase-3-script uit.
