# Sync-veiligheid: garanties, conflictvoorstel en integratietestplan (echte Supabase)

Status: voorstel en testplan. Er is niets uitgevoerd tegen een echt Supabase-project. Alle huidige tests gebruiken nagebootste opslag en/of een nagebootste Supabase (zie § 4).

## 1. Garanties en grenzen

| Onderdeel | Garantie | Grens |
|---|---|---|
| Eén syncronde per apparaat met Web Locks (`navigator.locks`) | Exclusief binnen één browserprofiel; vrijgegeven bij afsluiten of crash van het tabblad | Niet tussen verschillende browsers of profielen op hetzelfde apparaat |
| Terugval: lease in localStorage (`samenThuisSyncLeaseV1`) | **Best effort, niet exclusief.** Lezen, schrijven en controleren is niet atomair, en localStorage wordt tussen tabbladen met vertraging zichtbaar | Twee tabbladen kunnen allebei een ronde starten. Na een crash of bij een gepauzeerd achtergrondtabblad vervalt de lease na 30 s |
| Netwerkverzoeken | Time-out van 45 s per verzoek; een hangende verbinding houdt de lock niet onbeperkt vast | Een afgebroken upload is "onzeker" en wordt in de volgende ronde via versie en hash vastgesteld |
| Laatste verdedigingslinie | `put_household_state` accepteert alleen de verwachte versie (`40001` bij afwijking): twee schrijvers kunnen elkaar nooit stil overschrijven | Een tweede tabblad of apparaat ziet dan een (tijdelijk) conflict; de volgende ronde herstelt zich (adopt) |
| Syncmetadata | `status().durability`: IndexedDB = `durable`, localStorage = `limited`, geheugen = `session` | Bij `session` blijft ook de versie-administratie alleen in het geheugen, en de app meldt dat |

## 2. Volgorde van vastleggen na een ronde (`commitRound`)

1. Basiswaarden naar de metastore, met de vorige waarde erbij. Mislukt dit: **stop**. Er wordt geen versie als bevestigd geregistreerd.
2. Versie-administratie (`samenThuisAccountSyncV1.bases`, of in het geheugen bij `session`). Mislukt dit: **stop**. Omdat stap 1 de vorige waarde bewaarde, vindt de oude administratie haar basis nog.
3. Conflictsamenvattingen. Mislukt dit: een zichtbare waarschuwing; ze worden elke ronde opnieuw bepaald.
4. Inflight-registraties wissen (alleen bij status `ok`). Mislukt dit: een waarschuwing; de volgende geslaagde ronde wist ze alsnog.

Na een stop is de status `partial` en blijven de lokale gegevens staan. De volgende ronde ziet lokaal gelijk aan cloud en neemt de versie over (adopt), zonder tweede upload.

Beperking: mislukt stap 2 meerdere rondes achter elkaar, dan kan de bewaarde vorige waarde niet meer bij de oude administratie passen. De app vraagt dan per onderdeel om een keuze. Er gaat niets verloren.

## 3. Conflicten

### 3a. Gewone gegevens tussen tabbladen
Per pad worden de bewaarde waarde, de andere waarde en de basis vastgelegd (`SamenThuisTabConflicts.list/restore`). Dubbele meldingen worden één record. De laatste schrijfactie blijft lokaal staan; de andere waarde is herstelbaar.

### 3b. Financiële gegevens (opdracht 4, geïmplementeerd in `finance-conflict-core.js`)

| Regel | Uitwerking |
|---|---|
| Wat is financieel | Uitsluitend `FINANCIAL_SECTIONS` = `budget`, `budget19`, `budget219`, `budgetV22`, `budgetV23` (centraal, geen zoekwoorden) |
| Detectie | Sync: hetzelfde veld aan beide kanten anders gewijzigd (3-wegs). Tabbladen: idem via de tabbladbewaking. Herintroductie: een afgewezen waarde komt terug op dit apparaat |
| Record (één per onderdeel, IndexedDB) | Basis, lokale en concurrerende waarde; `localUser`, `remoteUpdatedBy` (`household_state.updated_by`), `detectedAt`, `remoteUpdatedAt`, onderdeel, cloudversie, oorsprong |
| Blokkade | Status `open`, `resolved-pending` of `confirmed`: het onderdeel wordt niet verstuurd, opgehaald of samengevoegd (`frozen`). Andere onderdelen synchroniseren door |
| Oplossen | Per conflicterend veld expliciet "deze waarde" of "andere waarde" (kaart in Instellingen → Synchronisatie, of `SamenThuisFinanceSync.resolve`). Niet-conflicterende verschillen worden gewoon samengevoegd |
| Volgorde | 1. keuze atomair vastleggen (`open` → `resolved-pending`) → 2. lokaal opslaan (fout: terugdraaien) → 3. versturen met de verwachte versie → 4. `confirmed` na serverantwoord → 5. record pas weg na duurzaam vastgelegde versie-administratie (niet bij `session`) |
| Cloud intussen gewijzigd | Ander veld: samengevoegd versturen. Zelfde veld: opnieuw `open` met een nieuwe keuze |
| Crash | Na stap 1: bij herstart alsnog lokaal toegepast (alleen als de lokale waarde nog die van het keuzemoment is). Na stap 4: afronden zonder nieuwe versie |
| Oude kopie | Ander apparaat: 3-wegs merge geeft daar een nieuw, expliciet conflict. Dit apparaat: 30 dagen per veld de hash van de afgewezen waarde; komt die terug, dan volgt een nieuw conflict (`reintroduction`) in plaats van een upload |
| Scope (opdracht 5) | Elk record hoort bij `'<accountId>:<huishoudenId>'` (key `fin|<scope>|<onderdeel>`). Een ronde ziet alleen records van de eigen scope. Tabbladconflict zonder bekende identiteit: scope `device` (blokkeert uit voorzorg zolang open; opgelost = `resolved-local`, waarden uit het record). Oude records zonder scope worden gemigreerd (identiteit uit het record), anders `device` (tabblad) of quarantaine `legacy-unknown` (bewaard, nooit verwerkt). Lokale budgetwaarde die nog bij een open conflict van een andere identiteit hoort, wordt in deze scope niet verstuurd of overschreven |
| Idempotent | Hetzelfde conflict → één record. Twee tabbladen met dezelfde keuze → één oplossing (compare-and-set in IndexedDB); een andere keuze wordt geweigerd |
| Audit | `finance-audit`: actie, onderdeel, paden, hashes, versies, gebruikers-id's, tijdstippen. Geen bedragen. Na afronding staan er geen financiële waarden meer in de conflictopslag |

