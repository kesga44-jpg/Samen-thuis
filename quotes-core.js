(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisQuotes = core;
})(globalThis, function () {
  const ROTATION_INTERVAL = 24 * 60 * 60 * 1000;

  // Lokale gedachten van de dag (eigen teksten van Samen Thuis, geen citaten van derden).
  // Vervangt het externe BrainyQuote-script (beveiligingsrisico R4): er draait geen code van derden meer in de pagina.
  const LOCAL_QUOTES = [
    'Een opgeruimd aanrecht begint met één bord in de vaatwasser.',
    'Samen plannen is de helft van het werk delen.',
    'Kleine gewoontes maken een groot verschil in huis.',
    'Een goed weekmenu bespaart tijd, geld en discussie.',
    'Vraag vandaag wat de ander nodig heeft, en luister naar het antwoord.',
    'Rust is ook een taak op de planning.',
    'Wat je vandaag afvinkt, hoef je morgen niet te onthouden.',
    'Een gezamenlijk doel maakt sparen lichter.',
    'Koken voor twee is ook samen tijd maken.',
    'Een lege boodschappenlijst is een kleine overwinning.',
    'Vier de kleine dingen: een schone vloer telt ook.',
    'Wie eerlijk verdeelt, hoeft minder te onderhandelen.',
    'Een wandeling na het eten maakt de avond langer.',
    'Thuis is waar je samen de dag afsluit.',
    'Vandaag één klusje, deze maand een opgeruimd huis.',
    'Goed voorbereid boodschappen doen voorkomt verspilling.',
    'Een compliment kost niets en levert veel op.',
    'Plan ook iets leuks, niet alleen wat moet.',
    'Overzicht in geld geeft ruimte in je hoofd.',
    'Samen lachen is het beste huishoudmiddel.',
    'Een vaste plek voor de sleutels scheelt elke dag zoeken.',
    'Wat restjes zijn voor de één, is een lunch voor de ander.',
    'Begin de week met een blik op de agenda, dan verrast niets je.',
    'Een goed gesprek is beter dan een perfecte planning.',
    'Ook een rustige zondag is productief.',
    'Groente in het weekmenu, groente in de boodschappentas.',
    'Delen wat goed ging is net zo belangrijk als bespreken wat beter kan.',
    'Een herhaalde taak wordt een gewoonte; een gewoonte wordt makkelijk.',
    'Neem vandaag even de tijd voor elkaar.',
    'Een huis wordt een thuis door wat je er samen doet.'
  ];

  function shouldRefresh(lastCheckedAt, now = Date.now()) {
    const checked = Date.parse(lastCheckedAt || '');
    return !Number.isFinite(checked) || checked > now || now - checked >= ROTATION_INTERVAL;
  }

  // Deterministisch per kalenderdag (YYYY-MM-DD): beide huishoudleden zien dezelfde tekst, ook offline.
  function localQuoteFor(dateISO) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || ''));
    const day = match ? Math.floor(Date.UTC(+match[1], +match[2] - 1, +match[3]) / 86400000) : 0;
    return { text: LOCAL_QUOTES[Math.abs(day) % LOCAL_QUOTES.length], source: 'Samen Thuis' };
  }

  return { ROTATION_INTERVAL, LOCAL_QUOTES, shouldRefresh, localQuoteFor };
});
