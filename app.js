const STORAGE_KEY = 'samenThuisDataV2';
const LEGACY_STORAGE_KEY = 'samenThuisDataV1';
const SYNC_KEY = 'samenThuisSyncV1';
const QUOTE_KEY = 'samenThuisQuoteCacheV1';

const pad = value => String(value).padStart(2, '0');
const toLocalISO = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayISO = () => toLocalISO(new Date());
const parseDate = value => new Date(`${value}T12:00:00`);
const addDays = (value, amount) => {
  const date = typeof value === 'string' ? parseDate(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return toLocalISO(date);
};
const startOfWeek = value => {
  const date = typeof value === 'string' ? parseDate(value) : new Date(value);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return toLocalISO(date);
};
const weekDates = start => Array.from({ length: 7 }, (_, index) => addDays(start, index));
const weekdayIndex = value => (parseDate(value).getDay() + 6) % 7;
const daysBetween = (from, to) => Math.round((parseDate(to) - parseDate(from)) / 86400000);

const CALENDAR_COLORS = ['#315f86', '#e98248', '#2e7d67', '#9b59b6', '#b84f58', '#8a6f3e'];
const GROCERY_CATEGORIES = ['Groente', 'Fruit', 'Brood & wraps', 'Zuivel & vega', 'Vlees & vis', 'Diepvries', 'Voorraadkast', 'Kruiden & sauzen', 'Drinken', 'Schoonmaak', 'Overig'];
const WEEKDAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const QUESTIONS = [
  'Wat gaf je vandaag onverwacht veel energie?',
  'Welke kleine gewoonte van ons waardeer je het meest?',
  'Waar kijk je deze week samen het meest naar uit?',
  'Wat zou je graag vaker samen doen zonder dat het veel hoeft te kosten?',
  'Wanneer voelde jij je deze week echt gezien?',
  'Wat kunnen we morgen doen om de dag fijner te maken?',
  'Welke herinnering aan ons maakt je direct aan het lachen?',
  'Wat is iets kleins waar je op dit moment trots op bent?',
  'Welke plek zouden we samen nog eens willen ontdekken?',
  'Wat heb je vandaag nodig: rust, hulp, aandacht of iets anders?',
  'Welke maaltijd zouden we binnenkort samen willen maken?',
  'Wat vind je fijn aan hoe we ons huis samen maken?',
  'Welke taak zou deze week eerlijker of slimmer verdeeld kunnen worden?',
  'Wat was het mooiste moment van je dag?',
  'Welke droom wil je de komende tijd meer ruimte geven?',
  'Wat zou een perfecte vrije ochtend voor ons zijn?',
  'Waarvoor ben je vandaag dankbaar in onze relatie?',
  'Wat wil je dat ik deze week niet vergeet?',
  'Wat is iets nieuws dat we samen zouden kunnen proberen?',
  'Welke eigenschap van de ander bewonder je?',
  'Wat helpt jou om na een drukke dag thuis te landen?',
  'Welke traditie zouden we samen willen beginnen?',
  'Wat betekent een gezellig huis voor jou?',
  'Waar kunnen we deze maand bewust tijd voor maken?',
  'Welke muziek past vandaag bij jouw stemming?',
  'Wat zou je graag leren van de ander?',
  'Welke dag uit het afgelopen jaar zou je opnieuw willen beleven?',
  'Wat kunnen we vandaag voor elkaar makkelijker maken?',
  'Waar hoop je over een jaar met ons te staan?',
  'Wat is een compliment dat je de ander vandaag wilt geven?',
  'Welke kleine verrassing zou je blij maken?'
];

const defaultCalendars = () => [
  { id: 'persoonlijk', name: 'Persoonlijk', color: '#315f86', visible: true, person: '' },
  { id: 'vitestro', name: 'Vitestro', color: '#e98248', visible: true, person: 'Kees' },
  { id: 'coach-o23', name: 'Coach O23', color: '#2e7d67', visible: true, person: 'Kees' },
  { id: 'daphne-werk', name: 'Daphne werk', color: '#9b59b6', visible: true, person: 'Daphne' }
];

const initialData = {
  meta: { version: 2, updatedAt: new Date().toISOString() },
  planning: [{ id: 'p1', title: 'Samen koken', date: todayISO(), time: '18:30', endTime: '', person: 'Samen', calendarId: 'persoonlijk' }],
  calendars: defaultCalendars(),
  excludedCalendars: [],
  meals: [{ id: 'm1', date: todayISO(), type: 'Avondeten', title: 'Tomaten-arancini met basilicummayonaise' }],
  groceries: [
    { id: 'g1', title: 'Tomaten', category: 'Groente', done: false },
    { id: 'g2', title: 'Basilicum', category: 'Groente', done: false },
    { id: 'g3', title: 'Havermelk', category: 'Zuivel & vega', done: true }
  ],
  chores: [
    { id: 'c1', title: 'Keuken opruimen', person: 'Samen', due: todayISO(), repeat: 'Dagelijks', secondWeekday: '', notes: '', completedDates: [] },
    { id: 'c2', title: 'Bed verschonen', person: 'Kees', due: addDays(todayISO(), 2), repeat: 'Wekelijks', secondWeekday: '', notes: '', completedDates: [] },
    { id: 'c3', title: 'Badkamer schoonmaken', person: 'Daphne', due: addDays(todayISO(), 1), repeat: 'Wekelijks', secondWeekday: '', notes: '', completedDates: [] }
  ],
  stock: [
    { id: 's1', title: 'Toiletpapier', category: 'Badkamer', amount: 5, min: 3, unit: 'rollen' },
    { id: 's2', title: 'Pasta', category: 'Voorraadkast', amount: 2, min: 2, unit: 'pakken' },
    { id: 's3', title: 'Afwasmiddel', category: 'Schoonmaak', amount: 1, min: 2, unit: 'flessen' }
  ],
  ideas: [
    { id: 'i1', title: 'Zelf pizza maken', category: 'Thuis', note: 'Allebei een eigen pizza beleggen', icon: '🍕' },
    { id: 'i2', title: 'Avondwandeling', category: 'Gratis', note: 'Telefoons thuislaten', icon: '🌙' },
    { id: 'i3', title: 'Nieuw restaurant proberen', category: 'Uit', note: 'Een vegetarisch restaurant kiezen', icon: '🍽️' }
  ],
  home: [
    { id: 'h1', title: 'Rookmelder testen', category: 'Onderhoud', due: addDays(todayISO(), 14), note: 'Testknop indrukken' },
    { id: 'h2', title: 'Afmetingen woonkamer', category: 'Woninginfo', due: '', note: 'Nog toevoegen' }
  ],
  tripFolders: [
    { id: 'trip-vietnam', name: 'Vietnam', startDate: '2027-01-08', endDate: '2027-01-31', note: 'Bruiloft in Nha Trang op 29 januari' }
  ],
  trips: [
    { id: 'r2', tripFolderId: 'trip-vietnam', title: 'Paspoorten controleren', date: addDays(todayISO(), 7), type: 'Voorbereiding', note: 'Controleer geldigheid' }
  ],
  dailyAnswers: {}
};

const clone = value => structuredClone(value);
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const fmtDate = (value, options = { weekday: 'short', day: 'numeric', month: 'short' }) => value ? new Intl.DateTimeFormat('nl-NL', options).format(parseDate(value)) : 'Geen datum';
const groupBy = (items, keyFn) => items.reduce((groups, item) => {
  const key = keyFn(item);
  (groups[key] ||= []).push(item);
  return groups;
}, {});

function migrateData(raw) {
  if (!raw || typeof raw !== 'object') return clone(initialData);
  const migrated = clone(initialData);
  ['planning', 'meals', 'groceries', 'chores', 'stock', 'ideas', 'home', 'trips'].forEach(key => {
    if (Array.isArray(raw[key])) migrated[key] = raw[key];
  });
  if (Array.isArray(raw.tripFolders)) {
    migrated.tripFolders = raw.tripFolders.filter(folder => folder && folder.id && folder.name).map(folder => ({ endDate: '', note: '', ...folder }));
  } else {
    const oldTrips = Array.isArray(raw.trips) ? raw.trips : [];
    const oldJourneys = oldTrips.filter(item => item.type === 'Reis');
    migrated.tripFolders = oldJourneys.map(item => ({
      id: `folder-${item.id}`,
      name: item.title,
      startDate: item.date || '',
      endDate: '',
      note: item.note || ''
    }));
    if (!migrated.tripFolders.length && oldTrips.length) {
      migrated.tripFolders = [{ id: 'folder-algemeen', name: 'Reisplannen', startDate: '', endDate: '', note: '' }];
    }
    const fallbackFolderId = migrated.tripFolders[0]?.id || '';
    migrated.trips = oldTrips.filter(item => item.type !== 'Reis').map(item => ({ ...item, tripFolderId: item.tripFolderId || fallbackFolderId }));
  }
  const validFolderIds = new Set(migrated.tripFolders.map(folder => folder.id));
  migrated.trips = migrated.trips.map(item => ({ ...item, tripFolderId: validFolderIds.has(item.tripFolderId) ? item.tripFolderId : (migrated.tripFolders[0]?.id || '') }));
  migrated.excludedCalendars = Array.isArray(raw.excludedCalendars)
    ? raw.excludedCalendars.filter(item => item && typeof item.name === 'string').map(item => ({ ...item }))
    : [];
  const excludedNames = new Set(migrated.excludedCalendars.map(item => calendarNameKey(item.name)));
  migrated.calendars = (Array.isArray(raw.calendars) ? raw.calendars : defaultCalendars())
    .filter(item => item && typeof item.name === 'string' && !excludedNames.has(calendarNameKey(item.name)))
    .map(item => ({ ...item, person: validCalendarPerson(item.person) || inferCalendarPerson(item.name) }));
  migrated.dailyAnswers = raw.dailyAnswers && typeof raw.dailyAnswers === 'object' ? raw.dailyAnswers : {};
  migrated.planning = migrated.planning.map(item => ({
    endTime: '',
    calendarId: 'persoonlijk',
    person: 'Samen',
    ...item
  }));
  migrated.chores = migrated.chores.map(item => {
    const completedDates = Array.isArray(item.completedDates) ? item.completedDates : (item.done ? [item.due || todayISO()] : []);
    return { secondWeekday: '', notes: '', ...item, completedDates };
  });
  migrated.meta = {
    version: 2,
    updatedAt: raw.meta?.updatedAt || new Date().toISOString()
  };
  return migrated;
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored ? migrateData(JSON.parse(stored)) : clone(initialData);
  } catch {
    return clone(initialData);
  }
}

