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

## 3. Technisch voorstel: conflicten tussen tabbladen (nog geen interface)

**Nu geïmplementeerd:**

- Per conflicterend pad (bijv. `budgetV23.pct`, `groceries[g1].title`) worden de bewaarde waarde (`kept`), de andere waarde (`other`) en de basis bewaard in IndexedDB.
- Dezelfde botsing, gemeld door twee tabbladen, wordt één record met een teller. De sleutel is het pad plus beide waarden.
- Openstaande conflicten worden niet opgeruimd ten gunste van nieuwe. Opgeloste blijven tot maximaal 50 bewaard; de harde bovengrens is 500.
- Financiële paden (onderdelen `budget*` en `finan*`) krijgen `financial: true` en een eigen, expliciete melding.
- Herstel (technisch): `SamenThuisTabConflicts.list()` en `SamenThuisTabConflicts.restore(key, 'other' | 'kept' | 'base')` zetten de waarde terug op het pad en markeren het conflict als opgelost.

**Voorstel voor de volgende opdracht:**

1. **Financiële tabbladconflicten blokkeren de upload van dat onderdeel.** Zolang er een openstaand `financial`-record voor een onderdeel is, verstuurt accountsync dat onderdeel niet. Het staat dan in de conflictlijst met de keuzes "deze waarde", "andere waarde" of "basis". Zo kan een financiële waarde de cloud nooit bereiken zonder bewuste keuze.
2. **Interface:** de bestaande conflictkaart in Instellingen uitbreiden met tabbladconflicten. Toon het pad als leesbaar label met de twee waarden naast elkaar, en een herstelknop die `restore` aanroept. Toon ook een melding in de Inbox (categorie `sync`).
3. **Gewone gegevens:** de laatste schrijfactie blijft automatisch winnen, maar de andere waarde blijft 30 dagen herstelbaar.
4. **Uitbreiding naar sync-conflicten tussen apparaten:** dezelfde regel voor `budget*`-onderdelen in `runAccountSync` (beleid B2). Een veldconflict wordt bij "Beide samenvoegen" dan niet automatisch "cloud wint" voor financiële paden.

Tests voor de detectie staan in `sync-tab-safety.test.js` (R5a–R5d, R8) en `e2e/sync-tabs.mjs`.

## 4. Wat is echt getest en wat niet

| Soort | Waar | Wat |
|---|---|---|
| Echte browser, echte opslag | `e2e/sync-tabs.mjs` (Chromium) | Echte tabbladen, storage-events, IndexedDB, Web Locks, BroadcastChannel, herladen |
| Nagebootste opslag | `sync-tab-safety.test.js` | Nagebootste IndexedDB (incl. blocked, quota, time-out) en localStorage met vertraagde zichtbaarheid |
| Nagebootste Supabase | `sync-tab-safety.test.js` (fakeCloud), `e2e/sync-tabs.mjs` (route-mock) | Versiecontrole, netwerkverlies vóór en na commit, gelijktijdige schrijvers |
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
| I3 | Financieel veld gelijktijdig | A en B wijzigen hetzelfde bedrag in `budgetV23` | Conflict, nooit automatisch gekozen | Zoals I2; geen nieuwe versie zonder keuze |
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
