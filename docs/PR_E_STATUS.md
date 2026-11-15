# PR E — implementatiestatus en resterende blokkades

## Aantoonbaar afgedwongen door deze codewijzigingen

- `household-sync-core.js` sluit `sportCoach` uit van lokale account-sync-projectie en negeert oude remote rijen vóór decryptie. `legacy_full` wordt niet teruggeschreven; alleen toegestane gewone velden kunnen daaruit worden voorgesteld.
- `account-sync.js` toont geen SportCoach-onderdeel en claimt niet langer dat apparaten gelijk zijn. De nieuwe app pauzeert de oude code-sync en roept `import_legacy_household_data` niet aan.
- Generieke JSON-back-ups laten `sportCoach` weg. Generiek herstel en samenvoegen behouden de lokale SportCoach-waarde en herstellen die niet uit een oudere backup. Bestaande lokale SportCoach-data blijft leesbaar en beschikbaar voor de lokale module.
- Een eerder opgeslagen legacy-syncconflict biedt geen versieknoppen meer en wordt niet toegepast of overschreven.
- `migrateData()` behoudt ook onbekende geneste `meta`-velden.
- De additieve migratie `20261115090000_pr_e_sportcoach_sync_guard.sql` weigert inserts en updates van SportCoach-rijen in `household_state` en trekt de client-uitvoerbaarheid van de opaque legacy-import-RPC in.

Dit zijn uitspraken over repositorycode en tests, niet over een toegepaste databaseconfiguratie. De migratie is niet uitgevoerd op Supabase, staging of productie.

## Beveiligingsgrenzen

| Pad | PR E | Wat blijft open |
|---|---|---|
| Nieuwe account-sync vanuit deze client | SportCoach wordt niet geprojecteerd; servermigratie weigert die sectie | Serverguard geldt pas na afzonderlijke migratietoepassing |
| Oude account-syncrijen | Oude remote SportCoach-rij wordt genegeerd; lokale data blijft staan | Bestaande rij wordt niet verwijderd en blijft serverdata |
| `legacy_full` in `household_state` | Nieuwe client importeert deze payload niet; client-RPC-recht wordt ingetrokken | Payload/rij blijft bestaan; oudere clients of niet-bewezen routes zijn niet afgedekt door de nieuwe clientcode |
| Legacy `household_data` | Deze client pauzeert de legacy-code-sync | Database, bestaande rijen en oude clients blijven onaangeroerd; volledige afsluiting is DB-1 |
| SportCoach Storage | Geen objecten gelezen, verplaatst of verwijderd | Productieobjecten zijn niet geïnventariseerd; onbekende, ontbrekende of onleesbare objecten blokkeren een volledige export |
| Lokale opslag | Generieke backup/restore kan SportCoach niet meer overschrijven | `samenThuisDataV2` blijft leesbare JSON; geen device-only encryptie of lokale opslagmigratie |
| Export/import | Veilige functie is niet beschikbaar en de UI zegt dat expliciet | Geen AES-GCM-container, manifest, complete inventaris, decryptie-preview of lokaal herstel geïmplementeerd |
| Verificatie en consent | Geen nieuwe verificatiestatus wordt geclaimd | JCS/RFC 8785, duplicate-key-detectie, versiegebonden consent/revisies, attestaties en offline-veroudering zijn nog niet geïmplementeerd |

De oude legacyroute kan nog gezondheidsgegevens bevatten. PR E is daarom geen bewijs dat alle oude toegangswegen zijn geblokkeerd of dat beide apparaten actuele, identieke gegevens hebben.

## Niet opgelost vóór review

- [ ] Inventariseer uitsluitend objecten binnen de bevoegde huishoudscope; vergelijk actieve `sportCoach.library`-verwijzingen met Storage-objecten. Classificeer bekend actief, bekend verweesd, onbekend, ontbrekend en onleesbaar. Verwijder of verplaats niets. Tot een complete inventaris is bewezen, blijft export uitgeschakeld.
- [ ] Laat exportformaat, KDF-parameters, Web Crypto-gebruik, afzonderlijke bestandsencryptie/manifest en importvalidatie onafhankelijk beoordelen; gebruik geen eigen streamingprotocol of onversleutelde fallback.
- [ ] Ontwerp een niet-destructieve device-only opslagmigratie met expliciete verificatie en herstelpad. Houd bestaande plaintext-opslag intact tot een afzonderlijk gecontroleerde overstap is goedgekeurd.
- [ ] Implementeer en test de goedgekeurde JCS-projectie, duplicate JSON-key-detectie, scope-/mapping-/contractversies, consent van beide leden, revisie-invalidatie en uitsluitend lokale verouderingsstatus. Houd de zes bestaande verificatiestatussen ongewijzigd.
- [ ] Beoordeel de migratie en RPC/RLS/grants op een synthetische lokale PostgreSQL 14–16-omgeving als niet-root; daarna is staging afzonderlijk besluit nodig. Productie blijft buiten deze PR.
- [ ] Voer de DB-1-voorbereidingen uit: beide leden op accountsync, controles en incompleetheden vastleggen, database- én Storage-back-up, geslaagde restoretest en afzonderlijke stagingvalidatie. Productieafsluiting vereist daarna nog expliciete toestemming.

## Tests en bewijsstatus

Volledige suite op Node.js met lokale PostgreSQL 16 (niet-root, synthetische gegevens): **403 tests, 390 geslaagd, 0 mislukt, 13 overgeslagen**. Daarvan slaan 8 optionele documentimport-/OCR-tests bibliotheken of OCR-taaldata over die niet zijn geïnstalleerd; 5 lokale Supabase-Docker-tests zijn overgeslagen omdat deze sessie geen Docker-toegang heeft. De SQL-semantiektests valideren de migratie, trigger, grants en rollback uitsluitend in de lokale stubomgeving. Er is geen browser-, staging- of productietest uitgevoerd; GitHub Actions is voor deze branch nog niet gedraaid.

## Herstel en rollback

De SQL rollback verwijdert uitsluitend de nieuwe trigger/functie en herstelt `EXECUTE` voor de legacy-import-RPC. Daarmee heropent zij bewust een pad dat de PR beveiligt; voer deze rollback niet automatisch uit. Rollback van de client kan oudere code opnieuw toestaan SportCoach in huishoudsync of generieke backup te verwerken. Er is geen data-cleanup nodig of toegestaan voor deze codewijziging.

## Goedkeuringsgrenzen

- Deze PR voert geen database-, Storage-, staging- of productiehandeling uit.
- DB-1, productie-legacyafsluiting, Storage-mutaties, gegevensverwijdering en iedere export/import van persoonsgegevens vereisen elk hun eigen voorwaarden en expliciete goedkeuring.
- De PR blijft Draft en is niet klaar om te mergen zolang de verplichte blokkades hierboven niet afzonderlijk zijn opgelost en beoordeeld.