function loadSyncConfig() {
  try {
    return { projectUrl: '', anonKey: '', householdCode: '', lastSyncedAt: '', ...JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') };
  } catch {
    return { projectUrl: '', anonKey: '', householdCode: '', lastSyncedAt: '' };
  }
}

let data = loadData();
let syncConfig = loadSyncConfig();
let current = 'today';
let householdWeekStart = startOfWeek(todayISO());
let agendaWeekStart = startOfWeek(todayISO());
let syncTimer;
let syncing = false;
let syncError = '';
let calendarOperation = null;
let addMode = 'item';

const sections = {
  today: { label: 'Vandaag', icon: '⌂' },
  planning: { label: 'Agenda', icon: '▦' },
  meals: { label: 'Weekmenu', icon: '♨' },
  groceries: { label: 'Boodschappen', icon: '✓' },
  chores: { label: 'Huishouden', icon: '⌁' },
  stock: { label: 'Voorraad', icon: '▤' },
  ideas: { label: 'Samen doen', icon: '♡' },
  home: { label: 'Woning', icon: '⌂' },
  trips: { label: 'Reizen', icon: '✈' },
  settings: { label: 'Instellingen', icon: '⚙' }
};

function formConfig(view) {
  const configs = {
    planning: {
      title: 'Afspraak toevoegen',
      fields: [
        ['title', 'Wat?', 'text'], ['date', 'Datum', 'date'], ['time', 'Begintijd', 'time'], ['endTime', 'Eindtijd (optioneel)', 'time'],
        ['calendarId', 'Agenda', 'select', data.calendars.map(calendar => [calendar.id, calendar.name])],
        ['person', 'Voor wie?', 'select', ['Samen', 'Kees', 'Daphne']]
      ]
    },
    meals: { title: 'Gerecht toevoegen', fields: [['title', 'Gerecht', 'text'], ['date', 'Datum', 'date'], ['type', 'Moment', 'select', ['Ontbijt', 'Lunch', 'Avondeten', 'Snack']]] },
    groceries: { title: 'Boodschap toevoegen', fields: [['title', 'Product', 'text'], ['category', 'Categorie', 'select', GROCERY_CATEGORIES]] },
    chores: {
      title: 'Huishoudtaak toevoegen',
      fields: [
        ['title', 'Taak', 'text'], ['person', 'Voor wie?', 'select', ['Samen', 'Kees', 'Daphne']], ['due', 'Eerste keer', 'date'],
        ['repeat', 'Herhaling', 'select', ['Eenmalig', 'Dagelijks', 'Wekelijks', '2× per week', ['Elke 2 weken', 'Elke 2 weken (om de week)'], 'Maandelijks']],
        ['secondWeekday', 'Tweede dag van de week', 'select', WEEKDAY_NAMES.map((name, index) => [String(index), name]), 'second-weekday'],
        ['notes', 'Notitie (optioneel)', 'textarea']
      ]
    },
    stock: { title: 'Voorraad toevoegen', fields: [['title', 'Product', 'text'], ['category', 'Plek', 'select', ['Voorraadkast', 'Koelkast', 'Vriezer', 'Badkamer', 'Schoonmaak', 'Overig']], ['amount', 'Aantal', 'number'], ['min', 'Minimum', 'number'], ['unit', 'Eenheid', 'text']] },
    ideas: { title: 'Idee toevoegen', fields: [['title', 'Idee', 'text'], ['category', 'Categorie', 'select', ['Thuis', 'Uit', 'Actief', 'Gratis', 'Eten']], ['note', 'Notitie', 'textarea'], ['icon', 'Emoji', 'text']] },
    home: { title: 'Woningitem toevoegen', fields: [['title', 'Onderwerp', 'text'], ['category', 'Categorie', 'select', ['Onderhoud', 'Klus', 'Garantie', 'Woninginfo', 'Handleiding']], ['due', 'Datum (optioneel)', 'date'], ['note', 'Notitie', 'textarea']] },
    trips: { title: 'Onderdeel aan reis toevoegen', fields: [['tripFolderId', 'Reismap', 'select', data.tripFolders.map(folder => [folder.id, folder.name])], ['title', 'Onderwerp', 'text'], ['date', 'Datum (optioneel)', 'date'], ['type', 'Soort', 'select', ['Voorbereiding', 'Reservering', 'Vervoer', 'Verblijf', 'Activiteit', 'Paklijst', 'Notitie']], ['note', 'Notitie', 'textarea']] }
  };
  return configs[view];
}

function save({ touch = true, sync = true } = {}) {
  if (touch) data.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const saveState = document.querySelector('#saveState');
  if (saveState) {
    saveState.textContent = 'Zojuist bewaard';
    setTimeout(() => { saveState.textContent = 'Lokaal bewaard'; }, 1200);
  }
  if (sync && syncConfigured()) scheduleSync();
}

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2200);
}

function setupNav() {
  document.querySelector('#nav').innerHTML = Object.entries(sections).map(([key, section]) =>
    `<button class="nav-item ${key === current ? 'active' : ''}" data-view="${key}"><span>${section.icon}</span>${section.label}</button>`
  ).join('');
}

function navigate(view) {
  if (!sections[view]) return;
  current = view;
  setupNav();
  document.querySelector('#pageTitle').textContent = sections[view].label;
  document.querySelector('#addBtn').style.display = ['today', 'settings'].includes(view) ? 'none' : '';
  render();
}

function render() {
  const renders = {
    today: renderToday, planning: renderPlanning, meals: renderMeals, groceries: renderGroceries,
    chores: renderChores, stock: renderStock, ideas: renderIdeas, home: renderHome,
    trips: renderTrips, settings: renderSettings
  };
  document.querySelector('#view').innerHTML = renders[current]();
  updateSyncBadge();
}

const empty = message => `<div class="empty">${esc(message)}</div>`;
function calendarById(calendarId) {
  const active = data.calendars.find(calendar => calendar.id === calendarId);
  if (active) return active;
  const removed = data.excludedCalendars.find(calendar => calendar.id === calendarId);
  if (removed) return { ...removed, name: removed.name + ' (bewaard)', visible: Boolean(removed.keepEvents) };
  return { id: calendarId || '', name: 'Zonder agenda', color: '#315f86', visible: true };
}

function questionForDate(date) {
  const dayNumber = Math.floor(parseDate(date).getTime() / 86400000);
  return QUESTIONS[Math.abs(dayNumber) % QUESTIONS.length];
}

function renderDailyQuestion() {
  const answers = data.dailyAnswers[todayISO()] || {};
  const bothAnswered = Boolean(answers.Kees && answers.Daphne);
  const personButton = person => answers[person]
    ? `<button class="secondary" disabled>${bothAnswered ? `${person}: antwoord staat vast` : `${person} heeft geantwoord`}</button>`
    : `<button class="primary" data-answer-person="${person}">${person} beantwoordt</button>`;
  return `<section class="card daily-question">
    <div class="card-head"><div><p class="eyebrow">Vraag van vandaag</p><h2>${esc(questionForDate(todayISO()))}</h2></div><span class="daily-icon">?</span></div>
    ${bothAnswered ? `<div class="answer-grid"><article><span>Kees</span><p>${esc(answers.Kees.answer)}</p></article><article><span>Daphne</span><p>${esc(answers.Daphne.answer)}</p></article></div>` : `<p class="question-hint">Antwoorden blijven verborgen tot jullie allebei hebben geantwoord. ${answers.Kees || answers.Daphne ? 'Eén antwoord is binnen.' : ''}</p>`}
    <div class="button-row">${personButton('Kees')}${personButton('Daphne')}</div>${bothAnswered ? '<p class="answer-locked">Beide antwoorden zijn definitief en kunnen niet meer worden gewijzigd.</p>' : ''}
  </section>`;
}

function captureBrainyQuote() {
  const source = document.querySelector('#brainyQuoteSource');
  if (!source) return;
  const copy = source.cloneNode(true);
  copy.querySelectorAll('script').forEach(script => script.remove());
  copy.querySelectorAll('a').forEach(link => {
    if (link.textContent.trim().toLowerCase() === 'more quotes') link.remove();
  });
  const quoteText = copy.textContent.replace(/\s+/g, ' ').trim();
  const markup = `<blockquote>${esc(quoteText)}</blockquote>`;
  if (quoteText.length > 12) {
    localStorage.setItem(QUOTE_KEY, JSON.stringify({ date: todayISO(), markup }));
    if (current === 'today') render();
  }
}

