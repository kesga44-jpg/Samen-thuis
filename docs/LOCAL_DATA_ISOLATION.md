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
| Back-up/herstel | Matrix: account-back-up alleen in exact hetzelfde account + huishouden; bewaarde kopie met doel alleen in die identiteit; zonder bewezen herkomst alleen in het lokale profiel. `meta.version` 1–2; bekende onderdelen moeten het juiste type hebben; gereserveerde/ongeldige namen worden geweigerd. Onbekende onderdelen met een geldige naam blijven behouden (bewust: gegevensbehoud). `settings` en `sportCoach` komen nooit uit een back-up en staan niet meer in nieuwe back-ups. |
| Bewaarde gegevens | `retainedFor`: met doel uitsluitend voor die identiteit; zonder doel (quarantaine, oud archief) alleen in het lokale profiel na **Herstelmodus openen** (bevestiging, alleen voor die paginalading). Een account ziet nooit quarantaine of gegevens van een ander. Downloaden alleen uit de zichtbare lijst. |
| Tabbladconflicten | Per identiteit (`slot 'tab|<dataset>'`). Lijst, ophalen en terugzetten alleen binnen de actieve identiteit. Oude records (slot `local`) blijven bewaard maar zijn voor geen enkele identiteit op te vragen. |
| Financiële apparaatconflicten | `device`-records dragen `localKey` (de lokale dataset). Alleen zichtbaar/oplosbaar in die lokale identiteit; geen invloed op een accountronde. Bij de expliciete koppeling (`activate`) gaan open records van precies dat profiel mee (`adoptDevice`; nooit overschrijven). Oude records zonder `localKey` alleen zolang `samenThuisDataV2` het lokale profiel is. `legacy-unknown` alleen in het lokale profiel (naam van het onderdeel, geen bedragen). |
| `finance_config` | Eén identiteitsvergrendeling per handeling (`identityLock`): vóór elk verzoek moet het token van precies dat account zijn, na elk antwoord wordt een wissel gedetecteerd en het antwoord verworpen. Geen nieuw gelezen `uid()` tijdens opslaan. RPC's met `p_household` alleen voor het huishouden van de identiteit. Persoonlijke voorkeuren (`writePersonalPreferences25`) alleen voor het account waarvoor ze zijn samengesteld. |
| Huishoudcode | Per account + huishouden. In een account wordt de globale code nooit getoond of gebruikt om te schrijven. Alleen voor identiteiten die al vóór deze versie op dit apparaat bestonden (migratiedoel of versie-administratie) is hij een kandidaat, en die wordt pas overgenomen nadat hij bestaande cloudgegevens van precies dat huishouden ontsleutelt. Leeg huishouden: eerste versie alleen met een voor deze identiteit ingevulde of bewezen code. Verkeerde code bij bestaande gegevens: niets verstuurd. |

Een herlaadbeurt is geen bewijs dat een al verzonden verzoek is geannuleerd. Een upload die vóór de wissel is verzonden, wordt door de server verwerkt onder het token waarmee hij is verzonden (het oude account, in diens eigen huishouden of rij); de nieuwe identiteit verwerkt het antwoord niet. Bij terugkeer herkent de volgende ronde de al verwerkte upload zonder tweede upload (getest in `e2e/isolation-v7.mjs`).

## 6. Grenzen
- Twee accounts in hetzelfde huishouden op één apparaat hebben elk een eigen kopie (dubbele opslag).
- Gekoppelde of quarantainegegevens blijven in `samenThuisDataV2` staan tot een latere, bewuste opruimactie (opslagruimte).
- Huishoudcodes staan, net als vroeger de globale code, onversleuteld in localStorage (zelfde dreigingsmodel; B1).
- Het versiekenmerk van `finance_config` is een tijdstempel van het apparaat. Een gelijk teruggeschreven `updated_at` (ABA) laat een verouderde voorwaardelijke update slagen; vastgelegd in `migrations-pg.test.js`. Oplossing vereist een databasewijziging (RPC met serverrevisie, buiten opdracht 7).
- `exportIdentity` staat in het back-upbestand zelf: bescherming tegen vergissingen, geen bewijs tegen opzet.
- Oude globale sleutels (`samenThuisPreAccountSyncBackup`, `samenThuisPreMergeBackup`, `samenThuisSyncBaseV1`, `samenThuisSyncConflictV1`, `samenThuisPreV23Backup`, `samenThuisCorruptBackup`, `samenThuisRestoreHold`) blijven bewaard. Nieuwe identiteiten gebruiken ze niet; alleen het oorspronkelijke lokale profiel houdt die namen.
