# Samen Thuis — technische keuzes na uitvoering van de AI-prompt

## 1. Supabase-synchronisatie

De app houdt lokale gegevens onder `samenThuisV2` in de browser. Supabase is optioneel en gebruikt de tabel `public.household_data` met deze kolommen:

| Kolom | Type | Gebruik |
| --- | --- | --- |
| `id` | `text`, primaire sleutel | SHA-256-hash van de huishoudcode |
| `payload` | `jsonb`, niet null | Versleutelde payload |
| `updated_at` | `timestamptz`, niet null | Tijdstip van de laatste upload |

Een basis-migratie voor de tabel:

```sql
create table public.household_data (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.household_data enable row level security;
```

### Configuratie en beveiliging

Er zijn geen build-time environment variables: de statische app heeft geen buildstap. Vul onder **Instellingen → Synchronisatie** de HTTPS-project-URL, de Supabase publishable/anon key en een lange huishoudcode in. Deze instellingen worden lokaal in de browser opgeslagen; zet geen `service_role`-sleutel of huishoudcode in HTML, JavaScript, GitHub Pages of een commit.

**Belangrijke beperking:** de huidige browsercode gebruikt de anon-key en heeft geen Supabase Auth-sessie. Daarom geeft de migratie hierboven bewust geen lees-/schrijfrechten aan `anon`. Een open anon-policy zou iedereen met de publieke project-key toegang geven tot alle huishoudrijen en kan ook gegevens laten wijzigen of verwijderen; de hash van de huishoudcode is geen autorisatie. Schakel geen onbeperkte anon-policy of RLS uit om synchronisatie werkend te krijgen. Veilige multi-user synchronisatie vereist eerst een geauthenticeerde server-/Edge Function of een uitbreiding met Supabase Auth en policies die per gebruiker/huis-houden controleren.

### Migratie

1. Maak een Supabase-project en voer de tabelmigratie hierboven uit via SQL Editor of Supabase CLI.
2. Importeer eerst een back-up in de lokale app en bewaar een aparte kopie.
3. Stel pas na het implementeren en testen van geauthenticeerde toegang de project-URL en publishable key in onder Instellingen. Gebruik nooit de `service_role`-key in de client.
4. Synchronisatie kan de lokale gegevens samenvoegen/vervangen op basis van de laatst gewijzigde versie. Test met back-ups en twee testapparaten voordat je echte huishoudgegevens gebruikt.

De bestaande app kan met alleen deze RLS-migratie nog niet synchroniseren. Dit is bewust veiliger dan documenteren dat een publieke, onbeperkte policy veilig is.

## 2. Real-time synchronisatie

De huidige synchronisatie is optioneel en client-side; realtime subscriptions zijn niet opgenomen. De lokale opslag blijft leidend wanneer synchronisatie niet is ingesteld.

Aanpak voor een volgende fase:
1. Geef elk record een stabiele `id`, `updatedAt` en eventueel `deletedAt`.
2. Gebruik een remote datastore als tweede bron naast de lokale cache.
3. Synchroniseer op recordniveau en los conflicten op met een expliciete strategie.
4. Houd export/import altijd beschikbaar als herstelmechanisme.

## 3. Mobiele wrapper

Voor de huidige vanilla-app is een lichte WebView/PWA-route logischer dan de hele interface opnieuw schrijven in React Native of Flutter. De UI is al responsive en gebruikt geen framework-afhankelijke componenten. Een wrapper kan later worden gekozen wanneer native push, background tasks of App Store/Play Store distributie daadwerkelijk nodig zijn.

## 4. Pushnotificaties

De instelling `notifications` in de testversie is alleen een lokale voorkeur; er wordt bewust geen pushservice gesimuleerd. Echte push vereist een service worker + browser/device permission en voor betrouwbare servergestuurde notificaties een backend of pushprovider.

## 5. Export/backup

De app ondersteunt JSON export en import. Het volledige state-object wordt geëxporteerd, inclusief taken, challenges, menu, boodschappen, voorraad, woning, budget, reizen, ideeën en historie. Dit is bewust een transparant formaat dat later gemigreerd kan worden.

## 6. Databasekeuze

Voor de huidige use-case is localStorage voldoende als testopslag. Voor een echte gedeelde productie-app is een relationele datastore of documentdatabase met authenticatie en realtime subscriptions nodig. De keuze moet pas worden gemaakt nadat het definitieve gegevensmodel en de gewenste multi-device synchronisatie zijn vastgesteld. De aangeleverde prompt geeft onvoldoende informatie om één database als definitief beste keuze te verklaren.