async function refreshBrainyQuoteRSS() {
  try {
    const response = await fetch('https://www.brainyquote.com/link/quotebr.rss', { cache: 'no-store' });
    if (!response.ok) return;
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    const item = xml.querySelector('item');
    if (!item) return;
    const title = item.querySelector('title')?.textContent?.trim() || '';
    const descriptionHtml = item.querySelector('description')?.textContent || '';
    const description = new DOMParser().parseFromString(descriptionHtml, 'text/html').body.textContent.trim();
    if (!title && !description) return;
    const genericTitle = /^(today'?s )?quote/i.test(title);
    const quote = genericTitle ? description : title;
    const author = genericTitle || description === title ? '' : description;
    const markup = `<blockquote>${esc(quote)}</blockquote>${author ? `<p>${esc(author)}</p>` : ''}`;
    localStorage.setItem(QUOTE_KEY, JSON.stringify({ date: todayISO(), markup }));
    if (current === 'today') render();
  } catch {
    // De officiële Javascript-feed en de laatst bewaarde quote blijven als fallback werken.
  }
}

function renderQuote() {
  let cache;
  try { cache = JSON.parse(localStorage.getItem(QUOTE_KEY) || 'null'); } catch { cache = null; }
  const quote = cache?.markup
    ? `<div class="quote-content">${cache.markup}</div>`
    : '<p class="quote-offline">De quote wordt opgehaald zodra er verbinding is.</p>';
  return `<section class="card quote-card"><div><p class="eyebrow">Quote of the day</p>${quote}</div><a href="https://www.brainyquote.com/link/quotebr.rss" target="_blank" rel="noopener">Bron: BrainyQuote RSS</a></section>`;
}

function renderToday() {
  const todayChores = occurrencesForDate(todayISO());
  const pending = todayChores.filter(({ chore }) => !isChoreDone(chore, todayISO()));
  const low = data.stock.filter(item => Number(item.amount) <= Number(item.min));
  const unbought = data.groceries.filter(item => !item.done);
  const meal = data.meals.find(item => item.date === todayISO() && item.type === 'Avondeten');
  const todayPlanning = data.planning.filter(item => item.date === todayISO() && calendarById(item.calendarId).visible !== false);
  return `<section class="card welcome"><div><p class="eyebrow welcome-eyebrow">Jullie thuis, in één oogopslag</p><h2>Fijn dat jullie er zijn.</h2><p>${meal ? `Vanavond staat <strong>${esc(meal.title)}</strong> op het menu.` : 'Plan samen wat er vanavond op tafel komt.'}</p></div><div class="date-chip">${fmtDate(todayISO(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></section>
    <div class="today-dailies">${renderDailyQuestion()}${renderQuote()}</div>
    <div class="stat-row"><div class="stat"><strong>${pending.length}</strong><span>huishoudtaken vandaag</span></div><div class="stat"><strong>${unbought.length}</strong><span>boodschappen open</span></div><div class="stat"><strong>${low.length}</strong><span>producten bijna op</span></div><div class="stat"><strong>${todayPlanning.length}</strong><span>agenda-items vandaag</span></div></div>
    <div class="grid two">
      <section class="card"><div class="card-head"><h2>Vandaag in huis</h2><button class="text-btn" data-view="chores">Hele week</button></div><div class="list">${todayChores.length ? todayChores.map(({ chore }) => choreOccurrenceRow(chore, todayISO())).join('') : empty('Vandaag geen huishoudtaken')}</div></section>
      <section class="card"><div class="card-head"><h2>Op de agenda</h2><button class="text-btn" data-view="planning">Week bekijken</button></div><div class="list">${data.planning.filter(item => item.date >= todayISO() && calendarById(item.calendarId).visible !== false).sort(sortPlanning).slice(0, 5).map(item => basicRow(item.title, `${fmtDate(item.date)} · ${item.time || 'Hele dag'}`, calendarById(item.calendarId).name)).join('') || empty('Nog niets gepland')}</div></section>
      <section class="card"><div class="card-head"><h2>Boodschappen</h2><button class="text-btn" data-view="groceries">Open lijst</button></div><div class="list">${unbought.slice(0, 5).map(groceryRow).join('') || empty('De lijst is leeg')}</div></section>
      <section class="card"><div class="card-head"><h2>Bijna op</h2><button class="text-btn" data-view="stock">Voorraad bekijken</button></div><div class="list">${low.slice(0, 5).map(item => basicRow(item.title, `${item.amount} ${esc(item.unit)} in huis`, 'Aanvullen', 'red')).join('') || empty('Voorraad is op peil')}</div></section>
    </div>`;
}

function sortPlanning(a, b) {
  return `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`);
}

function renderWeekControls(start, type) {
  const end = addDays(start, 6);
  return `<div class="week-controls"><button class="secondary icon-control" data-week="${type}:-1" aria-label="Vorige week">←</button><button class="secondary" data-week="${type}:0">Deze week</button><strong>${fmtDate(start, { day: 'numeric', month: 'short' })} – ${fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}</strong><button class="secondary icon-control" data-week="${type}:1" aria-label="Volgende week">→</button></div>`;
}

function renderPlanning() {
  const days = weekDates(agendaWeekStart);
  return `<div class="calendar-toolbar">
      ${renderWeekControls(agendaWeekStart, 'agenda')}
      <div class="calendar-filters" aria-label="Agenda's tonen">${data.calendars.map(calendar => `<button class="calendar-filter ${calendar.visible !== false ? 'active' : ''}" data-calendar-toggle="${calendar.id}"><i style="background:${esc(calendar.color)}"></i>${esc(calendar.name)}</button>`).join('')}</div>
    </div>
    <div class="week calendar-week">${days.map(day => {
      const events = data.planning.filter(item => item.date === day && calendarById(item.calendarId).visible !== false).sort(sortPlanning);
      return `<section class="day ${day === todayISO() ? 'today' : ''}"><div class="day-name">${fmtDate(day, { weekday: 'long' })}</div><div class="day-date">${parseDate(day).getDate()}</div>${events.map(calendarEvent).join('') || '<p class="day-empty">Vrij</p>'}</section>`;
    }).join('')}</div>
    <section class="card import-card"><div><p class="eyebrow">Apple Agenda via Opdrachten</p><h2>Agenda-items invoeren</h2><p>Vier velden zijn genoeg: agenda, datum, tijd en titel. De app onthoudt wie bij iedere agenda hoort. Nieuwe agenda’s worden toegevoegd; uitgesloten agenda’s worden overgeslagen.</p></div><textarea id="calendarImportText" placeholder="Vitestro | 2026-09-04 | 09:00 | Overleg"></textarea><div class="button-row"><button class="primary" data-import-calendar>Importeren</button><button class="secondary" data-pick-file="calendarImportFile">Bestand kiezen</button><button class="secondary" data-view="settings">Agenda’s beheren</button></div></section>`;
}

function calendarEvent(item) {
  const calendar = calendarById(item.calendarId);
  return `<div class="calendar-event" style="--event-color:${esc(calendar.color)}"><small>${esc(item.time || 'Hele dag')}${item.endTime ? `–${esc(item.endTime)}` : ''}</small><strong>${esc(item.title)}</strong><span>${esc(calendar.name)}${item.person ? ` · ${esc(item.person)}` : ''}</span><button class="delete" data-delete="planning:${item.id}" aria-label="Verwijderen">×</button></div>`;
}

function renderMeals() {
  const start = startOfWeek(todayISO());
  const days = weekDates(start);
  return `<div class="week">${days.map(day => `<section class="day ${day === todayISO() ? 'today' : ''}"><div class="day-name">${fmtDate(day, { weekday: 'long' })}</div><div class="day-date">${parseDate(day).getDate()}</div>${data.meals.filter(item => item.date === day).map(item => `<div class="meal"><small>${esc(item.type)}</small><strong>${esc(item.title)}</strong><button class="delete" data-delete="meals:${item.id}" aria-label="Verwijderen">×</button></div>`).join('') || '<p class="day-empty">Nog open</p>'}</section>`).join('')}</div>
    <section class="card import-card"><div><p class="eyebrow">Osta</p><h2>Schema snel overnemen</h2><p>Plak het schema uit Osta. Regels zoals <strong>Maandag: Pasta</strong> vullen het weekmenu. Een blok met <strong># Grocery List</strong> gaat direct naar Boodschappen.</p></div><textarea id="ostaImportText" placeholder="Maandag: curry\nDinsdag: risotto\n\n# Grocery List\n250 g spinazie"></textarea><div class="button-row"><button class="primary" data-import-osta>Osta importeren</button><button class="secondary" data-pick-file="ostaImportFile">Bestand kiezen</button></div></section>`;
}

function renderGroceries() {
  const groups = groupBy(data.groceries, item => item.category || 'Overig');
  return `<section class="card import-card grocery-import"><div><p class="eyebrow">Lijst verdelen</p><h2>Plakken of uploaden</h2><p>Hoeveelheden blijven staan. De app deelt producten automatisch in; regels met ✓ worden als gekocht gemarkeerd.</p></div><textarea id="groceryImportText" placeholder="250 g spinazie\n1 teentje knoflook\n✓ Zout"></textarea><div class="button-row"><button class="primary" data-import-groceries>Verdelen over categorieën</button><button class="secondary" data-pick-file="groceryImportFile">TXT, CSV of JSON kiezen</button></div></section>
    <div class="grid three grocery-groups">${GROCERY_CATEGORIES.map(category => {
      const items = groups[category] || [];
      if (!items.length) return '';
      return `<section class="card"><div class="card-head"><h2>${esc(category)}</h2><span class="tag">${items.filter(item => !item.done).length} open</span></div><div class="list">${items.map(groceryRow).join('')}</div></section>`;
    }).join('') || empty('Voeg jullie eerste boodschap toe')}</div>`;
}

function occursOn(chore, date) {
  if (!chore.due || date < chore.due) return false;
  const difference = daysBetween(chore.due, date);
  switch (chore.repeat) {
    case 'Dagelijks': return difference >= 0;
    case 'Wekelijks': return difference % 7 === 0;
    case 'Elke 2 weken':
    case 'Om de week': return difference % 14 === 0;
    case '2× per week': {
      const firstDay = weekdayIndex(chore.due);
      const secondDay = chore.secondWeekday === '' || chore.secondWeekday === undefined ? (firstDay + 3) % 7 : Number(chore.secondWeekday);
      return [firstDay, secondDay].includes(weekdayIndex(date));
    }
    case 'Maandelijks': return parseDate(date).getDate() === parseDate(chore.due).getDate();
    default: return difference === 0;
  }
}

