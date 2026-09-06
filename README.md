# Samen Thuis

Een zelfstandige gezamenlijke thuisapp voor Kees en Daphne. De app draait als
PWA op GitHub Pages en werkt ook offline op iPhone, iPad en laptop.

## Functies

- dagelijkse vraag waarvan de antwoorden pas zichtbaar worden nadat Kees en
  Daphne allebei hebben geantwoord;
- Quote of the Day via `https://www.brainyquote.com/link/quotebr.rss`, met de
  officiële BrainyQuote-Javascriptfeed als browserfallback;
- agenda met afzonderlijk zichtbare agenda's voor Persoonlijk, Vitestro,
  Coach O23 en Daphne werk;
- import vanuit Apple Agenda via een Apple Opdracht;
- weekmenu en snelle Osta-import;
- boodschappenlijst uploaden of plakken, met automatische categorieën;
- volledig geel huishoudschema per week;
- huishoudtaken met `Eenmalig`, `Dagelijks`, `Wekelijks`, `2× per week`,
  `Elke 2 weken` en `Maandelijks`;
- voorraad, ideeën, woninginformatie en reizen;
- lokale offline opslag, JSON-back-ups en optionele versleutelde synchronisatie.

Bestaande gegevens uit de vorige appversie worden bij de eerste start
automatisch omgezet. Een afgeronde huishoudtaak wordt voortaan per datum
bijgehouden, zodat een terugkerende taak in een volgende week weer open staat.

## Publiceren via GitHub Pages

1. Open op GitHub **Settings → Pages**.
2. Kies bij **Build and deployment** voor **Deploy from a branch**.
3. Selecteer branch **main**, map **/(root)** en kies **Save**.
4. Open de Pages-link op elk apparaat en kies in Safari eventueel
   **Zet op beginscherm**.

De app zelf gebruikt geen externe AI-dienst. Zonder synchronisatie blijven de
gegevens alleen op het apparaat waarop ze zijn ingevoerd.

## Synchronisatie tussen apparaten

Synchronisatie is optioneel en gebruikt een gratis Supabase-project als
opslag. De volledige appinhoud wordt in de browser met AES-GCM versleuteld
voordat deze wordt verzonden. Supabase ontvangt alleen versleutelde data.

1. Maak een Supabase-project.
2. Open **SQL Editor** en voer dit één keer uit:

```sql
create table public.household_data (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.household_data enable row level security;

create policy "encrypted household read" on public.household_data
  for select to anon using (true);
create policy "encrypted household insert" on public.household_data
  for insert to anon with check (true);
create policy "encrypted household update" on public.household_data
  for update to anon using (true) with check (true);
```

3. Ga in de app naar **Instellingen**.
4. Vul de Project URL, de publishable/anon key en een gedeelde huishoudcode van
   minimaal twaalf tekens in.
5. Gebruik op elk apparaat exact dezelfde drie gegevens.

De huishoudcode wordt alleen lokaal opgeslagen en staat niet in een back-up.
Bij gelijktijdige wijzigingen op twee apparaten blijft de laatst opgeslagen
versie behouden.

## Apple Agenda importeren

Maak in Apple Opdrachten een opdracht die afspraken uit de gewenste agenda's
ophaalt en per afspraak één tekstregel maakt:

```text
Agenda | 2026-09-04 | 09:00 | Titel | Kees
```

Meerdere regels kunnen in één keer onder **Agenda** worden geplakt. Het formaat
is achtereenvolgens: agendanaam, datum, begintijd, titel en persoon. Een zesde
veld mag de eindtijd bevatten. Een onbekende agendanaam wordt automatisch
toegevoegd. Zo bepaalt de selectie in Apple Opdrachten welke Apple-agenda's in
Samen Thuis terechtkomen.

## Osta en boodschappen

Onder **Weekmenu** kan tekst uit Osta direct worden geplakt. Deze regels vullen
het weekmenu:

```text
Maandag: curry
Dinsdag: risotto
```

Een blok vanaf `# Grocery List` gaat naar Boodschappen. Onder
**Boodschappen** kunnen ook TXT-, CSV- en JSON-bestanden worden gekozen. Elke
tekstregel wordt als één product gezien; hoeveelheden blijven intact en de app
kiest automatisch een categorie. Een regel die met `✓` begint wordt meteen als
gekocht gemarkeerd.

## Back-up

Gebruik **Back-up maken** om alle appgegevens als JSON-bestand te bewaren. Met
**Back-up laden** kan dat bestand later worden teruggezet. Synchronisatiegegevens
en de huishoudcode worden bewust niet geëxporteerd.
