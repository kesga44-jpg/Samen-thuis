# Upgrade: vijf hoofdsecties + veilige huishoudsync (fase 1-3)

## Inventaris: oude → nieuwe locatie
| Pagina (key) | Nieuwe sectie › subpagina |
|---|---|
| Dashboard (today) | Vandaag › Dashboard |
| Weer (weather) | Vandaag › Weer |
| Agenda (planning) | Agenda › Agenda & planning |
| Date ideeën (ideas) | Agenda › Date ideeën |
| Taken (tasks) | Taken › Taken |
| Weekmenu (meals) | Huishouden › Weekmenu |
| Boodschappen (groceries) | Huishouden › Boodschappen |
| Aanbiedingen (offers) | Huishouden › Aanbiedingen |
| Voorraad + vriezer/mealprep (stock) | Huishouden › Voorraad & vriezer |
| Huishouden/routines (chores) | Huishouden › Routines |
| Woning (home) | Huishouden › Woning |
| Budget/financiën (budget19) | Huishouden › Financiën |
| Reizen, Challenges, Programma's, Auto, Importeren, Extra, Instellingen | Meer › (zelfde namen) |

Geen pagina verwijderd. Deep links/`SamenThuisGo(key)` werken ongewijzigd; `nav-groups.js` legt alleen een 5-secties-balk, subtabs, breadcrumb en terugknop over de bestaande navigatie (oude items verborgen via CSS). Laatst bezochte subpagina per sectie wordt onthouden (sessionStorage).

## Gewijzigd/toegevoegd
`nav-core.js`, `nav-groups.js`, `css/layout.css`, `index.html`, `sw.js`, `nav-core.test.js`, `migration-security.test.js`,
`supabase/migrations/20261014000000_household_state_sync.sql` (+ `.rollback.sql`), `supabase/manual/phase3_revoke_anon_household_data.sql`.

## Migraties (handmatig, volgorde)
**Verplichte startgate — begin NIET aan 20261012 voordat alle punten geslaagd zijn** (zie ook "0. Vóór alles — back-ups" onderaan):
1. Exporteer `public.household_data` en `public.coach_data` afzonderlijk.
2. Open beide exports daadwerkelijk en controleer dat ze de verwachte kolommen en rijen bevatten.
3. Noteer de actuele rijaantallen van beide tabellen. De laatst bekende aantallen (4 en 2) zijn geen actuele waarheid; wijken de actuele aantallen af, stop dan en onderzoek het verschil vóór de migratie.
4. Controleer dat de app-back-up (Instellingen › Back-up maken) op BEIDE apparaten is gemaakt en lokaal beschikbaar is.
5. Is een controle mislukt of onduidelijk: stop en voer geen migratie uit.

Daarna, in deze volgorde en elk apart (controles na iedere migratie: zie "3. Controles na migratie"):
1. `20261012000000_personal_preferences.sql` → `20261013000000_chalkboard.sql` → `20261014000000_household_state_sync.sql`.
   Nieuw in de laatste: `household_state` (RLS, alleen leden lezen), `household_legacy_imports`, `put_household_state` (versiecontrole, SQLSTATE 40001 bij conflict), `import_legacy_household_data` (kopieert, wijzigt niets), maximaal 2 leden per huishouden.
2. Rollback (alleen 20261014): `20261014000000_household_state_sync.rollback.sql`. Oude sync blijft intussen ongewijzigd werken.
3. Fase 3 (pas na bewezen werking op 2 apparaten): `supabase/manual/phase3_revoke_anon_household_data.sql`.

## Testen op twee apparaten
Account A maakt huishouden (create_household), account B voegt toe met code; wijzig op A een taak, controleer B; zet A offline, wijzig, ga online; controleer conflictmelding en dat lokale back-up/herstel nog werkt.