function occurrencesForDate(date) {
  return data.chores.filter(chore => occursOn(chore, date)).map(chore => ({ chore, date }));
}

function isChoreDone(chore, date) {
  return Array.isArray(chore.completedDates) && chore.completedDates.includes(date);
}

function toggleChoreOccurrence(choreId, date) {
  const chore = data.chores.find(item => item.id === choreId);
  if (!chore) return;
  chore.completedDates ||= [];
  chore.completedDates = chore.completedDates.includes(date) ? chore.completedDates.filter(item => item !== date) : [...chore.completedDates, date];
  save();
  render();
}

function repeatLabel(chore) {
  if (chore.repeat !== '2× per week') return chore.repeat;
  const first = WEEKDAY_NAMES[weekdayIndex(chore.due)];
  const second = WEEKDAY_NAMES[Number(chore.secondWeekday === '' ? (weekdayIndex(chore.due) + 3) % 7 : chore.secondWeekday)];
  return `2× per week · ${first} & ${second}`;
}

function choreOccurrenceRow(chore, date, compact = false) {
  const done = isChoreDone(chore, date);
  return `<div class="${compact ? 'chore-chip' : 'list-item'} ${done ? 'is-done' : ''}">
    <button class="check ${done ? 'done' : ''}" data-chore-date="${chore.id}:${date}" aria-label="${done ? 'Opnieuw openen' : 'Afronden'}">${done ? '✓' : ''}</button>
    <div class="item-main"><strong class="${done ? 'done-text' : ''}">${esc(chore.title)}</strong>${compact ? `<small>${esc(chore.person)} · ${esc(chore.repeat)}</small>` : `<small>${esc(chore.person)} · ${esc(repeatLabel(chore))}</small>`}</div>
  </div>`;
}

function renderChores() {
  const days = weekDates(householdWeekStart);
  const occurrences = days.flatMap(date => occurrencesForDate(date));
  const completed = occurrences.filter(({ chore, date }) => isChoreDone(chore, date)).length;
  const percentage = occurrences.length ? Math.round(completed / occurrences.length * 100) : 0;
  return `<section class="household-board">
      <div class="household-board-head"><div><p class="eyebrow">Hele weekschema</p><h2>Alle huishoudactiviteiten</h2><p>${completed} van ${occurrences.length} activiteiten afgerond</p></div>${renderWeekControls(householdWeekStart, 'household')}</div>
      <div class="progress"><span style="width:${percentage}%"></span></div>
      <div class="household-week">${days.map(date => {
        const dayOccurrences = occurrencesForDate(date);
        return `<section class="household-day ${date === todayISO() ? 'today' : ''}"><div class="household-day-title"><span>${fmtDate(date, { weekday: 'long' })}</span><strong>${parseDate(date).getDate()}</strong></div><div class="household-items">${dayOccurrences.length ? dayOccurrences.map(({ chore }) => choreOccurrenceRow(chore, date, true)).join('') : '<p>Geen taken</p>'}</div></section>`;
      }).join('')}</div>
    </section>
    <div class="templates-head"><div><p class="eyebrow">Taakregels</p><h2>Herhalingen beheren</h2></div><button class="primary" data-open-add>＋ Taak toevoegen</button></div>
    <div class="grid three">${['Kees', 'Daphne', 'Samen'].map(person => `<section class="card"><div class="card-head"><h2>${person}</h2><span class="tag ${person === 'Samen' ? 'green' : ''}">${data.chores.filter(chore => chore.person === person).length}</span></div><div class="list">${data.chores.filter(chore => chore.person === person).sort((a, b) => a.due.localeCompare(b.due)).map(choreTemplateRow).join('') || empty('Geen taakregels')}</div></section>`).join('')}</div>`;
}

function choreTemplateRow(chore) {
  return `<div class="list-item"><div class="item-main"><strong>${esc(chore.title)}</strong><small>Vanaf ${fmtDate(chore.due)} · ${esc(repeatLabel(chore))}${chore.notes ? ` · ${esc(chore.notes)}` : ''}</small></div><button class="delete" data-delete="chores:${chore.id}" aria-label="Verwijderen">×</button></div>`;
}

function renderStock() {
  const sorted = [...data.stock].sort((a, b) => Number(a.amount <= a.min) - Number(b.amount <= b.min));
  return `<div class="grid three">${sorted.map(item => {
    const low = Number(item.amount) <= Number(item.min);
    return `<section class="card"><div class="card-head"><span class="tag ${low ? 'red' : 'green'}">${low ? 'Aanvullen' : 'Op peil'}</span><button class="delete" data-delete="stock:${item.id}">×</button></div><h2>${esc(item.title)}</h2><p class="muted">${esc(item.category)}</p><div class="stock-controls"><button class="secondary" data-stock="${item.id}:-1">−</button><strong>${item.amount} <small>${esc(item.unit)}</small></strong><button class="secondary" data-stock="${item.id}:1">＋</button></div><small class="stock-min">Minimum: ${item.min}</small></section>`;
  }).join('') || empty('Voeg producten toe die jullie willen bijhouden')}</div>`;
}

function renderIdeas() {
  return `<section class="card big-choice"><p class="eyebrow">Wat zullen we doen?</p><div id="choice" class="choice">Laat het toeval kiezen</div><button class="primary" data-random>🎲 Kies een idee</button></section><h2 class="section-title">Jullie ideeën</h2><div class="idea-grid">${data.ideas.map(item => `<article class="idea"><button class="delete float-delete" data-delete="ideas:${item.id}">×</button><div class="icon">${esc(item.icon || '♡')}</div><span class="tag orange">${esc(item.category)}</span><h3>${esc(item.title)}</h3><p>${esc(item.note)}</p></article>`).join('') || empty('Bewaar hier leuke ideeën voor samen')}</div>`;
}

function renderHome() {
  return `<div class="grid two">${['Onderhoud', 'Klus', 'Garantie', 'Woninginfo', 'Handleiding'].map(category => {
    const items = data.home.filter(item => item.category === category);
    if (!items.length) return '';
    return `<section class="card"><div class="card-head"><h2>${category}</h2><span class="tag">${items.length}</span></div><div class="list">${items.map(item => `<div class="list-item"><div class="item-main"><strong>${esc(item.title)}</strong><small>${esc(item.note)}${item.due ? ` · ${fmtDate(item.due)}` : ''}</small></div><button class="delete" data-delete="home:${item.id}">×</button></div>`).join('')}</div></section>`;
  }).join('') || empty('Bewaar onderhoud, garanties en woninginformatie')}</div>`;
}

