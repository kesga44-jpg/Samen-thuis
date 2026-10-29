# Slim sparen, dashboard en aanbiedingen (status)

## Geïmplementeerd
- `savings-core.js` (+ `savings-core.test.js`): saldo (beginsaldo + stortingen), benodigde periodieke inleg, achterstand, verwachte einddatum, geplande vs. werkelijke inleg, ontdubbelde stortingen, voorstel voor verdeling op prioriteit/deadline.
- Budgetpagina (bestaande `budget23`): spaardoelen uitgebreid met frequentie, prioriteit, persoonlijk/gezamenlijk, type, pauzeren, stortingen en sectie "Slim sparen". Bestaande velden (`current`, `monthly`, …) behouden hun betekenis; nieuwe velden zijn optioneel. Opslaan van het voorstel past alleen de geplande `monthly` aan; er worden geen betalingen uitgevoerd.
- Accentkleur: vrije kleurkiezer en de bestaande 4 voorinstellingen blijven. Zonder login is dit apparaatgebonden; met Supabase Auth wordt de instelling per geauthenticeerd gebruikers-ID opgeslagen.
- Dashboardeditor: bestaande geschikte dashboardkaarten kunnen worden verborgen/toegevoegd, verplaatst en teruggezet naar standaard. Configuraties worden lokaal bewaard en kunnen na login per gebruiker op andere apparaten worden hersteld.
- Aanbiedingen: geïntegreerde zoekpagina, filters op supermarkt/categorie, sorteren op prijs/korting/einddatum, favorieten, toevoegen aan boodschappen, geldigheidsdatums, bronvermelding, laad-/lege-/foutstatus en actieve/verlopen/binnenkort-geldige scheiding. `offers-core.js` blijft verantwoordelijk voor tijdzonebewuste geldigheid en deduplicatie.
- PrijsProfeet: aanbiedingen worden via de bestaande Supabase Edge Function gezocht. De implementatie gebruikt hetzelfde `/api/v1/search`-endpoint als de bestaande repositorycode, vraagt maximaal 20 records op en cachet zoektermen 20 minuten. De actuele officiële documentatie was in deze omgeving niet bereikbaar; endpointtoestemming, authenticatie, limieten, tarieven en voorwaarden zijn dus niet onafhankelijk bevestigd. Zie `GRATIS_PRIJZEN.md`.
- Pepper/Pepperdeals: niet geïntegreerd; officiële Nederlandse API/feed en toegestane gebruiksvoorwaarden konden niet worden geverifieerd. Er wordt niet gescrapet.
- Quotes: bestaande BrainyQuote RSS-feed met de bestaande auteur/citaat-opmaak wordt bij openen gecontroleerd en daarna maximaal eenmaal per 24 uur ververst zolang de pagina actief is.

## Vereiste configuratie / grenzen
- Voer `supabase/migrations/20261012000000_personal_preferences.sql` uit en schakel Supabase e-mail/wachtwoordauthenticatie in om persoonlijke voorkeuren cross-device te synchroniseren. Zonder dit blijft de bestaande apparaatlokale modus actief.
- De PrijsProfeet Edge Function moet na wijziging opnieuw worden uitgerold. `PRIJS_PROFEET_API_KEY` is een optionele server-side secret; voeg die alleen toe als het provider-account die vereist. De huidige officiële vereisten zijn niet bevestigd.
- Bronlink naar de originele individuele aanbieding wordt alleen getoond als de API daadwerkelijk een veilige HTTP(S)-link retourneert. Anders blijft de bronvermelding PrijsProfeet zichtbaar.
- Quotes behouden het bestaande BrainyQuote RSS en auteur/citaat-markup; de feed wordt bij openen opgehaald en daarna maximaal eens per 24 uur ververst zolang de pagina zichtbaar is. Externe feed en browsergedrag zijn niet live getest.
- `data-core.test.js` blijft de bestaande `MODULE_NOT_FOUND`-fout geven doordat de test `../data-core.js` vereist, terwijl de module naast de test staat. De identieke require-regel staat al op basiscommit `08062f3`; dit valt buiten de wijzigingen. De browserbediening is niet live getest.
