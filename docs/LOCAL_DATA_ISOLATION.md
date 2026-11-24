# Lokale gegevensisolatie per account en huishouden (opdracht 6)

Status: geïmplementeerd op branch `fix/sync-tab-safety-idb-meta`. Getest met Node (nagebootste opslag en cloud) en in Chromium (echte `localStorage`, IndexedDB, storage-events en herlaadbeurten; nagebootste Supabase). Er is niets naar Supabase geschreven.

## 1. Audit (vóór deze opdracht)

| Onderwerp | Bevinding |
|---|---|
| Lezen | `app.js` `loadData()` via `data-core.js` `loadWithRecovery` (sleutel `samenThuisDataV2`, terugval `samenThuisDataV1`), één keer bij het laden |
| Schrijven | `app.js` `writeDataToStorage()` (enige plek sinds opdracht 2); `data-core.js` `writeRestored` (back-up en herstel) |
| Migreren | `migrateData()` bij elke load en restore; `preserveUnknownFields` |
| Verwijderen | Nergens (alleen herbouwbare synckopieën bij een volle opslag) |
| Account-ID | `samenThuisPersonalAuthV1.user.id` (in geheugen `authSession25`) |
| Huishouden-ID | `account-sync.js`: `st.household` (membership) of `samenThuisAccountSyncV1.householdId` (**één waarde voor het hele apparaat**) |
| Accountsync aan/uit | `samenThuisAccountSyncV1.enabled` (**voor het hele apparaat, niet per account**) |
| Uitloggen | Sessie weg; `data` bleef dezelfde dataset; de volgende aanmelder zag en synchroniseerde die |
| Ander account | Zelfde dataset; `slot()` kon tijdelijk `<B>:<huishouden van A>` zijn; de eerste ronde van B kon gegevens van A naar het huishouden van B sturen |
| Huishoudwissel | Zelfde dataset; `st.household` werd per paginalading onthouden |
| Verlopen sessie | Ronde faalt met auth-fout; geen identiteitsprobleem |
| Netwerk weg / crash | Gegevens bleven bewaard (opdracht 2); niet per identiteit |
| Achterblijvend in geheugen | `data`, finance-ui (`state.remote`, `state.personal`), krijtbord, aanbiedingen, timers en lopende rondes van het vorige account |
| Back-ups | Export zonder herkomst; import in elk account; herstelvlag, herstelkopieën en `samenThuisPreAccountSyncBackup` voor het hele apparaat |
| Serververdelingen financiën | `applyDistributions` schreef in elke actieve dataset, ook zonder accountsync |

Classificatie: huishoudgegevens (alle onderdelen van `data` behalve onderstaande), apparaat (`settings`, `sportCoach`, `meta`, caches, UI-sleutels), account (`personal_preferences`, Inbox per account, sessie).

## 2. Architectuur na deze opdracht

| Sleutel | Inhoud | Eigenaar |
|---|---|---|
| `samenThuisDataV3|<account>|<huishouden>` | Huishoudgegevens van één account binnen één huishouden (zonder SportCoach en settings) | account + huishouden |
| `samenThuisDataV2` | Altijd: `sportCoach` en `settings` (apparaat). Daarnaast het lokale profiel zolang dat niet aan een account is gekoppeld; anders bewaard (gekoppeld of quarantaine) | apparaat |
| `samenThuisDataV3|local` | Lokaal profiel nadat `samenThuisDataV2` gekoppeld of in quarantaine is | apparaat (geen account) |
| `samenThuisDataV3|local-archive|<tijd>` | Lokaal profiel dat expliciet aan een account is gekoppeld (archief, niet gewist). Opdracht 7: doel vastgelegd in `samenThuisDataMigrationV1.archives` | het gekoppelde account + huishouden; zonder doel: quarantaine |
| `samenThuisHouseholdCodesV1` | Opdracht 7: huishoudcode per `<account>|<huishouden>` (`code`, `source`: `entered`/`legacy-verified`, `verified`) | account + huishouden |
| `samenThuisAccountSyncV1.accounts[<account>]` | `{ enabled, householdId }` per account | account |
| `samenThuisDataMigrationV1` | Journaal van de migratie (`local`, `copying`, `bound`, `quarantined`) | apparaat |
| Herstel- en synckopieën | `…|<account>|<huishouden>` per identiteit; het oorspronkelijke lokale profiel houdt de oude namen | identiteit |

