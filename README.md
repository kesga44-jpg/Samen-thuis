# Samen Thuis

Deze build gebruikt één volledig opgebouwde `styles.css`.

De stylesheet is voorzien van duidelijke comments per pagina en onderdeel:
basis, Vandaag, Agenda, Weekmenu, Boodschappen, Huishouden, Voorraad, Reizen,
Date ideeën, Woning, Budget, Instellingen, import/synchronisatie, thema's,
mobiele navigatie en responsive gedrag.

De bestaande stylingregels zijn behouden. Onderaan staat één gericht
kleurcontract: witte/lichtgrijze oppervlakken krijgen donkere tekst en
donkerblauwe oppervlakken krijgen lichte tekst.

De mobiele navigatie en het bewaren van de horizontale positie blijven
onderdeel van de bestaande app-functionaliteit.

Het budget gebruikt één financiële ledger in integer centen. Inkomstenbronnen,
verdelingsregels en terugkerende vaste lasten worden in diezelfde versleutelde
huishoudgegevens bewaard. Verwachte betalingen reserveren alleen saldo; een
uitgave ontstaat pas nadat een gebruiker de daadwerkelijke betaling bevestigt.

## Tests en CI

Lokaal: `node --test *.test.js`.

GitHub Actions (`.github/workflows/tests.yml`) draait dezelfde suite bij elke pull request en elke push naar `main`:

- `node --check app.js` en daarna `node --test *.test.js` op Node.js 22 (Ubuntu 24.04);
- de SQL-tests in `migrations-pg.test.js` draaien op een tijdelijke lokale PostgreSQL in de runner. De workflow faalt als PostgreSQL ontbreekt, zodat deze tests niet ongemerkt worden overgeslagen;
- acht importtests (PDF, XLSX, XLS, DOCX, OCR) worden overgeslagen omdat `pdfjs-dist`, `xlsx`, `mammoth` en Tesseract geen Node-afhankelijkheid van de repository zijn. Lokaal kunnen er minder worden overgeslagen als die bibliotheken globaal geïnstalleerd zijn;
- de workflow heeft alleen leesrechten, gebruikt geen secrets en maakt geen verbinding met Supabase.

Lokaal de SQL-tests draaien vereist PostgreSQL 14–16 en een gebruiker zonder rootrechten (`initdb` weigert root).
