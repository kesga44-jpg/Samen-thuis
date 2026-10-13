# Samen Thuis v26 — Challenges, streaks, punten en beloningen

## Wat deze add-on toevoegt
- Challenges voor sporten, wandelen, lezen, leren, gezondheid, huishouden en samen doen.
- Eigen challenges met categorie, persoon (Samen/Kees/Daphne), frequentie, doel en punten.
- Dagelijks afvinken met bescherming tegen dubbel punten verdienen op dezelfde dag.
- Streaks, voortgang en verdiende punten per challenge.
- Een puntenpot en puntenhistorie.
- Beloningen beheren en punten inwisselen, met standaardideeën zoals massage, date-avond, ontbijt op bed, vrije tijd en een verrassing.
- Elkaar uitdagen met voorstel, acceptatie/afwijzing, voortgangsbevestiging door de andere deelnemer en een eenmalige beloning bij afronding.
- Gezamenlijke activiteiten voorstellen, accepteren en door alle deelnemers als voltooid bevestigen.
- Persoonlijke beloningen inwisselen met afwijzing/annulering en terugbetaling; gezamenlijke beloningen vragen afzonderlijk bevestigde bijdragen en kunnen daarna worden ingepland en afgerond.
- In de primaire app worden challenges, punten en beloningen in `challengeDataV26` in de bestaande gegevensstructuur opgeslagen, zodat back-up en synchronisatie ze meenemen. Als losse add-on gebruikt de module `samenThuisChallengesV26`.

## Integratie in Samen-thuis-v2

De hoofdapp laadt deze module automatisch. De pagina verschijnt in de bestaande navigatie en gebruikt de primaire app-opslag, back-up en versleutelde synchronisatie. Eerder lokaal opgeslagen add-on-gegevens worden bij het laden overgenomen. De module kan ook nog zelfstandig aan een oudere app worden toegevoegd; dan blijft de aparte localStorage-sleutel in gebruik.

## Belangrijk over v16
Deze update verandert de bestaande v16-huishoudlogica niet. Het is een losse add-on. Gebruik v16 als functionele referentie en maak vóór publicatie een back-up.

## Los installeren in een oudere app
1. Maak een back-up van Samen Thuis en werk bij voorkeur eerst op een aparte GitHub-branch.
2. Upload `samen-thuis-update-v26-challenges.js` naar de hoofdmap naast `index.html` en `app.js`.
3. Open `index.html` en voeg vlak vóór `</body>` deze regel toe:
   `<script src="samen-thuis-update-v26-challenges.js?v=260"></script>`
4. Laat alle bestaande scripts en bestanden staan. Verwijder of vervang `app.js`, de v16-bestanden, CSS of de service worker niet als onderdeel van deze add-on.
5. Als de app een service worker gebruikt, laat de bestaande cache-instellingen intact tijdens de eerste test. Als GitHub Pages een oude versie toont, pas dan pas in een afzonderlijke commit de cacheversie aan.
6. Test op een aparte branch met bestaande gegevens. Controleer navigatie, challenge toevoegen/bewerken/verwijderen, afvinken, punten, streaks, beloningen inwisselen en herladen.
7. Pas na een geslaagde test maak je een Pull Request naar `main`.

## Testnotities / beperkingen
- Dit is een add-on voor de bestaande Samen Thuis-app en is bedoeld voor de v25.x appstructuur die in de projectbestanden is teruggevonden. Ik kon het bestaande ZIP-bestand niet als ruwe bestanden openen in deze sessie; controleer daarom de installatie op een aparte branch vóór je publiceert.
- Als losse add-on worden challenges en punten lokaal bewaard. In de primaire app maken ze deel uit van de bestaande versleutelde huishoudsynchronisatie en back-up.
- Punten hebben geen geldwaarde. Spreek samen af wat beloningen kosten en betekenen.
- De primaire app bewaart de ledger en voorstellen in de bestaande versleutelde huishoudgegevens. Bestaande saldo's worden eenmalig als controleerbare openingsboeking overgezet; er wordt geen tweede saldo bijgehouden.
- Het bestaande puntensysteem gebruikt één gedeelde huishoud-pot en de bestaande huishoudcode, niet per-deelnemer geauthenticeerde saldi. De bevestigingsknoppen zijn workflowbevestigingen en vormen op zichzelf geen beveiligde identiteit of transactionele databaseboeking. Voor persoonlijke saldi of harde server-side autorisatie is een aparte Supabase-puntenmigratie en accountkoppeling nodig; die moet vóór productie worden uitgerold.