## Update (vervolg in dezelfde PR): werkelijke status
**Geïmplementeerd**
- `household-sync-core.js`: REST-client (Supabase Auth-JWT van het bestaande `authSession25`; nooit een service-role key), `planSections` (sync per onderdeel/top-level sleutel; `settings` en `meta` blijven lokaal), versiecontrole via `put_household_state` (SQLSTATE 40001 → conflict), foutclassificatie (auth, migratie ontbreekt, netwerk, verkeerde code).
- `account-sync.js`: opt-in knop "Overstappen naar accountsync" bij Instellingen (huishouden aanmaken/toevoegen via bestaande RPC's, uitnodigingscode, max. 2 accounts server-side). Bij overstap wordt `import_legacy_household_data` aangeroepen (kopieert de oude versleutelde rij naar sectie `legacy_full`; niets wordt overschreven). Na overstap draait alleen de nieuwe route (`syncNow` wordt omgeleid) zodat oude en nieuwe sync elkaar niet overschrijven; "Terug naar oude code-sync" zet dit terug.
- Behouden: herstelvlag (`hold` → conflict i.p.v. overschrijven), lege lokale data haalt cloud op en pusht nooit, veiligheidskopie (`samenThuisPreAccountSyncBackup`) vóór het toepassen van cloudgegevens, per-onderdeel conflictkeuze (mijn versie / cloudversie), versleuteling met dezelfde huishoudcode (AES-GCM, ongewijzigd), offline: lokaal bewaren en synchroniseren bij `online`, sleutel-/autorisatiefouten stoppen vóór schrijven. Basisstand per `gebruiker:huishouden`, dus een accountwissel overschrijft niets stilzwijgend.
- `inbox-core.js`/`inbox.js`: 🔔-knop in de topbalk met ongelezen-teller, gelezen/ongelezen, verwijderen, herinneringen afgeleid uit taken/routines, agenda, vriezer, voorraad en syncconflicten; meldingsvoorkeuren per account (lokaal per account-ID; gedeelde huishouddata wordt niet gewijzigd).
- `weather-advice-core.js`/`weather-extras.js`: kledingadvies met SVG-illustraties en pollen/luchtkwaliteit (bron Open-Meteo + peiltijd, offline cache, "niet beschikbaar" i.p.v. verzonnen waarden) op de Weerpagina. De temperatuurgrafieken met waarden bestonden al (`chart25`) en zijn niet herbouwd.
- Bestaand en dus niet herbouwd: Supabase Auth-aanmelding, persoonlijke accentkleur/dashboardvoorkeuren (`personal_preferences`), huishouden aanmaken/joinen (krijtbord).
- Navigatie: oude items zijn `display:none` (geen focus, niet in toegankelijkheidsboom); getest op bereikbaarheid van alle 19 pagina's. Geen wijziging nodig.

**Tests (`node --test <bestand>`)**: alle `*.test.js` slagen, o.a. `household-sync-core.test.js` (twee leden, autorisatie met RLS-nabootsing, versieconflict en race, offline, legacy-import, herstelvlag, verkeerde sleutel, aansluiting migratie↔client), `inbox-core.test.js`, `weather-advice-core.test.js`, `nav-core.test.js`, `migration-security.test.js`. JS-syntaxis gecontroleerd met `node --check`.

**NIET uitgevoerd**: browser-/apparaattests (de browsertool was niet beschikbaar), live Supabase (migratie niet toegepast, geen credentials), echte e-mailbevestiging. De server-RLS is alleen met een nabootsing getest; test `household_state` na het toepassen van de migratie op twee echte accounts.

**Niet gebouwd (bewust)**: pushmeldingen — vereisen service worker-push, VAPID-sleutels en een server-side verzender; zonder die configuratie zou het nepfunctionaliteit zijn. Volgende stap: VAPID-sleutelpaar genereren (privésleutel alleen als Edge Function-secret), tabel voor push-subscriptions met RLS, Edge Function voor verzenden. Meldingsvoorkeuren staan niet in `personal_preferences` (cloud) maar lokaal per account.

**Resterende risico's**: de anon-policies op `household_data` blijven bestaan tot fase 3 (`supabase/manual/phase3_revoke_anon_household_data.sql`) — pas toe nadat beide apparaten op accountsync draaien én een verse export is gemaakt. Eerste synchronisatie versleutelt elk onderdeel apart (PBKDF2 250k iteraties) en kan enkele seconden duren. Het bestaande krijtbord/huishoudlid-RPC `join_household` geeft toegang met alleen de uitnodigingscode; de limiet van 2 leden wordt door de migratie-trigger afgedwongen.

## Review-ronde: gevonden en opgeloste problemen
| Probleem | Oplossing |
|---|---|
| Een lid dat opnieuw "joinde" kreeg de limietfout bij 2 leden | Trigger slaat bestaande leden over (no-op) |
| Gelijktijdige eerste schrijver gaf 23505 i.p.v. versieconflict | `unique_violation` → SQLSTATE 40001 |
| `put_household_state` accepteerde elke sectienaam/payload (ook `settings`, `legacy_full`) | Naamregex, gereserveerde namen, max 8 MB, null-/negatieve-versiecontrole |
| Client pulde onderdelen met willekeurige naam uit de cloud (`settings` bevat de huishoudcode) | Client negeert ongeldige/gereserveerde namen |
| `import_legacy_household_data` kon dezelfde oude rij in meerdere huishoudens kopiëren | Tabel `household_legacy_imports` (1 claim per oude rij), id-formaat (64 hex), dubbele import = no-op `false` |
| Account-wissel hergebruikte huishouden/conflicten van vorig account | State reset zodra gebruikers-ID wijzigt |
| Afmelden schakelde stil terug naar anon-sync | Ingeschakeld = accountroute blijft; zonder sessie "Aanmelden vereist" (lokaal bewaard) |
| Overstap werd ingeschakeld vóór een geslaagde sync (ook offline) | Pas inschakelen na `ok`/`conflict`; anders blijft oude sync actief met uitleg |
| Terugschakelen kon partnerwijzigingen in oude sync stil overschrijven | Veiligheidskopie `samenThuisPreAccountSyncBackupOff` + herstelvlag (conflictkeuze bij verschil) |
| Fase-3-script kon altijd draaien | Script weigert (en wijzigt niets) zonder migratie-objecten én een 2-ledenhuishouden met gesynchroniseerde onderdelen |
| Inbox meldde dezelfde situatie elke dag opnieuw | Sleutel = onderwerp + toestand; gelezen blijft gelezen |
| Foutmeldingen zonder vervolgstap | Meldingen noemen of lokale data veilig is en wat te doen |

Statusweergave (badge): Alleen dit apparaat · Offline · Synchroniseren… · Account-sync gelijk · Conflict · Aanmelden vereist · Sync controleren.

## Tests: wat is bewezen en wat niet
- `node --test <bestand>` per `*.test.js`; `node --check` op alle JS.
- **Gesimuleerd (nepserver in JS)**: `household-sync-core.test.js` — twee leden, vreemd huishouden, conflicten, races, offline/hervatten, mislukte RPC/migratie, deels mislukte push, accountwissel, reserved sections, legacy-sectie.
- **Echte SQL op een LOKALE tijdelijke PostgreSQL** (`migrations-pg.test.js`, met nagebouwde rollen/`auth.uid()` uit `supabase/tests/stub_supabase.sql`): migraties in volgorde, RLS/RPC-toegang per gebruiker, versiecontrole, naamvalidatie, ledenlimiet incl. echt parallelle sessies, legacy-import (dubbel, ander huishouden, oude rij onaangetast), fase-3-bewaking en effect, rollback + opnieuw toepassen. Wordt overgeslagen als PostgreSQL ontbreekt. **Dit bewijst de SQL-logica, niet dat live Supabase (PostgREST, echte Auth-JWT's, bestaande policies/grants) zich identiek gedraagt.**
- **Niet uitgevoerd**: browser-/apparaattests, live Supabase, e-mailbevestiging, echte twee-apparaten-test, pushmeldingen (buiten scope).

## Handmatige stappen (in deze volgorde)
**0. Vóór alles — back-ups (verplichte gate, zie bovenaan)**: (a) exporteer `household_data` en `coach_data` uit Supabase (CSV/`pg_dump`); (b) in de app op BEIDE apparaten: Instellingen › Back-up maken; bewaar het bestand buiten het apparaat; (c) noteer de rijaantallen (laatst bekend: household_data 4, coach_data 2).
**1. Controles vóór migratie** (SQL editor, alleen lezen): bestaan `households`, `household_members`, `chalkboard_messages`, `personal_preferences` nog NIET (verwacht); `select count(*) from household_data` = verwacht aantal; controleer dat Supabase Auth e-mailaanmelding aan staat.
**2. Migraties, elk apart en in deze volgorde**: `20261012000000_personal_preferences.sql` → `20261013000000_chalkboard.sql` → `20261014000000_household_state_sync.sql`. Stop bij een fout en ga NIET door; rollback zie hieronder. `coach_data` wordt niet geraakt.
**3. Controles na migratie**: tabellen `households`, `household_members`, `chalkboard_messages`, `personal_preferences`, `household_state`, `household_legacy_imports` bestaan met RLS aan; functies `create_household`, `join_household`, `put_household_state`, `import_legacy_household_data` bestaan; `household_data`/`coach_data` rijaantallen ongewijzigd; anon heeft geen toegang tot de nieuwe tabellen.
**4. Twee echte accounts, twee apparaten**: A: aanmelden (Instellingen › Persoonlijk account), huishouden aanmaken, uitnodigingscode noteren. B: aanmelden, "Toevoegen" met de code. Een derde account moet "maximaal twee accounts" krijgen. Op A en B dezelfde huishoudcode (sleutel) invullen. A: "Overstappen naar accountsync" (maakt legacy-kopie), controleer status "Account-sync gelijk". Daarna B hetzelfde; bij verschillen kies je per onderdeel.
**5. Acceptatiecriteria**: (1) alle bestaande gegevens zichtbaar op A en B, vergeleken met de back-up; (2) wijziging op A binnen ~1 min zichtbaar op B en omgekeerd; (3) wijziging van verschillende onderdelen op beide apparaten gaat niets verloren; (4) zelfde onderdeel op beide gewijzigd → conflictkeuze, geen stille overschrijving; (5) offline wijzigen en online zetten synchroniseert zonder verlies; (6) afmelden → status "Aanmelden vereist", lokale data intact; (7) een derde, niet-gekoppeld account ziet niets (probeer in de REST-API: `household_state` leeg); (8) `household_data` rijen onveranderd; (9) back-up maken/herstellen werkt nog op beide apparaten; (10) alle 19 pagina's bereikbaar.
**6. Fase 3 (anon intrekken) — alleen als**: stap 5 volledig geslaagd op BEIDE apparaten gedurende meerdere dagen, verse export van `household_data`/`coach_data` gemaakt, géén apparaat meer op de oude code-sync staat. Voer dan `supabase/manual/phase3_revoke_anon_household_data.sql` uit; het script weigert zelf als de migratie of een gebruikt 2-ledenhuishouden ontbreekt. Test daarna opnieuw stap 5 (2) en (5). Rollback fase 3: de GRANT/POLICY-regels onderaan het script.
**Fase 3 – veilige uitvoering**: het script bestaat uit één `DO`-blok dat eerst de voorwaarden controleert (migratieobjecten aanwezig; ≥1 huishouden met exact 2 leden én een niet-`legacy_full`-onderdeel in `household_state`) en pas daarna in hetzelfde blok de 3 anon-policies verwijdert en `select, insert, update` voor anon op `household_data` intrekt. Eén statement is atomair: faalt de controle, dan wordt niets gewijzigd, ook niet als de runner na een fout doorgaat (eerdere versie had losse statements na het blok). Plak het hele bestand in één keer; voeg er geen losse statements aan toe. Faalt het met "Fase 3 geweigerd": er is niets gewijzigd; controleer `select count(*) from pg_policies where tablename='household_data'` (moet 3 blijven), of migratie 20261014 volledig is toegepast en of beide accounts echt onderdelen hebben gesynchroniseerd. Lokaal bewezen op PostgreSQL (psql zonder ON_ERROR_STOP en als één query); in de Supabase SQL-editor niet getest — controleer daar na afloop de policy-telling.
**Rollback migratie 3**: in de app op beide apparaten "Terug naar oude code-sync" (kiest bij verschil bewust; veiligheidskopieën in `samenThuisPreAccountSyncBackup[Off]`), daarna `20261014000000_household_state_sync.rollback.sql` (verwijdert alleen `household_state`, `household_legacy_imports` en bijbehorende functies/trigger; export `household_state` eerst als je de onderdelen wilt bewaren). Migraties 1 en 2 zijn additief; verwijder die alleen met een eigen, gecontroleerde `drop` als dat nodig is. Herstel altijd vanuit de back-ups uit stap 0.

## Resterende risico's
- Live gedrag niet getest (zie boven); de oude anon-policies blijven tot fase 3 en tot dan kan iedereen met de huishoudcode-hash de oude rij lezen/schrijven.
- `import_legacy_household_data` vertrouwt erop dat de 64-hex legacy-ID alleen bij de huishoudcode-bezitters bekend is; de data blijft client-side versleuteld.
- Onderdelen worden per top-level sleutel gesynchroniseerd: twee wijzigingen in verschillende items van dezelfde lijst geven een conflict (geen automatische itemmerge).
- Meldingen en voorkeuren voor meldingen zijn lokaal per account; na aanmelden begint de inbox leeg.
- Pushmeldingen buiten scope.