Regels:

- **Identiteit ligt vast per paginalading.** Ze wordt in `app.js` vóór het laden bepaald (`identity-store-core.js` `resolve`): `account` (sessie + accountsync aan voor dat account + bekend huishouden), `local` of `locked`.
- **`locked`**: accountsync aan, maar het huishouden is onbekend of de migratie is mislukt. Dan een lege dataset zonder voorbeelddata, niets schrijven, geen synchronisatie en een zichtbare melding.
- **Wissel** van account (aanmelden, afmelden, callback), huishouden (lidmaatschap anders), accountsync-instelling of migratiestatus (ook vanuit een ander tabblad): eerst `identitySwitching`, zodat er niets meer wordt geschreven. Daarna herladen. Lopende verzoeken, timers en callbacks verdwijnen met de pagina.
- **Synchronisatie**: elke ronde haalt het lidmaatschap opnieuw op en controleert dat de dataset bij precies dit account en huishouden hoort. Vóór elke schrijfstap volgt opnieuw `assertIdentity()`: herstel na crash, toepassen van cloudwaarden, versie-administratie, financiële afronding. Na een wissel schrijft een oude respons niets.
- **Serververdelingen** (financiën) worden alleen toegepast in de dataset van precies dat huishouden.
- **Back-ups** dragen hun herkomst (`meta.exportIdentity`). Een back-up van een account wordt alleen in hetzelfde account en huishouden teruggezet. Opdracht 7: oude, lokale en quarantaine-back-ups (geen bewezen herkomst) alleen in het lokale profiel, nooit in een account; bewaarde kopieën met vastgelegd doel alleen in die identiteit. Schema en versie worden vóór herstel gecontroleerd. Apparaatinstellingen en SportCoach worden nooit uit een back-up overgenomen.
- **Accountsync inschakelen** is een expliciete koppeling: het lokale profiel wordt naar het account gekopieerd, alleen als daar nog niets staat. Het lokale profiel wordt daarna nooit meer als lokaal profiel geladen (status `bound`, of archief).

## 3. Migratie (`migrateLegacy`, bij elke paginalading, idempotent)

| Situatie | Gedrag |
|---|---|
| Accountsync stond niet aan | `samenThuisDataV2` blijft het lokale profiel; niets verandert |
| Precies één slot `<account>:<huishouden>` in de versie-administratie | Kopie zonder SportCoach/settings naar die identiteit; verificatie via hash; journaal `bound`. `samenThuisDataV2` blijft staan |
| Meer slots, geen slot, onleesbaar of doel bestaat al | Quarantaine: niets gekopieerd, niets gewijzigd, nergens geladen of gesynchroniseerd; downloadbaar onder Instellingen → Back-ups |
| Crash tijdens kopiëren | Journaal `copying`: doel gelijk aan bron → afronden; doel ontbreekt → opnieuw; doel anders → quarantaine |
| Migratie faalt (bijv. opslag vol) | Accountidentiteit wordt `locked` (geen lege dataset die de cloud vult); volgende paginalading probeert opnieuw |

Oude gegevens worden niet automatisch verwijderd; de gekoppelde kopie blijft als herstelmogelijkheid staan. Er is geen automatische toewijzing aan het eerstvolgende account.

## 4. Financiële gegevensinventarisatie