function renderTrips() {
  const folders = [...data.tripFolders].sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));
  return `<div class="trips-toolbar"><div><p class="eyebrow">Jullie reizen</p><h2>Reismappen</h2></div><div class="button-row"><button class="secondary" data-add-trip-folder>＋ Nieuwe reismap</button>${folders.length ? '<button class="primary" data-open-add>＋ Onderdeel toevoegen</button>' : ''}</div></div>
    <div class="trip-folder-grid">${folders.map(folder => {
      const items = data.trips.filter(item => item.tripFolderId === folder.id).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
      const period = folder.startDate ? `${fmtDate(folder.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}${folder.endDate ? ` – ${fmtDate(folder.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` : 'Datum nog niet bepaald';
      return `<section class="card trip-folder"><div class="trip-folder-head"><div><p class="eyebrow">${esc(period)}</p><h2>📁 ${esc(folder.name)}</h2>${folder.note ? `<p>${esc(folder.note)}</p>` : ''}</div><button class="delete" data-delete-trip-folder="${folder.id}" aria-label="Reismap ${esc(folder.name)} verwijderen">×</button></div>
        <div class="list">${items.map(tripItemRow).join('') || empty('Nog niets in deze reismap')}</div>
        <button class="secondary trip-add-item" data-add-to-trip="${folder.id}">＋ Toevoegen aan ${esc(folder.name)}</button>
      </section>`;
    }).join('') || `<section class="card trip-empty">${empty('Maak eerst een reismap, bijvoorbeeld Vietnam')}<button class="primary" data-add-trip-folder>＋ Eerste reismap maken</button></section>`}</div>`;
}

function tripItemRow(item) {
  const hasDate = Boolean(item.date);
  return `<div class="list-item"><div class="trip-date">${hasDate ? `<strong>${parseDate(item.date).getDate()}</strong><small>${fmtDate(item.date, { month: 'short' })}</small>` : '<strong>–</strong><small>datum</small>'}</div><div class="item-main"><strong>${esc(item.title)}</strong><small>${esc(item.type)}${item.note ? ` · ${esc(item.note)}` : ''}</small></div><button class="delete" data-delete="trips:${item.id}" aria-label="${esc(item.title)} verwijderen">×</button></div>`;
}

function renderSettings() {
  const configured = syncConfigured();
  const sql = `create table public.household_data (\n  id text primary key,\n  payload jsonb not null,\n  updated_at timestamptz not null default now()\n);\n\nalter table public.household_data enable row level security;\n\ncreate policy "encrypted household read" on public.household_data\n  for select to anon using (true);\ncreate policy "encrypted household insert" on public.household_data\n  for insert to anon with check (true);\ncreate policy "encrypted household update" on public.household_data\n  for update to anon using (true) with check (true);`;
  return `<div class="settings-grid">
    <section class="card settings-card"><div class="card-head"><div><p class="eyebrow">Apparaten</p><h2>Versleutelde synchronisatie</h2></div><span class="tag ${configured ? 'green' : ''}">${configured ? 'Ingesteld' : 'Nog instellen'}</span></div><p>De app werkt zelfstandig. Met een gratis Supabase-project blijven iPhone, iPad en laptop gelijk. De inhoud wordt vóór verzending versleuteld met jullie huishoudcode.</p>
      <form id="syncForm" class="form-grid compact-form"><div class="field"><label for="syncProjectUrl">Supabase-project-URL</label><input id="syncProjectUrl" name="projectUrl" type="url" value="${esc(syncConfig.projectUrl)}" placeholder="https://abc.supabase.co"></div><div class="field"><label for="syncAnonKey">Publishable / anon key</label><input id="syncAnonKey" name="anonKey" type="password" value="${esc(syncConfig.anonKey)}" autocomplete="off"></div><div class="field"><label for="syncHouseholdCode">Gedeelde huishoudcode (minimaal 12 tekens)</label><input id="syncHouseholdCode" name="householdCode" type="password" value="${esc(syncConfig.householdCode)}" minlength="12" autocomplete="off"></div><div class="button-row"><button class="primary" type="submit">Bewaren en verbinden</button>${configured ? '<button class="secondary" type="button" data-sync-now>Nu synchroniseren</button>' : ''}</div></form>
      <details><summary>Eenmalige Supabase-instelling</summary><ol><li>Maak een project op Supabase.</li><li>Open de SQL Editor en voer onderstaande code één keer uit.</li><li>Kopieer bij Project Settings → API de Project URL en publishable/anon key hierboven.</li><li>Gebruik op elk apparaat exact dezelfde huishoudcode.</li></ol><pre><code>${esc(sql)}</code></pre></details>
    </section>
    ${renderCalendarSettings()}
    <section class="card settings-card"><div class="card-head"><div><p class="eyebrow">Gegevens</p><h2>Back-up</h2></div></div><p>Maak een los JSON-bestand of laad een eerdere back-up. De synchronisatiecode en sleutel worden niet in de back-up gezet.</p><div class="button-row"><button class="secondary" data-action="backup">Back-up maken</button><button class="secondary" data-action="restore">Back-up laden</button></div></section>
    <section class="card settings-card"><div class="card-head"><div><p class="eyebrow">Apple Opdracht</p><h2>Eenvoudig tekstformaat</h2></div></div><p>Laat de Opdracht per afspraak één regel maken:</p><pre><code>Agendanaam | 2026-09-04 | 09:00 | Titel</code></pre><p>De persoon volgt uit de agenda. Een vijfde veld met Kees, Daphne of Samen is optioneel en gaat voor de agendakeuze. Een zesde veld mag de eindtijd bevatten. Bij onbekende namen kies je de persoon één keer.</p><p>Dit is een import, geen tweerichtingskoppeling. Verplaatsen of verwijderen in Apple Agenda wordt niet automatisch overgenomen.</p></section>
  </div>`;
}

function basicRow(title, subtitle, tag, color = '') {
  return `<div class="list-item"><div class="item-main"><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div>${tag ? `<span class="tag ${color}">${esc(tag)}</span>` : ''}</div>`;
}

function groceryRow(item) {
  return `<div class="list-item"><button class="check ${item.done ? 'done' : ''}" data-toggle="groceries:${item.id}" aria-label="Afvinken">${item.done ? '✓' : ''}</button><div class="item-main"><strong class="${item.done ? 'done-text' : ''}">${esc(item.title)}</strong></div><button class="delete" data-delete="groceries:${item.id}" aria-label="Verwijderen">×</button></div>`;
}

function openAdd(preselectedTripFolderId = '') {
  if (current === 'planning' && !data.calendars.length) {
    navigate('settings');
    toast('Voeg eerst een agenda toe of herstel een uitgesloten agenda');
    return;
  }
  if (current === 'trips' && !data.tripFolders.length) {
    openTripFolderForm();
    toast('Maak eerst een reismap');
    return;
  }
  addMode = 'item';
  const config = formConfig(current);
  if (!config) return;
  document.querySelector('#dialogTitle').textContent = config.title;
  document.querySelector('#formFields').innerHTML = config.fields.map(([name, label, type, options, conditionalClass]) => {
    const choices = (options || []).map(option => Array.isArray(option) ? option : [option, option]);
    const control = type === 'select'
      ? `<select id="f-${name}" name="${name}">${choices.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join('')}</select>`
      : type === 'textarea'
        ? `<textarea id="f-${name}" name="${name}"></textarea>`
        : `<input id="f-${name}" name="${name}" type="${type}" ${name === 'title' || name === 'due' || (name === 'date' && current !== 'trips') ? 'required' : ''} ${name === 'due' || (name === 'date' && current !== 'trips') ? `value="${todayISO()}"` : ''}>`;
    return `<div class="field ${conditionalClass || ''}"><label for="f-${name}">${label}</label>${control}</div>`;
  }).join('');
  document.querySelector('#itemDialog').showModal();
  if (preselectedTripFolderId && document.querySelector('#f-tripFolderId')) document.querySelector('#f-tripFolderId').value = preselectedTripFolderId;
  toggleSecondWeekdayField();
}

function openTripFolderForm() {
  addMode = 'trip-folder';
  document.querySelector('#dialogTitle').textContent = 'Reismap toevoegen';
  document.querySelector('#formFields').innerHTML = `
    <div class="field"><label for="f-title">Naam van de reis</label><input id="f-title" name="title" type="text" required placeholder="Bijvoorbeeld Vietnam"></div>
    <div class="field"><label for="f-startDate">Vertrekdatum (optioneel)</label><input id="f-startDate" name="startDate" type="date"></div>
    <div class="field"><label for="f-endDate">Terugkomstdatum (optioneel)</label><input id="f-endDate" name="endDate" type="date"></div>
    <div class="field"><label for="f-note">Algemene notitie (optioneel)</label><textarea id="f-note" name="note" placeholder="Bijvoorbeeld bruiloft, route of reisgezelschap"></textarea></div>`;
  document.querySelector('#itemDialog').showModal();
}

function toggleSecondWeekdayField() {
  const repeat = document.querySelector('#f-repeat');
  const field = document.querySelector('.second-weekday');
  if (!field) return;
  field.hidden = repeat?.value !== '2× per week';
  if (!field.hidden && document.querySelector('#f-secondWeekday')) {
    const firstDate = document.querySelector('#f-due')?.value || todayISO();
    document.querySelector('#f-secondWeekday').value = String((weekdayIndex(firstDate) + 3) % 7);
  }
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target));
  if (!formData.title) return;
  if (addMode === 'trip-folder') {
    data.tripFolders.push({ id: id(), name: formData.title.trim(), startDate: formData.startDate || '', endDate: formData.endDate || '', note: formData.note?.trim() || '' });
    save();
    document.querySelector('#itemDialog').close();
    render();
    toast('Reismap toegevoegd');
    return;
  }
  ['amount', 'min'].forEach(key => { if (key in formData) formData[key] = Number(formData[key]); });
  if (current === 'groceries') formData.done = false;
  if (current === 'chores') formData.completedDates = [];
  if (current === 'planning') formData.personSource = 'manual';
  data[current].push({ id: id(), ...formData });
  save();
  document.querySelector('#itemDialog').close();
  render();
  toast('Toegevoegd');
}

function openQuestion(person) {
  const answers = data.dailyAnswers[todayISO()] || {};
  if (answers.Kees && answers.Daphne) {
    toast('Beide antwoorden staan vast');
    return;
  }
  if (answers[person]) {
    toast(`${person} heeft vandaag al geantwoord`);
    return;
  }
  const answer = data.dailyAnswers[todayISO()]?.[person]?.answer || '';
  document.querySelector('#questionTitle').textContent = `${person}, jouw antwoord`;
  document.querySelector('#questionText').textContent = questionForDate(todayISO());
  document.querySelector('#questionPerson').value = person;
  document.querySelector('#questionAnswer').value = answer;
  document.querySelector('#questionDialog').showModal();
  document.querySelector('#questionAnswer').focus();
}

function handleQuestionSubmit(event) {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target));
  const existing = data.dailyAnswers[todayISO()] || {};
  if ((existing.Kees && existing.Daphne) || existing[formData.person]) {
    document.querySelector('#questionDialog').close();
    render();
    toast('Dit antwoord staat al vast');
    return;
  }
  const answer = formData.answer.trim();
  if (!answer) return;
  data.dailyAnswers[todayISO()] ||= {};
  data.dailyAnswers[todayISO()][formData.person] = { answer, answeredAt: new Date().toISOString() };
  save();
  document.querySelector('#questionDialog').close();
  render();
  toast('Antwoord bewaard');
}

function normalizeProductKey(title) {
  return title.toLowerCase().replace(/^✓\s*/, '').replace(/\s+/g, ' ').trim();
}

function categorizeProduct(title) {
  const value = title.toLowerCase();
  const hasKeyword = keyword => keyword.trim().length <= 3
    ? new RegExp(`(^|[^a-zà-ÿ])${keyword.trim()}([^a-zà-ÿ]|$)`, 'i').test(value)
    : value.includes(keyword);
  const rules = [
    ['Schoonmaak', ['afwasmiddel', 'wasmiddel', 'vaatwastablet', 'schoonmaak', 'allesreiniger', 'bleek', 'spons', 'vuilniszak']],
    ['Drinken', ['koffie', 'thee', 'sap', 'frisdrank', 'water', 'bier', 'wijn', 'drinken']],
    ['Diepvries', ['diepvries', 'frozen', 'gyoza', 'ijs', 'doperwten']],
    ['Vlees & vis', ['kipfilet', 'kippen', 'kip', 'chicken', 'rund', 'gehakt', 'vlees', 'vis', 'zalm', 'tonijn', 'worst']],
    ['Zuivel & vega', ['melk', 'kaas', 'parmezaan', 'boter', 'yoghurt', 'room', 'eieren', 'ei', 'vegan ranch', 'vega', 'tofu', 'tempeh']],
    ['Brood & wraps', ['brood', 'lavash', 'tortilla', 'wrap', 'bolletje', 'stokbrood', 'cracker']],
    ['Kruiden & sauzen', ['zout', 'salt', 'peper', 'pepper', 'olie', 'oil', 'saus', 'sauce', 'sojasaus', 'gochujang', 'tomatenpuree', 'pindakaas', 'seasoning', 'kruid', 'bouillon', 'maple syrup']],
    ['Fruit', ['limoen', 'citroen', 'appel', 'peer', 'banaan', 'sinaasappel', 'mango', 'fruit', 'aardbei', 'druif']],
    ['Groente', ['spinazie', 'paksoi', 'courgette', 'ui', 'onion', 'knoflook', 'garlic', 'champignon', 'gember', 'bosui', 'tomaat', 'tomato', 'lettuce', 'sla', 'paprika', 'komkommer', 'wortel', 'groente', 'prei', 'kool', 'broccoli']],
    ['Voorraadkast', ['rijst', 'risotto', 'pasta', 'noedel', 'udon', 'meel', 'suiker', 'pinda', 'noten', 'kokosmelk', 'kikkererwt', 'chickpea', 'blik', 'can ']]
  ];
  return rules.find(([, keywords]) => keywords.some(hasKeyword))?.[0] || 'Overig';
}

function parseGroceryText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/^[\[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.groceries;
      if (Array.isArray(items)) return items.map(item => typeof item === 'string' ? { title: item } : item).filter(item => item.title).map(item => ({ title: String(item.title).trim(), done: Boolean(item.done), category: item.category || categorizeProduct(item.title) }));
    } catch { /* fall through to lines */ }
  }
  return trimmed.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#') && !/^grocery list$/i.test(line)).map(line => {
    const done = /^[✓✔]\s*/.test(line);
    const title = line.replace(/^[✓✔]\s*/, '').replace(/^[-•]\s*/, '').trim();
    return { title, done, category: categorizeProduct(title) };
  }).filter(item => item.title);
}

function addGroceries(items) {
  let added = 0;
  let updated = 0;
  items.forEach(item => {
    const existing = data.groceries.find(candidate => normalizeProductKey(candidate.title) === normalizeProductKey(item.title));
    if (existing) {
      if (item.done && !existing.done) { existing.done = true; updated += 1; }
      if (!existing.category || existing.category === 'Overig') existing.category = item.category;
      return;
    }
    data.groceries.push({ id: id(), title: item.title, category: item.category || categorizeProduct(item.title), done: Boolean(item.done) });
    added += 1;
  });
  if (added || updated) save();
  return { added, updated };
}

function importGroceries(text) {
  const items = parseGroceryText(text);
  if (!items.length) return toast('Geen boodschappen gevonden');
  const { added, updated } = addGroceries(items);
  render();
  toast(`${added} boodschappen toegevoegd${updated ? `, ${updated} bijgewerkt` : ''}`);
}

function parseInputDate(value) {
  const clean = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return match ? `${match[3]}-${pad(match[2])}-${pad(match[1])}` : '';
}

function cleanCalendarName(name) {
  return String(name || 'Persoonlijk').normalize('NFKC').replace(/\s+/g, ' ').trim() || 'Persoonlijk';
}

function calendarNameKey(name) {
  return cleanCalendarName(name).toLowerCase();
}

function validCalendarPerson(value) {
  return ['Kees', 'Daphne', 'Samen'].find(person => person.toLowerCase() === String(value || '').trim().toLowerCase()) || '';
}

function inferCalendarPerson(name) {
  const key = calendarNameKey(name);
  const kees = /\bkees\b/.test(key);
  const daphne = /\bdaphne\b/.test(key);
  if ((kees && daphne) || /\bsamen\b/.test(key) || key === 'gezamenlijk') return 'Samen';
  if (daphne) return 'Daphne';
  if (kees || key === 'vitestro' || /^coach[\s-]+o23$/.test(key)) return 'Kees';
  return '';
}

function isCalendarExcluded(name) {
  return data.excludedCalendars.some(item => calendarNameKey(item.name) === calendarNameKey(name));
}

function calendarPersonOptions(selected = '') {
  return '<option value="">Kies persoon…</option>' + ['Kees', 'Daphne', 'Samen'].map(person =>
    '<option value="' + person + '"' + (person === selected ? ' selected' : '') + '>' + person + '</option>'
  ).join('');
}

function setCalendarPerson(calendarId, value) {
  const person = validCalendarPerson(value);
  const calendar = data.calendars.find(item => item.id === calendarId);
  if (!calendar || !person) return false;
  calendar.person = person;
  data.planning.forEach(item => {
    if (item.calendarId === calendar.id && item.personSource !== 'explicit' && item.personSource !== 'manual') {
      item.person = person;
      item.personSource = 'calendar';
    }
  });
  return true;
}

function renderCalendarSettings() {
  const active = data.calendars.map(calendar =>
    '<article class="card" style="padding:12px">' +
      '<div class="button-row"><label><input type="checkbox" data-calendar-visible="' + esc(calendar.id) + '"' + (calendar.visible !== false ? ' checked' : '') + '> ' + esc(calendar.name) + '</label>' +
      '<input type="color" value="' + esc(calendar.color) + '" data-calendar-color="' + esc(calendar.id) + '" aria-label="Kleur voor ' + esc(calendar.name) + '">' +
      '<button type="button" class="text-btn" data-remove-calendar="' + esc(calendar.id) + '">Verwijderen</button></div>' +
      '<div class="field" style="margin-top:10px"><label for="owner-' + esc(calendar.id) + '">Voor wie?</label>' +
      '<select id="owner-' + esc(calendar.id) + '" data-calendar-person="' + esc(calendar.id) + '">' + calendarPersonOptions(calendar.person) + '</select></div></article>'
  ).join('');
  const excluded = data.excludedCalendars.map(calendar =>
    '<div class="list-item"><div class="item-main"><strong>' + esc(calendar.name) + '</strong><small>Wordt bij import overgeslagen' +
    (calendar.keepEvents ? ' · eerdere afspraken bewaard' : '') + '</small></div>' +
    '<button type="button" class="secondary" data-restore-calendar="' + esc(calendar.id) + '">Herstellen</button></div>'
  ).join('');
  return '<section class="card settings-card"><div class="card-head"><div><p class="eyebrow">Apple Agenda</p><h2>Agenda’s beheren</h2></div><span class="tag">' + data.calendars.length + '</span></div>' +
    '<p>Het vinkje bepaalt de zichtbaarheid. Kies per agenda Kees, Daphne of Samen. Deze keuze geldt ook voor bestaande afspraken zonder handmatig gekozen persoon. Een persoon in de importregel gaat voor.</p>' +
    '<div class="calendar-settings">' + (active || empty('Geen actieve agenda’s')) + '</div>' +
    '<form id="calendarForm" class="form-grid"><div class="field"><label for="new-calendar-name">Nieuwe agenda</label><input id="new-calendar-name" name="name" required placeholder="Agendanaam"></div>' +
    '<div class="field"><label for="new-calendar-person">Voor wie? (optioneel)</label><select id="new-calendar-person" name="person">' + calendarPersonOptions() + '</select></div>' +
    '<button class="secondary" type="submit">Toevoegen</button></form>' +
    (excluded ? '<h3>Uitgesloten agenda’s</h3><p>Herstel een agenda om nieuwe imports weer toe te laten. Gewiste afspraken komen pas terug als je ze opnieuw importeert.</p><div class="list">' + excluded + '</div>' : '') +
    '<p>Verwijderen of herstellen verandert niets in Apple Agenda.</p></section>';
}

function getCalendarDialog() {
  let dialog = document.querySelector('#calendarManagementDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'calendarManagementDialog';
    dialog.setAttribute('aria-labelledby', 'calendarManagementTitle');
    dialog.addEventListener('close', () => { calendarOperation = null; });
    document.body.appendChild(dialog);
  }
  return dialog;
}

function showCalendarDialog(title, body, submitLabel) {
  const dialog = getCalendarDialog();
  dialog.innerHTML = '<form><div class="dialog-head"><h2 id="calendarManagementTitle">' + esc(title) + '</h2>' +
    '<button class="icon-btn" type="button" data-cancel-calendar aria-label="Sluiten">×</button></div>' +
    '<div class="form-grid">' + body + '</div><div class="dialog-actions">' +
    '<button class="secondary" type="button" data-cancel-calendar>Annuleren</button>' +
    '<button class="primary" type="submit">' + esc(submitLabel) + '</button></div></form>';
  dialog.querySelectorAll('[data-cancel-calendar]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const operation = calendarOperation;
    if (!operation || !event.target.reportValidity()) return;
    const fields = new FormData(event.target);
    if (operation.type === 'import') {
      const choices = new Map(operation.unknown.map(([key], index) => [key, fields.get('owner_' + index)]));
      if ([...choices.values()].some(value => !validCalendarPerson(value))) return;
      dialog.close();
      finishCalendarImport(operation.events, choices);
    } else if (operation.type === 'remove') {
      const deleteEvents = fields.get('deleteEvents') === 'on';
      dialog.close();
      const removed = removeCalendar(operation.calendarId, deleteEvents);
      if (!removed) return;
      save();
      render();
      toast(deleteEvents ? 'Agenda uitgesloten; afspraken gewist. Opnieuw importeren kan na herstellen.' : 'Agenda uitgesloten; afspraken bewaard');
    }
  });
  dialog.showModal();
}

function openCalendarMapping(events, unknown) {
  if (calendarOperation) return toast('Rond eerst het geopende agendavenster af');
  calendarOperation = { type: 'import', events, unknown };
  const fields = unknown.map(([key, name], index) =>
    '<div class="field"><label for="import-owner-' + index + '">' + esc(name) + '</label>' +
    '<select id="import-owner-' + index + '" name="owner_' + index + '" required>' + calendarPersonOptions() + '</select></div>'
  ).join('');
  showCalendarDialog('Van wie zijn deze agenda’s?', '<p>Kies één keer per agenda. De app onthoudt dit voor volgende imports. Annuleren voegt niets toe.</p>' + fields, 'Bewaren en importeren');
}

function openRemoveCalendar(calendarId) {
  if (calendarOperation) return toast('Rond eerst het geopende agendavenster af');
  const calendar = data.calendars.find(item => item.id === calendarId);
  if (!calendar) return;
  const count = data.planning.filter(item => item.calendarId === calendarId).length;
  calendarOperation = { type: 'remove', calendarId };
  showCalendarDialog('Agenda verwijderen', '<p><strong>' + esc(calendar.name) + '</strong> wordt verwijderd uit je actieve lijst en voortaan overgeslagen bij import. Je kunt dit later herstellen.</p>' +
    '<label><input type="checkbox" name="deleteEvents"> Ook de ' + count + ' afspraken uit Samen Thuis wissen</label>' +
    '<p>Niet aangevinkt? De afspraken blijven zichtbaar met “bewaard” bij de agendanaam. Apple Agenda blijft altijd ongewijzigd.</p>', 'Verwijderen en uitsluiten');
}

function removeCalendar(calendarId, deleteEvents = false) {
  const calendar = data.calendars.find(item => item.id === calendarId);
  if (!calendar) return false;
  data.excludedCalendars.push({ ...calendar, keepEvents: !deleteEvents, removedAt: new Date().toISOString() });
  data.calendars = data.calendars.filter(item => item.id !== calendarId);
  if (deleteEvents) data.planning = data.planning.filter(item => item.calendarId !== calendarId);
  return true;
}

function restoreCalendar(calendarId) {
  const calendar = data.excludedCalendars.find(item => item.id === calendarId);
  if (!calendar) return false;
  const { keepEvents, removedAt, ...restored } = calendar;
  restored.visible = true;
  restored.person = validCalendarPerson(restored.person) || inferCalendarPerson(restored.name);
  data.excludedCalendars = data.excludedCalendars.filter(item => item.id !== calendarId);
  data.calendars.push(restored);
  return true;
}

function ensureCalendar(name) {
  const clean = cleanCalendarName(name);
  if (isCalendarExcluded(clean)) return null;
  let calendar = data.calendars.find(item => calendarNameKey(item.name) === calendarNameKey(clean));
  if (!calendar) {
    calendar = { id: `cal-${id()}`, name: clean, color: CALENDAR_COLORS[data.calendars.length % CALENDAR_COLORS.length], visible: true, person: inferCalendarPerson(clean) };
    data.calendars.push(calendar);
  }
  return calendar;
}

function parseCalendarText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/^[\[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.events || parsed.planning;
      if (Array.isArray(items)) return items.map(item => ({
        calendar: cleanCalendarName(item.calendar || item.calendarName), date: parseInputDate(item.date), time: String(item.time || '').trim(), endTime: String(item.endTime || '').trim(), title: String(item.title || item.name || '').trim(), person: validCalendarPerson(item.person)
      })).filter(item => item.date && item.title);
    } catch { /* fall through to lines */ }
  }
  return trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s*[|;\t]\s*/);
    if (parts.length < 4) return null;
    return { calendar: cleanCalendarName(parts[0]), date: parseInputDate(parts[1]), time: parts[2] || '', title: parts[3] || '', person: validCalendarPerson(parts[4]), endTime: parts[5] || '' };
  }).filter(item => item?.date && item.title);
}

function importCalendar(text) {
  const events = parseCalendarText(text);
  if (!events.length) return toast('Geen agenda-items gevonden');
  const unknown = new Map();
  events.forEach(event => {
    if (isCalendarExcluded(event.calendar)) return;
    const key = calendarNameKey(event.calendar);
    const calendar = data.calendars.find(item => calendarNameKey(item.name) === key);
    if (!validCalendarPerson(calendar?.person) && !inferCalendarPerson(event.calendar)) unknown.set(key, event.calendar);
  });
  if (unknown.size) {
    openCalendarMapping(events, [...unknown.entries()]);
    return;
  }
  finishCalendarImport(events);
}

function finishCalendarImport(events, choices = new Map()) {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let newCalendars = 0;
  let mappingChanged = false;
  events.forEach(event => {
    const previousCount = data.calendars.length;
    const calendar = ensureCalendar(event.calendar);
    if (!calendar) { skipped += 1; return; }
    newCalendars += data.calendars.length - previousCount;
    const selected = validCalendarPerson(choices.get(calendarNameKey(event.calendar)));
    if (selected && calendar.person !== selected) {
      setCalendarPerson(calendar.id, selected);
      mappingChanged = true;
    }
    const person = validCalendarPerson(event.person) || calendar.person || inferCalendarPerson(calendar.name) || 'Samen';
    const personSource = validCalendarPerson(event.person) ? 'explicit' : 'calendar';
    const duplicate = data.planning.find(item => item.date === event.date && item.time === event.time && item.title.toLowerCase() === event.title.toLowerCase() && item.calendarId === calendar.id);
    if (duplicate) {
      // Een handmatig gemaakte afspraak wordt nooit door een import overschreven.
      if (duplicate.personSource !== 'manual' && (duplicate.person !== person || duplicate.endTime !== event.endTime || duplicate.personSource !== personSource)) {
        Object.assign(duplicate, { person, personSource, endTime: event.endTime });
        updated += 1;
      }
      return;
    }
    data.planning.push({ id: id(), title: event.title, date: event.date, time: event.time, endTime: event.endTime, person, personSource, calendarId: calendar.id });
    added += 1;
  });
  if (added || updated || newCalendars || mappingChanged) save();
  render();
  toast(`${added} toegevoegd · ${updated} bijgewerkt · ${skipped} uitgesloten`);
  return { added, updated, skipped, newCalendars };
}

function importOsta(text) {
  const lines = text.split(/\r?\n/);
  const groceryHeading = lines.findIndex(line => /^\s*#?\s*grocery list\s*$/i.test(line));
  let groceryItems = [];
  let mealLines = lines;
  if (groceryHeading >= 0) {
    groceryItems = parseGroceryText(lines.slice(groceryHeading + 1).join('\n'));
    mealLines = lines.slice(0, groceryHeading);
  }
  const dayMap = new Map(WEEKDAY_NAMES.map((name, index) => [name.toLowerCase(), index]));
  const start = startOfWeek(todayISO());
  let mealCount = 0;
  const plainMeals = [];
  mealLines.map(line => line.trim()).filter(line => line && !line.startsWith('#')).forEach(line => {
    const match = line.match(/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s*[:|-]\s*(.+)$/i);
    if (!match) { plainMeals.push(line.replace(/^[-•]\s*/, '')); return; }
    const date = addDays(start, dayMap.get(match[1].toLowerCase()));
    if (!data.meals.some(item => item.date === date && item.title.toLowerCase() === match[2].trim().toLowerCase())) {
      data.meals.push({ id: id(), date, type: 'Avondeten', title: match[2].trim() });
      mealCount += 1;
    }
  });
  if (!mealCount && groceryHeading < 0 && plainMeals.length > 0 && plainMeals.length <= 7) {
    plainMeals.forEach((title, index) => {
      data.meals.push({ id: id(), date: addDays(start, index), type: 'Avondeten', title });
      mealCount += 1;
    });
  }
  const groceryResult = addGroceries(groceryItems);
  if (mealCount && !groceryResult.added && !groceryResult.updated) save();
  render();
  toast(`${mealCount} maaltijden en ${groceryResult.added} boodschappen toegevoegd`);
}

async function readImportFile(file, type) {
  try {
    const text = await file.text();
    if (type === 'groceries') importGroceries(text);
    if (type === 'osta') importOsta(text);
    if (type === 'calendar') importCalendar(text);
  } catch {
    toast('Dit bestand kon niet worden gelezen');
  }
}

function downloadBackup(file) {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(file);
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  toast('Back-up opgeslagen');
}

async function exportBackup() {
  const file = new File([JSON.stringify(data, null, 2)], `samen-thuis-backup-${todayISO()}.json`, { type: 'application/json' });
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isAppleMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Samen Thuis back-up', text: 'Bewaar deze back-up in Bestanden.' });
      toast('Back-up gedeeld');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  downloadBackup(file);
}

async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    data = migrateData(parsed);
    save();
    render();
    toast('Back-up hersteld');
  } catch {
    toast('Dit bestand is geen geldige back-up');
  }
}

function syncConfigured() {
  return Boolean(syncConfig.projectUrl && syncConfig.anonKey && syncConfig.householdCode?.length >= 12);
}

function updateSyncBadge(message) {
  const badge = document.querySelector('#syncState');
  if (!badge) return;
  if (message) badge.textContent = message;
  else if (!syncConfigured()) badge.textContent = 'Alleen dit apparaat';
  else if (!navigator.onLine) badge.textContent = 'Offline · later synchroniseren';
  else if (syncing) badge.textContent = 'Synchroniseren…';
  else if (syncError) badge.textContent = 'Sync controleren';
  else badge.textContent = syncConfig.lastSyncedAt ? 'Apparaten gelijk' : 'Sync gereed';
  badge.classList.toggle('connected', syncConfigured() && !syncing && !syncError);
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function sha256(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(code, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptData(value, code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { version: 1, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(encrypted)) };
}

async function decryptData(payload, code) {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveKey(code, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function supabaseHeaders() {
  const headers = { apikey: syncConfig.anonKey, 'Content-Type': 'application/json' };
  // Nieuwe publishable keys zijn geen JWT; alleen de legacy anon-key gaat ook in Bearer.
  if (!syncConfig.anonKey.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${syncConfig.anonKey}`;
  return headers;
}

