# Datamodel Samen Thuis

## 1. Lokale opslag (`localStorage`)

| Sleutel | Inhoud | Sync | In back-up |
|---|---|---|---|
| `samenThuisDataV2` | Alle huishoudgegevens (zie § 2) | Ja (per top-level onderdeel, versleuteld) | Ja |
| `samenThuisDataV1` | Oude versie, alleen migratiebron | Nee | — |
| `samenThuisSyncV1` | Huishoudcode, laatste synctijd (legacy-route) | Nee | Nee |
| `samenThuisSyncConflictV1`, `samenThuisRestoreHold` | Conflict- en herstelstatus | Nee | Nee |
| `samenThuisPreV23Backup`, `samenThuisCorruptBackup`, `samenThuisPreRestoreBackup` | Veiligheidskopieën | Nee | — |
| `samenThuisPersonalAuthV1` | Supabase-sessie (persoonlijk account) | Nee | Nee |
| `samenThuisQuoteCacheV1` | Citaat van de dag (alleen RSS-tekst) | Nee | Nee |
| **`samenThuisFoodCacheV1`** 🆕 | Open Food Facts-cache per barcode `{ code: { t, p } }`, max 200, 30 dagen | Nee (apparaatgebonden, geen persoonsgegevens) | Nee |
| **`samenThuisFoodRate_product`, `_search`** 🆕 | Tijdstempels voor de verzoeklimiet | Nee | Nee |
| **`samenThuisSyncBaseV1`** 🆕 | Oude code-sync: gegevens zoals na de laatste geslaagde synchronisatie (basis voor automatisch samenvoegen) | Nee | Nee |
| **`samenThuisAccountSyncBaseValuesV1`** 🆕 | Accountsync: waarde per onderdeel bij de laatste geslaagde ronde (per account + huishouden) | Nee | Nee |
| **`samenThuisPreMergeBackup`** 🆕 | Kopie van de lokale gegevens vlak vóór een automatische samenvoeging | Nee | Nee |

De drie sync-basissleutels zijn herbouwbaar: bij een volle opslag ruimt `save()` ze eerst op en valt de app terug op "kies een versie". Ze staan, net als alle huishouddata, onversleuteld op het apparaat (zie `docs/SECURITY.md` S-9).

## 2. `samenThuisDataV2`

Bestaande onderdelen blijven ongewijzigd: `meta`, `settings` (lokaal), `planning`, `calendars`, `meals`, `groceries`, `freezer`, `chores`, `stock`, `ideas`, `home`, `trip*`, `dailyAnswers`, `budget*`/`budgetV23` (ledger in centen), `priceReferences`, `offers25`, `challengeDataV26`, `sportCoach`, enz. `migrateData` neemt onbekende velden ongewijzigd over (v23.1-principe).

### Wijziging aan bestaand onderdeel (additief)

`meals[]` krijgt optioneel `recipeId: string` — koppeling aan een recept in `nutrition.recipes`. Oude maaltijden zonder dit veld werken ongewijzigd. Bij het verwijderen van een recept wordt alleen de koppeling verwijderd, nooit de maaltijd.

### Nieuw onderdeel `nutrition` 🆕