Grenzen: zonder accountsync blijft een opgelost tabbladconflict op `resolved-pending` staan (er is geen server die bevestigt). Het blokkeert dan niets, maar blijft zichtbaar. In de localStorage-terugval is compare-and-set niet atomair tussen tabbladen. Een bewuste latere wijziging terug naar een afgewezen bedrag vraagt binnen 30 dagen om bevestiging.

## 4. Wat is echt getest en wat niet

| Soort | Waar | Wat |
|---|---|---|
| Echte browser, echte opslag | `e2e/sync-tabs.mjs` (Chromium) | Echte tabbladen, storage-events, IndexedDB, Web Locks, BroadcastChannel, herladen |
| Nagebootste opslag | `sync-tab-safety.test.js` | Nagebootste IndexedDB (incl. blocked, quota, time-out) en localStorage met vertraagde zichtbaarheid |
| Nagebootste Supabase | `sync-tab-safety.test.js` (fakeCloud), `e2e/sync-tabs.mjs` (route-mock) | Versiecontrole, netwerkverlies vóór en na commit, gelijktijdige schrijvers |
| Echte PostgreSQL (lokaal, echte migraties + RLS) | `migrations-pg.test.js` | Opdracht 7: voorwaardelijke `finance_config`-update met twee echte gelijktijdige sessies (precies één schrijver), ander account kan de rij niet zien of bijwerken; restrisico ABA vastgelegd |
| Echte browser, nagebootste Supabase | `e2e/isolation-v7.mjs` | Opdracht 7: back-upmatrix, bewaarde gegevens/conflicten per identiteit, twee huishoudcodes op één apparaat met herstart, fail-closed eerste push, vertraagde `finance_config`-verzoeken rond een (in het geheugen gesimuleerde) sessiewissel, upload verzonden vóór een accountwissel, huishoudwissel tijdens een vertraagde ronde, localStorage-fallback zonder IndexedDB |
| Nagebootste opslag en cloud | `isolation-m1.test.js` | M1: oud apparaatconflict zonder `localKey`, automatische migratie, onzekere herkomst, geblokkeerde upload, bewuste keuze en vrijgave |
| Echte browser, nagebootste Supabase | `e2e/isolation-v7.mjs` (M1-a t/m M1-d, A1, A2, G1) | M1 met echte IndexedDB en automatische migratie bij het laden (het oude record is met een tijdstip in het verleden in IndexedDB gezet), allowlist bij herstellen en samenvoegen via de echte importpagina, lokale quarantaine van onbekende onderdelen, afscherming tegen opvragen met een parameter via de console |
| **Vereist echte Supabase** | Dit plan, § 5 | RLS, echte versieconflicten, Auth-tokens, rate-limits, latentie, twee echte accounts |
| Niet getest | — | Safari/WebKit en Firefox (andere storage-event- en IndexedDB-implementaties), iOS-PWA, achtergrondbeperking (timer-throttling) op mobiel |

## 5. Integratietestplan met echte Supabase

**Omgeving:** een apart staging-project, niet productie (`vwfuetxgapzfivydzhxc`). Migraties zoals in productie, met synthetische gegevens. Gebruik twee testaccounts: A (Kees-test) en B (Daphne-test), in één huishouden. Daarnaast account C in een ander huishouden. Gebruik twee browsers (Chrome en Firefox), en Safari op een iPhone voor A.

**Voorbereiding per run:**

- Maak een JSON-back-up van alle browsers.
- Leg de stand van `household_state` vast met `select section, version, updated_by, updated_at from household_state where household_id = …`.
- Gebruik DevTools → Network-throttling of offline voor netwerkuitval.