async function syncNow({ manual = false } = {}) {
  if (!syncConfigured() || syncing || !navigator.onLine) {
    if (manual && !navigator.onLine) toast('Geen internetverbinding');
    return;
  }
  syncing = true;
  syncError = '';
  updateSyncBadge();
  try {
    if (!window.crypto?.subtle) throw new Error('Versleuteling vereist HTTPS');
    const householdId = await sha256(syncConfig.householdCode.trim());
    const baseUrl = syncConfig.projectUrl.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/rest/v1/household_data?id=eq.${householdId}&select=payload,updated_at`, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(`Supabase gaf ${response.status}`);
    const rows = await response.json();
    let remoteData = null;
    if (rows[0]?.payload) remoteData = migrateData(await decryptData(rows[0].payload, syncConfig.householdCode));
    const isFirstConnection = !syncConfig.lastSyncedAt;
    const remoteIsNewer = remoteData && new Date(remoteData.meta.updatedAt) > new Date(data.meta.updatedAt);
    if (remoteData && (isFirstConnection || remoteIsNewer)) {
      data = remoteData;
      save({ touch: false, sync: false });
    } else if (!remoteData || new Date(data.meta.updatedAt) >= new Date(remoteData.meta.updatedAt)) {
      const payload = await encryptData(data, syncConfig.householdCode);
      const upload = await fetch(`${baseUrl}/rest/v1/household_data?on_conflict=id`, {
        method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: householdId, payload, updated_at: data.meta.updatedAt })
      });
      if (!upload.ok) throw new Error(`Opslaan gaf ${upload.status}`);
    }
    syncConfig.lastSyncedAt = new Date().toISOString();
    syncError = '';
    localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
    if (current === 'settings' || remoteData) render();
    if (manual) toast('Apparaten zijn bijgewerkt');
  } catch (error) {
    console.error('Synchronisatie mislukt', error);
    syncError = error.message || 'Synchronisatie mislukt';
    if (manual) toast('Synchronisatie lukt nog niet. Controleer de instellingen.');
  } finally {
    syncing = false;
    updateSyncBadge();
  }
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), 1200);
}

function handleSyncForm(event) {
  event.preventDefault();
  const next = Object.fromEntries(new FormData(event.target));
  next.projectUrl = next.projectUrl.trim().replace(/\/+$/, '');
  next.anonKey = next.anonKey.trim();
  next.householdCode = next.householdCode.trim();
  if (next.householdCode.length < 12) return toast('Kies een huishoudcode van minimaal 12 tekens');
  const changedHousehold = next.projectUrl !== syncConfig.projectUrl || next.householdCode !== syncConfig.householdCode;
  syncConfig = { ...syncConfig, ...next, lastSyncedAt: changedHousehold ? '' : syncConfig.lastSyncedAt };
  localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
  render();
  syncNow({ manual: true });
}

function handleInitialAgendaImport() {
  const params = new URLSearchParams(location.search);
  const agendaText = params.get('agenda');
  if (!agendaText) return;
  importCalendar(agendaText);
  params.delete('agenda');
  const query = params.toString();
  history.replaceState({}, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-close-dialog]')) { document.querySelector('#itemDialog').close(); return; }
  if (event.target.closest('[data-close-question]')) { document.querySelector('#questionDialog').close(); return; }
  const view = event.target.closest('[data-view]');
  if (view) { navigate(view.dataset.view); return; }
  if (event.target.closest('[data-open-add]')) { openAdd(); return; }
  if (event.target.closest('[data-add-trip-folder]')) { openTripFolderForm(); return; }
  const addToTrip = event.target.closest('[data-add-to-trip]');
  if (addToTrip) { openAdd(addToTrip.dataset.addToTrip); return; }
  const answer = event.target.closest('[data-answer-person]');
  if (answer) { openQuestion(answer.dataset.answerPerson); return; }
  const removeCalendarButton = event.target.closest('[data-remove-calendar]');
  if (removeCalendarButton) { openRemoveCalendar(removeCalendarButton.dataset.removeCalendar); return; }
  const restoreCalendarButton = event.target.closest('[data-restore-calendar]');
  if (restoreCalendarButton) {
    if (restoreCalendar(restoreCalendarButton.dataset.restoreCalendar)) {
      save(); render(); toast('Agenda hersteld; nieuwe imports zijn weer toegestaan');
    }
    return;
  }
  const deleteTripFolderButton = event.target.closest('[data-delete-trip-folder]');
  if (deleteTripFolderButton) {
    const folderId = deleteTripFolderButton.dataset.deleteTripFolder;
    const folder = data.tripFolders.find(item => item.id === folderId);
    if (!folder) return;
    const childCount = data.trips.filter(item => item.tripFolderId === folderId).length;
    const warning = childCount ? `Ook de ${childCount} onderdelen in deze map worden verwijderd.` : 'Deze map is leeg.';
    if (!confirm(`Reismap “${folder.name}” verwijderen?\n\n${warning}`)) return;
    data.tripFolders = data.tripFolders.filter(item => item.id !== folderId);
    data.trips = data.trips.filter(item => item.tripFolderId !== folderId);
    save(); render(); toast('Reismap verwijderd'); return;
  }
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    const [type, itemId] = deleteButton.dataset.delete.split(':');
    data[type] = data[type].filter(item => item.id !== itemId);
    save(); render(); return;
  }
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) {
    const [type, itemId] = toggle.dataset.toggle.split(':');
    const item = data[type].find(candidate => candidate.id === itemId);
    if (item) item.done = !item.done;
    save(); render(); return;
  }
  const choreDate = event.target.closest('[data-chore-date]');
  if (choreDate) {
    const [choreId, date] = choreDate.dataset.choreDate.split(':');
    toggleChoreOccurrence(choreId, date); return;
  }
  const stock = event.target.closest('[data-stock]');
  if (stock) {
    const [itemId, amount] = stock.dataset.stock.split(':');
    const item = data.stock.find(candidate => candidate.id === itemId);
    if (item) item.amount = Math.max(0, Number(item.amount) + Number(amount));
    save(); render(); return;
  }
  const week = event.target.closest('[data-week]');
  if (week) {
    const [type, direction] = week.dataset.week.split(':');
    const nextStart = direction === '0' ? startOfWeek(todayISO()) : addDays(type === 'agenda' ? agendaWeekStart : householdWeekStart, Number(direction) * 7);
    if (type === 'agenda') agendaWeekStart = nextStart; else householdWeekStart = nextStart;
    render(); return;
  }
  const calendarToggle = event.target.closest('[data-calendar-toggle]');
  if (calendarToggle) {
    const calendar = calendarById(calendarToggle.dataset.calendarToggle);
    calendar.visible = calendar.visible === false;
    save(); render(); return;
  }
  if (event.target.closest('[data-random]')) {
    if (!data.ideas.length) return;
    const item = data.ideas[Math.floor(Math.random() * data.ideas.length)];
    document.querySelector('#choice').textContent = `${item.icon || '♡'} ${item.title}`;
    return;
  }
  if (event.target.closest('[data-import-groceries]')) { importGroceries(document.querySelector('#groceryImportText').value); return; }
  if (event.target.closest('[data-import-osta]')) { importOsta(document.querySelector('#ostaImportText').value); return; }
  if (event.target.closest('[data-import-calendar]')) { importCalendar(document.querySelector('#calendarImportText').value); return; }
  const picker = event.target.closest('[data-pick-file]');
  if (picker) { document.querySelector(`#${picker.dataset.pickFile}`).click(); return; }
  if (event.target.closest('[data-sync-now]')) { syncNow({ manual: true }); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'backup') exportBackup();
  if (action === 'restore') document.querySelector('#restoreInput').click();
});

