# docs(beleggen): ontwerpdossier en ADR 0001 beleggen en vermogensbeheer

**Branch:** `beleggen/ontwerpdossier` → `main`. **Status:** lokaal klaar. Nog niet gepusht, omdat de sessie geen schrijfrechten heeft.

## Doel

Het goedgekeurde ontwerp voor beleggen en vermogensbeheer in de repository vastleggen: roadmap F7 van `personal-ecosystem` vraagt "eigen ADR in Samen Thuis". Dit is alleen documentatie. Eén onderwerp, volgens ADR 0011 van het ecosysteem.

## Gewijzigd (12 nieuwe bestanden, 0 gewijzigd, 0 verwijderd)

- `docs/adr/0001-beleggen-en-vermogensbeheer.md`
- `docs/beleggen/00-README.md` tot en met `08-importinventarisatie.md` (9 bestanden)
- `docs/beleggen/ontwerp-migratie.sql`: ontwerp. **Niet** in `supabase/migrations/`, wordt nergens tegen Supabase uitgevoerd.
- `docs/beleggen/ontwerp-beleggen-pg.test.js`: test van het ontwerp op een tijdelijke lokale PostgreSQL.

**Niet gewijzigd:** app-code, bestaande tests, migraties, rollbacks, edge functions, de versleutelde budgetopslag en de knop "Inleg bevestigen". Er zit geen CI-workflow in deze PR; die komt uit `personal-ecosystem` F1 PR-1.

## Getest

- `node --test *.test.js` als niet-rootgebruiker: 260 tests, 256 geslaagd, 0 mislukt, 4 overgeslagen. Dat is gelijk aan de uitgangssituatie; de overgeslagen tests missen optionele bibliotheken voor xlsx, mammoth en OCR.
- `node --test docs/beleggen/ontwerp-beleggen-pg.test.js` als niet-rootgebruiker: 10 van 10 geslaagd. Gecontroleerd:
  - privacy van rekeningen, producten, koersen, imports en audit tussen huisgenoten;
  - een vreemd huishouden ziet niets;
  - ontdubbeling bij import;
  - onveranderlijke historie;
  - vormcontrole per transactietype;
  - geen toekomstige datums;
  - alleen een totaalbedrag delen na expliciete vrijgave;
  - ISO-4: `search_path` leeg en geen `EXECUTE` voor anon;
  - de migratie kan twee keer achter elkaar worden uitgevoerd.

## Niet getest

- Niets tegen live Supabase. Dat is ook niet de bedoeling.
- De ontwerptest draait nog niet in CI. Hij komt mee zodra F1 PR-1 is gemerged, of wordt in PR 1 onderdeel van `migrations-pg.test.js`.

## Risico's en open punten

- **Laag:** alleen documentatie.
- De beleggings-PR's die volgen hebben F1 PR-1 (CI) nodig.
- In de ecosysteem-roadmap staat F7 ná F3. Jouw akkoord van 7 november geldt voor de beleggings-PR's; bevestig dat F7 nu al mag starten.
- **CoinGecko:** het bewaren van dagwaarden moet worden nagevraagd vóór PR 4.
- **EODHD:** wordt niet gebruikt (licentie).
- Samen-thuis heeft geen `CHANGELOG.md`. Volgens CLAUDE.md §4 moet die minimaal worden bijgewerkt. Een changelog aanmaken valt buiten deze PR; dat is een aparte beslissing.
- De commit staat op naam van "Claude <noreply@anthropic.com>". Pas dat desgewenst aan met `git commit --amend --reset-author`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DXboTaedeVemZshBNhLu6R