| # | Scenario | Stappen | Verwacht | Controle |
|---|---|---|---|---|
| I1 | Twee accounts, gelijktijdige toevoegingen | A (Chrome) en B (Firefox) voegen binnen 1 s elk een andere boodschap toe | Na ≤ 2 rondes beide items bij A en B | `household_state.groceries.version` +2; geen conflictkaart |
| I2 | Zelfde veld gelijktijdig | A en B wijzigen dezelfde boodschaptitel | Conflictkaart bij de tweede; beide waarden zichtbaar | Cloudwaarde = die van de eerste; niets stil overschreven |
| I3 | Financieel veld gelijktijdig | A en B wijzigen hetzelfde bedrag in `budgetV23` | Financieel record bij de tweede; badge "Financieel conflict"; boodschappen synchroniseren door | Geen nieuwe `budgetV23`-versie tot de keuze; daarna precies één; `updated_by` van A staat in het record |
| I3b | Financiële keuze met netwerkuitval | B kiest, verbinding weg vóór/na upload, herstel | Record blijft tot bevestiging; daarna weg | Versie +1, niet +2 |
| I4 | Netwerkuitval vóór de upload | A offline, wijziging, sync | Status "Offline"; wijziging lokaal; na online automatisch verstuurd | Eén nieuwe versie |
| I5 | Onzekere upload (antwoord kwijt) | A: DevTools "Block request" op het antwoord van `rpc/put_household_state` (of het tabblad sluiten direct na verzenden) | Inflight in IndexedDB; status `partial` | Na herstel: `version` precies +1, `pushed` leeg, inflight leeg |
| I6 | Herstel na onzekere upload, ander apparaat eerst | Na I5 wijzigt B hetzelfde onderdeel voordat A terugkomt | A ziet de wijziging van B en voegt samen; geen tweede upload van de oude A-waarde | Versies oplopend zonder gaten |
| I7 | Server-side versieconflict | A en B pushen tegelijk (twee knoppen binnen 100 ms of via script) | Eén krijgt `40001`, ziet een conflict of rondt de volgende ronde af | Server-log: één geslaagde update per versie |
| I8 | Twee tabbladen, één account | A opent twee tabbladen en wijzigt in beide | Eén ronde tegelijk (Web Locks); geen dubbele versies | `household_state_write_audit` laat geen dubbele writes zien |
| I9 | Lek persoonlijke gegevens | A wijzigt thema, dashboard en privé-potjes (`finance_config`) | Alleen A-apparaten volgen; B ziet ze niet | Als B via REST: `personal_preferences?user_id=eq.<A>` geeft `[]` |
| I10 | Vreemd huishouden | C probeert `household_state` van het huishouden te lezen en `put_household_state` aan te roepen | `[]` respectievelijk `42501` | Geen rij gewijzigd |
| I11 | Rate-limit | Script: 100 wijzigingen in 1 min op A | Geen dataverlies; eventuele `P0001` geeft `partial` en een latere ronde rondt af | Eindstand gelijk op A en B |
| I12 | Opslagstatus | A in een privévenster (Firefox: IndexedDB kan ontbreken) | `metaStatus().durability` is `limited` of `session`; de badge meldt "niet duurzaam" bij `session` | Na herladen geen versie als bevestigd zonder basis |
| I13 | Crash tijdens ronde | Tijdens een vertraagde ronde (throttling "Slow 3G") het tabblad of proces killen | Na herstarten: lokale gegevens intact, inflight zichtbaar, volgende ronde rondt af | Zoals I5 |

**Afronding per run:** vergelijk de eindstand van alle browsers met de gedecodeerde cloudstand (via de app-export). Leg de resultaten vast in `docs/RC_VALIDATION.md` met datum, versies en browsers.

### 5b. Aanvullende scenario's na opdracht 7 (echte Supabase-staging, twee echte accounts)

1. Twee apparaten slaan tegelijk `finance_config` op vanaf dezelfde versie → precies één PATCH geeft één rij terug; de ander krijgt een conflictkeuze (via echte PostgREST).
2. Upload (`put_household_state`) verzonden vlak vóór afmelden; antwoord pas daarna → de rij staat in het huishouden van het oude account met `updated_by` = oud account; de nieuwe identiteit past niets toe.
3. Lezen van `personal_preferences` verzonden vlak vóór een wissel → het late antwoord wordt niet toegepast (DevTools: netwerkvertraging).
4. Nieuw account in een leeg huishouden zonder ingevulde code → geen enkel `put_household_state`-verzoek.
5. Bestaand account met de oude globale code → code pas overgenomen na ontsleutelen van bestaande rijen (`samenThuisHouseholdCodesV1.source = legacy-verified`).
6. Back-up van huishouden A terugzetten in huishouden B (zelfde en ander account) → geweigerd, geen herstelvlag gezet.
7. Apparaat met een oud financieel apparaatconflict (van vóór opdracht 7) en automatische migratie naar een account → conflict verschijnt bij dat account, onderdeel wordt niet verstuurd tot een keuze; bij een ander account op hetzelfde apparaat verschijnt alleen de waarschuwing zonder bedragen.