document.addEventListener('change', event => {
  if (event.target.id === 'f-repeat' || event.target.id === 'f-due') toggleSecondWeekdayField();
  const calendarPerson = event.target.closest('[data-calendar-person]');
  if (calendarPerson) {
    if (setCalendarPerson(calendarPerson.dataset.calendarPerson, calendarPerson.value)) {
      save(); render(); toast('Persoon voor deze agenda bewaard');
    } else {
      calendarPerson.value = calendarById(calendarPerson.dataset.calendarPerson).person || '';
    }
    return;
  }
  const calendarVisible = event.target.closest('[data-calendar-visible]');
  if (calendarVisible) {
    calendarById(calendarVisible.dataset.calendarVisible).visible = calendarVisible.checked;
    save(); updateSyncBadge(); return;
  }
  const calendarColor = event.target.closest('[data-calendar-color]');
  if (calendarColor) {
    calendarById(calendarColor.dataset.calendarColor).color = calendarColor.value;
    save(); return;
  }
});

document.addEventListener('submit', event => {
  if (event.target.id === 'syncForm') { handleSyncForm(event); return; }
  if (event.target.id === 'calendarForm') {
    event.preventDefault();
    const fields = new FormData(event.target);
    const name = fields.get('name')?.trim();
    if (!name) return;
    const calendar = ensureCalendar(name);
    if (!calendar) { toast('Deze agenda is uitgesloten. Kies hieronder Herstellen.'); return; }
    const person = validCalendarPerson(fields.get('person'));
    if (person) setCalendarPerson(calendar.id, person);
    save(); render(); toast('Agenda bewaard'); return;
  }
});

document.querySelector('#addBtn').addEventListener('click', openAdd);
document.querySelector('#laptopSaveBtn').addEventListener('click', exportBackup);
document.querySelector('#itemForm').addEventListener('submit', handleSubmit);
document.querySelector('#questionForm').addEventListener('submit', handleQuestionSubmit);
document.querySelector('#restoreInput').addEventListener('change', event => event.target.files[0] && importBackup(event.target.files[0]));
document.querySelector('#groceryImportFile').addEventListener('change', event => event.target.files[0] && readImportFile(event.target.files[0], 'groceries'));
document.querySelector('#ostaImportFile').addEventListener('change', event => event.target.files[0] && readImportFile(event.target.files[0], 'osta'));
document.querySelector('#calendarImportFile').addEventListener('change', event => event.target.files[0] && readImportFile(event.target.files[0], 'calendar'));
document.querySelector('#eyebrow').textContent = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
window.addEventListener('online', () => { updateSyncBadge(); syncNow(); });
window.addEventListener('offline', () => updateSyncBadge());

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
setupNav();
render();
handleInitialAgendaImport();
setTimeout(captureBrainyQuote, 600);
refreshBrainyQuoteRSS();
if (syncConfigured()) syncNow();