| Onderdeel | Opslag | Eigenaar | Sync-route | Conflictbeveiliging | Resterend risico |
|---|---|---|---|---|---|
| `budgetV23` (incl. `financialLedger`, `goals`/spaardoelen, `incomes`, `fixed`, `finPots`) | Dataset per identiteit → `household_state` | huishouden | accountsync | Financieel record per veld, upload geblokkeerd tot keuze (opdracht 4/5) | Echte Supabase niet getest |
| `budget`, `budget19`, `budget219`, `budgetV22` (oude formaten) | idem | huishouden | accountsync | idem | Worden nog meegesynchroniseerd hoewel verouderd |
| `fuelEntries` (tankbedragen) | idem | huishouden | accountsync | **Nieuw**: in `FINANCIAL_SECTIONS` → zelfde veld = financieel conflict | — |
| Privé-potjes en -uitgaven (`personal_preferences.finance_config`) | Supabase-rij per account | account | finance-ui, direct | **Nieuw**: geen blinde upsert meer. Lezen → 3-wegs samenvoegen met de laatst geladen versie → `PATCH …&updated_at=eq.<gelezen>` (conditioneel). Veldconflict → niets geschreven, keuze "Mijn versie" of "Andere versie" | Het `updated_at`-filter is alleen met een nagebootste server getest |
| Inkomens en verdelingen (`finance_income_months`, `finance_distributions`) | Supabase-tabellen | huishouden | RPC's met versie- en idempotentiecontrole | Database (onveranderlijk, revisies) | Toepassen in de lokale ledger nu alleen in de dataset van hetzelfde huishouden |
| Prijsreferenties, aanbiedingen | dataset | huishouden (cache) | accountsync | Geen (geen persoonlijke financiën) | — |

## 5. Opdracht 7 — resterende isolatielekken

| Onderdeel | Regel |
|---|---|
| Back-up/herstel | Matrix: account-back-up alleen in exact hetzelfde account + huishouden; bewaarde kopie met doel alleen in die identiteit; zonder bewezen herkomst alleen in het lokale profiel. `meta.version` 1–2 (of geen meta); bekende onderdelen moeten het juiste type hebben; gereserveerde/ongeldige namen worden geweigerd. **Strikte allowlist** (`ACCOUNT_SECTIONS` in `identity-store-core.js`): een back-up met een ander onderdeel wordt in een account in zijn geheel geweigerd, de bestaande gegevens blijven ongewijzigd. In het lokale profiel gaan onbekende onderdelen naar een aparte quarantaine (`samenThuisDataV3\|quarantine\|<tijd>`), niet in de dataset. Dit geldt ook voor **Importeren → Volledige back-up (samenvoegen)** (`mergeBackupChecked`). `settings`, `sportCoach` en `meta` (herkomst) komen nooit uit een back-up; nieuwe back-ups bevatten geen `settings`. |
| Bewaarde gegevens | `retainedFor`: met doel uitsluitend voor die identiteit; zonder doel (quarantaine, oud archief) alleen in het lokale profiel na **Herstelmodus openen** (bevestiging, alleen voor die paginalading). Een account ziet nooit quarantaine of gegevens van een ander. Downloaden alleen uit de zichtbare lijst. |
| Conflictlogboek en syncmetadata | In de app is `SamenThuisSyncMeta.shared()` afgeschermd op de identiteit van de paginalading (`activeScope`): tabbladconflicten, basiswaarden, onbevestigde uploads, conflictsamenvattingen en financiële records gelden standaard voor de actieve identiteit; een parameter met een andere identiteit levert niets op (lezen leeg, schrijven geweigerd, bestaande records van een ander nooit overschreven). Tabbladconflicten alleen via de tabblad-API. Tijdens een wissel of zonder identiteit: niets. Oude records (slot `local`) blijven bewaard maar zijn voor geen enkele identiteit op te vragen. Er wordt niets verwijderd. Dit is lokale afscherming, geen vervanging voor serverbeveiliging. |
| Financiële apparaatconflicten | `device`-records dragen `localKey` (de lokale dataset). Alleen zichtbaar/oplosbaar (met waarden) in die lokale identiteit; geen invloed op een accountronde. Bij de expliciete koppeling (`activate`) gaan open records van precies dat profiel mee (`adoptDevice`; nooit overschrijven). `legacy-unknown` alleen in het lokale profiel (naam van het onderdeel, geen bedragen). |
| Oude apparaatconflicten zonder `localKey` (M1) | Bij elke paginalading en vóór elke accountronde (`classifyUntaggedDevice` met `legacyRecordOwner`): het profiel waarin het conflict ontstond volgt uit het migratiejournaal, de archieven en het tijdstip van het conflict. Nog het lokale profiel → `localKey` vastgelegd. Aantoonbaar gekoppeld aan een account (ontstaan vóór de koppeling, of in een archief met vastgelegd doel) → het record gaat met alle waarden naar die identiteit en blijft open (eerst nieuw record, dan pas het oude weg; bestaat daar al een record, dan blijft het oude staan). Niet betrouwbaar vast te stellen (quarantaine, archief zonder doel, migratie bezig, geen of ongeldig tijdstip) → gemarkeerd `ownerUnknown`. Zolang een open apparaatrecord geen `localKey` heeft, blokkeert het in **elke** accountronde de upload én het ophalen van dat onderdeel (`beforeRound`), ook als de koppeling zelf mislukt. Er wordt nooit een waarde gekozen. Oplossen: gekoppeld → keuze per veld zoals elk financieel conflict; onbekend → **Vrijgeven voor dit account** (geen waarde gekozen, eigen gegevens ongewijzigd, geldt alleen voor die identiteit; het record blijft bewaard en blijft andere identiteiten blokkeren). |
| `finance_config` | Eén identiteitsvergrendeling per handeling (`identityLock`): vóór elk verzoek moet het token van precies dat account zijn, na elk antwoord wordt een wissel gedetecteerd en het antwoord verworpen. Geen nieuw gelezen `uid()` tijdens opslaan. RPC's met `p_household` alleen voor het huishouden van de identiteit. Persoonlijke voorkeuren (`writePersonalPreferences25`) alleen voor het account waarvoor ze zijn samengesteld. |
| Huishoudcode | Per account + huishouden (`samenThuisHouseholdCodesV1`). In een account wordt de globale code (`samenThuisSyncV1.householdCode`) nooit getoond, nooit in de globale sleutel teruggeschreven en nooit gebruikt om naar een leeg huishouden te schrijven. Hij is alleen een **kandidaat** voor een identiteit die (a) het doel is van de koppeling van het oorspronkelijke lokale profiel in het migratiejournaal (automatische migratie, of de expliciete overstap waarbij `samenThuisDataV2` wordt gekoppeld), of (b) al in de versie-administratie (`samenThuisAccountSyncV1.bases`) van dit apparaat staat. Een kandidaat wordt pas de code van die identiteit (`source: legacy-verified`) nadat hij bestaande cloudgegevens van precies dat huishouden heeft ontsleuteld. Elke andere identiteit vult de code zelf in (`source: entered`). Leeg huishouden: eerste versie alleen met een zelf ingevulde of bewezen code. Verkeerde code bij bestaande gegevens: niets verstuurd. |

