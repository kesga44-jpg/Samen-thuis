# Lokale Supabase-staging (Docker)

Doel: de bestaande migraties en beveiligingsscripts reproduceerbaar testen op een **lokale** Supabase-stack met synthetische gegevens. Dit raakt productie niet: geen project-ref, geen productie-URL, geen keys of secrets in de repo.

## 1. Wat dit wel en niet is

| Wel | Niet |
|---|---|
| Lokale PostgreSQL 15 + Auth + Storage + Edge Runtime in Docker | Een kopie van productie |
| Acht migraties + legacy-basisschema en synthetische rechten/RLS/Phase-3-v2-tests | Productie-RLS of echte gegevens |
| Synthetische testaccounts en -rijen | Echte huishoudgegevens, echte codes of back-ups |

Lokale staging is **geen bewijs voor productie**. Productiechecks (grants, RLS, logs en plannen) blijven een aparte eigenaarsvoorwaarde (zie `MIGRATIONS.md`).

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
| `supabase/migrations/*` | Acht additieve migraties; de Phase-3-v2-ledger volgt op de database-hardeningmigratie. |
| `supabase/schema.sql` | Legacy-basisschema (`household_data` + anon-policies en minimale expliciete anon-grant), idempotent. Wordt door `[db.seed]` geladen en installeert lokaal ook de ledger-inventaristrigger. |
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
7. 20261113 database_rate_limits_and_privileges
8. 20261114 legacy_sync_phase3_v2 (ledger, server-side audit, guard en recovery-RPC's; sluit niets automatisch af)
9. **Seed:** `schema.sql` (`household_data` + 3 anon-policies + minimale anon-grant)

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

Verwacht: 8 versies (20261012000000 ... 20261114000000) en de bestaande tabellen plus ledger-, audit-, recovery- en rate-limit-tabellen.

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

## 12. Grenzen van deze omgeving

- De Phase-3-v2-integratietest gebruikt uitsluitend synthetische accounts en payloads en rolt de testafsluiting na afloop terug. De lokale service-role-noodprocedure wordt ook getest; `legacy_row_allow` bestaat niet.
- De database kan geen gelijkheid van ontsleutelde plaintext tussen apparaten bewijzen. Voor een echte migratie zijn de lokale rapporten van PR E, met dezelfde `comparison_id` voor beide leden en opgeloste conflicten, vereist. Zonder die rapporten faalt de guard.
- Productiegrants, productie-RLS, logs, plannen, twee echte apparaten/accounts, offline herstel in de app en Edge Functions zijn niet getest.

## 13. Rechten- en migratietests

Na `start` of `db reset` draaien de lokale integratietests met synthetische fixtures. De Phase-3-test sluit de legacyroute binnen één transactie en rolt die afsluiting na de recovery-kill-switch terug:

```bash
node --test supabase-local.test.js
```

De integratietests controleren PostgreSQL 15, de seed, effectieve grants op tabellen, kolommen, sequences, functies en schema's, RLS-policies, SECURITY DEFINER-instellingen, rate-limits, pg_temp-isolatie, synthetische sync/imports, Phase-3-v2-faal- en succespaden en recovery. De migratie trekt voor de applicatiemigratierol `postgres` standaardrechten op toekomstige `public`-tabellen en sequences in voor `PUBLIC`, `anon` en `authenticated`, verwijdert de standaard `PUBLIC EXECUTE` voor functies en trekt API-roldefaults voor nieuwe functies in. De vertrouwde `service_role`-defaults blijven bestaan; interne rate-limit- en ledgerobjecten zijn expliciet van directe toegang door die rol uitgesloten.

**Bekende platformbeperking:** de lokale Supabase-rol `supabase_admin` heeft eigen, bredere defaults voor `anon`/`authenticated`. `postgres` is geen lid van die rol en kan die ACL's niet intrekken; de lokale test meldt dit expliciet en controleert dat applicatietabellen en SECURITY DEFINER-functies niet door `supabase_admin` worden gemaakt. Normale Supabase-appmigraties draaien als `postgres`, waarvoor toekomstige objecten wel getest zijn. Als een object ooit als `supabase_admin` wordt gemaakt, kan het deze API-rechten erven; dat vereist een afzonderlijke platformbeheerhandeling. Dit rest-risico is niet op productie onderzocht of gewijzigd.

De `household_data`-seed behoudt voor de lokale beginstatus uitsluitend de bestaande anon-route met `SELECT`, `INSERT` en `UPDATE`; `DELETE`, `TRUNCATE`, `REFERENCES` en `TRIGGER` worden niet toegekend. Alleen de expliciete lokale Phase-3-v2-test voert `close_legacy_sync_phase3_v2()` uit; daarin worden tabel- en kolomrechten voor `PUBLIC`, `anon`, `authenticated` en `service_role` ingetrokken en alle legacy-RLS-policies verwijderd. De importfunctie wordt daarna ingetrokken en alternatieve gebruikersroutes via views/RPC's worden gecontroleerd. `TRUNCATE` wordt expliciet gecontroleerd omdat RLS dit niet afschermt. Dit is lokaal bewezen, geen productiecontrole.

De limiter bewaart maximaal één compacte token-bucketrij per gebruiker en RPC-actie. De rij bevat alleen user-id, actie, tokens en tijdstempels; er worden geen join-codes, legacy-ID's, payloads, IP-adressen of per-poging logs opgeslagen. Een rij verloopt zodra de bucket weer vol is. Een beheerder kan verlopen rijen in begrensde batches verwijderen met `select public.cleanup_household_rpc_rate_limits(1000);` (maximaal 10.000 per aanroep); er wordt geen `pg_cron`-extensie vereist. Verwijdering van een Auth-gebruiker ruimt diens rijen via `ON DELETE CASCADE` op.

De teststub voor losse PostgreSQL-tests bootst de brede Supabase-defaults niet na; de lokale Supabase-test controleert de effectieve defaults voor objecten die door `postgres` worden aangemaakt, plus de genoemde platformbeperking. De probe-objecten worden tijdens de testtransactie teruggedraaid.

`migrations-pg.test.js` test daarnaast de SQL-semantiek in een aparte tijdelijke database met een niet-superuser-eigenaar die `BYPASSRLS` heeft. De PostgreSQL-versie kan expliciet gekozen worden:

```bash
runuser -u postgres -- env PG_BIN=/usr/lib/postgresql/14/bin node --test migrations-pg.test.js
runuser -u postgres -- env PG_BIN=/usr/lib/postgresql/16/bin node --test migrations-pg.test.js
```

De runner selecteert standaard de eerste aanwezige versie in volgorde 16, 15, 14. De PG14/16-commando's zijn afzonderlijke tests; de volledige Supabase-stack is hier uitsluitend op PostgreSQL 15 getest. De lokale Phase-3-test voert synthetische sluiting en de kill switch uit; die wijzigingen worden transactioneel teruggedraaid.

### Rate-limits en operationele gevolgen

| RPC | Token-bucketlimiet | Reden / normale stroom |
|---|---|---|
| `join_household` | burst 5; daarna 1 token per 3 minuten | Een geldige uitnodiging vereist normaal één poging; de burst laat invoerfouten en korte retries toe, maar begrenst codegissen per account over alle sessies. Een ongeldige, volle of geblokkeerde join geeft hetzelfde lege resultaat. |
| `create_household` | burst 3; daarna 1 per 8 uur | Aanmaken hoort bij onboarding, niet bij periodieke sync; drie snelle pogingen laten correcties/dubbelklikken toe. |
| `import_legacy_household_data` | burst 5; daarna 1 token per 3 minuten | De import hoort eenmalig te zijn; de marge laat herstel na transient fouten toe. Ontbrekende, ongeldige en al geclaimde IDs geven geen onderscheidende gegevens terug. |
| `put_household_state` | burst 60; daarna 1 per seconde | Veel hoger dan normale periodieke sync; 60 writes kunnen direct worden gebundeld/hersteld. Bestaande lidmaatschaps-, 8 MB-payload- en versiecontroles blijven actief. |

De waarden staan in `household_rpc_rate_limit_config` en kunnen alleen door de database-eigenaar worden aangepast. `join_household` retourneert bij een ongeldige code of een uitgeputte bucket `NULL` in plaats van een SQL-exception: anders zou PostgreSQL de limiterwijziging samen met de mislukte RPC terugdraaien. De UI toont voor beide situaties dezelfde generieke fout. Rate-limiting houdt pogingen per `auth.uid()` bij, onafhankelijk van venster of sessie.

**Rollback:** `supabase/rollbacks/20261113000000_database_rate_limits_and_privileges.rollback.sql` herstelt alleen de vorige RPC-antwoorden en verwijdert de bucket/config-tabellen. De privileges, default privileges en lege `search_path` blijven bewust gehard. Het bestand is handmatig en is in deze validatie niet uitgevoerd.

## Phase 3 v2: ledger, afsluiting en noodherstel

De additieve migratie `20261114000000_legacy_sync_phase3_v2.sql` sluit niets automatisch af. De ledger `legacy_row_disposition` inventariseert iedere bestaande `household_data`-rij. Een beslissing is onveranderlijk: `migrated` vereist een huishouden, beslisser, tijdstip, SHA-256 en initiële importversie; `excluded` vereist een reden, beslisser, tijdstip en SHA-256. Ongeldige legacy-ID's worden in de ledger vervangen door `sha256:<digest>`. Er worden geen codes of ontsleutelde gegevens opgeslagen.

`import_legacy_household_data` lockt de bronrij en berekent vóór wijzigingen SHA-256 over UTF-8 van de oorspronkelijke `jsonb::text`-representatie. Importclaim, `legacy_full`-state en ledgerdispositie worden in één transactie vastgelegd. De rate-limit blijft burst 5 en daarna één token per 180 seconden. Een mislukking rolt alle wijzigingen terug.

`check_legacy_sync_phase3_v2()` geeft een rapport met afzonderlijke checks. De guard faalt gesloten bij ontbrekende/onopgeloste ledgerstatus, ongeldige uitsluiting, ontbrekende/hash-mismatched payload, inconsistent of dubbel importresultaat, orphan `legacy_full`-state, ontbrekende twee actieve leden met passende rollen, minder dan twee actieve schrijvers na de initiële importversie, onopgeloste imports/herstelvensters, alternatieve gebruikersroutes of ontbrekende lokale verificatie. De database kan niet verifiëren dat versleutelde payloads op beide apparaten tot dezelfde plaintext leiden. PR E moet daarom per lid een lokaal rapport leveren; dezelfde vergelijking-ID en opgeloste conflicten zijn verplicht.

### Lokale uitvoeringsprocedure

1. Verifieer dat de CLI-doelstack lokaal is (`npx supabase@3.1.0 status`) en voer `npx supabase@3.1.0 db reset` uit.
2. Gebruik uitsluitend synthetische data. Voer `node --test supabase-local.test.js migration-security.test.js migrations-pg.test.js` uit; de Phase-3-test controleert eerst afwijzingen en voert daarna een volledige synthetische sluiting uit in een transactie die wordt teruggedraaid.
3. Voor een handmatige lokale proef: vul eerst alle ledgerdisposities in en lever de vereiste PR-E-rapporten voor beide accounts aan. Laat `select public.check_legacy_sync_phase3_v2();` alle checks tonen als geslaagd. Voer pas daarna `supabase/manual/phase3_v2_close_legacy_sync.sql` uit op de lokale testdatabase. Het statement herhaalt alle controles onder een exclusieve advisory lock en trekt rechten/policies atomair in.
4. Bij een exception: niets wordt gedeeltelijk gesloten; bekijk de JSON-checks, herstel alleen de ontbrekende synthetische of staging-evidence en voer de guard opnieuw uit. De oude `phase3_revoke_anon_household_data.sql` weigert altijd en mag niet als alternatief gebruikt worden.

### Noodherstel

Er bestaat geen publieke `legacy_row_allow`-tabel of normale frontendknop. Alleen een beheerder via de vertrouwde lokale `service_role`-databasecontext kan een sessie openen voor 1–20 vooraf geregistreerde ledger-ID's, met reden en TTL van 1–60 minuten. `read_legacy_row_recovery(uuid)` retourneert alleen de expliciet toegestane bronrijen en payloadhash; directe tabeltoegang blijft ingetrokken. De reads worden gelogd. Sluit de sessie met `close_legacy_recovery(uuid)`; `supabase/rollbacks/20261114000000_legacy_sync_phase3_v2.rollback.sql` is een kill switch die alle open herstelvensters sluit en geen legacytoegang heropent. Een algemene rollback naar de oude sync is bewust niet beschikbaar.

### Rechten en bewijsstatus

Na succesvolle lokale sluiting hebben `PUBLIC`, `anon`, `authenticated` en `service_role` geen legacy-tabel- of kolomrechten (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) meer. Policies worden verwijderd; de oude importfunctie en eventuele gebruikersroutes via views/RPC's worden geweigerd. De nieuwe account-sync blijft actief.

| Bewijs | Status |
|---|---|
| Lokale PostgreSQL 15-reset, synthetische guard/import/recovery-tests | Geslaagd; 4 lokale Supabase-integratietests plus 15 statische migration-security checks |
| Supabase-staging buiten de lokale Docker-stack | Niet uitgevoerd |
| Statische controle van migratie en scripts | Uitgevoerd via `migration-security.test.js` |
| Productiegrants, productiemigraties, productiegegevens en deployments | Niet uitgevoerd of bewezen |

### Validatiestatus

| Controle | Resultaat |
|---|---|
| Volledige `node --test *.test.js` als niet-root, PostgreSQL 16 beschikbaar | 395 totaal: 383 geslaagd, 0 gefaald, 12 overgeslagen |
| `migrations-pg.test.js` | 20 geslaagd op PostgreSQL 16 |
| `migration-security.test.js` | 15 geslaagd |
| `node --test supabase-local.test.js migration-security.test.js` na verse `supabase db reset` | 19 geslaagd op lokale Supabase PostgreSQL 15; 4 Supabase-integratietests en 15 statische checks |
| `node --check app.js`, `node --check account-sync.js` en `git diff --check` | Geslaagd |

De 12 skips in de volledige niet-root-run: 3 PDF-tests (`pdfjs-dist` ontbreekt), 2 Excel-tests (`xlsx` ontbreekt), 1 Word-test (`mammoth` ontbreekt), 1 OCR-test (`IMPORT_TEST_OCR_LANGPATH` ontbreekt), 1 gecombineerde bestandsimporttest (vereiste readers ontbreken) en 4 lokale Supabase-tests (niet-root testgebruiker heeft geen Docker-toegang). Het resterende risico van de eerste 8 is dat die PDF-, XLSX-, DOCX- en OCR-parsers niet end-to-end zijn getest. De 4 Supabase-tests zijn afzonderlijk als Docker-capable gebruiker uitgevoerd en slaagden na een verse lokale reset op PostgreSQL 15. De `supabase_admin`-probe rapporteert de platformdefaults, waaronder `PUBLIC EXECUTE`. PostgreSQL 14 is niet geïnstalleerd en daarom niet getest; PostgreSQL 16 semantiek/concurrency en de Supabase PostgreSQL 15-stack zijn wel getest.

Dit zijn uitsluitend lokale resultaten. Supabase-staging buiten de lokale Docker-stack en productie zijn niet getest.