```js
nutrition: {
  version: 1,
  products: [{
    id: 'off-8710400000006' | 'man-…',
    barcode: '8710400000006' | '',
    name, brand, quantity, servingSize,       // tekst
    servingGrams: number | null,
    per100g:    { energyKcal, fat, saturatedFat, carbohydrates, sugars, fiber, proteins, salt },  // number | null
    perServing: { … zelfde sleutels … },        // number | null
    derived: ['energyKcal' | 'salt' | 'perServing'],   // welke waarden berekend zijn
    noNutritionData: boolean,
    ingredientsText: string,
    allergens: string[], traces: string[],
    allergensStatus: 'declared' | 'none-declared' | 'unknown',
    nutriscore: 'a'…'e' | null, nova: 1…4 | null,
    source: 'openfoodfacts' | 'manual', sourceUrl, license,
    fetchedAt: ISO, offModifiedAt: ISO | null,
    quality: { score: 0…100, level: 'goed'|'gedeeltelijk'|'beperkt', issues: string[], knownNutrients }
  }],
  recipes: [{                      // alleen-lezen kopieën uit Osta of een receptbestand (ADR 0001)
    // — receptinhoud (uit de bron; in Samen Thuis niet bewerkbaar, bij herimport wint de bron) —
    id, title, servings: 1…50, servingsKnown: boolean,
    ingredients: [{ id, text, name,
                    grams: number | null, gramsApprox: boolean,   // gram uit de brontekst, anders annotatie
                    productId: string | null }],                  // annotatie Samen Thuis
    steps: string[], tags: string[], notes: string,
    declaredPerServing: { …voedingssleutels… } | null,   // zoals opgegeven door de bron
    source: 'osta' | 'schema.org' | 'samen-thuis' | 'import' | 'manual'(*),
    externalRef: string | null, sourceUrl: 'https://…' | '', importedAt: ISO | null,
    // — annotaties Samen Thuis —
    servingsOverride: number | null,                     // porties voor de planning
    createdAt, updatedAt
  }]
}
```

(*) `manual` komt alleen voor in data uit de niet-gemergde testversie 26.0; Samen Thuis maakt geen recepten meer aan.

Regels:

- **Receptinhoud is van Osta.** Samen Thuis legt alleen productkoppeling, gram (waar de bron geen gewicht geeft) en planningsporties vast.
- **Onbekend is `null`, nooit 0.** Berekende totalen zijn alleen "volledig" als elk ingrediënt voor die waarde een product én gewicht heeft; anders ondergrens (≥) met dekking (`known`/`missing`).
- Grenzen: 500 producten, 500 recepten, 60 ingrediënten per recept, teksten afgekapt (titel 160, ingrediënten 4.000 tekens).
- Geen persoonsgegevens: geen persoon per maaltijd/inname, geen lichaams- of gezondheidsvelden (getest in `nutrition-integration.test.js`).
- Synchronisatie: `nutrition` is één onderdeel in `household_state` (versleuteld). Gelijktijdige wijziging op twee apparaten → conflict, gebruiker kiest per onderdeel (bestaand gedrag). Grootte: ~1–3 kB per product; bij 200 producten ruim binnen de bestaande payloads.

## 3. Uitwisselingsformaat `samen-thuis.recipes` v1

Zie `osta-exchange-core.js` (`exportBundle`) en `docs/API_INTEGRATIONS.md` § 3. Checksum per recept (FNV-1a, alleen voor reconciliatie, geen beveiliging).

## 4. Database (Supabase project A, schema `public`)

Ongewijzigd in deze set. Tabellen en RLS: zie `supabase/migrations/` en `personal-ecosystem/REPO_ANALYSIS.md` § Fase 2.

| Tabel/functie | Doel | RLS |
|---|---|---|
| `household_data` | Legacy versleutelde payload | Aan; `anon` lezen/invoegen/bijwerken met `using (true)` (R1) |
| `households`, `household_members` | Huishouden (max 2 leden) | Leden lezen; schrijven via RPC |
| `household_state`, `household_legacy_imports` | Accountsync per onderdeel | Leden lezen; schrijven via `put_household_state` |
| `personal_preferences` | Voorkeuren, profiel | Alleen eigenaar |
| `chalkboard_messages` | Krijtbord | Leden |
| `finance_income_months`, `finance_income_history`, `finance_distributions` | Inkomens en verdelingen | Leden lezen; RPC; updates geblokkeerd |
| Buckets `sport-training`, `profile-photos` | Privébestanden (met grootte- en MIME-limiet) | Lidmaatschap/eigenaar |