Een herlaadbeurt is geen bewijs dat een al verzonden verzoek is geannuleerd. Een upload die vóór de wissel is verzonden, wordt door de server verwerkt onder het token waarmee hij is verzonden (het oude account, in diens eigen huishouden of rij); de nieuwe identiteit verwerkt het antwoord niet. Bij terugkeer herkent de volgende ronde de al verwerkte upload zonder tweede upload (getest in `e2e/isolation-v7.mjs`).

## 5b. Na opdracht 7 (24-11-2026)

| Onderdeel | Regel |
|---|---|
| Opruimen | Op verzoek, nooit automatisch. Per bewaard item dat de actieve identiteit mag zien: eerst automatisch een download van precies dat item, daarna een expliciete bevestiging. `samenThuisDataV2`: alleen de huishoudgegevens verdwijnen; SportCoach, apparaatinstellingen en de revisie-administratie blijven; het journaal krijgt `v2Cleared`. Archief/quarantaine: verwijderd, met een grafsteen (`discarded`) zodat de eigenaarsbepaling van M1 gelijk blijft. Oude conflictregistraties (slot `local`, `legacy-unknown`): alleen in het lokale profiel in de herstelmodus, na download en bevestiging. Open apparaatconflicten die de upload blokkeren (M1) worden nooit zo opgeruimd. |
| Controlewaarde huishoudcode | Wie een leeg huishouden als eerste vult, zet eerst het onderdeel `keycheck` (versleuteld met de code, versie 0). Tegelijk starten met een andere code: versieconflict, daarna ontsleutelfout op `keycheck`, niets verstuurd. `keycheck` komt nooit in de lokale gegevens en wordt uit back-ups genegeerd. Bestaande huishoudens zonder `keycheck` worden gecontroleerd op hun eerste onderdeel, zoals voorheen. |
| `finance_config` | Met migratie `20261124000000_finance_config_revision.sql` (handmatig toe te passen): opslaan via `save_finance_config(p_expected_revision, p_config)`, revisie door de database opgehoogd (ook bij wijzigingen via de oude route, via een trigger). Zonder die migratie valt de app automatisch terug op de voorwaardelijke PATCH op `updated_at`. |
| Huishoudprofielen | Een laat antwoord van `household_profile_list` na een accountwissel wordt niet toegepast. |

## 6. Grenzen
- Twee accounts in hetzelfde huishouden op één apparaat hebben elk een eigen kopie (dubbele opslag).
- Gekoppelde of quarantainegegevens blijven in `samenThuisDataV2` staan tot een latere, bewuste opruimactie (opslagruimte).
- Huishoudcodes staan, net als vroeger de globale code, onversleuteld in localStorage (zelfde dreigingsmodel; B1).
- Zolang migratie `20261124000000_finance_config_revision.sql` niet is toegepast, gebruikt `finance_config` nog de tijdstempel van het apparaat als versie (ABA-risico, vastgelegd in `migrations-pg.test.js`). Na toepassen is dat opgelost (getest op lokale PostgreSQL).
- `exportIdentity` staat in het back-upbestand zelf: bescherming tegen vergissingen, geen bewijs tegen opzet.
- Wat lokaal in quarantaine blijft (niet geladen, niet gesynchroniseerd, nergens verwijderd): `samenThuisDataV2` met status `quarantined`; archieven zonder vastgelegd doel (`samenThuisDataV3|local-archive|<tijd>`); onbekende onderdelen uit back-ups (`samenThuisDataV3|quarantine|<tijd>`); tabbladconflicten van vóór opdracht 7 (IndexedDB, slot `local`); financiële records `legacy-unknown` en apparaatrecords met `ownerUnknown`. Downloaden kan alleen in het lokale profiel na **Herstelmodus openen** (de records in IndexedDB worden niet in de interface getoond).
- Het eigenaarsoordeel van M1 rust op de apparaatklok (tijdstip van het conflict tegenover het migratiejournaal). Een sterk verzette klok kan een conflict aan het verkeerde profiel toewijzen; dat gaat alleen tussen profielen van hetzelfde apparaat, en een conflict zonder geldig tijdstip blijft blokkeren.
- De vrijgave van een onbekend oud conflict is een bewuste keuze van de gebruiker per identiteit; de app kan niet controleren of het conflict werkelijk niet bij die identiteit hoort.
- De allowlist is afgeleid uit de onderdelen die de app nu leest en schrijft. Een onderdeel van een toekomstige module moet eerst aan `ACCOUNT_SECTIONS` worden toegevoegd voordat een back-up ervan in een account kan worden hersteld (tot dan: geweigerd, niets verloren).
- De importpagina voor losse lijsten (CSV/Excel/JSON per doel, budget- en FuelMate-import) voegt door de gebruiker gekozen inhoud toe aan de actieve identiteit; dat is geen back-upherstel en valt buiten de herkomstcontrole.
- Wie het browserprofiel kan openen of code in de pagina kan uitvoeren, kan localStorage en IndexedDB rechtstreeks lezen. Alle lokale afscherming beschermt tegen vergissingen; de grens tussen accounts ligt bij de server (RLS en lidmaatschapscontrole).
- Oude globale sleutels (`samenThuisPreAccountSyncBackup`, `samenThuisPreMergeBackup`, `samenThuisSyncBaseV1`, `samenThuisSyncConflictV1`, `samenThuisPreV23Backup`, `samenThuisCorruptBackup`, `samenThuisRestoreHold`) blijven bewaard. Nieuwe identiteiten gebruiken ze niet; alleen het oorspronkelijke lokale profiel houdt die namen.
