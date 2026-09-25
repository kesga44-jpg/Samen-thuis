
/* ===== GEÏNTEGREERD: app.js ===== */
const STORAGE_KEY = 'samenThuisDataV2';
const LEGACY_STORAGE_KEY = 'samenThuisDataV1';
const SYNC_KEY = 'samenThuisSyncV1';
const QUOTE_KEY = 'samenThuisQuoteCacheV1';
const DEFAULT_PROJECT_URL = 'https://vwfuetxgapzfivydzhxc.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_Xa1oLeM64F-jog1vVjJbkQ_BE3UV6mR';
const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

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
  tripSections: [
    { id: 'trip-vietnam-voorbereiding', tripFolderId: 'trip-vietnam', name: 'Voor vertrek' },
    { id: 'trip-vietnam-boekingen', tripFolderId: 'trip-vietnam', name: 'Boekingen' },
    { id: 'trip-vietnam-paklijst', tripFolderId: 'trip-vietnam', name: 'Paklijst' }
  ],
  trips: [
    { id: 'r2', tripFolderId: 'trip-vietnam', tripSectionId: 'trip-vietnam-voorbereiding', title: 'Paspoorten controleren', date: addDays(todayISO(), 7), type: 'Voorbereiding', note: 'Controleer geldigheid', checkable: true, done: false }
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
  // v23.1 DATA-VEILIG: behoud ook velden die door latere/oude modules zijn toegevoegd.
  // Bekende structuren worden hieronder nog genormaliseerd, onbekende structuren
  // worden één-op-één meegenomen zodat een update ze niet stilzwijgend verwijdert.
  Object.keys(raw).forEach(key => {
    if (!(key in migrated)) {
      try { migrated[key] = clone(raw[key]); } catch { migrated[key] = raw[key]; }
    }
  });
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
  if (Array.isArray(raw.tripSections)) {
    migrated.tripSections = raw.tripSections.filter(section => section && section.id && section.name && validFolderIds.has(section.tripFolderId)).map(section => ({ ...section }));
  } else {
    migrated.tripSections = migrated.tripFolders.map(folder => ({ id: `section-${folder.id}-algemeen`, tripFolderId: folder.id, name: 'Algemeen' }));
  }
  const sectionById = new Map(migrated.tripSections.map(section => [section.id, section]));
  migrated.trips = migrated.trips.map(item => {
    const tripFolderId = validFolderIds.has(item.tripFolderId) ? item.tripFolderId : (migrated.tripFolders[0]?.id || '');
    const selectedSection = sectionById.get(item.tripSectionId);
    const tripSectionId = selectedSection?.tripFolderId === tripFolderId
      ? selectedSection.id
      : (migrated.tripSections.find(section => section.tripFolderId === tripFolderId)?.id || '');
    const checkable = typeof item.checkable === 'boolean' ? item.checkable : ['Voorbereiding', 'Paklijst'].includes(item.type);
    return { ...item, tripFolderId, tripSectionId, checkable, done: checkable ? Boolean(item.done) : false };
  });
  migrated.excludedCalendars = Array.isArray(raw.excludedCalendars)
    ? raw.excludedCalendars.filter(item => item && typeof item.name === 'string').map(item => ({ ...item }))
    : [];
  const excludedNames = new Set(migrated.excludedCalendars.map(item => calendarNameKey(item.name)));
  migrated.calendars = (Array.isArray(raw.calendars) ? raw.calendars : defaultCalendars())
    .filter(item => item && typeof item.name === 'string' && !excludedNames.has(calendarNameKey(item.name)))
    .map(item => ({ ...item, person: validCalendarPerson(item.person) || inferCalendarPerson(item.name) }));
  migrated.dailyAnswers = raw.dailyAnswers && typeof raw.dailyAnswers === 'object' ? raw.dailyAnswers : {};
  // v23: preserve backward-compatible financial data instead of dropping it during migration.
  if (raw.budget && typeof raw.budget === 'object') migrated.budget = clone(raw.budget);
  if (raw.budget19 && typeof raw.budget19 === 'object') migrated.budget19 = clone(raw.budget19);
  if (raw.budgetV23 && typeof raw.budgetV23 === 'object') migrated.budgetV23 = clone(raw.budgetV23);
  if (Array.isArray(raw.priceReferences)) migrated.priceReferences = raw.priceReferences;
  if (raw.priceReferenceSource) migrated.priceReferenceSource = raw.priceReferenceSource;
  if (raw.priceReferenceUpdatedAt) migrated.priceReferenceUpdatedAt = raw.priceReferenceUpdatedAt;
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
    if (!stored) return clone(initialData);

    // v23.1 DATA-VEILIG: maak vóór migratie automatisch een ongewijzigde snapshot.
    // De normale opslagkey blijft samenThuisDataV2, dus bestaande Voorraad,
    // Boodschappen, Huishouden, Reizen enz. blijven op dezelfde plek staan.
    try {
      if (!localStorage.getItem('samenThuisPreV23Backup')) {
        localStorage.setItem('samenThuisPreV23Backup', stored);
        localStorage.setItem('samenThuisPreV23BackupAt', new Date().toISOString());
      }
    } catch {}

    return migrateData(JSON.parse(stored));
  } catch {
    // Bij een parse/migratiefout proberen we de safety snapshot terug te lezen
    // in plaats van direct met voorbeelddata te starten.
    try {
      const backup = localStorage.getItem('samenThuisPreV23Backup');
      if (backup) return migrateData(JSON.parse(backup));
    } catch {}
    return clone(initialData);
  }
}

function loadSyncConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(SYNC_KEY) || '{}');
    return {
      projectUrl: DEFAULT_PROJECT_URL,
      anonKey: DEFAULT_PUBLISHABLE_KEY,
      householdCode: String(stored.householdCode || ''),
      lastSyncedAt: String(stored.lastSyncedAt || '')
    };
  } catch {
    return { projectUrl: DEFAULT_PROJECT_URL, anonKey: DEFAULT_PUBLISHABLE_KEY, householdCode: '', lastSyncedAt: '' };
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
    trips: { title: 'Onderdeel aan reis toevoegen', fields: [['tripFolderId', 'Reis', 'select', data.tripFolders.map(folder => [folder.id, folder.name])], ['tripSectionId', 'Map binnen de reis', 'select', data.tripSections.map(section => [section.id, section.name])], ['title', 'Onderwerp', 'text'], ['date', 'Deadline / datum (optioneel)', 'date'], ['type', 'Soort', 'select', ['Voorbereiding', 'Reservering', 'Vervoer', 'Verblijf', 'Activiteit', 'Eten', 'Budget', 'Documenten', 'Paklijst', 'Notitie']], ['note', 'Notitie', 'textarea'], ['checkable', 'Dit moet afgevinkt worden', 'checkbox']] }
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

function tripFolderById(folderId) {
  return data.tripFolders.find(folder => folder.id === folderId);
}

function tripSectionById(sectionId) {
  return data.tripSections.find(section => section.id === sectionId);
}

function openTravelActions() {
  return data.trips.filter(item => item.checkable && !item.done).sort((a, b) => {
    const dateOrder = (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31');
    return dateOrder || a.title.localeCompare(b.title, 'nl');
  });
}

function renderTravelActions() {
  const actions = openTravelActions().slice(0, 10);
  return `<section class="card travel-actions"><div class="card-head"><div><p class="eyebrow">Belangrijkste reisacties</p><h2>Nog te doen</h2></div><button class="text-btn" data-view="trips">Alle reizen</button></div><div class="list">${actions.length ? actions.map(item => {
    const folder = tripFolderById(item.tripFolderId);
    const section = tripSectionById(item.tripSectionId);
    const overdue = item.date && item.date < todayISO();
    const timing = item.date ? `${overdue ? 'Te laat · ' : ''}${fmtDate(item.date)}` : 'Geen deadline';
    return `<div class="list-item travel-action ${overdue ? 'overdue' : ''}"><button class="check" data-toggle="trips:${item.id}" aria-label="${esc(item.title)} afronden"></button><div class="item-main"><strong>${esc(item.title)}</strong><small>${esc(folder?.name || 'Reis')}${section ? ` · ${esc(section.name)}` : ''} · ${esc(timing)}</small></div></div>`;
  }).join('') : empty('Geen openstaande reisacties')}</div>${openTravelActions().length > 10 ? `<p class="muted travel-more">Nog ${openTravelActions().length - 10} acties staan onder Reizen.</p>` : ''}</section>`;
}

function renderToday() {
  const todayChores = occurrencesForDate(todayISO());
  const pending = todayChores.filter(({ chore }) => !isChoreDone(chore, todayISO()));
  const low = data.stock.filter(item => Number(item.amount) <= Number(item.min));
  const unbought = data.groceries.filter(item => !item.done);
  const meal = data.meals.find(item => item.date === todayISO() && item.type === 'Avondeten');
  const todayPlanning = data.planning.filter(item => item.date === todayISO() && calendarById(item.calendarId).visible !== false);
  return `<section class="card welcome"><div><p class="eyebrow welcome-eyebrow">Jullie thuis, in één oogopslag</p><h2>Fijn dat jullie er zijn.</h2><p>${meal ? `Vanavond staat <strong>${esc(meal.title)}</strong> op het menu.` : 'Plan samen wat er vanavond op tafel komt.'}</p></div><div class="date-chip">${fmtDate(todayISO(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></section>
    ${renderTravelActions()}
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
  return `<div class="trips-toolbar"><div><p class="eyebrow">Jullie reizen</p><h2>Reismappen</h2></div><div class="button-row"><button class="secondary" data-add-trip-folder>＋ Nieuwe reis</button>${folders.length ? '<button class="primary" data-open-add>＋ Onderdeel toevoegen</button>' : ''}</div></div>
    ${folders.length ? `<section class="card import-card travel-import"><div><p class="eyebrow">Reisplan importeren</p><h2>PDF lezen of tekst plakken</h2><p>Kies de reis. De app verdeelt route, vervoer, verblijf, activiteiten, budget, documenten en acties automatisch over mappen. De PDF blijft op dit apparaat; alleen de herkende onderdelen worden opgeslagen.</p></div><div class="travel-import-fields"><label for="travelImportFolder">Toevoegen aan reis</label><select id="travelImportFolder">${folders.map(folder => `<option value="${folder.id}">${esc(folder.name)}</option>`).join('')}</select><label for="travelImportText">Tekst uit reisplan</label><textarea id="travelImportText" placeholder="Plak hier de tekst uit jullie reisplan…"></textarea></div><div class="button-row"><button class="primary" data-import-travel-text>Tekst verdelen</button><button class="secondary" data-pick-file="travelImportFile">PDF of tekstbestand kiezen</button></div></section>` : ''}
    <div class="trip-folder-grid">${folders.map(folder => {
      const sections = data.tripSections.filter(section => section.tripFolderId === folder.id);
      const period = folder.startDate ? `${fmtDate(folder.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}${folder.endDate ? ` – ${fmtDate(folder.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}` : 'Datum nog niet bepaald';
      return `<section class="card trip-folder"><div class="trip-folder-head"><div><p class="eyebrow">${esc(period)}</p><h2>📁 ${esc(folder.name)}</h2>${folder.note ? `<p>${esc(folder.note)}</p>` : ''}</div><button class="delete" data-delete-trip-folder="${folder.id}" aria-label="Reismap ${esc(folder.name)} verwijderen">×</button></div>
        <div class="trip-subfolder-grid">${sections.map(section => {
          const items = data.trips.filter(item => item.tripSectionId === section.id).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
          return `<section class="trip-subfolder"><div class="trip-subfolder-head"><h3>📂 ${esc(section.name)}</h3><button class="delete" data-delete-trip-section="${section.id}" aria-label="Map ${esc(section.name)} verwijderen">×</button></div><div class="list">${items.map(tripItemRow).join('') || '<p class="muted trip-section-empty">Deze map is leeg</p>'}</div><button class="text-btn trip-add-item" data-add-to-trip-section="${section.id}">＋ Onderdeel</button></section>`;
        }).join('') || empty('Maak een map binnen deze reis')}</div>
        <div class="button-row trip-folder-actions"><button class="secondary" data-add-trip-section="${folder.id}">＋ Map in ${esc(folder.name)}</button>${sections.length ? `<button class="secondary" data-add-to-trip="${folder.id}">＋ Onderdeel toevoegen</button>` : ''}</div>
      </section>`;
    }).join('') || `<section class="card trip-empty">${empty('Maak eerst een reismap, bijvoorbeeld Vietnam')}<button class="primary" data-add-trip-folder>＋ Eerste reismap maken</button></section>`}</div>`;
}

function tripItemRow(item) {
  const hasDate = Boolean(item.date);
  return `<div class="list-item ${item.done ? 'is-done' : ''}">${item.checkable ? `<button class="check ${item.done ? 'done' : ''}" data-toggle="trips:${item.id}" aria-label="${item.done ? 'Opnieuw openen' : 'Afronden'}">${item.done ? '✓' : ''}</button>` : ''}<div class="trip-date">${hasDate ? `<strong>${parseDate(item.date).getDate()}</strong><small>${fmtDate(item.date, { month: 'short' })}</small>` : '<strong>–</strong><small>datum</small>'}</div><div class="item-main"><strong class="${item.done ? 'done-text' : ''}">${esc(item.title)}</strong><small>${esc(item.type)}${item.checkable ? ' · Afvinken' : ''}${item.note ? ` · ${esc(item.note)}` : ''}</small></div><button class="delete" data-delete="trips:${item.id}" aria-label="${esc(item.title)} verwijderen">×</button></div>`;
}

function renderSettings() {
  const configured = syncConfigured();
  return `<div class="settings-grid">
    <section class="card settings-card"><div class="card-head"><div><p class="eyebrow">Apparaten</p><h2>Versleutelde synchronisatie</h2></div><span class="tag ${configured ? 'green' : ''}">${configured ? 'Verbonden' : 'Code invullen'}</span></div><p>Vul op elk apparaat dezelfde geheime huishoudcode in. De overige verbindingsgegevens zijn al ingesteld.</p>
      <form id="syncForm" class="form-grid compact-form"><div class="field"><label for="syncHouseholdCode">Geheime huishoudcode (minimaal 12 tekens)</label><input id="syncHouseholdCode" name="householdCode" type="password" value="${esc(syncConfig.householdCode)}" minlength="12" autocomplete="off" placeholder="Jullie gedeelde geheime code"></div><div class="button-row"><button class="primary" type="submit">Bewaren en verbinden</button>${configured ? '<button class="secondary" type="button" data-sync-now>Nu synchroniseren</button>' : ''}</div></form>
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

function openAdd(preselectedTripFolderId = '', preselectedTripSectionId = '') {
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
  if (current === 'trips') {
    const preferredFolder = preselectedTripFolderId || data.tripFolders.find(folder => data.tripSections.some(section => section.tripFolderId === folder.id))?.id || data.tripFolders[0].id;
    if (!data.tripSections.some(section => section.tripFolderId === preferredFolder)) {
      openTripSectionForm(preferredFolder);
      toast('Maak eerst een map binnen deze reis');
      return;
    }
    preselectedTripFolderId = preferredFolder;
  }
  addMode = 'item';
  const config = formConfig(current);
  if (!config) return;
  document.querySelector('#dialogTitle').textContent = config.title;
  document.querySelector('#formFields').innerHTML = config.fields.map(([name, label, type, options, conditionalClass]) => {
    const choices = (options || []).map(option => Array.isArray(option) ? option : [option, option]);
    if (type === 'checkbox') return `<label class="checkbox-field"><input id="f-${name}" name="${name}" type="checkbox"><span>${label}</span></label>`;
    const control = type === 'select'
      ? `<select id="f-${name}" name="${name}">${choices.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join('')}</select>`
      : type === 'textarea'
        ? `<textarea id="f-${name}" name="${name}"></textarea>`
        : `<input id="f-${name}" name="${name}" type="${type}" ${name === 'title' || name === 'due' || (name === 'date' && current !== 'trips') ? 'required' : ''} ${name === 'due' || (name === 'date' && current !== 'trips') ? `value="${todayISO()}"` : ''}>`;
    return `<div class="field ${conditionalClass || ''}"><label for="f-${name}">${label}</label>${control}</div>`;
  }).join('');
  document.querySelector('#itemDialog').showModal();
  if (preselectedTripFolderId && document.querySelector('#f-tripFolderId')) document.querySelector('#f-tripFolderId').value = preselectedTripFolderId;
  if (current === 'trips') refreshTripSectionSelect(preselectedTripFolderId, preselectedTripSectionId);
  toggleSecondWeekdayField();
}

function refreshTripSectionSelect(folderId, selectedSectionId = '') {
  const select = document.querySelector('#f-tripSectionId');
  if (!select) return;
  const sections = data.tripSections.filter(section => section.tripFolderId === folderId);
  select.innerHTML = sections.map(section => `<option value="${esc(section.id)}">${esc(section.name)}</option>`).join('');
  if (selectedSectionId && sections.some(section => section.id === selectedSectionId)) select.value = selectedSectionId;
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

function openTripSectionForm(tripFolderId) {
  const folder = tripFolderById(tripFolderId);
  if (!folder) return;
  addMode = 'trip-section';
  document.querySelector('#dialogTitle').textContent = `Map in ${folder.name}`;
  document.querySelector('#formFields').innerHTML = `
    <input name="tripFolderId" type="hidden" value="${esc(folder.id)}">
    <div class="field"><label for="f-title">Naam van de map</label><input id="f-title" name="title" type="text" required placeholder="Bijvoorbeeld Hotels, Vluchten of Paklijst"></div>`;
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
    const folderId = id();
    data.tripFolders.push({ id: folderId, name: formData.title.trim(), startDate: formData.startDate || '', endDate: formData.endDate || '', note: formData.note?.trim() || '' });
    data.tripSections.push({ id: id(), tripFolderId: folderId, name: 'Algemeen' });
    save();
    document.querySelector('#itemDialog').close();
    render();
    toast('Reismap toegevoegd');
    return;
  }
  if (addMode === 'trip-section') {
    if (!tripFolderById(formData.tripFolderId)) return toast('Reis niet gevonden');
    data.tripSections.push({ id: id(), tripFolderId: formData.tripFolderId, name: formData.title.trim() });
    save();
    document.querySelector('#itemDialog').close();
    render();
    toast('Map toegevoegd');
    return;
  }
  ['amount', 'min'].forEach(key => { if (key in formData) formData[key] = Number(formData[key]); });
  if (current === 'groceries') formData.done = false;
  if (current === 'chores') formData.completedDates = [];
  if (current === 'planning') formData.personSource = 'manual';
  if (current === 'trips') {
    const section = tripSectionById(formData.tripSectionId);
    if (!section || section.tripFolderId !== formData.tripFolderId) return toast('Kies een geldige map binnen de reis');
    formData.checkable = formData.checkable === 'on';
    formData.done = false;
    if (formData.checkable && !formData.date) return toast('Kies een deadline voor een onderdeel dat afgevinkt moet worden');
  }
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

const TRAVEL_IMPORT_CATEGORIES = [
  { name: 'Documenten & gezondheid', type: 'Documenten', match: /paspoort|visum|visa\b|verzekering|vaccin|medic|gezondheid|dokter|recept|astma/i },
  { name: 'Paklijst', type: 'Paklijst', match: /paklijst|inpakken|meenemen|bagage|koffer|rugzak|handbagage/i },
  { name: 'Vervoer', type: 'Vervoer', match: /vlucht|flight|vliegtuig|trein|bus\b|transfer|taxi|grab\b|veerboot|ferry|cruise|vervoer/i },
  { name: 'Verblijf', type: 'Verblijf', match: /hotel|hostel|resort|homestay|appartement|verblijf|overnacht|accommodat|check-in|check-out/i },
  { name: 'Eten & drinken', type: 'Eten', match: /restaurant|ontbijt|lunch|diner|avondeten|eten|drinken|vegetari|food/i },
  { name: 'Budget', type: 'Budget', match: /budget|kosten|prijs|prijzen|totaal|betaalmiddel|contant|valuta|\bvnd\b|\busd\b|\beur\b|€/i },
  { name: 'Activiteiten', type: 'Activiteit', match: /activiteit|excursie|tour\b|bezoek|museum|strand|hike|wandeling|massage|spa\b|skincare|kleermaker|tailor|ring|workshop/i },
  { name: 'Boekingen & acties', type: 'Voorbereiding', match: /boeken|reserveren|regelen|controleren|aanvragen|bevestigen|betalen|kopen|bestellen|afspraak maken|to-do|todo|actiepunt|deadline/i },
  { name: 'Route & planning', type: 'Notitie', match: /route|reisplan|planning|programma|reisschema|itinerary|dagindeling|dag\s+\d+/i }
];

const DUTCH_MONTHS = {
  januari: 1, jan: 1, februari: 2, feb: 2, maart: 3, mrt: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6,
  juli: 7, jul: 7, augustus: 8, aug: 8, september: 9, sep: 9, oktober: 10, okt: 10, november: 11, nov: 11, december: 12, dec: 12
};

function travelImportCategory(line) {
  return TRAVEL_IMPORT_CATEGORIES.find(category => category.match.test(line));
}

function travelImportHeading(line) {
  const clean = line.replace(/^#{1,6}\s*/, '').replace(/[:：]\s*$/, '').trim();
  if (clean.length < 3 || clean.length > 70) return '';
  const knownCategory = travelImportCategory(clean);
  if (knownCategory && (/^#{1,6}\s*/.test(line) || /[:：]\s*$/.test(line) || clean.toUpperCase() === clean)) return knownCategory.name;
  const looksLikeHeading = /^#{1,6}\s*/.test(line) || /[:：]\s*$/.test(line) || /^[A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9 &/+-]{3,}$/.test(clean) || /^(deel|week|hoofdstuk)\s+\d+\b/i.test(clean);
  return looksLikeHeading ? clean.replace(/^\d+[.)]\s*/, '').slice(0, 60) : '';
}

function validTravelDate(year, month, day) {
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day) ? toLocalISO(date) : '';
}

function travelDateFromLine(line, folder) {
  const iso = line.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return validTravelDate(iso[1], iso[2], iso[3]);
  const numeric = line.match(/\b(\d{1,2})[-/.](\d{1,2})(?:[-/.](20\d{2}))?\b/);
  const fallbackYear = folder?.startDate ? parseDate(folder.startDate).getFullYear() : new Date().getFullYear();
  if (numeric) return validTravelDate(numeric[3] || fallbackYear, numeric[2], numeric[1]);
  const written = line.match(/\b(\d{1,2})\s+(januari|jan|februari|feb|maart|mrt|april|apr|mei|juni|jun|juli|jul|augustus|aug|september|sep|oktober|okt|november|nov|december|dec)(?:\s+(20\d{2}))?\b/i);
  return written ? validTravelDate(written[3] || fallbackYear, DUTCH_MONTHS[written[2].toLowerCase()], written[1]) : '';
}

function ensureTripSection(folderId, name) {
  const clean = String(name || 'Algemeen').trim().slice(0, 60) || 'Algemeen';
  let section = data.tripSections.find(item => item.tripFolderId === folderId && item.name.toLowerCase() === clean.toLowerCase());
  if (!section) {
    section = { id: id(), tripFolderId: folderId, name: clean };
    data.tripSections.push(section);
  }
  return section;
}

function importTravelPlan(text, folderId) {
  const folder = data.tripFolders.find(item => item.id === folderId);
  if (!folder) return toast('Kies eerst een reismap');
  const seenLines = new Set();
  let sectionName = 'Algemeen';
  let added = 0;
  let checkableCount = 0;
  let skipped = 0;
  const rawLines = String(text || '').replace(/\u00ad/g, '').split(/\r?\n/);
  rawLines.forEach(rawLine => {
    if (added >= 300) { skipped += 1; return; }
    const source = rawLine.replace(/\s+/g, ' ').trim();
    if (!source || /^pagina\s+\d+(?:\s+van\s+\d+)?$/i.test(source) || /^\d+$/.test(source)) return;
    const heading = travelImportHeading(source);
    if (heading) { sectionName = heading; return; }
    const done = /^(?:✓|✔|☑|\[x\])\s*/i.test(source);
    const explicitAction = /^(?:☐|□|\[\s?\]|todo:|to-do:|actie:)/i.test(source);
    const clean = source.replace(/^(?:[-•▪◦‣–—]|✓|✔|☑|☐|□|\[x\]|\[\s?\])\s*/i, '').trim();
    if (clean.length < 3) return;
    const lineKey = clean.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim();
    if (!lineKey || seenLines.has(lineKey)) return;
    seenLines.add(lineKey);
    const detected = travelImportCategory(clean);
    const targetSection = ensureTripSection(folder.id, detected?.name || sectionName);
    const type = detected?.type || travelImportCategory(targetSection.name)?.type || 'Notitie';
    const checkable = done || explicitAction || /\b(boeken|reserveren|regelen|controleren|aanvragen|bevestigen|betalen|kopen|bestellen|inpakken|meenemen|afspreken|downloaden|printen)\b/i.test(clean);
    const duplicate = data.trips.some(item => item.tripFolderId === folder.id && item.title.toLowerCase() === clean.toLowerCase());
    if (duplicate) { skipped += 1; return; }
    const title = clean.length <= 170 ? clean : `${clean.slice(0, 167).trim()}…`;
    const note = clean.length > 170 ? clean.slice(167).trim() : '';
    data.trips.push({ id: id(), tripFolderId: folder.id, tripSectionId: targetSection.id, title, date: travelDateFromLine(clean, folder), type, note, checkable, done: checkable ? done : false });
    added += 1;
    if (checkable) checkableCount += 1;
  });
  if (!added) return toast('Geen nieuwe reisonderdelen gevonden');
  save();
  render();
  toast(`${added} onderdelen verdeeld · ${checkableCount} om af te vinken${skipped ? ` · ${skipped} overgeslagen` : ''}`);
}

async function extractPdfText(file) {
  const pdfjs = await import(PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    let currentLine = [];
    let previousY = null;
    content.items.forEach(item => {
      const value = String(item.str || '').trim();
      if (!value) return;
      const y = Math.round(item.transform?.[5] || 0);
      if (previousY !== null && Math.abs(y - previousY) > 2 && currentLine.length) {
        lines.push(currentLine.join(' '));
        currentLine = [];
      }
      currentLine.push(value);
      previousY = y;
      if (item.hasEOL && currentLine.length) {
        lines.push(currentLine.join(' '));
        currentLine = [];
        previousY = null;
      }
    });
    if (currentLine.length) lines.push(currentLine.join(' '));
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n');
}

async function readTravelImportFile(file) {
  const folderId = document.querySelector('#travelImportFolder')?.value;
  if (!folderId) return toast('Kies eerst een reismap');
  try {
    toast(file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'PDF wordt gelezen…' : 'Bestand wordt gelezen…');
    const text = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? await extractPdfText(file) : await file.text();
    if (!text.trim()) return toast('In dit bestand is geen leesbare tekst gevonden');
    importTravelPlan(text, folderId);
  } catch (error) {
    console.error('Reisbestand lezen mislukt', error);
    toast('PDF lezen lukte niet. Kopieer de tekst en plak die hier.');
  }
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
  const fields = Object.fromEntries(new FormData(event.target));
  const next = { projectUrl: DEFAULT_PROJECT_URL, anonKey: DEFAULT_PUBLISHABLE_KEY, householdCode: String(fields.householdCode || '').trim() };
  if (next.householdCode.length < 12) return toast('Kies een huishoudcode van minimaal 12 tekens');
  const changedHousehold = next.projectUrl !== syncConfig.projectUrl || next.anonKey !== syncConfig.anonKey || next.householdCode !== syncConfig.householdCode;
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
  const addTripSection = event.target.closest('[data-add-trip-section]');
  if (addTripSection) { openTripSectionForm(addTripSection.dataset.addTripSection); return; }
  const addToTripSection = event.target.closest('[data-add-to-trip-section]');
  if (addToTripSection) {
    const section = tripSectionById(addToTripSection.dataset.addToTripSection);
    if (section) openAdd(section.tripFolderId, section.id);
    return;
  }
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
    data.tripSections = data.tripSections.filter(item => item.tripFolderId !== folderId);
    data.trips = data.trips.filter(item => item.tripFolderId !== folderId);
    save(); render(); toast('Reismap verwijderd'); return;
  }
  const deleteTripSectionButton = event.target.closest('[data-delete-trip-section]');
  if (deleteTripSectionButton) {
    const sectionId = deleteTripSectionButton.dataset.deleteTripSection;
    const section = tripSectionById(sectionId);
    if (!section) return;
    const childCount = data.trips.filter(item => item.tripSectionId === sectionId).length;
    const warning = childCount ? `Ook de ${childCount} onderdelen in deze map worden verwijderd.` : 'Deze map is leeg.';
    if (!confirm(`Map “${section.name}” verwijderen?\n\n${warning}`)) return;
    data.tripSections = data.tripSections.filter(item => item.id !== sectionId);
    data.trips = data.trips.filter(item => item.tripSectionId !== sectionId);
    save(); render(); toast('Map verwijderd'); return;
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
  if (event.target.closest('[data-import-travel-text]')) {
    importTravelPlan(document.querySelector('#travelImportText').value, document.querySelector('#travelImportFolder').value);
    return;
  }
  const picker = event.target.closest('[data-pick-file]');
  if (picker) { document.querySelector(`#${picker.dataset.pickFile}`).click(); return; }
  if (event.target.closest('[data-sync-now]')) { syncNow({ manual: true }); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'backup') exportBackup();
  if (action === 'restore') document.querySelector('#restoreInput').click();
});

document.addEventListener('change', event => {
  if (event.target.id === 'f-repeat' || event.target.id === 'f-due') toggleSecondWeekdayField();
  if (event.target.id === 'f-tripFolderId') refreshTripSectionSelect(event.target.value);
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
document.querySelector('#travelImportFile').addEventListener('change', event => {
  if (event.target.files[0]) readTravelImportFile(event.target.files[0]);
  event.target.value = '';
});
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

;


/* ===== GEÏNTEGREERD: upgrade-v11.js ===== */
/* Samen Thuis v11 – travel editing, import preview, priorities and automatic two-way sync */
(() => {
  if (window.__SAMEN_THUIS_V11_LOADED__) return;
  window.__SAMEN_THUIS_V11_LOADED__ = true;

  const AUTO_SYNC_INTERVAL_MS = 30000;
  const PRIORITIES = ['low', 'medium', 'high'];
  const PRIORITY_LABELS = { low: 'Laag', medium: 'Gemiddeld', high: 'Hoog' };
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2, '': 3 };
  const TRAVEL_TYPES = ['Voorbereiding', 'Reservering', 'Vervoer', 'Verblijf', 'Activiteit', 'Eten', 'Budget', 'Documenten', 'Paklijst', 'Notitie'];

  let autoSyncInterval = null;
  let travelDraft = [];
  let travelDraftFolderId = '';

  const baseFormConfig = formConfig;
  const baseOpenAdd = openAdd;
  const baseRenderTrips = renderTrips;
  const baseRenderSettings = renderSettings;
  const baseUpdateSyncBadge = updateSyncBadge;

  const nowIso = () => new Date().toISOString();

  function isImportant(value) {
    return value === true || value === 'true' || value === 'on' || value === 1;
  }

  function normalisePriority(item) {
    item.important = isImportant(item.important);
    item.priority = item.important && PRIORITIES.includes(item.priority) ? item.priority : (item.important ? 'medium' : '');
    if (!item.updatedAt) item.updatedAt = data.meta?.updatedAt || nowIso();
    return item;
  }

  function normaliseTravelData({ persist = false } = {}) {
    (data.tripFolders || []).forEach(folder => {
      folder.createdAt ||= data.meta?.updatedAt || nowIso();
      folder.updatedAt ||= folder.createdAt;
    });
    (data.tripSections || []).forEach(section => {
      section.createdAt ||= data.meta?.updatedAt || nowIso();
      section.updatedAt ||= section.createdAt;
    });
    (data.trips || []).forEach(normalisePriority);
    if (persist) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function syncTimeLabel(value) {
    if (!value) return 'Nog niet gesynchroniseerd';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Nog niet gesynchroniseerd';
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return `${sameDay ? 'Vandaag' : date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} om ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function priorityBadge(item) {
    if (!item.important) return '';
    const priority = PRIORITIES.includes(item.priority) ? item.priority : 'medium';
    return `<span class="priority-badge ${priority}">${PRIORITY_LABELS[priority]}</span>`;
  }

  function markUpdated(item) {
    item.updatedAt = nowIso();
  }

  formConfig = function formConfigV11(view) {
    const config = baseFormConfig(view);
    if (view !== 'trips' || !config) return config;
    config.fields = config.fields.map(field => [...field]);
    if (!config.fields.some(([name]) => name === 'important')) {
      config.fields.push(['important', 'Belangrijk / prioriteit', 'checkbox']);
      config.fields.push(['priority', 'Prioriteit', 'select', [['low', 'Laag'], ['medium', 'Gemiddeld'], ['high', 'Hoog']], 'trip-priority-field']);
    }
    return config;
  };

  function updateAddPriorityVisibility() {
    const important = document.querySelector('#f-important');
    const priority = document.querySelector('#f-priority');
    const field = priority?.closest('.trip-priority-field');
    if (!important || !priority || !field) return;
    if (!priority.dataset.initialised) {
      priority.value = 'medium';
      priority.dataset.initialised = '1';
    }
    field.hidden = !important.checked;
    priority.disabled = !important.checked;
  }

  openAdd = function openAddV11(...args) {
    baseOpenAdd(...args);
    if (current === 'trips') setTimeout(updateAddPriorityVisibility, 0);
  };

  openTravelActions = function openTravelActionsV11() {
    normaliseTravelData();
    return data.trips.filter(item => item.checkable && !item.done).sort((a, b) => {
      const importantOrder = Number(Boolean(b.important)) - Number(Boolean(a.important));
      if (importantOrder) return importantOrder;
      const priorityOrder = PRIORITY_RANK[a.priority || ''] - PRIORITY_RANK[b.priority || ''];
      if (priorityOrder) return priorityOrder;
      const dateOrder = (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31');
      return dateOrder || a.title.localeCompare(b.title, 'nl');
    });
  };

  renderTravelActions = function renderTravelActionsV11() {
    const actions = openTravelActions().slice(0, 10);
    return `<section class="card travel-actions"><div class="card-head"><div><p class="eyebrow">Belangrijkste reisacties</p><h2>Prioriteiten & deadlines</h2></div><button class="text-btn" data-view="trips">Alle reizen</button></div><div class="list">${actions.length ? actions.map(item => {
      const folder = tripFolderById(item.tripFolderId);
      const section = tripSectionById(item.tripSectionId);
      const overdue = item.date && item.date < todayISO();
      const timing = item.date ? `${overdue ? 'Te laat · ' : ''}${fmtDate(item.date)}` : 'Geen deadline';
      return `<div class="list-item travel-action ${overdue ? 'overdue' : ''}"><button class="check" data-toggle="trips:${item.id}" aria-label="${esc(item.title)} afronden"></button><div class="item-main"><div class="travel-title-row"><strong>${esc(item.title)}</strong>${priorityBadge(item)}</div><small>${esc(folder?.name || 'Reis')}${section ? ` · ${esc(section.name)}` : ''} · ${esc(timing)}</small></div></div>`;
    }).join('') : '<p class="muted">Geen open reisacties.</p>'}</div>${openTravelActions().length > 10 ? `<p class="muted travel-more">Nog ${openTravelActions().length - 10} acties staan bij Reizen.</p>` : ''}</section>`;
  };

  tripItemRow = function tripItemRowV11(item) {
    normalisePriority(item);
    const hasDate = Boolean(item.date);
    return `<div class="list-item ${item.done ? 'is-done' : ''}">${item.checkable ? `<button class="check ${item.done ? 'done' : ''}" data-toggle="trips:${item.id}" aria-label="${item.done ? 'Opnieuw openen' : 'Afronden'}">${item.done ? '✓' : ''}</button>` : ''}<div class="trip-date">${hasDate ? `<strong>${parseDate(item.date).getDate()}</strong><small>${fmtDate(item.date, { month: 'short' })}</small>` : '<strong>–</strong><small>datum</small>'}</div><div class="item-main"><div class="travel-title-row"><strong class="${item.done ? 'done-text' : ''}">${esc(item.title)}</strong>${priorityBadge(item)}</div><small>${esc(item.type)}${item.checkable ? ' · Afvinken' : ''}${item.note ? ` · ${esc(item.note)}` : ''}</small></div><div class="travel-row-actions"><button class="text-btn" data-edit-trip-item="${item.id}" aria-label="${esc(item.title)} bewerken">✎</button><button class="delete" data-delete="trips:${item.id}" aria-label="${esc(item.title)} verwijderen">×</button></div></div>`;
  };

  renderTrips = function renderTripsV11() {
    let html = baseRenderTrips();
    html = html.replace(/(<button class="delete" data-delete-trip-folder="([^"]+)"[^>]*>×<\/button>)/g, '<div class="travel-edit-actions"><button class="text-btn" data-edit-trip-folder="$2" aria-label="Reismap bewerken">✎</button>$1</div>');
    html = html.replace(/(<button class="delete" data-delete-trip-section="([^"]+)"[^>]*>×<\/button>)/g, '<div class="travel-edit-actions"><button class="text-btn" data-edit-trip-section="$2" aria-label="Map bewerken">✎</button>$1</div>');
    return html;
  };

  renderSettings = function renderSettingsV11() {
    let html = baseRenderSettings();
    const detail = `<div class="sync-detail"><strong>Automatische synchronisatie</strong><p>Wijzigingen worden na ongeveer 1,2 seconde verzonden. Als de app open is, controleert hij daarnaast elke 30 seconden op nieuwere gegevens van je andere apparaten.</p><p><strong>Laatst gesynchroniseerd:</strong> ${esc(syncTimeLabel(syncConfig.lastSyncedAt))}</p><p class="muted small">De knop “Nu synchroniseren” blijft alleen als noodknop; normaal hoef je die niet te gebruiken.</p></div>`;
    html = html.replace('</form>\n    </section>', `</form>${detail}\n    </section>`);
    return html;
  };

  updateSyncBadge = function updateSyncBadgeV11(message) {
    baseUpdateSyncBadge(message);
    const badge = document.querySelector('#syncState');
    if (!badge || message) return;
    if (syncConfigured() && navigator.onLine && !syncing && !syncError && syncConfig.lastSyncedAt) {
      const date = new Date(syncConfig.lastSyncedAt);
      badge.textContent = `✓ ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
      badge.title = `Laatst gesynchroniseerd: ${syncTimeLabel(syncConfig.lastSyncedAt)}`;
    }
  };

  function ensureTravelEditDialog() {
    if (document.querySelector('#travelEditDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'travelEditDialog';
    dialog.innerHTML = `<form id="travelEditForm" method="dialog"><div class="dialog-head"><div><p class="eyebrow">Reizen</p><h2 id="travelEditTitle">Bewerken</h2></div><button type="button" class="icon-btn" data-close-travel-edit aria-label="Sluiten">×</button></div><div id="travelEditFields" class="form-grid"></div><div class="dialog-actions"><button type="button" class="secondary" data-close-travel-edit>Annuleren</button><button type="submit" class="primary">Wijzigingen opslaan</button></div></form>`;
    document.body.appendChild(dialog);
  }

  function folderOptions(selected) {
    return data.tripFolders.map(folder => `<option value="${esc(folder.id)}" ${folder.id === selected ? 'selected' : ''}>${esc(folder.name)}</option>`).join('');
  }

  function sectionOptions(folderId, selected) {
    return data.tripSections.filter(section => section.tripFolderId === folderId).map(section => `<option value="${esc(section.id)}" ${section.id === selected ? 'selected' : ''}>${esc(section.name)}</option>`).join('');
  }

  function typeOptions(selected) {
    return TRAVEL_TYPES.map(type => `<option ${type === selected ? 'selected' : ''}>${esc(type)}</option>`).join('');
  }

  function priorityOptions(selected = 'medium') {
    return PRIORITIES.map(value => `<option value="${value}" ${value === selected ? 'selected' : ''}>${PRIORITY_LABELS[value]}</option>`).join('');
  }

  function openTravelItemEdit(itemId) {
    ensureTravelEditDialog();
    const item = data.trips.find(candidate => candidate.id === itemId);
    if (!item) return;
    normalisePriority(item);
    const dialog = document.querySelector('#travelEditDialog');
    dialog.dataset.mode = 'item';
    dialog.dataset.id = item.id;
    document.querySelector('#travelEditTitle').textContent = 'Reisonderdeel bewerken';
    document.querySelector('#travelEditFields').innerHTML = `
      <div class="field"><label>Titel</label><input name="title" required value="${esc(item.title)}"></div>
      <div class="field"><label>Reis</label><select name="tripFolderId" id="editTripFolder">${folderOptions(item.tripFolderId)}</select></div>
      <div class="field"><label>Map binnen de reis</label><select name="tripSectionId" id="editTripSection">${sectionOptions(item.tripFolderId, item.tripSectionId)}</select></div>
      <div class="field"><label>Deadline / datum</label><input name="date" type="date" value="${esc(item.date || '')}"></div>
      <div class="field"><label>Soort</label><select name="type">${typeOptions(item.type)}</select></div>
      <div class="field"><label>Notitie</label><textarea name="note">${esc(item.note || '')}</textarea></div>
      <label class="checkbox-field"><input name="checkable" type="checkbox" ${item.checkable ? 'checked' : ''}><span>Dit moet afgevinkt worden</span></label>
      <label class="checkbox-field"><input name="important" id="editTripImportant" type="checkbox" ${item.important ? 'checked' : ''}><span>Belangrijk / prioriteit</span></label>
      <div class="field trip-priority-field" id="editTripPriorityField" ${item.important ? '' : 'hidden'}><label>Prioriteit</label><select name="priority" id="editTripPriority" ${item.important ? '' : 'disabled'}>${priorityOptions(item.priority || 'medium')}</select></div>`;
    dialog.showModal();
  }

  function openTravelFolderEdit(folderId) {
    ensureTravelEditDialog();
    const folder = tripFolderById(folderId);
    if (!folder) return;
    const dialog = document.querySelector('#travelEditDialog');
    dialog.dataset.mode = 'folder';
    dialog.dataset.id = folder.id;
    document.querySelector('#travelEditTitle').textContent = 'Reismap bewerken';
    document.querySelector('#travelEditFields').innerHTML = `
      <div class="field"><label>Naam van de reis</label><input name="name" required value="${esc(folder.name)}"></div>
      <div class="field"><label>Vertrekdatum</label><input name="startDate" type="date" value="${esc(folder.startDate || '')}"></div>
      <div class="field"><label>Terugkomstdatum</label><input name="endDate" type="date" value="${esc(folder.endDate || '')}"></div>
      <div class="field"><label>Notitie</label><textarea name="note">${esc(folder.note || '')}</textarea></div>`;
    dialog.showModal();
  }

  function openTravelSectionEdit(sectionId) {
    ensureTravelEditDialog();
    const section = tripSectionById(sectionId);
    if (!section) return;
    const dialog = document.querySelector('#travelEditDialog');
    dialog.dataset.mode = 'section';
    dialog.dataset.id = section.id;
    document.querySelector('#travelEditTitle').textContent = 'Map bewerken';
    document.querySelector('#travelEditFields').innerHTML = `<div class="field"><label>Naam van de map</label><input name="name" required value="${esc(section.name)}"></div>`;
    dialog.showModal();
  }

  function updateEditPriorityVisibility() {
    const important = document.querySelector('#editTripImportant');
    const priority = document.querySelector('#editTripPriority');
    const field = document.querySelector('#editTripPriorityField');
    if (!important || !priority || !field) return;
    field.hidden = !important.checked;
    priority.disabled = !important.checked;
  }

  function updateEditSectionOptions() {
    const folder = document.querySelector('#editTripFolder');
    const section = document.querySelector('#editTripSection');
    if (!folder || !section) return;
    section.innerHTML = sectionOptions(folder.value, '');
  }

  function handleTravelEditSubmit(event) {
    event.preventDefault();
    const dialog = document.querySelector('#travelEditDialog');
    const values = Object.fromEntries(new FormData(event.target));
    const mode = dialog.dataset.mode;
    const targetId = dialog.dataset.id;

    if (mode === 'item') {
      const item = data.trips.find(candidate => candidate.id === targetId);
      if (!item) return;
      const targetSection = tripSectionById(values.tripSectionId);
      if (!targetSection || targetSection.tripFolderId !== values.tripFolderId) return toast('Kies een geldige map binnen de reis');
      const checkable = values.checkable === 'on';
      if (checkable && !values.date) return toast('Kies een deadline voor een onderdeel dat afgevinkt moet worden');
      const important = values.important === 'on';
      Object.assign(item, {
        title: String(values.title || '').trim(),
        tripFolderId: values.tripFolderId,
        tripSectionId: values.tripSectionId,
        date: values.date || '',
        type: values.type || 'Notitie',
        note: String(values.note || '').trim(),
        checkable,
        done: checkable ? Boolean(item.done) : false,
        important,
        priority: important && PRIORITIES.includes(values.priority) ? values.priority : (important ? 'medium' : '')
      });
      markUpdated(item);
    } else if (mode === 'folder') {
      const folder = tripFolderById(targetId);
      if (!folder) return;
      Object.assign(folder, { name: String(values.name || '').trim(), startDate: values.startDate || '', endDate: values.endDate || '', note: String(values.note || '').trim() });
      markUpdated(folder);
    } else if (mode === 'section') {
      const section = tripSectionById(targetId);
      if (!section) return;
      section.name = String(values.name || '').trim();
      markUpdated(section);
    }

    save();
    dialog.close();
    render();
    toast('Wijzigingen opgeslagen');
  }

  function hasDateLead(line) {
    return /^(?:dag\s+\d+\b|\d{1,2}\s+(?:januari|jan|februari|feb|maart|mrt|april|apr|mei|juni|jun|juli|jul|augustus|aug|september|sep|oktober|okt|november|nov|december|dec)\b|20\d{2}-\d{1,2}-\d{1,2}\b|\d{1,2}[-/.]\d{1,2}(?:[-/.]20\d{2})?\b)/i.test(line);
  }

  function candidateTitleAndNote(text) {
    const clean = text.trim();
    if (clean.length <= 170) return { title: clean, note: '' };
    const boundary = clean.slice(70, 175).search(/[.!?;](?:\s|$)/);
    const cut = boundary >= 0 ? 70 + boundary + 1 : 167;
    return { title: `${clean.slice(0, cut).trim()}${cut < clean.length ? '…' : ''}`, note: clean.slice(cut).trim() };
  }

  function parseTravelCandidates(text, folderId) {
    const folder = tripFolderById(folderId);
    if (!folder) return [];
    const blocks = [];
    let sectionName = 'Algemeen';
    let currentBlock = null;

    const pushBlock = () => {
      if (currentBlock?.text?.trim()) blocks.push(currentBlock);
      currentBlock = null;
    };

    String(text || '').replace(/\u00ad/g, '').split(/\r?\n/).forEach(rawLine => {
      const source = rawLine.replace(/\s+/g, ' ').trim();
      if (!source || /^pagina\s+\d+(?:\s+van\s+\d+)?$/i.test(source) || /^\d+$/.test(source)) return;
      const heading = travelImportHeading(source);
      if (heading) {
        pushBlock();
        sectionName = heading;
        return;
      }
      const bullet = /^(?:[-•▪◦‣–—]|✓|✔|☑|☐|□|\[x\]|\[\s?\])\s*/i.test(source);
      const startsNew = bullet || hasDateLead(source) || !currentBlock;
      if (startsNew) {
        pushBlock();
        currentBlock = { sectionName, text: source };
      } else if ((currentBlock.text.length + source.length) < 900) {
        currentBlock.text += ` ${source}`;
      } else {
        pushBlock();
        currentBlock = { sectionName, text: source };
      }
    });
    pushBlock();

    const seen = new Set();
    return blocks.slice(0, 180).map(block => {
      const source = block.text;
      const done = /^(?:✓|✔|☑|\[x\])\s*/i.test(source);
      const explicitAction = /^(?:☐|□|\[\s?\]|todo:|to-do:|actie:)/i.test(source);
      const clean = source.replace(/^(?:[-•▪◦‣–—]|✓|✔|☑|☐|□|\[x\]|\[\s?\])\s*/i, '').trim();
      if (clean.length < 3) return null;
      const key = clean.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim();
      if (!key || seen.has(key)) return null;
      seen.add(key);
      const detected = travelImportCategory(clean);
      const section = detected?.name || block.sectionName || 'Algemeen';
      const type = detected?.type || travelImportCategory(section)?.type || 'Notitie';
      const checkable = done || explicitAction || /\b(boeken|reserveren|regelen|controleren|aanvragen|bevestigen|betalen|kopen|bestellen|inpakken|meenemen|afspreken|downloaden|printen)\b/i.test(clean);
      const split = candidateTitleAndNote(clean);
      return {
        selected: true,
        title: split.title,
        note: split.note,
        section,
        type,
        date: travelDateFromLine(clean, folder),
        checkable,
        done: checkable ? done : false,
        important: false,
        priority: ''
      };
    }).filter(Boolean).filter(candidate => !data.trips.some(item => item.tripFolderId === folderId && item.title.toLowerCase() === candidate.title.toLowerCase()));
  }

  function renderTravelDraft() {
    document.querySelector('#travelImportPreview')?.remove();
    const importCard = document.querySelector('.travel-import');
    if (!importCard || !travelDraft.length) return;
    const section = document.createElement('section');
    section.id = 'travelImportPreview';
    section.className = 'card travel-import-preview';
    section.innerHTML = `<div class="card-head"><div><p class="eyebrow">Controle vóór import</p><h2>${travelDraft.length} mogelijke onderdelen gevonden</h2><p class="muted small">Pas tekst, map, type, datum, afvinken en prioriteit eerst aan. Pas na “Geselecteerde importeren” worden ze opgeslagen.</p></div><div class="button-row"><button class="secondary" data-preview-select-all>Alles selecteren</button><button class="secondary" data-preview-select-none>Niets selecteren</button></div></div><div class="travel-preview-list">${travelDraft.map((candidate, index) => `<article class="travel-preview-card" data-preview-index="${index}"><label class="preview-select"><input type="checkbox" data-preview-selected ${candidate.selected ? 'checked' : ''}> Importeren</label><div class="preview-grid"><div class="field preview-title"><label>Titel</label><input data-preview-title value="${esc(candidate.title)}"></div><div class="field"><label>Map</label><input data-preview-section value="${esc(candidate.section)}"></div><div class="field"><label>Soort</label><select data-preview-type>${typeOptions(candidate.type)}</select></div><div class="field"><label>Datum / deadline</label><input type="date" data-preview-date value="${esc(candidate.date || '')}"></div><label class="checkbox-field compact"><input type="checkbox" data-preview-checkable ${candidate.checkable ? 'checked' : ''}><span>Afvinken</span></label><label class="checkbox-field compact"><input type="checkbox" data-preview-important><span>Belangrijk</span></label><div class="field preview-priority" hidden><label>Prioriteit</label><select data-preview-priority disabled>${priorityOptions('medium')}</select></div><div class="field preview-note"><label>Notitie</label><textarea data-preview-note>${esc(candidate.note || '')}</textarea></div></div></article>`).join('')}</div><div class="button-row preview-actions"><button class="secondary" data-preview-cancel>Annuleren</button><button class="primary" data-preview-import>Geselecteerde importeren</button></div>`;
    importCard.insertAdjacentElement('afterend', section);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function beginTravelPreview(text, folderId) {
    const candidates = parseTravelCandidates(text, folderId);
    if (!candidates.length) return toast('Geen nieuwe reisonderdelen gevonden');
    travelDraft = candidates;
    travelDraftFolderId = folderId;
    renderTravelDraft();
    toast(`${candidates.length} onderdelen gevonden · controleer ze eerst`);
  }

  async function readTravelFileToPreview(file) {
    const folderId = document.querySelector('#travelImportFolder')?.value;
    if (!folderId) return toast('Kies eerst een reismap');
    try {
      toast(file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'PDF wordt gelezen…' : 'Bestand wordt gelezen…');
      const text = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? await extractPdfText(file) : await file.text();
      if (!text.trim()) return toast('In dit bestand is geen leesbare tekst gevonden');
      const textarea = document.querySelector('#travelImportText');
      if (textarea) textarea.value = text;
      beginTravelPreview(text, folderId);
    } catch (error) {
      console.error('Reisbestand lezen mislukt', error);
      toast('PDF lezen lukte niet. Kopieer de tekst en plak die hier.');
    }
  }

  function importPreviewCandidates() {
    const cards = [...document.querySelectorAll('.travel-preview-card')];
    let added = 0;
    let skipped = 0;
    cards.forEach(card => {
      if (!card.querySelector('[data-preview-selected]')?.checked) return;
      const title = card.querySelector('[data-preview-title]')?.value.trim();
      if (!title) { skipped += 1; return; }
      const sectionName = card.querySelector('[data-preview-section]')?.value.trim() || 'Algemeen';
      const duplicate = data.trips.some(item => item.tripFolderId === travelDraftFolderId && item.title.toLowerCase() === title.toLowerCase());
      if (duplicate) { skipped += 1; return; }
      const targetSection = ensureTripSection(travelDraftFolderId, sectionName);
      const important = Boolean(card.querySelector('[data-preview-important]')?.checked);
      const priority = important ? (card.querySelector('[data-preview-priority]')?.value || 'medium') : '';
      const checkable = Boolean(card.querySelector('[data-preview-checkable]')?.checked);
      data.trips.push({
        id: id(),
        tripFolderId: travelDraftFolderId,
        tripSectionId: targetSection.id,
        title,
        date: card.querySelector('[data-preview-date]')?.value || '',
        type: card.querySelector('[data-preview-type]')?.value || 'Notitie',
        note: card.querySelector('[data-preview-note]')?.value.trim() || '',
        checkable,
        done: false,
        important,
        priority,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      added += 1;
    });
    if (!added) return toast('Selecteer minimaal één geldig onderdeel');
    save();
    travelDraft = [];
    travelDraftFolderId = '';
    render();
    toast(`${added} onderdelen geïmporteerd${skipped ? ` · ${skipped} overgeslagen` : ''}`);
  }

  function replaceTravelFileInput() {
    const oldInput = document.querySelector('#travelImportFile');
    if (!oldInput || oldInput.dataset.v11 === '1') return;
    const fresh = oldInput.cloneNode(true);
    fresh.dataset.v11 = '1';
    oldInput.replaceWith(fresh);
    fresh.addEventListener('change', event => {
      if (event.target.files[0]) readTravelFileToPreview(event.target.files[0]);
      event.target.value = '';
    });
  }

  syncNow = async function syncNowV11({ manual = false } = {}) {
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

      const localTime = new Date(data.meta?.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteData?.meta?.updatedAt || 0).getTime();
      let remoteLoaded = false;

      if (!remoteData) {
        const payload = await encryptData(data, syncConfig.householdCode);
        const upload = await fetch(`${baseUrl}/rest/v1/household_data?on_conflict=id`, {
          method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ id: householdId, payload, updated_at: data.meta.updatedAt })
        });
        if (!upload.ok) throw new Error(`Opslaan gaf ${upload.status}`);
      } else if (remoteTime > localTime) {
        data = remoteData;
        normaliseTravelData();
        save({ touch: false, sync: false });
        remoteLoaded = true;
      } else if (localTime > remoteTime) {
        const payload = await encryptData(data, syncConfig.householdCode);
        const upload = await fetch(`${baseUrl}/rest/v1/household_data?on_conflict=id`, {
          method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ id: householdId, payload, updated_at: data.meta.updatedAt })
        });
        if (!upload.ok) throw new Error(`Opslaan gaf ${upload.status}`);
      }

      syncConfig.lastSyncedAt = nowIso();
      localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
      syncError = '';
      if (current === 'settings' || remoteLoaded) render();
      if (manual) toast('Apparaten zijn bijgewerkt');
    } catch (error) {
      console.error('Synchronisatie mislukt', error);
      syncError = error.message || 'Synchronisatie mislukt';
      if (manual) toast('Synchronisatie lukt nog niet. Controleer de instellingen.');
    } finally {
      syncing = false;
      updateSyncBadge();
    }
  };

  function startAutomaticSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    autoSyncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') syncNow();
    }, AUTO_SYNC_INTERVAL_MS);
  }

  document.addEventListener('click', event => {
    const importText = event.target.closest('[data-import-travel-text]');
    if (importText) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const folderId = document.querySelector('#travelImportFolder')?.value;
      const text = document.querySelector('#travelImportText')?.value || '';
      if (!folderId) return toast('Kies eerst een reismap');
      if (!text.trim()) return toast('Plak eerst de tekst uit het reisplan');
      beginTravelPreview(text, folderId);
      return;
    }

    const editItem = event.target.closest('[data-edit-trip-item]');
    if (editItem) { event.preventDefault(); openTravelItemEdit(editItem.dataset.editTripItem); return; }
    const editFolder = event.target.closest('[data-edit-trip-folder]');
    if (editFolder) { event.preventDefault(); openTravelFolderEdit(editFolder.dataset.editTripFolder); return; }
    const editSection = event.target.closest('[data-edit-trip-section]');
    if (editSection) { event.preventDefault(); openTravelSectionEdit(editSection.dataset.editTripSection); return; }
    if (event.target.closest('[data-close-travel-edit]')) { document.querySelector('#travelEditDialog')?.close(); return; }
    if (event.target.closest('[data-preview-select-all]')) { document.querySelectorAll('[data-preview-selected]').forEach(input => { input.checked = true; }); return; }
    if (event.target.closest('[data-preview-select-none]')) { document.querySelectorAll('[data-preview-selected]').forEach(input => { input.checked = false; }); return; }
    if (event.target.closest('[data-preview-cancel]')) { travelDraft = []; travelDraftFolderId = ''; document.querySelector('#travelImportPreview')?.remove(); return; }
    if (event.target.closest('[data-preview-import]')) { importPreviewCandidates(); return; }
  }, true);

  document.addEventListener('change', event => {
    if (event.target.matches('#f-important')) updateAddPriorityVisibility();
    if (event.target.matches('#editTripImportant')) updateEditPriorityVisibility();
    if (event.target.matches('#editTripFolder')) updateEditSectionOptions();
    if (event.target.matches('[data-preview-important]')) {
      const card = event.target.closest('.travel-preview-card');
      const field = card?.querySelector('.preview-priority');
      const select = card?.querySelector('[data-preview-priority]');
      if (field && select) {
        field.hidden = !event.target.checked;
        select.disabled = !event.target.checked;
      }
    }
  });

  document.querySelector('#itemForm')?.addEventListener('submit', () => {
    if (current !== 'trips') return;
    setTimeout(() => {
      normaliseTravelData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (syncConfigured()) scheduleSync();
    }, 0);
  });

  ensureTravelEditDialog();
  document.querySelector('#travelEditForm')?.addEventListener('submit', handleTravelEditSubmit);
  replaceTravelFileInput();

  window.addEventListener('focus', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });

  normaliseTravelData({ persist: true });
  startAutomaticSync();
  render();
  updateSyncBadge();
  syncNow();
})();

;


/* ===== GEÏNTEGREERD: samen-thuis-update-v4.js ===== */
console.info('Samen Thuis update 12.0 geladen');

(() => {
  'use strict';

  // Deze file wordt na app.js en upgrade-v11.js geladen en gebruikt bewust
  // de bestaande Samen Thuis data/functions in plaats van een tweede opslaglaag.

  const IMPORT_TARGETS = {
    planning: 'Agenda',
    meals: 'Weekmenu',
    groceries: 'Boodschappen',
    chores: 'Huishouden',
    stock: 'Voorraad',
    ideas: 'Samen doen',
    home: 'Woning',
    trips: 'Reizen'
  };

  const importState = { target: 'planning', text: '', filename: '', preview: [] };
  const oldRender = render;

  sections.imports = { label: 'Importeren', icon: '↥' };

  function importEsc(value='') { return esc(value); }

  function ensureImportDialog() {
    if (document.querySelector('#editItemDialogV12')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'editItemDialogV12';
    dialog.innerHTML = `
      <form id="editItemFormV12">
        <div class="dialog-head">
          <div><p class="eyebrow">Bewerken</p><h2 id="editItemTitleV12">Item bewerken</h2></div>
          <button type="button" class="icon-btn" data-edit-close>×</button>
        </div>
        <div id="editItemFieldsV12" class="form-grid"></div>
        <div class="dialog-actions">
          <button type="button" class="secondary" data-edit-close>Annuleren</button>
          <button type="submit" class="primary">Wijzigingen opslaan</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll('[data-edit-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  }

  function renderImportsV12() {
    return `<div class="settings-grid import-center-v12">
      <section class="card settings-card">
        <div class="card-head">
          <div><p class="eyebrow">Één centrale ingang</p><h2>Bestand of lijst importeren</h2></div>
          <span class="tag green">Eerst controleren</span>
        </div>
        <p>Kies waar de informatie hoort. Daarna leest de app het bestand of de geplakte tekst en toont eerst een controlelijst. Pas na bevestigen worden de items toegevoegd.</p>
        <div class="form-grid">
          <div class="field">
            <label for="centralImportTarget">Waar hoort dit bij?</label>
            <select id="centralImportTarget">
              ${Object.entries(IMPORT_TARGETS).map(([key,label]) => `<option value="${key}" ${key===importState.target?'selected':''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="centralImportFile">Bestand</label>
            <input id="centralImportFile" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv">
          </div>
          <div class="field" style="grid-column:1/-1">
            <label for="centralImportText">Of tekst/lijst plakken</label>
            <textarea id="centralImportText" placeholder="Plak hier de inhoud…">${importEsc(importState.text)}</textarea>
          </div>
        </div>
        ${importState.filename ? `<p class="muted">Gelezen bestand: <strong>${importEsc(importState.filename)}</strong></p>` : ''}
        <div class="button-row">
          <button class="primary" type="button" data-central-analyse>Analyseren</button>
          <button class="secondary" type="button" data-central-clear>Leegmaken</button>
        </div>
      </section>

      <section class="card settings-card">
        <div class="card-head">
          <div><p class="eyebrow">Controle</p><h2>${importState.preview.length} gevonden items</h2></div>
          ${importState.preview.length ? '<button class="primary" type="button" data-central-commit>Geselecteerde toevoegen</button>' : ''}
        </div>
        <div class="list">
          ${importState.preview.length ? importState.preview.map((entry,index) => `
            <div class="list-item">
              <input type="checkbox" data-preview-check="${index}" ${entry.selected?'checked':''}>
              <div class="item-main">
                <strong>${importEsc(previewTitle(entry.item))}</strong>
                <small>${importEsc(previewSubtitle(entry.item))}</small>
              </div>
              <button class="secondary" type="button" data-preview-edit="${index}">✎</button>
            </div>`).join('') : empty('Nog niets geanalyseerd')}
        </div>
      </section>
    </div>`;
  }

  render = function() {
    if (current === 'imports') {
      document.querySelector('#view').innerHTML = renderImportsV12();
      updateSyncBadge();
      bindImportPageV12();
      return;
    }
    oldRender();
    requestAnimationFrame(addEditButtonsV12);
  };

  function previewTitle(item) {
    return item.title || item.name || item.task || item.text || 'Item';
  }

  function previewSubtitle(item) {
    const bits = [item.date || item.due || '', item.type || item.category || item.repeat || '', item.person || ''].filter(Boolean);
    return bits.join(' · ') || IMPORT_TARGETS[importState.target];
  }

  function bindImportPageV12() {
    const target = document.querySelector('#centralImportTarget');
    if (target) target.onchange = () => {
      importState.target = target.value;
      importState.preview = importState.text ? parseCentralTextV12(importState.text, importState.target) : [];
      render();
    };
    const text = document.querySelector('#centralImportText');
    if (text) text.oninput = () => { importState.text = text.value; };
    const file = document.querySelector('#centralImportFile');
    if (file) file.onchange = async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      try {
        toast('Bestand wordt gelezen…');
        importState.filename = selected.name;
        importState.text = await readCentralFileV12(selected);
        importState.preview = parseCentralTextV12(importState.text, importState.target);
        render();
        toast(`${importState.preview.length} items gevonden`);
      } catch (error) {
        console.error(error);
        toast('Bestand lezen is mislukt');
      }
    };
  }

  async function loadExternalV12(src, test) {
    if (test()) return;
    await new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function readCentralFileV12(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (['txt','md','csv'].includes(ext)) return file.text();

    if (ext === 'docx') {
      await loadExternalV12('https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js', () => Boolean(window.mammoth));
      return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value || '';
    }

    if (['xlsx','xlsm','xls'].includes(ext)) {
      await loadExternalV12('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => Boolean(window.XLSX));
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
      return workbook.SheetNames.map(name => `# Werkblad: ${name}\n${window.XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n\n');
    }

    if (ext === 'pdf') {
      // Gebruik de PDF-functie die de app al voor Reizen heeft.
      return await extractPdfText(file);
    }
    throw new Error('Niet ondersteund bestandstype');
  }

  function linesV12(text) {
    return String(text || '').replace(/\r/g,'').split(/\n+/).map(x => x.trim()).filter(Boolean)
      .filter(x => !/^#\s*(pagina|werkblad)\b/i.test(x));
  }

  function dateInLineV12(line) {
    const iso = line.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
    const eu = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (eu) return `${eu[3]}-${pad(eu[2])}-${pad(eu[1])}`;
    return '';
  }

  function stripDateV12(line) {
    return line.replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}\b/,'')
      .replace(/^[\s|;,:–—-]+/,'').trim();
  }

  function parseCentralTextV12(text, target) {
    const lines = linesV12(text);
    const wrap = item => ({ selected:true, item });

    if (target === 'planning') {
      return lines.filter(line => dateInLineV12(line)).slice(0,200).map(line => wrap({
        id:id(), title:stripDateV12(line) || 'Afspraak', date:dateInLineV12(line), time:'', endTime:'',
        person:'Samen', personSource:'manual', calendarId:data.calendars[0]?.id || 'persoonlijk'
      }));
    }

    if (target === 'meals') {
      const dayMap = new Map(WEEKDAY_NAMES.map((name,index)=>[name.toLowerCase(), index]));
      const start = startOfWeek(todayISO());
      return lines.slice(0,100).map((line,index) => {
        const match = line.match(/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s*[:|;-]\s*(.+)$/i);
        return wrap({
          id:id(),
          date: match ? addDays(start, dayMap.get(match[1].toLowerCase())) : addDays(start, index % 7),
          type:'Avondeten',
          title: match ? match[2].trim() : line.replace(/^[-•]\s*/,'')
        });
      });
    }

    if (target === 'groceries') {
      return parseGroceryText(text).slice(0,300).map(item => wrap({ id:id(), ...item }));
    }

    if (target === 'chores') {
      return lines.slice(0,250).map(line => {
        const parts = line.split(/\s+[–—-]\s+|[;|]/).map(x=>x.trim());
        return wrap({
          id:id(), title:parts[0], person:'Samen', due:todayISO(),
          repeat:parts[1] || 'Wekelijks', secondWeekday:'', notes:'', completedDates:[]
        });
      });
    }

    if (target === 'stock') {
      return lines.slice(0,300).map(line => {
        const match = line.match(/^(.+?)(?:\s+(\d+(?:[.,]\d+)?)\s*([A-Za-zÀ-ÿ]+)?)?$/);
        return wrap({
          id:id(), title:(match?.[1] || line).trim(), category:'Overig',
          amount:match?.[2] ? Number(match[2].replace(',','.')) : 1,
          min:1, unit:match?.[3] || 'stuks'
        });
      });
    }

    if (target === 'ideas') {
      return lines.slice(0,200).map(line => wrap({
        id:id(), title:line.replace(/^[-•]\s*/,''), category:'Thuis', note:'', icon:'♡'
      }));
    }

    if (target === 'home') {
      return lines.slice(0,200).map(line => wrap({
        id:id(), title:line.replace(/^[-•]\s*/,''), category:'Onderhoud', due:'', note:''
      }));
    }

    if (target === 'trips') {
      const folder = data.tripFolders[0];
      if (!folder) return [];
      const section = data.tripSections.find(s => s.tripFolderId === folder.id);
      return lines.slice(0,300).map(line => wrap({
        id:id(), tripFolderId:folder.id, tripSectionId:section?.id || '',
        title:line.replace(/^[-•]\s*/,''), date:dateInLineV12(line), type:'Notitie',
        note:'', checkable:false, done:false
      }));
    }
    return [];
  }

  function editPreviewV12(index) {
    const entry = importState.preview[index];
    if (!entry) return;
    openGenericEditorV12(importState.target, entry.item, false, () => render());
  }

  function commitPreviewV12() {
    const selected = importState.preview.filter(x => x.selected).map(x => x.item);
    if (!selected.length) return toast('Selecteer minimaal één item');
    data[importState.target].push(...selected);
    save();
    importState.preview = [];
    importState.text = '';
    importState.filename = '';
    render();
    toast(`${selected.length} items toegevoegd aan ${IMPORT_TARGETS[importState.target]}`);
  }

  function editableSpecV12(type, item) {
    const base = {
      planning: [['title','Titel','text'],['date','Datum','date'],['time','Tijd','time'],['endTime','Eindtijd','time'],['person','Voor wie','select',['Samen','Kees','Daphne']]],
      meals: [['title','Gerecht','text'],['date','Datum','date'],['type','Moment','select',['Ontbijt','Lunch','Avondeten','Snack']]],
      groceries: [['title','Product','text'],['category','Categorie','select',GROCERY_CATEGORIES],['done','Gekocht','checkbox']],
      chores: [['title','Taak','text'],['person','Voor wie','select',['Samen','Kees','Daphne']],['due','Eerste keer','date'],['repeat','Herhaling','select',['Eenmalig','Dagelijks','Wekelijks','2× per week','Elke 2 weken','Maandelijks']],['notes','Notitie','textarea']],
      stock: [['title','Product','text'],['category','Plek','text'],['amount','Aantal','number'],['min','Minimum','number'],['unit','Eenheid','text']],
      ideas: [['title','Idee','text'],['category','Categorie','text'],['note','Notitie','textarea'],['icon','Emoji','text']],
      home: [['title','Onderwerp','text'],['category','Categorie','text'],['due','Datum','date'],['note','Notitie','textarea']],
      trips: [['title','Onderwerp','text'],['date','Datum/deadline','date'],['type','Soort','text'],['note','Notitie','textarea'],['checkable','Afvinkbaar','checkbox'],['done','Afgerond','checkbox']]
    };
    return base[type] || [];
  }

  function openGenericEditorV12(type, item, persist=true, afterSave=null) {
    ensureImportDialog();
    const dialog = document.querySelector('#editItemDialogV12');
    const fields = editableSpecV12(type, item);
    document.querySelector('#editItemTitleV12').textContent = `${IMPORT_TARGETS[type] || 'Item'} bewerken`;
    document.querySelector('#editItemFieldsV12').innerHTML = fields.map(([key,label,kind,options]) => {
      const value = item[key] ?? '';
      if (kind === 'checkbox') return `<label class="checkbox-field"><input type="checkbox" data-edit-field="${key}" ${value?'checked':''}><span>${label}</span></label>`;
      if (kind === 'textarea') return `<div class="field"><label>${label}</label><textarea data-edit-field="${key}">${importEsc(value)}</textarea></div>`;
      if (kind === 'select') return `<div class="field"><label>${label}</label><select data-edit-field="${key}">${options.map(opt=>`<option value="${importEsc(opt)}" ${String(opt)===String(value)?'selected':''}>${importEsc(opt)}</option>`).join('')}</select></div>`;
      return `<div class="field"><label>${label}</label><input type="${kind}" data-edit-field="${key}" value="${importEsc(value)}"></div>`;
    }).join('');

    const form = document.querySelector('#editItemFormV12');
    form.onsubmit = event => {
      event.preventDefault();
      fields.forEach(([key,,kind]) => {
        const input = dialog.querySelector(`[data-edit-field="${key}"]`);
        if (!input) return;
        if (kind === 'checkbox') item[key] = input.checked;
        else if (kind === 'number') item[key] = Number(input.value) || 0;
        else item[key] = input.value;
      });
      if (persist) save();
      dialog.close();
      if (persist) render();
      afterSave?.();
      if (persist) toast('Wijzigingen opgeslagen');
    };
    dialog.showModal();
  }

  function addEditButtonsV12() {
    if (current === 'today' || current === 'settings' || current === 'imports') return;
    document.querySelectorAll('[data-delete]').forEach(deleteButton => {
      if (deleteButton.parentElement?.querySelector('[data-edit-existing]')) return;
      const raw = deleteButton.dataset.delete || '';
      const [type,itemId] = raw.split(':');
      if (!IMPORT_TARGETS[type] || !itemId) return;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'delete edit-pencil-v12';
      edit.dataset.editExisting = `${type}:${itemId}`;
      edit.setAttribute('aria-label','Bewerken');
      edit.textContent = '✎';
      deleteButton.before(edit);
    });
  }

  document.addEventListener('click', event => {
    const analyse = event.target.closest('[data-central-analyse]');
    if (analyse) {
      importState.text = document.querySelector('#centralImportText')?.value || '';
      importState.preview = parseCentralTextV12(importState.text, importState.target);
      render();
      toast(`${importState.preview.length} items gevonden`);
      return;
    }

    if (event.target.closest('[data-central-clear]')) {
      importState.text=''; importState.filename=''; importState.preview=[];
      render(); return;
    }

    if (event.target.closest('[data-central-commit]')) {
      commitPreviewV12(); return;
    }

    const previewEdit = event.target.closest('[data-preview-edit]');
    if (previewEdit) {
      editPreviewV12(Number(previewEdit.dataset.previewEdit)); return;
    }

    const existingEdit = event.target.closest('[data-edit-existing]');
    if (existingEdit) {
      const [type,itemId] = existingEdit.dataset.editExisting.split(':');
      const item = data[type]?.find(x => x.id === itemId);
      if (item) openGenericEditorV12(type,item,true);
      return;
    }
  });

  document.addEventListener('change', event => {
    const check = event.target.closest('[data-preview-check]');
    if (check) {
      const entry = importState.preview[Number(check.dataset.previewCheck)];
      if (entry) entry.selected = check.checked;
    }
  });

  ensureImportDialog();
  setupNav();
  render();
})();

;


/* ===== GEÏNTEGREERD: samen-thuis-update-v13(1).js ===== */
/* CLEAN MASTER BUILD 2026-09-08 20:xx
   Samen Thuis v13.1
   Fix: gestructureerde reisdocumenten worden als blokken gelezen.
*/
console.info('Samen Thuis update 13.1 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V131__) return;
  window.__SAMEN_THUIS_V131__ = true;

  const TARGETS = {
    planning:'Agenda', meals:'Weekmenu', groceries:'Boodschappen',
    chores:'Huishouden', stock:'Voorraad', ideas:'Samen doen',
    home:'Woning', trips:'Reizen'
  };

  const SUBTYPES = {
    chores:['Reguliere schoonmaak','Periodieke schoonmaak','Was & textiel','Overig'],
    stock:['Huishoudvoorraad','Persoonlijke verzorging','Keuken basisvoorraad','Koelkast & vriezer','Overig'],
    home:['Onderhoud','Veiligheid','Organisatie','Seizoen','Garantie','Woninginfo'],
    trips:['Route & planning','Vervoer','Verblijf','Activiteiten','Boekingen & acties','Budget','Documenten','Paklijst','Overig']
  };

  const REPEATS = [
    'Eenmalig','Dagelijks','Om de dag','2× per week','3× per week','Wekelijks',
    'Elke 2 weken','Elke 4 weken','Maandelijks','Elke 2 maanden','Elke 3 maanden',
    'Elke 6 maanden','Jaarlijks','Na elke was','Wanneer nodig'
  ];

  const state13 = {
    target:'planning',
    subtype:'',
    method:'manual',
    text:'',
    filename:'',
    preview:[],
    tripFolderId:data.tripFolders?.[0]?.id || '',
    tripSectionId:'',
    detectedTripName:'',
    detectedTripStart:'',
    detectedTripEnd:''
  };

  const baseRender13 = render;
  const baseFormConfig13 = formConfig;

  function norm(s='') {
    return String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/&/g,' en ')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }

  function cleanBullet(s='') {
    return String(s)
      .replace(/^\s*(?:[-•▪◦‣–—]|☐|□|☑|✓|✔|\[[ xX]?\])\s*/,'')
      .trim();
  }

  function num(v, fallback=0) {
    const m=String(v??'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return m?Number(m[0]):fallback;
  }

  function boolWord(v) {
    return /^(1|ja|yes|true|aan|x|✓)$/i.test(String(v||'').trim());
  }

  function falseWord(v) {
    return /^(0|nee|no|false|uit)$/i.test(String(v||'').trim());
  }

  function isoDateFromText(s='') {
    let m=String(s).match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m=String(s).match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return '';
  }

  function normaliseRepeat(raw='') {
    const v=norm(String(raw).replace(/^frequentie\s*:\s*/i,''));
    const map=[
      [/^dagelijks$/,'Dagelijks'],[/^(om de dag|elke 2 dagen)$/,'Om de dag'],
      [/^(2x per week|2 per week|twee keer per week)$/,'2× per week'],
      [/^(3x per week|3 per week|drie keer per week)$/,'3× per week'],
      [/^wekelijks$/,'Wekelijks'],[/^(elke 2 weken|2 wekelijks|tweewekelijks)$/,'Elke 2 weken'],
      [/^(elke 4 weken|4 wekelijks)$/,'Elke 4 weken'],[/^maandelijks$/,'Maandelijks'],
      [/^(elke 2 maanden|2 maandelijks)$/,'Elke 2 maanden'],
      [/^(elke 3 maanden|kwartaal|kwartaallijks)$/,'Elke 3 maanden'],
      [/^(elke 6 maanden|halfjaarlijks)$/,'Elke 6 maanden'],
      [/^(jaarlijks|elk jaar|1x per jaar)$/,'Jaarlijks'],
      [/^(na elke was|na iedere was)$/,'Na elke was'],
      [/^(wanneer nodig|indien nodig|naar behoefte)$/,'Wanneer nodig'],
      [/^eenmalig$/,'Eenmalig']
    ];
    for(const [rx,label] of map) if(rx.test(v)) return label;
    return REPEATS.includes(raw)?raw:'Wekelijks';
  }

  function defaultSubtype(target) { return SUBTYPES[target]?.[0] || ''; }

  function keyValueLine(line='') {
    const m=cleanBullet(line).match(/^([^:]{2,40}):\s*(.*)$/);
    if(!m) return null;
    return {key:norm(m[1]), value:m[2].trim()};
  }

  function keyValueParts(line='') {
    const chunks=cleanBullet(line).split('|').map(x=>x.trim()).filter(Boolean);
    const title=chunks.shift()||'';
    const meta={}, loose=[];
    chunks.forEach(chunk=>{
      const m=chunk.match(/^([^:]{2,35}):\s*(.*)$/);
      if(m) meta[norm(m[1])]=m[2].trim();
      else loose.push(chunk);
    });
    return {title,meta,loose};
  }

  function stockCategory(raw, subtype) {
    if(raw) return raw;
    if(subtype==='Persoonlijke verzorging') return 'Badkamer';
    if(subtype==='Keuken basisvoorraad') return 'Voorraadkast';
    if(subtype==='Koelkast & vriezer') return 'Koelkast';
    return 'Overig';
  }

  function duplicateOf(target,item) {
    const arr=data[target]||[];
    return arr.find(existing=>{
      if(norm(existing.title||existing.name)!==norm(item.title||item.name)) return false;
      if(target==='trips' && item.tripFolderId && existing.tripFolderId) {
        return existing.tripFolderId===item.tripFolderId;
      }
      return true;
    });
  }

  function parseChore(line) {
    const {title,meta,loose}=keyValueParts(line);
    if(!title || /^(huishouden|was & textiel)/i.test(title)) return null;
    return {
      id:id(), title,
      person:meta['voor wie']||meta.persoon||'Samen',
      due:meta.datum||meta['eerste keer']||todayISO(),
      repeat:normaliseRepeat(meta.frequentie||meta.herhaling||loose[0]||'Wekelijks'),
      secondWeekday:'',
      notes:meta.notitie||meta.notes||meta.omschrijving||loose.slice(1).join(' · '),
      completedDates:[],
      category:meta.categorie||state13.subtype,
      importSubtype:state13.subtype
    };
  }

  function parseStock(line) {
    const {title,meta}=keyValueParts(line);
    if(!title || /^(huishoudvoorraad|persoonlijke verzorging|keuken basisvoorraad|koelkast)/i.test(title)) return null;
    const desired=num(meta.gewenst??meta.doel??meta.streefvoorraad,0);
    const minimum=num(meta.minimum??meta.min,0);
    const given=meta.aantal??meta['in huis']??meta.huidig;
    const amount=given!==undefined?num(given,0):0;
    return {
      id:id(), title,
      category:stockCategory(meta.categorie||meta.plek,state13.subtype),
      amount,min:minimum,desired:desired||Math.max(minimum,amount),
      unit:meta.eenheid||'stuks',importSubtype:state13.subtype
    };
  }

  function parseHome(line) {
    const {title,meta,loose}=keyValueParts(line);
    if(!title || /^(woningonderhoud|veiligheid|woningorganisatie|seizoenstaken)/i.test(title)) return null;
    const repeatRaw=meta.frequentie||meta.herhaling||'';
    return {
      id:id(),title,
      category:meta.categorie||state13.subtype||'Onderhoud',
      due:meta.datum||'',
      repeat:repeatRaw?normaliseRepeat(repeatRaw):'',
      note:meta.notitie||meta.omschrijving||loose.join(' · '),
      importSubtype:state13.subtype
    };
  }

  function findTripFolderByName(name='') {
    return (data.tripFolders||[]).find(f=>norm(f.name)===norm(name));
  }

  function findTripSectionByName(folderId,name='') {
    return (data.tripSections||[]).find(s=>s.tripFolderId===folderId && norm(s.name)===norm(name));
  }

  function selectedTripFolder() {
    return (data.tripFolders||[]).find(f=>f.id===state13.tripFolderId) || data.tripFolders?.[0] || null;
  }

  function selectedTripSection(folderId) {
    const selected=(data.tripSections||[]).find(s=>s.id===state13.tripSectionId && s.tripFolderId===folderId);
    return selected || (data.tripSections||[]).find(s=>s.tripFolderId===folderId) || null;
  }

  function travelSection(type='',title='') {
    const s=norm(`${type} ${title}`);
    if(/paklijst|reisapotheek|meenemen|kleding|schoenen|outdoor|elektronica/.test(s)) return 'Paklijst';
    if(/verblijf|hotel|homestay|overnachting/.test(s)) return 'Verblijf';
    if(/budget|dagbudget|spaardoel|budgetsamenvatting|budgetnotitie/.test(s)) return 'Budget';
    if(/taak|voorbereiding|gezondheidstaak|boeking|reserver/.test(s)) return 'Boekingen & acties';
    if(/document|visum|paspoort|verzekering/.test(s)) return 'Documenten';
    if(/planning|route/.test(s)) return 'Route & planning';
    if(/vervoer|vlucht|transfer|limousine|trein|bus/.test(s)) return 'Vervoer';
    if(/activiteit|wellness|tip|eten|food|massage|spa|manicure|facial|head spa|canyoning|rafting|workshop/.test(s)) return 'Activiteiten';
    return state13.subtype || 'Overig';
  }

  function travelType(line, subtype='') {
    const s=norm(`${line} ${subtype}`);
    if(/paklijst|meenemen|inpakken|reisapotheek/.test(s)) return 'Paklijst';
    if(/hotel|homestay|verblijf|overnacht/.test(s)) return 'Verblijf';
    if(/vlucht|trein|bus|transfer|taxi|grab|vervoer|ferry|cruise|limousine/.test(s)) return 'Vervoer';
    if(/budget|prijs|kosten|spaardoel|euro|vnd/.test(s)) return 'Budget';
    if(/paspoort|visum|verzekering|document|gezondheid|vaccin/.test(s)) return 'Documenten';
    if(/boeken|vastleggen|reserveren|regelen|controleren|afspraak|taak/.test(s)) return 'Voorbereiding';
    if(/restaurant|eten|food|coffee|koffie/.test(s)) return 'Eten';
    if(/activiteit|tour|cave|rafting|canyoning|massage|spa|tailor|workshop|strand|museum|wellness/.test(s)) return 'Activiteit';
    return 'Notitie';
  }

  function detectTripMeta(lines) {
    state13.detectedTripName='';
    state13.detectedTripStart='';
    state13.detectedTripEnd='';

    for(const line of lines.slice(0,40)) {
      let m=line.match(/^Reis:\s*(.+)$/i);
      if(m) state13.detectedTripName=m[1].trim();
      m=line.match(/^(.+?\b20\d{2})\s*-\s*\d+\b/i);
      if(m && !state13.detectedTripName) state13.detectedTripName=m[1].trim();
    }

    // Record "Reis: X" is followed by metadata in our importdocument.
    const reisIndex=lines.findIndex(x=>/^Reis:\s*/i.test(x));
    if(reisIndex>=0) {
      for(let i=reisIndex+1;i<Math.min(lines.length,reisIndex+12);i++) {
        const kv=keyValueLine(lines[i]);
        if(!kv) break;
        if(kv.key==='startdatum') state13.detectedTripStart=isoDateFromText(kv.value)||kv.value;
        if(kv.key==='einddatum') state13.detectedTripEnd=isoDateFromText(kv.value)||kv.value;
      }
    }

    // Fallback: document title "Vietnam 2027 - 01 Reisplanning"
    if(!state13.detectedTripName && state13.filename) {
      const m=state13.filename.replace(/\.[^.]+$/,'').match(/^(.+?20\d{2})[_ -]/);
      if(m) state13.detectedTripName=m[1].replace(/_/g,' ').trim();
    }

    state13.detectedTripName ||= selectedTripFolder()?.name || 'Nieuwe reis';
  }

  const META_KEYS=new Set([
    'type','locatie','startdatum','einddatum','datum','deadline','afvinken','afvinkbaar',
    'belangrijk','personen','route','details','notitie','notes','categorie','prijs','bedrag',
    'status','plaats','person','voor wie','frequentie','herhaling','eenheid'
  ]);

  function isDocumentNoise(line='') {
    const s=String(line).trim();
    return !s ||
      /^Samen Thuis importdocument\b/i.test(s) ||
      /^IMPORTINSTRUCTIE:/i.test(s) ||
      /^Vietnam 20\d{2}\s*-\s*\d+/i.test(s) ||
      /^Reis:\s*/i.test(s) ||
      /^(Type|Startdatum|Einddatum|Afvinken|Belangrijk|Personen|Route):\s*/i.test(s) && false;
  }

  function structuredTravelBlocks(text) {
    const rawLines=String(text||'').replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    detectTripMeta(rawLines);

    const skipIndexes=new Set();
    const reisIndex=rawLines.findIndex(x=>/^Reis:\s*/i.test(x));
    if(reisIndex>=0) {
      skipIndexes.add(reisIndex);
      for(let i=reisIndex+1;i<Math.min(rawLines.length,reisIndex+15);i++) {
        const kv=keyValueLine(rawLines[i]);
        if(!kv || !META_KEYS.has(kv.key)) break;
        skipIndexes.add(i);
      }
    }

    const blocks=[];
    let current=null;

    function pushCurrent() {
      if(!current) return;
      if(current.title && !isDocumentNoise(current.title)) blocks.push(current);
      current=null;
    }

    rawLines.forEach((line,idx)=>{
      if(skipIndexes.has(idx)) return;
      if(/^Samen Thuis importdocument\b/i.test(line) || /^IMPORTINSTRUCTIE:/i.test(line)) return;
      if(/^Vietnam 20\d{2}\s*-\s*\d+/i.test(line)) return;

      const kv=keyValueLine(line);
      if(kv && META_KEYS.has(kv.key)) {
        if(!current) return; // metadata zonder hoofdonderwerp negeren
        current.meta[kv.key]=kv.value;
        return;
      }

      // Een gewone regel is een nieuw hoofditem.
      pushCurrent();
      current={title:cleanBullet(line),meta:{}};
    });

    pushCurrent();
    return blocks;
  }

  function blockToTrip(block) {
    const m=block.meta||{};
    const title=block.title?.trim();
    if(!title) return null;

    const type=m.type || travelType(title,'');
    const sectionName=travelSection(type,title);
    const startDate=isoDateFromText(m.startdatum||m.datum||m.deadline||'');
    const endDate=isoDateFromText(m.einddatum||'') || startDate;
    let checkable=false;
    if(m.afvinken!==undefined) checkable=boolWord(m.afvinken);
    else if(m.afvinkbaar!==undefined) checkable=boolWord(m.afvinkbaar);
    else checkable=/\b(boek|boeken|vastleggen|reserveer|reserveren|regel|regelen|controleer|controleren|download|meenemen|inpakken)\b/i.test(title);

    const important=m.belangrijk!==undefined ? boolWord(m.belangrijk) : false;

    const notes=[];
    if(m.details) notes.push(m.details);
    if(m.notitie) notes.push(m.notitie);
    if(m.notes) notes.push(m.notes);
    if(m.locatie) notes.push(`Locatie: ${m.locatie}`);
    if(m.prijs) notes.push(`Prijs: ${m.prijs}`);
    if(m.bedrag) notes.push(`Bedrag: ${m.bedrag}`);
    if(m.status) notes.push(`Status: ${m.status}`);
    if(m.categorie) notes.push(`Categorie: ${m.categorie}`);

    const folder=findTripFolderByName(state13.detectedTripName);
    const section=folder?findTripSectionByName(folder.id,sectionName):null;

    return {
      id:id(),
      tripFolderId:folder?.id||'',
      tripSectionId:section?.id||'',
      title,
      date:startDate || endDate || '',
      startDate:startDate||'',
      endDate:endDate||'',
      type,
      note:notes.join('\n'),
      checkable,
      important,
      done:false,
      _pendingFolderName:folder?'':state13.detectedTripName,
      _pendingSectionName:section?'':sectionName
    };
  }

  function parseTripLegacy(line) {
    const source=cleanBullet(line);
    if(!source) return null;
    const {title,meta}=keyValueParts(source);
    const itemTitle=title||source;
    if(!itemTitle || /^[A-ZÀ-Ÿ &/-]{3,}:?$/.test(itemTitle)) return null;
    const folder=selectedTripFolder();
    const section=folder?selectedTripSection(folder.id):null;
    return {
      id:id(),tripFolderId:folder?.id||'',tripSectionId:section?.id||'',
      title:itemTitle,
      date:meta.datum||meta.deadline||isoDateFromText(source),
      startDate:meta.startdatum||'',
      endDate:meta.einddatum||'',
      type:meta.type||meta.soort||travelType(itemTitle,state13.subtype),
      note:meta.notitie||meta.notes||'',
      checkable:boolWord(meta.afvinkbaar||meta.afvinken) || /\b(boeken|vastleggen|reserveren|regelen|controleren|afspraak|downloaden|meenemen|inpakken)\b/i.test(itemTitle),
      important:boolWord(meta.belangrijk),
      done:false
    };
  }

  function parseGeneric(line,target) {
    const clean=cleanBullet(line);
    if(!clean) return null;
    if(target==='ideas') return {id:id(),title:clean,category:'Thuis',note:'',icon:'♡'};
    return null;
  }

  function parseLines13(text,target) {
    if(target==='planning'||target==='meals'||target==='groceries') return null;

    if(target==='trips') {
      const structured=structuredTravelBlocks(text);
      let items=structured.map(blockToTrip).filter(Boolean);

      // Als er geen blokstructuur is, val terug op de oude regelparser.
      if(!items.length) {
        items=String(text||'').replace(/\r/g,'').split(/\n+/)
          .map(x=>x.trim()).filter(Boolean).slice(0,350)
          .map(parseTripLegacy).filter(Boolean);
      }

      return items.map(item=>{
        const dup=duplicateOf(target,item);
        return {selected:!dup,item,duplicate:dup?dup.id:''};
      });
    }

    const lines=String(text||'').replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean)
      .filter(x=>!/^#\s*(pagina|werkblad)\b/i.test(x))
      .filter(x=>!/^(aanbevolen uploadvolgorde|belangrijk|importregels|beperkingen|uitgangspunt woning)$/i.test(x));

    const parser=target==='chores'?parseChore:
      target==='stock'?parseStock:
      target==='home'?parseHome:
      line=>parseGeneric(line,target);

    return lines.slice(0,350).map(parser).filter(Boolean).map(item=>{
      const dup=duplicateOf(target,item);
      return {selected:!dup,item,duplicate:dup?dup.id:''};
    });
  }

  function field(label,html,cls='') {
    return `<div class="field ${cls}"><label>${esc(label)}</label>${html}</div>`;
  }

  function optionList(values,selected) {
    return values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
  }

  function previewMeta(item,target) {
    if(target==='stock') return `${item.category} · huidig ${item.amount} · minimum ${item.min} · gewenst ${item.desired} ${item.unit}`;
    if(target==='chores') return `${item.repeat} · ${item.person}${item.category?' · '+item.category:''}`;
    if(target==='home') return `${item.category}${item.repeat?' · '+item.repeat:''}${item.due?' · '+item.due:''}`;
    if(target==='trips') {
      const folder=(data.tripFolders||[]).find(f=>f.id===item.tripFolderId)?.name || item._pendingFolderName || state13.detectedTripName || 'Nieuwe/gekozen reis';
      const section=(data.tripSections||[]).find(s=>s.id===item.tripSectionId)?.name || item._pendingSectionName || state13.subtype || 'Algemeen';
      const dates=item.startDate&&item.endDate&&item.startDate!==item.endDate?`${item.startDate} → ${item.endDate}`:(item.date||item.startDate||'');
      return `${folder} › ${section} · ${item.type}${dates?' · '+dates:''}${item.checkable?' · afvinken':''}${item.important?' · ★ belangrijk':''}`;
    }
    return item.category||TARGETS[target]||'';
  }

  function previewEditor(entry) {
    const x=entry.item,t=state13.target;
    if(t==='stock') return `
      ${field('Product',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category)}">`)}
      ${field('Huidig',`<input type="number" step="0.01" data-v13-field="amount" value="${x.amount}">`)}
      ${field('Minimum',`<input type="number" step="0.01" data-v13-field="min" value="${x.min}">`)}
      ${field('Gewenst',`<input type="number" step="0.01" data-v13-field="desired" value="${x.desired}">`)}
      ${field('Eenheid',`<input data-v13-field="unit" value="${esc(x.unit)}">`)}`;
    if(t==='chores') return `
      ${field('Taak',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Frequentie',`<select data-v13-field="repeat">${optionList(REPEATS,x.repeat)}</select>`)}
      ${field('Voor wie',`<select data-v13-field="person">${optionList(['Samen','Kees','Daphne'],x.person)}</select>`)}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category||'')}">`)}
      ${field('Eerste keer',`<input type="date" data-v13-field="due" value="${esc(x.due||'')}">`)}
      ${field('Notitie',`<textarea data-v13-field="notes">${esc(x.notes||'')}</textarea>`,'full')}`;
    if(t==='home') return `
      ${field('Onderwerp',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Categorie',`<input data-v13-field="category" value="${esc(x.category)}">`)}
      ${field('Frequentie',`<select data-v13-field="repeat"><option value="">Geen herhaling</option>${optionList(REPEATS,x.repeat)}</select>`)}
      ${field('Datum',`<input type="date" data-v13-field="due" value="${esc(x.due||'')}">`)}
      ${field('Notitie',`<textarea data-v13-field="note">${esc(x.note||'')}</textarea>`,'full')}`;
    if(t==='trips') return `
      ${field('Onderwerp',`<input data-v13-field="title" value="${esc(x.title)}">`,'full')}
      ${field('Startdatum',`<input type="date" data-v13-field="startDate" value="${esc(x.startDate||x.date||'')}">`)}
      ${field('Einddatum',`<input type="date" data-v13-field="endDate" value="${esc(x.endDate||x.startDate||x.date||'')}">`)}
      ${field('Soort',`<input data-v13-field="type" value="${esc(x.type||'Notitie')}">`)}
      <label class="checkbox-field"><input type="checkbox" data-v13-field="checkable" ${x.checkable?'checked':''}><span>Afvinkbaar</span></label>
      <label class="checkbox-field"><input type="checkbox" data-v13-field="important" ${x.important?'checked':''}><span>Belangrijk ★</span></label>
      ${field('Notitie',`<textarea data-v13-field="note">${esc(x.note||'')}</textarea>`,'full')}`;
    return field('Titel',`<input data-v13-field="title" value="${esc(x.title||'')}">`,'full');
  }

  function manualForm13() {
    const t=state13.target;
    const calendars=data.calendars||[];
    const tripFolders=data.tripFolders||[];
    const folder=selectedTripFolder();
    const sections=(data.tripSections||[]).filter(s=>s.tripFolderId===folder?.id);

    if(t==='planning') return `
      ${field('Wat?',`<input data-v14-manual="title" required>`,'full')}
      ${field('Datum',`<input type="date" data-v14-manual="date" value="${todayISO()}">`)}
      ${field('Begintijd',`<input type="time" data-v14-manual="time">`)}
      ${field('Eindtijd',`<input type="time" data-v14-manual="endTime">`)}
      ${field('Agenda',`<select data-v14-manual="calendarId">${calendars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>`)}
      ${field('Voor wie?',`<select data-v14-manual="person">${optionList(['Samen','Kees','Daphne'],'Samen')}</select>`)}`;
    if(t==='meals') return `
      ${field('Gerecht',`<input data-v14-manual="title" required>`,'full')}
      ${field('Datum',`<input type="date" data-v14-manual="date" value="${todayISO()}">`)}
      ${field('Moment',`<select data-v14-manual="type">${optionList(['Ontbijt','Lunch','Avondeten','Snack'],'Avondeten')}</select>`)}`;
    if(t==='groceries') return `
      ${field('Product',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<select data-v14-manual="category">${optionList(GROCERY_CATEGORIES,'Overig')}</select>`)}`;
    if(t==='chores') return `
      ${field('Taak',`<input data-v14-manual="title" required>`,'full')}
      ${field('Voor wie?',`<select data-v14-manual="person">${optionList(['Samen','Kees','Daphne'],'Samen')}</select>`)}
      ${field('Eerste keer',`<input type="date" data-v14-manual="due" value="${todayISO()}">`)}
      ${field('Frequentie',`<select data-v14-manual="repeat">${optionList(REPEATS,'Wekelijks')}</select>`)}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(state13.subtype||'Reguliere schoonmaak')}">`)}
      ${field('Notitie',`<textarea data-v14-manual="notes"></textarea>`,'full')}`;
    if(t==='stock') return `
      ${field('Product',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(stockCategory('',state13.subtype))}">`)}
      ${field('Huidig',`<input type="number" step="0.01" data-v14-manual="amount" value="0">`)}
      ${field('Minimum',`<input type="number" step="0.01" data-v14-manual="min" value="0">`)}
      ${field('Gewenst',`<input type="number" step="0.01" data-v14-manual="desired" value="0">`)}
      ${field('Eenheid',`<input data-v14-manual="unit" value="stuks">`)}`;
    if(t==='ideas') return `
      ${field('Idee',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<select data-v14-manual="category">${optionList(['Thuis','Uit','Actief','Gratis','Eten'],'Thuis')}</select>`)}
      ${field('Emoji',`<input data-v14-manual="icon" value="♡">`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}`;
    if(t==='home') return `
      ${field('Onderwerp',`<input data-v14-manual="title" required>`,'full')}
      ${field('Categorie',`<input data-v14-manual="category" value="${esc(state13.subtype||'Onderhoud')}">`)}
      ${field('Datum',`<input type="date" data-v14-manual="due">`)}
      ${field('Herhaling',`<select data-v14-manual="repeat"><option value="">Geen herhaling</option>${optionList(REPEATS,'')}</select>`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}`;
    if(t==='trips') return `
      ${field('Reis',`<select id="v14TripFolder" data-v14-manual="tripFolderId">${tripFolders.map(f=>`<option value="${esc(f.id)}" ${f.id===folder?.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`)}
      ${field('Map binnen de reis',`<select data-v14-manual="tripSectionId">${sections.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`)}
      ${field('Onderwerp',`<input data-v14-manual="title" required>`,'full')}
      ${field('Startdatum',`<input type="date" data-v14-manual="startDate">`)}
      ${field('Einddatum',`<input type="date" data-v14-manual="endDate">`)}
      ${field('Soort',`<select data-v14-manual="type">${optionList(['Voorbereiding','Reservering','Vervoer','Verblijf','Activiteit','Eten','Budget','Documenten','Paklijst','Notitie'],'Notitie')}</select>`)}
      ${field('Notitie',`<textarea data-v14-manual="note"></textarea>`,'full')}
      <label class="checkbox-field"><input type="checkbox" data-v14-manual="checkable"><span>Dit moet afgevinkt worden</span></label>
      <label class="checkbox-field"><input type="checkbox" data-v14-manual="important"><span>Belangrijk ★</span></label>`;
    return '';
  }

  function destinationFields13() {
    if(state13.target==='trips') {
      const detected=state13.detectedTripName?`<div class="field full"><small class="muted">Automatisch herkende reis: <strong>${esc(state13.detectedTripName)}</strong>. De documentstructuur heeft voorrang op de standaardkeuze.</small></div>`:'';
      const folder=selectedTripFolder();
      const sections=(data.tripSections||[]).filter(s=>s.tripFolderId===folder?.id);
      return `
        ${field('Standaard reis',`<select id="v14ImportTripFolder">${(data.tripFolders||[]).map(f=>`<option value="${esc(f.id)}" ${f.id===folder?.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`)}
        ${field('Standaard map',`<select id="v14ImportTripSection">${sections.map(s=>`<option value="${esc(s.id)}" ${s.id===state13.tripSectionId?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`)}
        ${detected}`;
    }
    const subtypes=SUBTYPES[state13.target]||[];
    return subtypes.length?field('Standaard categorie/map',`<select id="v13Subtype">${subtypes.map(v=>`<option ${v===state13.subtype?'selected':''}>${esc(v)}</option>`).join('')}</select>`):'';
  }

  function renderImports13() {
    const methodLabel=state13.method==='manual'?'Handmatig invoeren':state13.method==='file'?'Bestand uploaden':'Tekst plakken';
    return `<div class="import-v13">
      <section class="card">
        <div class="card-head"><div><p class="eyebrow">SAMEN THUIS · CENTRALE INVOER</p><h2>Toevoegen & importeren</h2></div><span class="tag green">${esc(methodLabel)}</span></div>
        <p>Kies waar het hoort en daarna hoe je het wilt toevoegen.</p>
        <div class="form-grid">
          ${field('Waar hoort dit bij?',`<select id="v13Target">${Object.entries(TARGETS).map(([k,v])=>`<option value="${k}" ${k===state13.target?'selected':''}>${esc(v)}</option>`).join('')}</select>`)}
          ${state13.method!=='manual'?destinationFields13():''}
        </div>
        <div class="v14-methods">
          <button class="${state13.method==='manual'?'primary':'secondary'}" data-v14-method="manual">✏️ Handmatig</button>
          <button class="${state13.method==='file'?'primary':'secondary'}" data-v14-method="file">📄 Bestand uploaden</button>
          <button class="${state13.method==='text'?'primary':'secondary'}" data-v14-method="text">📋 Tekst plakken</button>
        </div>
        ${state13.method==='manual'?`
          <div class="form-grid v14-manual-form">${manualForm13()}</div>
          <div class="button-row"><button class="primary" data-v14-manual-save>Opslaan</button></div>
        `:state13.method==='file'?`
          <div class="form-grid">${field('Bestand',`<input id="v13File" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt,.md,application/pdf,text/plain">`,'full')}</div>
          ${state13.filename?`<p class="muted">Bron: <strong>${esc(state13.filename)}</strong></p>`:''}
          <p class="muted">Na kiezen wordt het bestand automatisch gelezen en geanalyseerd.</p>
        `:`
          <div class="form-grid">${field('Tekst/lijst plakken',`<textarea id="v13Text">${esc(state13.text)}</textarea>`,'full')}</div>
          <div class="button-row"><button class="primary" data-v13-analyse>Analyseren</button><button class="secondary" data-v13-clear>Leegmaken</button></div>
        `}
      </section>

      ${state13.method!=='manual'?(state13.preview.length?`<section class="card v13-preview">
        <div class="card-head"><div><p class="eyebrow">CONTROLE</p><h2>${state13.preview.length} gevonden items</h2></div>
          <div class="button-row"><button class="secondary" data-v13-all>Alles selecteren</button><button class="secondary" data-v13-none>Niets</button><button class="primary" data-v13-commit>Geselecteerde toevoegen</button></div>
        </div>
        ${state13.target==='trips'&&state13.detectedTripName?`<p class="muted">Bestemming: <strong>Reizen → ${esc(state13.detectedTripName)}</strong>${state13.detectedTripStart?` · ${esc(state13.detectedTripStart)}`:''}${state13.detectedTripEnd?` t/m ${esc(state13.detectedTripEnd)}`:''}</p>`:''}
        ${['chores','stock','home'].includes(state13.target)?`<div class="v13-bulk">
          <strong>Bulk aanpassen</strong>
          ${state13.target==='chores'?`<select id="v13BulkRepeat"><option value="">Frequentie behouden</option>${REPEATS.map(x=>`<option>${esc(x)}</option>`).join('')}</select>
          <select id="v13BulkPerson"><option value="">Persoon behouden</option><option>Samen</option><option>Kees</option><option>Daphne</option></select>`:''}
          <input id="v13BulkCategory" placeholder="Categorie (optioneel)">
          <button class="secondary" data-v13-bulk>Toepassen op geselecteerde</button>
        </div>`:''}
        <div class="v13-preview-list">${state13.preview.map((entry,i)=>`
          <article class="v13-card ${entry.duplicate?'duplicate':''}" data-v13-card="${i}">
            <div class="v13-card-head">
              <label><input type="checkbox" data-v13-selected ${entry.selected?'checked':''}> Importeren</label>
              ${entry.duplicate?'<span class="tag warning">Mogelijk al aanwezig · standaard overgeslagen</span>':''}
            </div>
            <div class="v13-fields">${previewEditor(entry)}</div>
            <small class="muted">${esc(previewMeta(entry.item,state13.target))}</small>
          </article>`).join('')}</div>
      </section>`:`<section class="card"><p class="muted">Nog niets geanalyseerd.</p></section>`):''}
    </div>`;
  }

  async function loadExternal13(src,test) {
    if(test()) return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  async function readFile13(file) {
    const ext=file.name.toLowerCase().split('.').pop();
    if(['txt','md','csv'].includes(ext)) return file.text();
    if(ext==='pdf') return extractPdfText(file);
    if(ext==='docx') {
      await loadExternal13('https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js',()=>Boolean(window.mammoth));
      return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value||'';
    }
    if(['xlsx','xlsm','xls'].includes(ext)) {
      await loadExternal13('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>Boolean(window.XLSX));
      const wb=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      return wb.SheetNames.map(n=>window.XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
    }
    throw new Error('Bestandstype niet ondersteund');
  }

  function syncCardEdits() {
    document.querySelectorAll('[data-v13-card]').forEach(card=>{
      const entry=state13.preview[Number(card.dataset.v13Card)];
      if(!entry) return;
      entry.selected=Boolean(card.querySelector('[data-v13-selected]')?.checked);
      card.querySelectorAll('[data-v13-field]').forEach(input=>{
        const k=input.dataset.v13Field;
        let v=input.type==='checkbox'?input.checked:input.value;
        if(['amount','min','desired'].includes(k)) v=num(v,0);
        entry.item[k]=v;
      });
      if(entry.item.startDate) entry.item.date=entry.item.startDate;
    });
  }

  function analyse13() {
    const special=parseLines13(state13.text,state13.target);
    if(special!==null) {
      state13.preview=special;
      render();
      toast(`${state13.preview.length} items gevonden`);
      return;
    }

    const lines=String(state13.text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(state13.target==='groceries') {
      state13.preview=parseGroceryText(state13.text).slice(0,300).map(x=>({selected:true,item:{id:id(),...x}}));
    } else if(state13.target==='planning') {
      state13.preview=lines.filter(x=>isoDateFromText(x)).map(x=>({selected:true,item:{
        id:id(),title:x.replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/,'').trim()||'Afspraak',
        date:isoDateFromText(x),time:'',endTime:'',person:'Samen',calendarId:data.calendars[0]?.id||'persoonlijk'
      }}));
    } else if(state13.target==='meals') {
      const start=startOfWeek(todayISO());
      state13.preview=lines.slice(0,7).map((x,i)=>({selected:true,item:{id:id(),date:addDays(start,i),type:'Avondeten',title:cleanBullet(x)}}));
    }
    render();
    toast(`${state13.preview.length} items gevonden`);
  }

  function resolveTripDestination13(item) {
    data.tripFolders ||= [];
    data.tripSections ||= [];
    data.trips ||= [];

    const wantedFolder=item._pendingFolderName || state13.detectedTripName || '';
    let folder=(data.tripFolders||[]).find(f=>f.id===item.tripFolderId);

    if(!folder && wantedFolder) {
      folder=findTripFolderByName(wantedFolder);
      if(!folder) {
        folder={
          id:id(),name:wantedFolder,
          startDate:state13.detectedTripStart||'',
          endDate:state13.detectedTripEnd||'',
          note:'Aangemaakt via centrale invoer'
        };
        data.tripFolders.push(folder);
      }
    }
    if(!folder) folder=selectedTripFolder();
    if(!folder) return item;

    // Periode van de reis aanvullen wanneer die uit het document komt.
    if(state13.detectedTripStart && !folder.startDate) folder.startDate=state13.detectedTripStart;
    if(state13.detectedTripEnd && !folder.endDate) folder.endDate=state13.detectedTripEnd;

    const wantedSection=item._pendingSectionName || travelSection(item.type,item.title);
    let section=(data.tripSections||[]).find(s=>s.id===item.tripSectionId && s.tripFolderId===folder.id);
    if(!section) section=findTripSectionByName(folder.id,wantedSection);
    if(!section) {
      section={id:id(),tripFolderId:folder.id,name:wantedSection};
      data.tripSections.push(section);
    }

    const clean={...item,tripFolderId:folder.id,tripSectionId:section.id};
    delete clean._pendingFolderName;
    delete clean._pendingSectionName;
    clean.date=clean.startDate||clean.date||clean.endDate||'';
    return clean;
  }

  function commit13() {
    syncCardEdits();
    let selected=state13.preview.filter(x=>x.selected).map(x=>x.item);
    if(!selected.length) return toast('Selecteer minimaal één item');
    if(state13.target==='trips') selected=selected.map(resolveTripDestination13);

    data[state13.target] ||= [];
    data[state13.target].push(...selected);
    save();

    const count=selected.length;
    state13.preview=[];state13.text='';state13.filename='';
    render();
    toast(`${count} items toegevoegd aan ${TARGETS[state13.target]}`);
  }

  function manualValue13(name) {
    const el=document.querySelector(`[data-v14-manual="${name}"]`);
    if(!el) return '';
    return el.type==='checkbox'?el.checked:el.value;
  }

  function saveManual13() {
    const t=state13.target;
    const title=String(manualValue13('title')||'').trim();
    if(!title) return toast('Vul eerst een titel/onderwerp in');
    let item;

    if(t==='planning') item={id:id(),title,date:manualValue13('date')||todayISO(),time:manualValue13('time'),endTime:manualValue13('endTime'),calendarId:manualValue13('calendarId')||'persoonlijk',person:manualValue13('person')||'Samen',personSource:'manual'};
    else if(t==='meals') item={id:id(),title,date:manualValue13('date')||todayISO(),type:manualValue13('type')||'Avondeten'};
    else if(t==='groceries') item={id:id(),title,category:manualValue13('category')||'Overig',done:false};
    else if(t==='chores') item={id:id(),title,person:manualValue13('person')||'Samen',due:manualValue13('due')||todayISO(),repeat:manualValue13('repeat')||'Wekelijks',secondWeekday:'',notes:manualValue13('notes')||'',category:manualValue13('category')||'',completedDates:[]};
    else if(t==='stock') item={id:id(),title,category:manualValue13('category')||'Overig',amount:num(manualValue13('amount'),0),min:num(manualValue13('min'),0),desired:num(manualValue13('desired'),0),unit:manualValue13('unit')||'stuks'};
    else if(t==='ideas') item={id:id(),title,category:manualValue13('category')||'Thuis',note:manualValue13('note')||'',icon:manualValue13('icon')||'♡'};
    else if(t==='home') item={id:id(),title,category:manualValue13('category')||'Onderhoud',due:manualValue13('due')||'',repeat:manualValue13('repeat')||'',note:manualValue13('note')||''};
    else if(t==='trips') {
      const startDate=manualValue13('startDate')||'';
      item={id:id(),title,tripFolderId:manualValue13('tripFolderId'),tripSectionId:manualValue13('tripSectionId'),date:startDate,startDate,endDate:manualValue13('endDate')||startDate,type:manualValue13('type')||'Notitie',note:manualValue13('note')||'',checkable:Boolean(manualValue13('checkable')),important:Boolean(manualValue13('important')),done:false};
      item=resolveTripDestination13(item);
    }
    if(!item) return;
    data[t] ||= [];
    data[t].push(item);
    save();render();
    toast(`Toegevoegd aan ${TARGETS[t]}`);
  }

  function bind13() {
    const target=document.querySelector('#v13Target');
    if(target) target.onchange=()=>{
      state13.target=target.value;
      state13.subtype=defaultSubtype(state13.target);
      state13.preview=[];
      if(state13.target==='trips') {
        state13.tripFolderId=data.tripFolders?.[0]?.id||'';
        state13.tripSectionId=data.tripSections?.find(s=>s.tripFolderId===state13.tripFolderId)?.id||'';
      }
      render();
    };

    const subtype=document.querySelector('#v13Subtype');
    if(subtype) subtype.onchange=()=>{state13.subtype=subtype.value;};

    const text=document.querySelector('#v13Text');
    if(text) text.oninput=()=>{state13.text=text.value;};

    const importFolder=document.querySelector('#v14ImportTripFolder');
    if(importFolder) importFolder.onchange=()=>{
      state13.tripFolderId=importFolder.value;
      state13.tripSectionId=data.tripSections?.find(s=>s.tripFolderId===state13.tripFolderId)?.id||'';
      render();
    };

    const importSection=document.querySelector('#v14ImportTripSection');
    if(importSection) importSection.onchange=()=>{state13.tripSectionId=importSection.value;};

    const manualFolder=document.querySelector('#v14TripFolder');
    if(manualFolder) manualFolder.onchange=()=>{
      state13.tripFolderId=manualFolder.value;
      state13.tripSectionId=data.tripSections?.find(s=>s.tripFolderId===state13.tripFolderId)?.id||'';
      render();
    };

    const file=document.querySelector('#v13File');
    if(file) file.onchange=async()=>{
      const f=file.files?.[0];
      if(!f) return;
      try {
        toast('Bestand wordt gelezen…');
        state13.filename=f.name;
        state13.text=await readFile13(f);

        // Voor onze Samen Thuis-reisdocumenten automatisch naar Reizen.
        if(/\bReis:\s*.+20\d{2}\b/i.test(state13.text) || /Samen Thuis importdocument/i.test(state13.text) && /\b(Startdatum|Einddatum|Afvinken|Belangrijk):/i.test(state13.text)) {
          state13.target='trips';
          state13.subtype='Route & planning';
        }

        analyse13();
      } catch(e) {
        console.error(e);
        toast('Bestand lezen is mislukt');
      }
    };
  }

  render=function renderV131() {
    if(current==='imports') {
      document.querySelector('#view').innerHTML=renderImports13();
      updateSyncBadge();
      bind13();
      return;
    }
    baseRender13();
  };

  document.addEventListener('click',e=>{
    const method=e.target.closest('[data-v14-method]');
    if(method) {
      state13.method=method.dataset.v14Method;
      state13.preview=[];
      render();
      return;
    }
    if(e.target.closest('[data-v14-manual-save]')) {saveManual13();return;}

    const ctl=e.target.closest('[data-v13-analyse],[data-v13-clear],[data-v13-all],[data-v13-none],[data-v13-commit],[data-v13-bulk]');
    if(!ctl) return;

    if(e.target.closest('[data-v13-analyse]')) {analyse13();return;}
    if(e.target.closest('[data-v13-clear]')) {
      state13.text='';state13.filename='';state13.preview=[];state13.detectedTripName='';render();return;
    }
    if(e.target.closest('[data-v13-all]')) {
      document.querySelectorAll('[data-v13-selected]').forEach(x=>x.checked=true);return;
    }
    if(e.target.closest('[data-v13-none]')) {
      document.querySelectorAll('[data-v13-selected]').forEach(x=>x.checked=false);return;
    }
    if(e.target.closest('[data-v13-commit]')) {commit13();return;}
    if(e.target.closest('[data-v13-bulk]')) {
      syncCardEdits();
      const cat=document.querySelector('#v13BulkCategory')?.value.trim();
      const rep=document.querySelector('#v13BulkRepeat')?.value;
      const person=document.querySelector('#v13BulkPerson')?.value;
      state13.preview.filter(x=>x.selected).forEach(entry=>{
        if(cat) entry.item.category=cat;
        if(rep&&state13.target==='chores') entry.item.repeat=rep;
        if(person&&state13.target==='chores') entry.item.person=person;
      });
      render();return;
    }
  },true);

  formConfig=function formConfigV131(view) {
    const cfg=baseFormConfig13(view);
    if(!cfg) return cfg;
    cfg.fields=(cfg.fields||[]).map(f=>[...f]);

    if(view==='stock'&&!cfg.fields.some(f=>f[0]==='desired')) {
      const minIndex=cfg.fields.findIndex(f=>f[0]==='min');
      cfg.fields.splice(minIndex>=0?minIndex+1:cfg.fields.length,0,['desired','Gewenste voorraad','number']);
    }
    if(view==='chores') {
      const r=cfg.fields.find(f=>f[0]==='repeat');
      if(r) r[3]=REPEATS;
      if(!cfg.fields.some(f=>f[0]==='category')) cfg.fields.push(['category','Categorie','text']);
    }
    if(view==='home'&&!cfg.fields.some(f=>f[0]==='repeat')) {
      cfg.fields.push(['repeat','Herhaling','select',['',...REPEATS]]);
    }
    return cfg;
  };

  (data.stock||[]).forEach(item=>{
    if(item.desired==null) item.desired=Math.max(Number(item.amount||0),Number(item.min||0));
  });
  (data.chores||[]).forEach(item=>{item.category||='Schoonmaak';});
  (data.home||[]).forEach(item=>{item.repeat||='';});
  (data.trips||[]).forEach(item=>{
    if(item.startDate==null) item.startDate=item.date||'';
    if(item.endDate==null) item.endDate=item.startDate||item.date||'';
    if(item.important==null) item.important=false;
  });

  save({touch:false});
  toast('Samen Thuis v13.1 geladen');
})();

;


/* ===== GEÏNTEGREERD: samen-thuis-update-v14(1).js ===== */
/* Samen Thuis v14.0 — universele importlaag
   Eén vast importformaat voor Agenda t/m Reizen.
   Ondersteunt | ; tab, " / " en " - " als scheidingsteken.
   Datums zoals 2027-01-08 blijven intact.
*/
console.info('Samen Thuis update 14.1 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V140__) return;
  window.__SAMEN_THUIS_V140__ = true;

  const baseRender14 = render;

  const TARGETS14 = {
    planning:'Agenda', meals:'Weekmenu', groceries:'Boodschappen', chores:'Huishouden',
    stock:'Voorraad', ideas:'Ideeën', home:'Woning', trips:'Reizen'
  };

  const ALIASES14 = {
    agenda:'planning', planning:'planning', kalender:'planning', afspraak:'planning', afspraken:'planning',
    weekmenu:'meals', menu:'meals', maaltijd:'meals', maaltijden:'meals', eten:'meals',
    boodschappen:'groceries', boodschap:'groceries', grocery:'groceries', groceries:'groceries',
    huishouden:'chores', huishoudelijk:'chores', schoonmaak:'chores', taak:'chores', taken:'chores',
    voorraad:'stock', stock:'stock', inventaris:'stock',
    idee:'ideas', ideeen:'ideas', ideeenlijst:'ideas', samen_doen:'ideas',
    woning:'home', huis:'home', onderhoud:'home',
    reizen:'trips', reis:'trips', vakantie:'trips', travel:'trips'
  };

  const SCHEMAS14 = {
    planning:['type','title','startDate','startTime','endDate','endTime','allDay','location','description','repeat'],
    meals:['type','date','mealType','title','persons','ingredients','note'],
    groceries:['type','title','amount','unit','category','store','forMeal','done','note'],
    chores:['type','title','category','repeat','person','startDate','nextDate','priority','done','notes'],
    stock:['type','title','category','amount','unit','minimum','bestBefore','location','note'],
    ideas:['type','title','category','description','person','priority','status','date','note'],
    home:['type','title','category','description','kind','priority','startDate','deadline','status','cost','done','note'],
    trips:['type','trip','section','title','kind','description','startDate','endDate','deadline','location','cost','priority','checkable','done','note']
  };

  const state14 = { target:'planning', text:'', filename:'', preview:[], legacy:false };

  const esc14 = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const norm14 = value => String(value ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  const clean14 = value => String(value ?? '').trim().replace(/^\[(.*)\]$/,'$1').trim();

  function bool14(value, fallback=false) {
    const v=norm14(value);
    if(['1','ja','yes','true','aan','x','afgevinkt','klaar','gedaan'].includes(v)) return true;
    if(['0','nee','no','false','uit','open','niet afgevinkt'].includes(v)) return false;
    return fallback;
  }

  function priority14(value='') {
    const v=norm14(value);
    if(/urgent|belangrijk|high|hoog/.test(v)) return 'hoog';
    if(/low|laag/.test(v)) return 'laag';
    if(/normaal|normal|medium|midden/.test(v)) return 'normaal';
    return value ? String(value).trim() : '';
  }

  function repeat14(value='') {
    const v=norm14(String(value).replace(/^frequentie\s*:?\s*/i,''));
    if(!v) return '';
    if(/^(dagelijks|elke dag|iedere dag|daily)$/.test(v)) return 'Dagelijks';
    if(/^(om de dag|elke 2 dagen)$/.test(v)) return 'Om de dag';
    if(/^(2x per week|2 per week|twee keer per week|twice weekly)$/.test(v)) return '2× per week';
    if(/^(3x per week|3 per week|drie keer per week)$/.test(v)) return '3× per week';
    if(/^(wekelijks|iedere week|elke week|weekly)$/.test(v)) return 'Wekelijks';
    if(/^(elke 2 weken|om de week|tweewekelijks|biweekly)$/.test(v)) return 'Elke 2 weken';
    if(/^(elke 4 weken|4 wekelijks)$/.test(v)) return 'Elke 4 weken';
    if(/^(maandelijks|iedere maand|elke maand|monthly)$/.test(v)) return 'Maandelijks';
    if(/^(elke 2 maanden|2 maandelijks)$/.test(v)) return 'Elke 2 maanden';
    if(/^(elke 3 maanden|kwartaal|kwartaallijks|quarterly)$/.test(v)) return 'Elke 3 maanden';
    if(/^(elke 6 maanden|halfjaarlijks|semiannual)$/.test(v)) return 'Elke 6 maanden';
    if(/^(jaarlijks|ieder jaar|elk jaar|1x per jaar|yearly)$/.test(v)) return 'Jaarlijks';
    if(/^(na elke was|na iedere was)$/.test(v)) return 'Na elke was';
    if(/^(wanneer nodig|indien nodig|naar behoefte)$/.test(v)) return 'Wanneer nodig';
    if(/^(eenmalig|once)$/.test(v)) return 'Eenmalig';
    return String(value).trim();
  }

  function iso14(value='') {
    const s=String(value).trim();
    let m=s.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m=s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return s;
  }

  function number14(value, fallback=0) {
    const m=String(value ?? '').replace(',','.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : fallback;
  }

  function split14(line='') {
    const raw=String(line).trim();
    let parts;
    if(raw.includes('|')) parts=raw.split('|');
    else if(raw.includes(';')) parts=raw.split(';');
    else if(raw.includes('\t')) parts=raw.split(/\t+/);
    else if(/\s\/\s/.test(raw)) parts=raw.split(/\s+\/\s+/);
    else if(/\s[-–—]\s/.test(raw)) parts=raw.split(/\s+[-–—]\s+/);
    else if(/\s{2,}/.test(raw)) parts=raw.split(/\s{2,}/);
    else return [raw];
    return parts.map(clean14);
  }

  function detectTarget14(parts, fallback) {
    const first=norm14(parts[0]).replace(/\s/g,'_');
    return ALIASES14[first] || ALIASES14[norm14(parts[0])] || fallback;
  }

  function mapLine14(line, fallbackTarget) {
    const parts=split14(line);
    if(!parts.length || !parts.some(Boolean)) return null;
    const target=detectTarget14(parts,fallbackTarget);
    const schema=SCHEMAS14[target];
    if(!schema) return null;

    const firstTarget=ALIASES14[norm14(parts[0]).replace(/\s/g,'_')] || ALIASES14[norm14(parts[0])];
    const values=firstTarget ? parts : [TARGETS14[target], ...parts];
    const record={target};
    schema.forEach((key,i)=>record[key]=clean14(values[i] ?? ''));
    return record;
  }

  function findCalendar14(name='') {
    const n=norm14(name);
    return (data.calendars||[]).find(c=>norm14(c.name)===n)?.id || data.calendars?.[0]?.id || 'persoonlijk';
  }

  function makeItem14(r) {
    if(r.target==='planning') return {
      id:id(), title:r.title||'Afspraak',
      date:iso14(r.startDate), time:r.startTime||'',
      endDate:iso14(r.endDate||r.startDate), endTime:r.endTime||'',
      allDay:bool14(r.allDay,false), location:r.location||'',
      note:r.description||'', repeat:repeat14(r.repeat),
      person:'Samen', calendarId:findCalendar14('')
    };

    if(r.target==='meals') return {
      id:id(), title:r.title||'Maaltijd', date:iso14(r.date),
      type:r.mealType||'Avondeten', persons:r.persons||'',
      ingredients:r.ingredients||'', note:r.note||''
    };

    if(r.target==='groceries') return {
      id:id(), title:r.title||'Product',
      amount:number14(r.amount, r.amount?0:1), unit:r.unit||'',
      category:r.category||'Overig', store:r.store||'',
      forMeal:r.forMeal||'', done:bool14(r.done,false), note:r.note||''
    };

    if(r.target==='chores') return {
      id:id(), title:r.title||'Taak', category:r.category||'',
      repeat:repeat14(r.repeat), person:r.person||'Samen',
      due:iso14(r.startDate||r.nextDate), nextDate:iso14(r.nextDate),
      priority:priority14(r.priority), done:bool14(r.done,false),
      notes:r.notes||'', secondWeekday:'', completedDates:[]
    };

    if(r.target==='stock') return {
      id:id(), title:r.title||'Product', category:r.category||'Overig',
      amount:number14(r.amount,0), unit:r.unit||'stuks',
      min:number14(r.minimum,0),
      desired:Math.max(number14(r.minimum,0),number14(r.amount,0)),
      bestBefore:iso14(r.bestBefore), location:r.location||'', note:r.note||''
    };

    if(r.target==='ideas') return {
      id:id(), title:r.title||'Idee', category:r.category||'Thuis',
      note:[r.description,r.note].filter(Boolean).join('\n'),
      person:r.person||'', priority:priority14(r.priority),
      status:r.status||'', date:iso14(r.date), icon:'♡'
    };

    if(r.target==='home') return {
      id:id(), title:r.title||'Woningitem', category:r.category||'Onderhoud',
      note:[r.description,r.note].filter(Boolean).join('\n'),
      kind:r.kind||'', priority:priority14(r.priority),
      startDate:iso14(r.startDate), due:iso14(r.deadline||r.startDate),
      status:r.status||'', cost:number14(r.cost,0),
      done:bool14(r.done,false), repeat:''
    };

    if(r.target==='trips') return makeTrip14(r);
    return null;
  }

  function getOrCreateTripFolder14(name='') {
    data.tripFolders ||= [];
    const wanted=(name||'Nieuwe reis').trim();
    let folder=data.tripFolders.find(f=>norm14(f.name)===norm14(wanted));
    if(!folder) {
      folder={id:id(),name:wanted,startDate:'',endDate:'',note:'Aangemaakt via universele import'};
      data.tripFolders.push(folder);
    }
    return folder;
  }

  function getOrCreateTripSection14(folderId,name='') {
    data.tripSections ||= [];
    const wanted=(name||'Algemeen').trim();
    let section=data.tripSections.find(s=>s.tripFolderId===folderId && norm14(s.name)===norm14(wanted));
    if(!section) {
      section={id:id(),tripFolderId:folderId,name:wanted};
      data.tripSections.push(section);
    }
    return section;
  }

  function makeTrip14(r) {
    const folder=getOrCreateTripFolder14(r.trip);
    const section=getOrCreateTripSection14(folder.id,r.section);
    const start=iso14(r.startDate||r.deadline);
    const end=iso14(r.endDate||start);

    if(start && !folder.startDate) folder.startDate=start;
    if(end && !folder.endDate) folder.endDate=end;

    const extras=[];
    if(r.location) extras.push(`Locatie: ${r.location}`);
    if(r.cost) extras.push(`Kosten: ${r.cost}`);
    if(r.priority) extras.push(`Prioriteit: ${priority14(r.priority)}`);
    if(r.note) extras.push(r.note);

    return {
      id:id(), tripFolderId:folder.id, tripSectionId:section.id,
      title:r.title||'Reisitem', date:start, startDate:start, endDate:end,
      type:r.kind||'Notitie',
      note:[r.description,...extras].filter(Boolean).join('\n'),
      checkable:bool14(r.checkable,false),
      important:priority14(r.priority)==='hoog',
      done:bool14(r.done,false)
    };
  }

  function analyse14() {
    const lines=String(state14.text||'').replace(/\r/g,'').split(/\n+/)
      .map(x=>x.trim()).filter(Boolean)
      .filter(x=>!/^#/.test(x));

    const records=lines.map(line=>mapLine14(line,state14.target)).filter(Boolean);
    state14.preview=records
      .map(record=>({record,item:makeItem14(record),selected:true}))
      .filter(x=>x.item);

    render();
    toast(`${state14.preview.length} items gevonden`);
  }

  function previewText14(entry) {
    const r=entry.record;
    if(r.target==='planning') return `${r.startDate||'geen datum'} ${r.startTime||''}`.trim();
    if(r.target==='meals') return `${r.date||'geen datum'} · ${r.mealType||'Avondeten'}`;
    if(r.target==='groceries') return `${r.amount||''} ${r.unit||''} · ${r.category||'Overig'}`.trim();
    if(r.target==='chores') return `${repeat14(r.repeat)||'geen frequentie'} · ${r.person||'Samen'}`;
    if(r.target==='stock') return `${r.amount||0} ${r.unit||'stuks'} · min ${r.minimum||0}`;
    if(r.target==='ideas') return `${r.category||'Thuis'}${r.priority?' · '+priority14(r.priority):''}`;
    if(r.target==='home') return `${r.category||'Onderhoud'}${r.deadline?' · '+r.deadline:''}`;
    if(r.target==='trips') return `${r.trip||'Nieuwe reis'} › ${r.section||'Algemeen'}${r.startDate?' · '+r.startDate:''}`;
    return '';
  }

  function renderImport14() {
    return `<div class="import-v13">
      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow">SAMEN THUIS · UNIVERSELE IMPORT</p><h2>Toevoegen & importeren</h2></div>
          <span class="tag green">v14</span>
        </div>

        <p>Gebruik <strong>|</strong>, <strong>;</strong>, tabs, <strong> / </strong>, <strong> - </strong> of meerdere spaties. Datums met een koppelteken blijven intact.</p>

        <div class="form-grid">
          <div class="field">
            <label>Standaard pagina</label>
            <select id="v14Target">
              ${Object.entries(TARGETS14).map(([k,v])=>`<option value="${k}" ${k===state14.target?'selected':''}>${esc14(v)}</option>`).join('')}
            </select>
          </div>

          <div class="field">
            <label>Bestand</label>
            <input id="v14File" type="file" accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv,.txt,.md,application/pdf,text/plain">
          </div>

          <div class="field full">
            <label>Tekst / lijst</label>
            <textarea id="v14Text" placeholder="huishouden | Badkamer schoonmaken | Badkamer | wekelijks | Samen ...">${esc14(state14.text)}</textarea>
          </div>
        </div>

        ${state14.filename?`<p class="muted">Bron: <strong>${esc14(state14.filename)}</strong></p>`:''}

        <div class="button-row">
          <button class="primary" data-v14-analyse>Analyseren</button>
          <button class="secondary" data-v14-clear>Leegmaken</button>
          <button class="secondary" data-v14-legacy>Oude documentanalyse</button>
        </div>

        <details>
          <summary>Vaste volgorde per pagina bekijken</summary>
          <pre style="white-space:pre-wrap">Agenda: [agenda] | [titel] | [begindatum] | [begintijd] | [einddatum] | [eindtijd] | [hele dag] | [locatie] | [omschrijving] | [herhaling]
Weekmenu: [weekmenu] | [datum] | [maaltijdmoment] | [gerecht] | [personen] | [ingrediënten] | [notitie]
Boodschappen: [boodschappen] | [product] | [hoeveelheid] | [eenheid] | [categorie] | [winkel] | [voor weekmenu] | [afgevinkt] | [notitie]
Huishouden: [huishouden] | [taak] | [ruimte/categorie] | [frequentie] | [toegewezen aan] | [startdatum] | [volgende datum] | [prioriteit] | [afgevinkt] | [omschrijving/subtaken]
Voorraad: [voorraad] | [product] | [categorie] | [hoeveelheid] | [eenheid] | [minimumvoorraad] | [houdbaar-tot] | [locatie] | [notitie]
Ideeën: [idee] | [titel] | [categorie] | [omschrijving] | [voor wie] | [prioriteit] | [status] | [datum/deadline] | [link/notitie]
Woning: [woning] | [titel] | [categorie/ruimte] | [omschrijving] | [type] | [prioriteit] | [startdatum] | [deadline] | [status] | [kosten] | [afgevinkt] | [notitie]
Reizen: [reizen] | [reis] | [map/onderdeel] | [titel] | [type] | [omschrijving] | [startdatum] | [einddatum] | [deadline] | [locatie] | [kosten] | [prioriteit] | [afvinken] | [afgevinkt] | [notitie/link]</pre>
        </details>
      </section>

      ${state14.preview.length?`
      <section class="card">
        <div class="card-head">
          <div><p class="eyebrow">CONTROLE</p><h2>${state14.preview.length} gevonden items</h2></div>
          <button class="primary" data-v14-commit>Geselecteerde toevoegen</button>
        </div>

        <div class="v13-preview-list">
          ${state14.preview.map((entry,i)=>`
            <article class="v13-card" data-v14-card="${i}">
              <div class="v13-card-head">
                <label><input type="checkbox" data-v14-selected ${entry.selected?'checked':''}> Importeren</label>
              </div>
              <strong>${esc14(entry.item.title)}</strong><br>
              <small class="muted">${esc14(TARGETS14[entry.record.target])} · ${esc14(previewText14(entry))}</small>
            </article>
          `).join('')}
        </div>
      </section>`:
      '<section class="card"><p class="muted">Nog niets geanalyseerd.</p></section>'}
    </div>`;
  }

  async function loadScript14(src,test) {
    if(test()) return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  async function readFile14(file) {
    const ext=file.name.toLowerCase().split('.').pop();

    if(['txt','md','csv'].includes(ext)) return file.text();

    if(ext==='pdf') return extractPdfText(file);

    if(ext==='docx') {
      await loadScript14(
        'https://cdn.jsdelivr.net/npm/mammoth@1.12.2/mammoth.browser.min.js',
        ()=>Boolean(window.mammoth)
      );
      return (await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value||'';
    }

    if(['xlsx','xlsm','xls'].includes(ext)) {
      await loadScript14(
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
        ()=>Boolean(window.XLSX)
      );
      const wb=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      return wb.SheetNames.map(n=>window.XLSX.utils.sheet_to_csv(wb.Sheets[n],{FS:'|'})).join('\n');
    }

    throw new Error('Bestandstype niet ondersteund');
  }

  function bind14() {
    document.querySelector('#v14Target')?.addEventListener('change',e=>{
      state14.target=e.target.value;
      state14.preview=[];
      render();
    });

    document.querySelector('#v14Text')?.addEventListener('input',e=>{
      state14.text=e.target.value;
    });

    document.querySelector('#v14File')?.addEventListener('change',async e=>{
      const file=e.target.files?.[0];
      if(!file) return;

      try {
        state14.filename=file.name;
        toast('Bestand wordt gelezen…');
        state14.text=await readFile14(file);
        analyse14();
      } catch(err) {
        console.error(err);
        toast('Bestand lezen is mislukt');
      }
    });
  }

  function openManualImport14() {
    state14.legacy=true;
    render();
    // De v13-importer staat standaard op handmatig. Als de gebruiker eerder
    // een andere methode koos, schakelen we expliciet terug naar Handmatig.
    setTimeout(()=>document.querySelector('[data-v14-method="manual"]')?.click(),0);
  }

  function bindTopAdd14() {
    const add=document.querySelector('#addBtn');
    if(!add || add.dataset.v14Bound==='1') return;
    add.dataset.v14Bound='1';
    add.addEventListener('click',e=>{
      if(current!=='imports') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openManualImport14();
    },true);
  }

  render = function renderV141() {
    if(current==='imports' && !state14.legacy) {
      document.querySelector('#view').innerHTML=renderImport14();
      updateSyncBadge();
      bind14();
      bindTopAdd14();
      return;
    }

    baseRender14();

    if(current==='imports' && state14.legacy) {
      const view=document.querySelector('#view');
      if(view && !view.querySelector('[data-v14-new]')) {
        view.insertAdjacentHTML('afterbegin',`
          <div class="button-row" style="margin-bottom:16px">
            <button class="secondary" data-v14-new>← Terug naar nieuwe import</button>
          </div>`);
      }
      bindTopAdd14();
    }
  };

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-v14-new]')) {
      state14.legacy=false;
      render();
      return;
    }

    if(e.target.closest('[data-v14-legacy]')) {
      state14.legacy=true;
      render();
      return;
    }

    if(current!=='imports' || state14.legacy) return;

    if(e.target.closest('[data-v14-analyse]')) {
      state14.text=document.querySelector('#v14Text')?.value||state14.text;
      analyse14();
      return;
    }

    if(e.target.closest('[data-v14-clear]')) {
      state14.text='';
      state14.filename='';
      state14.preview=[];
      render();
      return;
    }

    if(e.target.closest('[data-v14-commit]')) {
      document.querySelectorAll('[data-v14-card]').forEach(card=>{
        const x=state14.preview[Number(card.dataset.v14Card)];
        if(x) x.selected=Boolean(card.querySelector('[data-v14-selected]')?.checked);
      });

      const selected=state14.preview.filter(x=>x.selected);
      if(!selected.length) return toast('Selecteer minimaal één item');

      selected.forEach(({record,item})=>{
        data[record.target] ||= [];
        data[record.target].push(item);
      });

      save();

      const count=selected.length;
      state14.preview=[];
      state14.text='';
      state14.filename='';
      render();
      toast(`${count} items toegevoegd`);
      return;
    }
  },true);

  save({touch:false});
  toast('Samen Thuis v14.1 geladen');
})();

;


/* ===== GEÏNTEGREERD: samen-thuis-update-v15(1).js ===== */
/* Samen Thuis v15.0
   - Bodemprijzen / goede-deal database
   - Gierige Gerda lijst 31-08-2026 als startdata
   - Nieuwere bodemprijzen-PDF direct importeerbaar
   - Prijsreferenties zichtbaar bij Boodschappen en Voorraad
   - Aanbevolen huishoudverdeling kan op bestaande taken worden toegepast
*/
console.info('Samen Thuis update 15.0 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V150__) return;
  window.__SAMEN_THUIS_V150__ = true;

  const baseRender15 = render;
  const DEFAULT_PRICES = [{"category":"(Fris)drank","product":"Aanmaaklimonade","brand":"Karvam Cevitan","quantity":"liter","floorPrice":3.33,"goodDealPrice":4.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Aanmaaklimonade","brand":"Raak","quantity":"liter","floorPrice":1.86,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Aanmaaklimonade","brand":"Teisseire","quantity":"liter","floorPrice":4.0,"goodDealPrice":4.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Cola","brand":"Coca-Cola","quantity":"liter","floorPrice":0.85,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Cola","brand":"huismerk","quantity":"liter","floorPrice":0.33,"goodDealPrice":0.6,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Cola","brand":"Pepsi","quantity":"liter","floorPrice":0.67,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Energiedrank","brand":"Red Bull","quantity":"250 ml","floorPrice":0.85,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Frisdrank overig","brand":"A-merk","quantity":"liter","floorPrice":1.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"IJsthee","brand":"Lipton","quantity":"liter","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"(Fris)drank","product":"Rivella","brand":"","quantity":"liter","floorPrice":0.83,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Chips","product":"Popcorn","brand":"Jimmy's","quantity":"100 gram","floorPrice":0.89,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Diepvries","product":"IJs","brand":"Ben & Jerry's","quantity":"500 ml","floorPrice":3.21,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Diepvries","product":"IJsstam","brand":"Viennetta","quantity":"600 gram","floorPrice":0.89,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Conditioner","brand":"A-merk","quantity":"300 ml","floorPrice":1.99,"goodDealPrice":3.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Conditioner","brand":"huismerk","quantity":"500 ml","floorPrice":1.0,"goodDealPrice":1.25,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Damesscheermesjes","brand":"A-merk","quantity":"stuk","floorPrice":1.67,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant roller","brand":"A-merk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant roller","brand":"huismerk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant spuitbus","brand":"A-merk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Deodorant spuitbus","brand":"huismerk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Douchegel","brand":"Fa","quantity":"250 ml","floorPrice":0.33,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Handzeep","brand":"A-merk","quantity":"liter","floorPrice":2.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Herenscheermesjes","brand":"A-merk","quantity":"stuk","floorPrice":1.92,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Opzetborstel elektrisch","brand":"A-merk","quantity":"stuk","floorPrice":1.79,"goodDealPrice":2.5,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Opzetborstel elektrisch","brand":"huismerk","quantity":"stuk","floorPrice":0.31,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Shampoo","brand":"A-merk","quantity":"300 ml","floorPrice":1.99,"goodDealPrice":3.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Shampoo","brand":"huismerk","quantity":"500 ml","floorPrice":1.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandenborstel","brand":"A-merk","quantity":"stuk","floorPrice":0.33,"goodDealPrice":0.5,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"A-merk (doosje)","quantity":"75 ml","floorPrice":1.0,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"A-merk (tube)","quantity":"75 ml","floorPrice":0.5,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"huismerk","quantity":"75 ml","floorPrice":0.25,"goodDealPrice":0.41,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Tandpasta","brand":"Parodontax","quantity":"75 ml","floorPrice":1.67,"goodDealPrice":2.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Zonnebrandcrème","brand":"A-merk","quantity":"200 ml","floorPrice":5.99,"goodDealPrice":8.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Drogisterij","product":"Zonnebrandcrème","brand":"huismerk","quantity":"200 ml","floorPrice":3.2,"goodDealPrice":4.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Afwasmiddel","brand":"A-merk","quantity":"liter","floorPrice":2.85,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Allesreiniger","brand":"A-merk","quantity":"liter","floorPrice":0.9,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Allesreiniger","brand":"huismerk","quantity":"liter","floorPrice":0.75,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Allesreiniger doekjes","brand":"huismerk","quantity":"80 stuks","floorPrice":0.49,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Biotex","brand":"","quantity":"100 gram","floorPrice":0.42,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Keukenrol","brand":"2-laags","quantity":"100 vel","floorPrice":0.52,"goodDealPrice":0.75,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Keukenrol","brand":"3-laags","quantity":"100 vel","floorPrice":0.78,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Oxi vlekverwijderaar","brand":"A-merk","quantity":"kilo","floorPrice":6.47,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Toiletblok","brand":"A-merk","quantity":"stuk","floorPrice":0.8,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Toiletblok","brand":"huismerk","quantity":"stuk","floorPrice":0.5,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Toiletpapier","brand":"3-laags","quantity":"100 vel","floorPrice":0.13,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwaspoeder","brand":"A-merk","quantity":"wasbeurt","floorPrice":0.05,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwaspoeder","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwastablet","brand":"Dreft","quantity":"wasbeurt","floorPrice":0.17,"goodDealPrice":0.2,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwastablet","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.04,"goodDealPrice":0.08,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Vaatwastablet","brand":"Sun","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel","brand":"Neutral","quantity":"wasbeurt","floorPrice":0.19,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel pods","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.1,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel pods","brand":"Reus","quantity":"wasbeurt","floorPrice":0.14,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel poeder","brand":"Ariel","quantity":"wasbeurt","floorPrice":0.2,"goodDealPrice":0.23,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel poeder","brand":"Reus","quantity":"wasbeurt","floorPrice":0.14,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel quickwash","brand":"Robijn","quantity":"wasbeurt","floorPrice":0.22,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Ariel","quantity":"wasbeurt","floorPrice":0.2,"goodDealPrice":0.23,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Fleuril","quantity":"wasbeurt","floorPrice":0.13,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Omo","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":0.11,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Reus","quantity":"wasbeurt","floorPrice":0.09,"goodDealPrice":0.11,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddel vloeibaar","brand":"Robijn","quantity":"wasbeurt","floorPrice":0.13,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddeldoekje","brand":"A-merk","quantity":"wasbeurt","floorPrice":0.07,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasmiddeldoekje","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.1,"goodDealPrice":0.15,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasparfum","brand":"Robijn","quantity":"wasbeurt","floorPrice":0.16,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Wasverzachter","brand":"huismerk","quantity":"wasbeurt","floorPrice":0.02,"goodDealPrice":0.05,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Huishouden","product":"Zakdoekjes (4-laags)","brand":"huismerk","quantity":"pakje 10 zakdoekjes","floorPrice":0.07,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Filterkoffie","brand":"A-merk","quantity":"500 gram","floorPrice":5.29,"goodDealPrice":6.5,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Filterkoffie","brand":"huismerk","quantity":"500 gram","floorPrice":3.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiebonen","brand":"huismerk","quantity":"kilo","floorPrice":6.66,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiecup","brand":"A-merk","quantity":"stuk","floorPrice":0.25,"goodDealPrice":0.3,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiecup","brand":"huismerk","quantity":"stuk","floorPrice":0.09,"goodDealPrice":0.13,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiepads","brand":"A-merk","quantity":"per pad","floorPrice":0.07,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Koffiepads","brand":"huismerk","quantity":"per pad","floorPrice":0.05,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Thee","brand":"A-merk","quantity":"doosje 20 stuks","floorPrice":1.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Koffie en thee","product":"Thee","brand":"Clipper","quantity":"doosje 20 stuks","floorPrice":1.79,"goodDealPrice":1.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Olie","product":"Olijfolie extra vierge","brand":"A-merk","quantity":"liter","floorPrice":4.99,"goodDealPrice":7.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Duopasta","brand":"Duo Pennotti","quantity":"kilo","floorPrice":4.36,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Hazelnootpasta","brand":"A-merk","quantity":"kilo","floorPrice":5.3,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Hazelnootpasta","brand":"huismerk","quantity":"kilo","floorPrice":3.49,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Ontbijtgranen","brand":"A-merk","quantity":"kilo","floorPrice":6.5,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Pindakaas","brand":"A-merk","quantity":"kilo","floorPrice":3.06,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Pindakaas","brand":"huismerk","quantity":"kilo","floorPrice":2.54,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Ontbijt en lunch","product":"Pindakaas 100%","brand":"huismerk","quantity":"kilo","floorPrice":2.86,"goodDealPrice":3.99,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Farfalle","brand":"huismerk","quantity":"kilo","floorPrice":1.35,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Fusilli","brand":"huismerk","quantity":"kilo","floorPrice":1.39,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Macaroni","brand":"huismerk","quantity":"kilo","floorPrice":0.99,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Noodles","brand":"Indomie","quantity":"zakje","floorPrice":0.3,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Noodles","brand":"Unox","quantity":"pot","floorPrice":0.99,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Noodles","brand":"Unox","quantity":"zakje","floorPrice":0.58,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Penne","brand":"huismerk","quantity":"kilo","floorPrice":1.08,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst","brand":"Lassie","quantity":"kilo","floorPrice":1.74,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst basmati","brand":"huismerk","quantity":"kilo","floorPrice":1.79,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst pandan","brand":"huismerk","quantity":"kilo","floorPrice":1.79,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Rijst zilvervlies","brand":"huismerk","quantity":"kilo","floorPrice":1.4,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Pasta en rijst","product":"Spaghetti","brand":"huismerk","quantity":"kilo","floorPrice":0.66,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Sauzen","product":"Mayonaise","brand":"A-merk","quantity":"liter","floorPrice":2.22,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Snoep","product":"Pepermunt","brand":"Wilhelmina","quantity":"per rol","floorPrice":0.29,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Vlees","product":"Rookworst","brand":"HEMA","quantity":"stuk","floorPrice":2.49,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Vlees","product":"Rookworst","brand":"huismerk","quantity":"stuk","floorPrice":0.99,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Wereldkeuken","product":"Pizza","brand":"Crosta & Mollica","quantity":"stuk","floorPrice":3.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Wereldkeuken","product":"Wereldgerechten burritos","brand":"Knorr","quantity":"pak 2-3 personen","floorPrice":1.0,"goodDealPrice":1.35,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Chocolademelk","brand":"A-merk","quantity":"liter","floorPrice":0.75,"goodDealPrice":1.0,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Houdbare melk","brand":"A-merk","quantity":"liter","floorPrice":0.79,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Houdbare melk","brand":"huismerk","quantity":"liter","floorPrice":0.66,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Kaas (jong belegen)","brand":"huismerk","quantity":"kilo","floorPrice":5.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Roomboter","brand":"huismerk","quantity":"500 gram","floorPrice":2.0,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"},{"category":"Zuivel","product":"Smeerkaas","brand":"A-merk","quantity":"100 gram","floorPrice":0.75,"goodDealPrice":null,"source":"Gierige Gerda Media 2026","updatedAt":"2026-08-31"}];
  const ASSIGNMENTS = {"Keuken en woonkamer dagelijkse reset":"Samen","WC schoonmaken":"Kees","Badkamer schoonmaken":"Daphne","Vloeren hele huis":"Kees","Afstoffen hele huis":"Daphne","Keuken grondig schoonmaken":"Daphne","Slaapkamer opruimen en schoonmaken":"Samen","Bureau- en wasruimte opruimen":"Kees","Hal opruimen en schoonmaken":"Kees","Koelkast weekcontrole":"Daphne","Spiegels en glazen oppervlakken reinigen":"Daphne","Deurklinken en lichtknoppen reinigen":"Samen","Onder bed, bank en meubels stofzuigen":"Kees","Afvalbakken reinigen":"Kees","Beddengoed verschonen":"Samen","Handdoeken en keukentextiel vervangen":"Samen","Kledingwas verwerken":"Samen","Badmat en schoonmaakdoeken wassen":"Daphne","Koelkast volledig schoonmaken":"Daphne","Oven en afzuigkap grondig reinigen":"Kees","Badkamer dieptereiniging":"Daphne","Plinten, deuren en kozijnen reinigen":"Samen","Radiatoren en ventilatieroosters reinigen":"Kees","Ramen binnenzijde en kozijnen schoonmaken":"Kees","Bank en hoge oppervlakken grondig reinigen":"Daphne","Wasmachine onderhouden":"Kees","Voorraadkast en keukenkastjes nalopen":"Daphne","Kledingkast en opbergkast nalopen":"Samen"};

  const norm15 = (v='') => String(v).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  const esc15 = (v='') => String(v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const euro15 = n => Number.isFinite(Number(n))
    ? new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(Number(n))
    : '—';

  data.priceReferences ||= [];
  if(!data.priceReferences.length) {
    data.priceReferences = DEFAULT_PRICES.map((x,i)=>({id:`price-${i+1}`,...x}));
    data.priceReferenceSource = 'Gierige Gerda Media 2026';
    data.priceReferenceUpdatedAt = '2026-08-31';
    save({touch:false});
  }

  let pricePreview15 = [];
  let priceFileName15 = '';

  function bestRefs15(title='') {
    const q=norm15(title);
    if(!q) return [];
    const exact=[], loose=[];
    for(const r of data.priceReferences||[]) {
      const p=norm15(r.product);
      if(!p) continue;
      if(q===p || q.includes(p) || p.includes(q)) exact.push(r);
      else {
        const words=p.split(' ').filter(w=>w.length>3);
        if(words.length && words.some(w=>q.includes(w))) loose.push(r);
      }
    }
    return (exact.length?exact:loose).sort((a,b)=>(a.floorPrice??999)-(b.floorPrice??999));
  }

  function priceBadge15(ref) {
    if(!ref) return '';
    return `<span class="tag green">Bodem ${euro15(ref.floorPrice)} / ${esc15(ref.quantity)}</span>`+
      (ref.goodDealPrice!=null?` <span class="tag">Goede deal ≤ ${euro15(ref.goodDealPrice)}</span>`:'');
  }

  function renderPriceReferenceCard15() {
    const items=current==='groceries'?(data.groceries||[]):(data.stock||[]);
    const matched=items.map(item=>({item,refs:bestRefs15(item.title||item.name||'')}))
      .filter(x=>x.refs.length);

    return `<section class="card" data-v15-price-card>
      <div class="card-head">
        <div>
          <p class="eyebrow">BODEMPRIJZEN</p>
          <h2>Prijsreferentie</h2>
        </div>
        <span class="tag green">${(data.priceReferences||[]).length} prijzen</span>
      </div>
      <p class="muted">Bron: ${esc15(data.priceReferenceSource||'Prijsreferenties')} · bijgewerkt ${esc15(data.priceReferenceUpdatedAt||'onbekend')}.</p>
      ${matched.length?`
        <div class="v13-preview-list">
          ${matched.slice(0,12).map(x=>`
            <article class="v13-card">
              <strong>${esc15(x.item.title||x.item.name)}</strong>
              <div style="margin-top:8px">${priceBadge15(x.refs[0])}</div>
              <small class="muted">${esc15(x.refs[0].brand||'')}${x.refs.length>1?` · ${x.refs.length} passende referenties`:''}</small>
            </article>`).join('')}
        </div>`:
        `<p class="muted">Er zijn nog geen producten op deze pagina die automatisch aan de bodemprijzenlijst gekoppeld zijn.</p>`}
    </section>`;
  }

  function injectPagePriceCard15() {
    if(!['groceries','stock'].includes(current)) return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v15-price-card]')) return;
    view.insertAdjacentHTML('afterbegin',renderPriceReferenceCard15());
  }

  function householdStats15() {
    const counts={Kees:0,Daphne:0,Samen:0};
    (data.chores||[]).forEach(x=>{ if(counts[x.person]!=null) counts[x.person]++; });
    return counts;
  }

  function injectHouseholdDistribution15() {
    if(current!=='chores') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v15-household]')) return;
    const c=householdStats15();
    view.insertAdjacentHTML('afterbegin',`
      <section class="card" data-v15-household>
        <div class="card-head">
          <div><p class="eyebrow">VERDELING</p><h2>Huishoudtaken</h2></div>
          <button class="secondary" data-v15-distribute>⚖️ Aanbevolen verdeling toepassen</button>
        </div>
        <p class="muted">Samen betekent: gezamenlijke verantwoordelijkheid; één van jullie mag de taak afronden.</p>
        <div class="button-row">
          <span class="tag">Kees · ${c.Kees}</span>
          <span class="tag">Daphne · ${c.Daphne}</span>
          <span class="tag">Samen · ${c.Samen}</span>
        </div>
      </section>`);
  }

  function applyHouseholdDistribution15() {
    let changed=0;
    (data.chores||[]).forEach(task=>{
      const key=Object.keys(ASSIGNMENTS).find(k=>norm15(k)===norm15(task.title));
      if(key && ASSIGNMENTS[key] && task.person!==ASSIGNMENTS[key]) {
        task.person=ASSIGNMENTS[key];
        changed++;
      }
    });
    save(); render(); toast(`${changed} huishoudtaken opnieuw verdeeld`);
  }

  function parsePrice15(value) {
    const m=String(value||'').match(/(\d+[,.]\d+|\d+)/);
    return m?Number(m[1].replace(',','.')):null;
  }

  const CATS15=['(Fris)drank','Chips','Diepvries','Drogisterij','Huishouden','Koffie en thee','Olie','Ontbijt en lunch','Pasta en rijst','Sauzen','Snoep','Vlees','Wereldkeuken','Zuivel'];

  function parsePricePdfText15(text='') {
    const lines=String(text).replace(/\r/g,'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const updated=(String(text).match(/Update datum:\s*(\d{1,2})\s+([A-Za-zé]+)\s+(20\d{2})/i)||[]);
    const months={januari:'01',februari:'02',maart:'03',april:'04',mei:'05',juni:'06',juli:'07',augustus:'08',september:'09',oktober:'10',november:'11',december:'12'};
    const updateISO=updated.length?`${updated[3]}-${months[norm15(updated[2])]||'01'}-${String(updated[1]).padStart(2,'0')}`:'';

    const result=[];
    for(const line of lines) {
      if(/^Categorie\s+Product/i.test(line) || /Copyright Gierige Gerda/i.test(line)) continue;
      const category=CATS15.find(c=>line.startsWith(c+' '));
      if(!category) continue;
      const priceMatch=line.match(/€\s*(\d+[,.]\d+)\s*(?:€\s*(\d+[,.]\d+)|[-x])?\s*$/i);
      if(!priceMatch) continue;

      const prefix=line.slice(category.length,priceMatch.index).trim();
      const qtyRx=/(pakje\s+10\s+zakdoekjes|doosje\s+20\s+stuks|pak\s+2-3\s+personen|100\s+vel|80\s+stuks|600\s+gram|500\s+gram|300\s+ml|250\s+ml|200\s+ml|100\s+gram|75\s+ml|500\s+ml|kilo|liter|stuk|wasbeurt|per\s+pad|per\s+rol|zakje|pot)$/i;
      const qm=prefix.match(qtyRx);
      if(!qm) continue;
      const quantity=qm[1];
      const left=prefix.slice(0,qm.index).trim();

      let product='',brand='';
      const known=DEFAULT_PRICES.find(r=>norm15(`${r.product} ${r.brand}`)===norm15(left))
        || DEFAULT_PRICES.find(r=>norm15(left).startsWith(norm15(r.product)) && (!r.brand || norm15(left).includes(norm15(r.brand))));
      if(known) {
        product=known.product; brand=known.brand;
      } else {
        const tokens=left.split(/\s+/);
        brand=tokens.pop()||'';
        product=tokens.join(' ');
      }

      result.push({
        id:`price-import-${Date.now()}-${result.length}`,
        category,product,brand:brand==='-'?'':brand,quantity,
        floorPrice:parsePrice15(priceMatch[1]),
        goodDealPrice:parsePrice15(priceMatch[2]),
        source:'Gierige Gerda Media',
        updatedAt:updateISO
      });
    }
    return {items:result,updatedAt:updateISO};
  }

  function priceImportCard15() {
    return `<section class="card" data-v15-price-import>
      <div class="card-head">
        <div><p class="eyebrow">BODEMPRIJZEN</p><h2>Bodemprijzenlijst importeren</h2></div>
        <span class="tag green">${(data.priceReferences||[]).length} actief</span>
      </div>
      <p>Upload hier rechtstreeks de <strong>Gierige Gerda bodemprijzenlijst</strong>. De lijst wordt apart bewaard en niet als voorraadproduct.</p>
      <div class="form-grid">
        <div class="field full">
          <label>PDF / TXT</label>
          <input type="file" id="v15PriceFile" accept=".pdf,.txt,text/plain,application/pdf">
        </div>
      </div>
      ${priceFileName15?`<p class="muted">Bronbestand: <strong>${esc15(priceFileName15)}</strong></p>`:''}
      ${pricePreview15.length?`
        <div class="card-head" style="margin-top:16px">
          <div><strong>${pricePreview15.length} prijzen gevonden</strong><br><small class="muted">Controleer het aantal en vervang daarna de huidige prijsreferenties.</small></div>
          <button class="primary" data-v15-price-commit>Huidige lijst vervangen</button>
        </div>
        <div class="v13-preview-list">
          ${pricePreview15.slice(0,8).map(r=>`
            <article class="v13-card">
              <strong>${esc15(r.product)}</strong><br>
              <small>${esc15(r.brand||'Geen merk')} · ${esc15(r.quantity)}</small>
              <div style="margin-top:6px">${priceBadge15(r)}</div>
            </article>`).join('')}
        </div>
        ${pricePreview15.length>8?`<p class="muted">+ ${pricePreview15.length-8} overige prijzen</p>`:''}
      `:''}
    </section>`;
  }

  function injectPriceImport15() {
    if(current!=='imports') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v15-price-import]')) return;
    view.insertAdjacentHTML('afterbegin',priceImportCard15());
    bindPriceFile15();
  }

  function bindPriceFile15() {
    const input=document.querySelector('#v15PriceFile');
    if(!input || input.dataset.bound==='1') return;
    input.dataset.bound='1';
    input.addEventListener('change',async e=>{
      const file=e.target.files?.[0]; if(!file) return;
      try {
        priceFileName15=file.name;
        toast('Bodemprijzenlijst wordt gelezen…');
        const ext=file.name.toLowerCase().split('.').pop();
        const text=ext==='pdf'?await extractPdfText(file):await file.text();
        const parsed=parsePricePdfText15(text);
        pricePreview15=parsed.items;
        if(parsed.updatedAt) pricePreview15.forEach(x=>x.updatedAt=parsed.updatedAt);
        render();
        toast(`${pricePreview15.length} bodemprijzen gevonden`);
      } catch(err) {
        console.error(err);
        toast('Bodemprijzenlijst kon niet worden gelezen');
      }
    });
  }

  function commitPrices15() {
    if(!pricePreview15.length) return toast('Upload eerst een bodemprijzenlijst');
    data.priceReferences=pricePreview15.map(x=>({...x}));
    data.priceReferenceSource='Gierige Gerda Media';
    data.priceReferenceUpdatedAt=pricePreview15.find(x=>x.updatedAt)?.updatedAt || new Date().toISOString().slice(0,10);
    save();
    const n=pricePreview15.length;
    pricePreview15=[]; priceFileName15='';
    render(); toast(`${n} bodemprijzen opgeslagen`);
  }

  render=function renderV150() {
    baseRender15();
    injectPriceImport15();
    injectPagePriceCard15();
    injectHouseholdDistribution15();
  };

  document.addEventListener('click',e=>{
    if(e.target.closest('[data-v15-distribute]')) {
      e.preventDefault(); applyHouseholdDistribution15(); return;
    }
    if(e.target.closest('[data-v15-price-commit]')) {
      e.preventDefault(); commitPrices15(); return;
    }
  },true);

  save({touch:false});
  toast('Samen Thuis v15 geladen');
})();

;


/* ===== GEÏNTEGREERD: samen-thuis-update-v16(1).js ===== */
/* Samen Thuis v16.0
   SMART HOUSEHOLD + SCROLL PRESERVATION
   - Geen vaste weekdagen meer voor huishoudtaken.
   - Planning wordt berekend vanaf de echte laatste uitvoering.
   - 2×/3× per week werkt met flexibele tussenpozen en cyclusstatus.
   - completedDates blijft de bronhistorie.
   - Wijzigen/afvinken houdt de scrollpositie vast.
*/
console.info('Samen Thuis update 16.0 geladen');

(() => {
  'use strict';
  if (window.__SAMEN_THUIS_V160__) return;
  window.__SAMEN_THUIS_V160__ = true;

  const baseRender16 = render;
  const baseOccursOn16 = typeof occursOn === 'function' ? occursOn : null;
  const baseToggle16 = typeof toggleChoreOccurrence === 'function' ? toggleChoreOccurrence : null;

  const pad16 = n => String(n).padStart(2,'0');
  const iso16 = d => `${d.getFullYear()}-${pad16(d.getMonth()+1)}-${pad16(d.getDate())}`;
  const parse16 = s => new Date(`${s}T12:00:00`);
  const today16 = () => iso16(new Date());

  const esc16 = (v='') => String(v).replace(/[&<>'"]/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  const norm16 = (v='') => String(v).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9×]+/g,' ').trim();

  function addDays16(dateISO, amount) {
    const d=parse16(dateISO);
    d.setDate(d.getDate()+amount);
    return iso16(d);
  }

  function addMonths16(dateISO, amount) {
    const original=parse16(dateISO);
    const day=original.getDate();
    const d=new Date(original.getFullYear(), original.getMonth()+amount, 1, 12);
    const last=new Date(d.getFullYear(), d.getMonth()+1, 0, 12).getDate();
    d.setDate(Math.min(day,last));
    return iso16(d);
  }

  function daysBetween16(a,b) {
    return Math.round((parse16(b)-parse16(a))/86400000);
  }

  function fmt16(date) {
    if(!date) return '';
    return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(parse16(date));
  }

  function uniqueSortedDates16(chore) {
    return [...new Set((Array.isArray(chore.completedDates)?chore.completedDates:[])
      .filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))]
      .sort();
  }

  function lastDone16(chore) {
    const dates=uniqueSortedDates16(chore);
    return chore.lastDoneDate || dates.at(-1) || '';
  }

  function frequency16(chore) {
    const r=norm16(chore.repeat);
    if(r==='dagelijks') return {kind:'interval', target:1, days:1, lead:0};
    if(r==='om de dag') return {kind:'interval', target:1, days:2, lead:1};
    if(r==='2× per week' || r==='2x per week' || r==='2 per week') return {kind:'multi',target:2,days:4,lead:2,cycleDays:7};
    if(r==='3× per week' || r==='3x per week' || r==='3 per week') return {kind:'multi',target:3,days:3,lead:1,cycleDays:7};
    if(r==='wekelijks') return {kind:'interval',target:1,days:7,lead:3};
    if(r==='elke 2 weken' || r==='om de week') return {kind:'interval',target:1,days:14,lead:4};
    if(r==='elke 4 weken') return {kind:'interval',target:1,days:28,lead:7};
    if(r==='maandelijks') return {kind:'month',target:1,months:1,lead:7};
    if(r==='elke 2 maanden') return {kind:'month',target:1,months:2,lead:10};
    if(r==='elke 3 maanden') return {kind:'month',target:1,months:3,lead:14};
    if(r==='elke 6 maanden' || r==='halfjaarlijks') return {kind:'month',target:1,months:6,lead:21};
    if(r==='jaarlijks') return {kind:'month',target:1,months:12,lead:30};
    if(r==='eenmalig') return {kind:'once',target:1,lead:3};
    if(r==='na elke was' || r==='wanneer nodig') return {kind:'manual',target:0,lead:0};
    return {kind:'interval',target:1,days:7,lead:3};
  }

  function cycleCount16(chore, cfg) {
    if(cfg.kind!=='multi') return 0;
    const persisted=Number(chore.smartCycleCount);
    if(Number.isFinite(persisted) && persisted>=0 && persisted<=cfg.target) return persisted;

    const dates=uniqueSortedDates16(chore);
    if(!dates.length) return 0;

    // Reconstruct a current flexible cycle from the most recent completions.
    const recent=[];
    for(let i=dates.length-1;i>=0;i--) {
      if(!recent.length || daysBetween16(dates[i],recent.at(-1))<=cfg.days) {
        recent.unshift(dates[i]);
        if(recent.length>=cfg.target) break;
      } else break;
    }
    return Math.min(cfg.target,recent.length);
  }

  function nextDue16(chore) {
    const cfg=frequency16(chore);
    const last=lastDone16(chore);

    if(cfg.kind==='manual') return '';
    if(cfg.kind==='once') {
      if(last) return '';
      return chore.due || today16();
    }

    // First ever run: due is only an initial hint, never a fixed recurring weekday.
    if(!last) return chore.due || today16();

    if(cfg.kind==='month') return addMonths16(last,cfg.months);
    return addDays16(last,cfg.days);
  }

  function smartStatus16(chore, date=today16()) {
    const cfg=frequency16(chore);
    const last=lastDone16(chore);
    const due=nextDue16(chore);

    if(cfg.kind==='manual') {
      return {
        due:'', last, count:0, target:0, level:'green',
        text:last?`Laatst gedaan ${fmt16(last)} · wanneer nodig`:'Wanneer nodig'
      };
    }

    if(cfg.kind==='once' && last) {
      return {due:'',last,count:1,target:1,level:'green',text:`Afgerond ${fmt16(last)}`};
    }

    const delta=due ? daysBetween16(date,due) : 999;
    let level='green';
    if(delta<0) level='red';
    else if(delta<=Math.min(2,cfg.lead||0)) level='orange';

    if(cfg.kind==='multi') {
      const count=cycleCount16(chore,cfg);
      if(count>=cfg.target) {
        const text = delta>0
          ? `${cfg.target}/${cfg.target} gedaan · nieuwe cyclus over ${delta} ${delta===1?'dag':'dagen'}`
          : delta===0
            ? `${cfg.target}/${cfg.target} gedaan · nieuwe cyclus kan vandaag starten`
            : `Nieuwe cyclus is ${Math.abs(delta)} ${Math.abs(delta)===1?'dag':'dagen'} aan de beurt`;
        return {due,last,count,target:cfg.target,level,text};
      }

      const remaining=cfg.target-count;
      const prefix=`${count}/${cfg.target} gedaan`;
      const text=delta>0
        ? `${prefix} · nog ${remaining}× · volgende binnen ${delta} ${delta===1?'dag':'dagen'}`
        : delta===0
          ? `${prefix} · nog ${remaining}× · volgende vandaag`
          : `${prefix} · nog ${remaining}× · ${Math.abs(delta)} ${Math.abs(delta)===1?'dag':'dagen'} te laat`;
      return {due,last,count,target:cfg.target,level,text};
    }

    const text = delta>0
      ? `Binnen ${delta} ${delta===1?'dag':'dagen'} weer doen`
      : delta===0
        ? 'Vandaag weer doen'
        : `${Math.abs(delta)} ${Math.abs(delta)===1?'dag':'dagen'} te laat`;

    return {due,last,count:last?1:0,target:1,level,text};
  }

  function shouldShowSoon16(chore,date=today16()) {
    const cfg=frequency16(chore);
    const st=smartStatus16(chore,date);
    if(cfg.kind==='manual') return false;
    if(cfg.kind==='once' && st.last) return false;
    if(!st.due) return false;
    const d=daysBetween16(date,st.due);
    return d<=Math.max(0,cfg.lead||0);
  }

  // Replace fixed-weekday scheduling. The calendar occurrence is now the calculated
  // next deadline only; "soon" tasks are surfaced separately in Today/Household.
  if(baseOccursOn16) {
    occursOn = function occursOnV16(chore,date) {
      const due=nextDue16(chore);
      return Boolean(due && date===due);
    };
  }

  // Completion is always an actual completion moment, not a recurring weekday.
  if(baseToggle16) {
    toggleChoreOccurrence = function toggleChoreOccurrenceV16(choreId,date) {
      const chore=(data.chores||[]).find(x=>x.id===choreId);
      if(!chore) return;

      const doneDate = (date && date<=today16()) ? date : today16();
      chore.completedDates ||= [];

      // Clicking an already-recorded date undoes that exact completion.
      if(chore.completedDates.includes(doneDate)) {
        chore.completedDates=chore.completedDates.filter(x=>x!==doneDate);
        const dates=uniqueSortedDates16(chore);
        chore.lastDoneDate=dates.at(-1)||'';
        delete chore.smartCycleCount;
        delete chore.smartCycleStart;
      } else {
        const cfg=frequency16(chore);
        const previousLast=lastDone16(chore);
        chore.completedDates=[...new Set([...chore.completedDates,doneDate])].sort();
        chore.lastDoneDate=doneDate;

        if(cfg.kind==='multi') {
          let current=cycleCount16(chore,cfg);
          if(current>=cfg.target || !previousLast || daysBetween16(previousLast,doneDate)>cfg.cycleDays) {
            current=1;
            chore.smartCycleStart=doneDate;
          } else {
            current=Math.min(cfg.target,current+1);
            chore.smartCycleStart ||= previousLast;
          }
          chore.smartCycleCount=current;
        } else {
          chore.smartCycleCount=1;
          chore.smartCycleStart=doneDate;
        }
      }

      save();
      render();
    };
  }

  function migrateSmartChores16() {
    (data.chores||[]).forEach(chore=>{
      chore.completedDates ||= [];
      if(!chore.lastDoneDate) {
        const dates=uniqueSortedDates16(chore);
        chore.lastDoneDate=dates.at(-1)||'';
      }
      // Old second weekday is intentionally ignored from v16 onward.
      chore.secondWeekday='';
      chore.smartSchedule=true;
    });
    save({touch:false});
  }

  function statusColor16(level) {
    if(level==='red') return '#b84f58';
    if(level==='orange') return '#b2762c';
    return '#2e7d67';
  }

  function smartTaskCard16(chore) {
    const s=smartStatus16(chore);
    const last=s.last?`Laatst: ${fmt16(s.last)}`:'Nog niet uitgevoerd';
    return `<article class="v16-smart-task" data-v16-chore="${esc16(chore.id)}"
      style="border:1px solid rgba(49,95,134,.18);border-left:5px solid ${statusColor16(s.level)};border-radius:16px;padding:14px;margin:10px 0;background:rgba(255,255,255,.7)">
      <div style="display:flex;gap:12px;justify-content:space-between;align-items:flex-start">
        <div>
          <strong>${esc16(chore.title)}</strong>
          <div class="muted" style="margin-top:4px">${esc16(chore.person||'Samen')} · ${esc16(chore.repeat||'')}</div>
        </div>
        <button class="primary" data-v16-done="${esc16(chore.id)}" style="white-space:nowrap">✓ Gedaan</button>
      </div>
      <div style="margin-top:10px;font-weight:700;color:${statusColor16(s.level)}">${esc16(s.text)}</div>
      <small class="muted">${esc16(last)}${s.due?` · uiterlijk ${esc16(fmt16(s.due))}`:''}</small>
    </article>`;
  }

  function injectSmartHousehold16() {
    if(current!=='chores') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v16-smart-household]')) return;

    const chores=[...(data.chores||[])].sort((a,b)=>{
      const sa=smartStatus16(a), sb=smartStatus16(b);
      if(!sa.due&&!sb.due) return 0;
      if(!sa.due) return 1;
      if(!sb.due) return -1;
      return sa.due.localeCompare(sb.due);
    });

    const dueSoon=chores.filter(x=>shouldShowSoon16(x));
    const later=chores.filter(x=>!shouldShowSoon16(x));

    const html=`<section class="card" data-v16-smart-household>
      <div class="card-head">
        <div><p class="eyebrow">SLIMME PLANNING</p><h2>Wanneer moet wat weer?</h2></div>
        <span class="tag green">Geen vaste weekdagen</span>
      </div>
      <p class="muted">Na iedere afronding wordt de volgende termijn opnieuw berekend vanaf die echte datum.</p>
      ${dueSoon.length?`
        <h3 style="margin-top:18px">Nu / binnenkort</h3>
        ${dueSoon.map(smartTaskCard16).join('')}
      `:`<p class="muted">Er hoeft op dit moment niets binnenkort gedaan te worden.</p>`}
      ${later.length?`
        <details style="margin-top:14px">
          <summary>Later (${later.length})</summary>
          <div style="margin-top:10px">${later.map(smartTaskCard16).join('')}</div>
        </details>`:''}
    </section>`;

    const distribution=view.querySelector('[data-v15-household]');
    if(distribution) distribution.insertAdjacentHTML('afterend',html);
    else view.insertAdjacentHTML('afterbegin',html);
  }

  function injectTodaySoon16() {
    if(current!=='today') return;
    const view=document.querySelector('#view');
    if(!view || view.querySelector('[data-v16-today-chores]')) return;

    const soon=(data.chores||[])
      .filter(x=>shouldShowSoon16(x))
      .sort((a,b)=>(nextDue16(a)||'9999').localeCompare(nextDue16(b)||'9999'));

    if(!soon.length) return;

    const html=`<section class="card" data-v16-today-chores>
      <div class="card-head">
        <div><p class="eyebrow">HUISHOUDEN · BINNENKORT</p><h2>${soon.length} ${soon.length===1?'taak':'taken'} in beeld</h2></div>
        <span class="tag">Flexibel</span>
      </div>
      ${soon.slice(0,6).map(smartTaskCard16).join('')}
    </section>`;

    view.insertAdjacentHTML('beforeend',html);
  }

  // ---- SCROLL PRESERVATION ----
  let lastRenderedPage16=null;
  let savedPage16=null;
  let savedY16=0;
  let restoreToken16=0;

  function captureScroll16() {
    savedPage16=current;
    savedY16=window.scrollY || document.documentElement.scrollTop || 0;
  }

  function restoreScroll16(page,y) {
    const token=++restoreToken16;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        if(token!==restoreToken16 || current!==page) return;
        window.scrollTo({top:y,left:0,behavior:'auto'});
      });
    });
  }

  render = function renderV160() {
    const samePage = lastRenderedPage16===current;
    const y = samePage ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
    const page=current;

    baseRender16();
    injectSmartHousehold16();
    injectTodaySoon16();

    lastRenderedPage16=page;
    if(samePage && y>0) restoreScroll16(page,y);
  };

  // Capture before interactions that commonly re-render the same page:
  // edit/delete/complete/import/save/bulk controls.
  document.addEventListener('pointerdown',e=>{
    const actionable=e.target.closest(
      'button, input[type="checkbox"], select, [data-edit], [data-delete], [data-action], [data-v13-card], [data-v14-card], [data-v15-distribute], [data-v15-price-commit], [data-v16-done]'
    );
    if(actionable) captureScroll16();
  },true);

  document.addEventListener('click',e=>{
    const done=e.target.closest('[data-v16-done]');
    if(done) {
      e.preventDefault();
      e.stopImmediatePropagation();
      captureScroll16();
      toggleChoreOccurrence(done.dataset.v16Done,today16());
      return;
    }
  },true);

  migrateSmartChores16();

  // One initial render is needed so existing screens immediately use the new logic.
  render();
  toast('Samen Thuis v16 geladen');
})();

;

/* ===== v18 CLEAN DASHBOARD ===== */
(() => {
'use strict';
if(window.__ST_V18__) return; window.__ST_V18__=true;
const oldRender18=render, WC='stWeatherV18', LOC={name:'Rotterdam',lat:51.9225,lon:4.47917};
const wi=c=>({0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',77:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'🌨️',95:'⛈️',96:'⛈️',99:'⛈️'})[c]||'🌤️';
function wt(c){if(c===0)return'Zonnig';if(c<=2)return'Licht bewolkt';if(c===3)return'Bewolkt';if(c<=48)return'Mistig';if(c<=57)return'Motregen';if(c<=67)return'Regen';if(c<=77)return'Sneeuw';if(c<=86)return'Buien';return'Onweer'}
function outfit(w){let f=Math.round(w.current?.apparent_temperature??15),r=+(w.daily?.precipitation_probability_max?.[0]||0),wind=+(w.current?.wind_speed_10m||0),a=f<=5?['Winterjas','warme trui']:f<=11?['Jas','trui of vest']:f<=16?['Lichte jas of vest','lange broek']:f<=22?['T-shirt','lichte broek']:['Luchtige kleding','korte broek'];if(r>=40)a.push('regenjas of paraplu');if(wind>=30)a.push('winddichte laag');if((w.current?.weather_code||99)<=1&&f>=18)a.push('zonnebril');return a}
function data18(){
 let chores=0;try{chores=occurrencesForDate(todayISO()).filter(({chore})=>!isChoreDone(chore,todayISO())).length}catch(_){chores=(data.chores||[]).filter(x=>!x.done).length}
 const groceries=(data.groceries||[]).filter(x=>!x.done).length;
 const low=(data.stock||[]).filter(x=>{let a=+(x.amount??0),m=+(x.min??x.minimum??0);return m>0&&a<=m}).length;
 const dinner=(data.meals||[]).find(x=>x.date===todayISO()&&/avond/i.test(x.type||x.mealType||''));
 let agenda=[];try{agenda=(data.planning||[]).filter(x=>x.date>=todayISO()).sort(typeof sortPlanning==='function'?sortPlanning:(a,b)=>`${a.date}${a.time||''}`.localeCompare(`${b.date}${b.time||''}`)).slice(0,4)}catch(_){}
 return{chores,groceries,low,dinner,agenda}
}
function html18(){
 const s=data18(),date=new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
 return `<section class="dash18" data-dash18><header class="dh18"><div><p class="eyebrow">Jullie thuis, in één oogopslag</p><h2>Vandaag</h2><p>${date}</p></div><div class="people18"><span>K</span><span>D</span></div></header><div class="dg18">
 <section class="weather18" data-weather18>Weer ophalen…</section>
 <section class="today18"><div class="ct18"><strong>Vandaag</strong><span>${s.chores} taken</span></div><div class="stats18"><button data-view="chores"><b>${s.chores}</b><small>Huishouden</small></button><button data-view="groceries"><b>${s.groceries}</b><small>Boodschappen</small></button><button data-view="stock"><b>${s.low}</b><small>Bijna op</small></button></div><div class="meal18"><small>🍽️ VANAVOND</small><strong>${esc(s.dinner?.title||'Nog geen avondeten gepland')}</strong></div></section>
 <section class="agenda18"><div class="ct18"><strong>Komende afspraken</strong><button class="text-btn" data-view="planning">Alles →</button></div>${s.agenda.length?s.agenda.map(x=>`<div class="ar18"><time>${esc(x.date===todayISO()?(x.time||'Hele dag'):new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric'}).format(parseDate(x.date)))}</time><div><strong>${esc(x.title)}</strong><small>${esc(x.person||'')}</small></div></div>`).join(''):'<p class="muted">Geen komende afspraken.</p>'}</section>
 <section class="outfit18" data-outfit18><span>👕</span><div><strong>Wat trek je aan?</strong><p>Weeradvies laden…</p></div></section></div></section>`
}
async function weather18(force=false){
 const box=document.querySelector('[data-weather18]');if(!box)return;
 try{let w=null;if(!force)try{let c=JSON.parse(localStorage.getItem(WC)||'null');if(c&&Date.now()-c.t<1800000)w=c.w}catch(_){}
 if(!w){let q=new URLSearchParams({latitude:LOC.lat,longitude:LOC.lon,current:'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m',hourly:'temperature_2m,weather_code,precipitation_probability',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max',timezone:'Europe/Amsterdam',forecast_days:'5'});let r=await fetch('https://api.open-meteo.com/v1/forecast?'+q,{cache:'no-store'});if(!r.ok)throw 0;w=await r.json();localStorage.setItem(WC,JSON.stringify({t:Date.now(),w}))}
 let c=w.current,d=w.daily,h=w.hourly,n=new Date(),i=h.time.findIndex(t=>new Date(t)>=new Date(n.getFullYear(),n.getMonth(),n.getDate(),n.getHours()));if(i<0)i=0;let ids=Array.from({length:6},(_,k)=>i+k).filter(k=>k<h.time.length);
 box.innerHTML=`<div class="wm18"><div><small>⌖ ${LOC.name}</small><div class="temp18"><span>${wi(c.weather_code)}</span><strong>${Math.round(c.temperature_2m)}°</strong></div><p>${wt(c.weather_code)} · voelt als ${Math.round(c.apparent_temperature)}°</p></div><div class="wf18"><b>${Math.round(d.temperature_2m_max[0])}° / ${Math.round(d.temperature_2m_min[0])}°</b><span>☂ ${Math.round(d.precipitation_probability_max[0]||0)}%</span><span>↗ ${Math.round(c.wind_speed_10m||0)} km/u</span></div></div><div class="hours18">${ids.map(k=>`<div><small>${h.time[k].slice(11,16)}</small><b>${wi(h.weather_code[k])}</b><strong>${Math.round(h.temperature_2m[k])}°</strong><small>${Math.round(h.precipitation_probability[k]||0)}%</small></div>`).join('')}</div><button class="wr18" data-wr18>↻</button>`;
 let o=document.querySelector('[data-outfit18]');if(o)o.innerHTML=`<span>👕</span><div><strong>Wat trek je aan?</strong><p>${outfit(w).map(esc).join(' · ')}</p><small>Gebaseerd op temperatuur, regen en wind.</small></div>`
 }catch(_){box.innerHTML='<strong>Weer tijdelijk niet beschikbaar</strong><p><button class="text-btn" data-wr18>Opnieuw proberen</button></p>'}
}
function enhance18(){if(current!=='today')return;let v=document.querySelector('#view');if(!v||v.querySelector('[data-dash18]'))return;v.insertAdjacentHTML('afterbegin',html18());let w=v.querySelector('.welcome');if(w)w.style.display='none';weather18()}
render=function(...a){let r=oldRender18(...a);requestAnimationFrame(enhance18);return r};
document.addEventListener('click',e=>{if(e.target.closest('[data-wr18]'))weather18(true)});
requestAnimationFrame(enhance18);
})();


/* =========================================================
   SAMEN THUIS v19 — 12 PAGINA'S + APPARAATGEBONDEN WEERGAVE
   ========================================================= */
(() => {
'use strict';
if(window.__ST_V19__) return; window.__ST_V19__=true;

const UIKEY19='samenThuisDeviceUiV19';
const DEFAULTUI19={theme:'system',accent:'bluePurple',density:'comfortable',mobileNav:['today','planning','meals','groceries']};
function loadUi19(){try{return {...DEFAULTUI19,...JSON.parse(localStorage.getItem(UIKEY19)||'{}')}}catch(_){return {...DEFAULTUI19}}}
let ui19=loadUi19();
function saveUi19(){localStorage.setItem(UIKEY19,JSON.stringify(ui19));applyUi19()}
function applyUi19(){
  const dark=ui19.theme==='dark'||(ui19.theme==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.dataset.theme19=dark?'dark':'light';
  document.documentElement.dataset.accent19=ui19.accent||'bluePurple';
  document.documentElement.dataset.density19=ui19.density||'comfortable';
}
applyUi19();
try{matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>ui19.theme==='system'&&applyUi19())}catch(_){}

const pages19=[
 ['today','Today','⌂'],['planning','Agenda','▦'],['meals','Weekmenu','♨'],['groceries','Boodschappen','✓'],
 ['chores','Huishouden','⌁'],['stock','Voorraad','▤'],['trips','Reizen','✈'],['ideas','Date ideeën','♡'],
 ['home','Woning','⌂'],['budget19','Budget','€'],['extra19','Extra','＋'],['settings','Instellingen','⚙']
];
try{
  sections.today={label:'Today',icon:'⌂'};
  sections.ideas={label:'Date ideeën',icon:'♡'};
  sections.budget19={label:'Budget',icon:'€'};
  sections.extra19={label:'Extra',icon:'＋'};
}catch(_){}

function go19(view,focusId=''){
  if(view==='budget19'||view==='extra19'){current=view;render();return}
  current=view;render();
  if(focusId)setTimeout(()=>{
    const el=document.querySelector(`[data-id="${CSS.escape(focusId)}"],[data-edit="${CSS.escape(focusId)}"],#${CSS.escape(focusId)}`);
    el?.scrollIntoView({behavior:'smooth',block:'center'});
  },80);
}
window.SamenThuisGo=go19;

function nav19(){
  const desktop=document.querySelector('.sidebar nav,.side-nav,.nav-list');
  if(desktop){
    desktop.innerHTML=pages19.map(([id,label,icon])=>`<button class="${current===id?'active':''}" data-v19-go="${id}"><span>${icon}</span>${label}</button>`).join('');
  }
  const mobile=document.querySelector('.mobile-nav,.bottom-nav');
  if(mobile){
    const direct=(ui19.mobileNav||DEFAULTUI19.mobileNav).slice(0,4);
    mobile.innerHTML=direct.map(id=>{const p=pages19.find(x=>x[0]===id)||pages19[0];return `<button class="${current===id?'active':''}" data-v19-go="${id}"><span>${p[2]}</span><small>${p[1]}</small></button>`}).join('')+
      `<button data-v19-more><span>•••</span><small>Meer</small></button>`;
  }
}
function more19(){
  let old=document.querySelector('[data-v19-moremenu]');if(old){old.remove();return}
  const direct=new Set(ui19.mobileNav||DEFAULTUI19.mobileNav);
  document.body.insertAdjacentHTML('beforeend',`<div class="more19" data-v19-moremenu><div class="more19-sheet"><div class="more19-head"><strong>Alle pagina's</strong><button data-v19-more>×</button></div>${pages19.filter(p=>!direct.has(p[0])).map(p=>`<button data-v19-go="${p[0]}"><span>${p[2]}</span><b>${p[1]}</b></button>`).join('')}</div></div>`);
}
function budgetPage19(){
  const b=data.budget||data.budget19||{income:0,expenses:[]};
  const expenses=Array.isArray(b.expenses)?b.expenses:[];
  const total=expenses.reduce((s,x)=>s+Number(x.amount||0),0), income=Number(b.income||0);
  return `<div class="page19"><div class="page19-head"><div><p class="eyebrow">GELD</p><h1>Budget</h1><p>Inkomsten, uitgaven en doelen op één plek.</p></div><button class="primary" data-v19-budget-add>+ Toevoegen</button></div>
  <div class="budget19-grid"><section class="card"><small>Inkomen</small><h2>€ ${income.toLocaleString('nl-NL')}</h2></section><section class="card"><small>Uitgaven</small><h2>€ ${total.toLocaleString('nl-NL')}</h2></section><section class="card"><small>Resterend</small><h2>€ ${(income-total).toLocaleString('nl-NL')}</h2></section></div>
  <section class="card"><div class="card-head"><h2>Uitgaven</h2></div>${expenses.length?expenses.map((x,i)=>`<div class="row19"><div><strong>${esc(x.title||x.category||'Uitgave')}</strong><small>${esc(x.category||'')}</small></div><b>€ ${Number(x.amount||0).toLocaleString('nl-NL')}</b><button data-v19-budget-edit="${i}">Bewerk</button></div>`).join(''):'<p class="muted">Nog geen budgetposten. Gebruik + Toevoegen.</p>'}</section></div>`;
}
function extraPage19(){
 return `<div class="page19"><div class="page19-head"><div><p class="eyebrow">HANDIGE TOOLS</p><h1>Extra</h1><p>Snelle toegang tot handige onderdelen.</p></div></div><div class="tools19">
 ${[['weather','☀️','Weer','Actueel weer op Today'],['daily','💡','Vraag van de dag','Leer elkaar beter kennen'],['calc','▦','Omrekenen','Valuta, maten en meer'],['floor','🏷️','Bodemprijzen','Boodschappen'],['links','🔗','Links','Handige websites'],['notes','▤','Notities','Snelle notities'],['docs','📁','Documenten',"PDF's en bestanden"],['contacts','👤','Contacten','Belangrijke nummers']].map(x=>`<button data-v19-tool="${x[0]}"><span>${x[1]}</span><strong>${x[2]}</strong><small>${x[3]}</small></button>`).join('')}</div></div>`;
}
function settingsPanel19(){
 if(current!=='settings')return;
 const v=document.querySelector('#view');if(!v||v.querySelector('[data-v19-device-settings]'))return;
 v.insertAdjacentHTML('afterbegin',`<section class="card device-settings19" data-v19-device-settings><div class="card-head"><div><p class="eyebrow">DIT APPARAAT</p><h2>Thema & weergave</h2></div><span class="tag">Niet gedeeld</span></div><p class="muted">Deze instellingen blijven alleen op dit apparaat. Daphne kan op haar telefoon dus een ander thema gebruiken.</p>
 <div class="settings-grid19"><label>Thema<select data-v19-theme><option value="system">Systeem</option><option value="light">Licht</option><option value="dark">Donker</option></select></label>
 <label>Accent<select data-v19-accent><option value="bluePurple">Blauw / paars</option><option value="blue">Blauw</option><option value="purple">Paars</option><option value="orange">Oranje</option></select></label>
 <label>Weergave<select data-v19-density><option value="comfortable">Ruim</option><option value="compact">Compact</option></select></label></div></section>`);
 v.querySelector('[data-v19-theme]').value=ui19.theme;v.querySelector('[data-v19-accent]').value=ui19.accent;v.querySelector('[data-v19-density]').value=ui19.density;
}
function editBudget19(index=null){
 data.budget ||= {income:0,expenses:[]}; data.budget.expenses ||= [];
 const old=index===null?{}:data.budget.expenses[index];
 const title=prompt('Naam',old.title||'');if(title===null)return;
 const amount=prompt('Bedrag (€)',old.amount??'');if(amount===null)return;
 const category=prompt('Categorie',old.category||'Overig');if(category===null)return;
 const item={...old,id:old.id||uid(),title,amount:Number(String(amount).replace(',','.'))||0,category};
 if(index===null)data.budget.expenses.push(item);else data.budget.expenses[index]=item;save();render();
}
function crossLinks19(){
  if(current!=='today')return;
  const v=document.querySelector('#view');if(!v)return;
  // Existing Today content remains source-of-truth; cards receive explicit navigation.
  v.querySelectorAll('[data-dashboard-v18] .today18,[data-dash18] .today18').forEach(x=>{x.dataset.v19Go='chores'});
  v.querySelectorAll('[data-dashboard-v18] .agenda18,[data-dash18] .agenda18').forEach(x=>{x.dataset.v19Go='planning'});
  v.querySelectorAll('[data-outfit18],[data-outfit-v18]').forEach(x=>{x.dataset.v19Tool='weather'});
}
const baseRender19=render;
render=function(...args){
 let r;
 if(current==='budget19'){document.querySelector('#view').innerHTML=budgetPage19();r=undefined}
 else if(current==='extra19'){document.querySelector('#view').innerHTML=extraPage19();r=undefined}
 else r=baseRender19(...args);
 requestAnimationFrame(()=>{nav19();settingsPanel19();crossLinks19();applyUi19()});
 return r;
};
document.addEventListener('click',e=>{
 const g=e.target.closest('[data-v19-go]');if(g){e.preventDefault();go19(g.dataset.v19Go);return}
 if(e.target.closest('[data-v19-more]')){e.preventDefault();more19();return}
 if(e.target.closest('[data-v19-budget-add]')){editBudget19();return}
 const be=e.target.closest('[data-v19-budget-edit]');if(be){editBudget19(Number(be.dataset.v19BudgetEdit));return}
 const tool=e.target.closest('[data-v19-tool]');if(tool){
   const t=tool.dataset.v19Tool;if(t==='weather'){go19('today');return}
   if(t==='floor'){go19('groceries');return}
   if(t==='daily'){go19('today');return}
   toast('Deze tool kan vanuit Extra verder worden uitgebreid.');return;
 }
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-v19-theme]')){ui19.theme=e.target.value;saveUi19()}
 if(e.target.matches('[data-v19-accent]')){ui19.accent=e.target.value;saveUi19()}
 if(e.target.matches('[data-v19-density]')){ui19.density=e.target.value;saveUi19()}
});
requestAnimationFrame(()=>{nav19();settingsPanel19();applyUi19()});
})();

/* =========================================================
   SAMEN THUIS v20 — GLASS THEME / DEVICE UI
   Alleen interfacevoorkeuren zijn apparaatgebonden.
   ========================================================= */
(() => {
'use strict';
if (window.__ST_V20__) return;
window.__ST_V20__ = true;

const KEY20 = 'samenThuisDeviceUiV20';
const FALLBACK20 = { theme:'system', accent:'purple', density:'comfortable' };

function get20(){
  try {
    const old = JSON.parse(localStorage.getItem('samenThuisDeviceUiV19') || '{}');
    const now = JSON.parse(localStorage.getItem(KEY20) || '{}');
    return {...FALLBACK20, ...old, ...now};
  } catch (_) { return {...FALLBACK20}; }
}
let ui20 = get20();

function apply20(){
  const systemDark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = ui20.theme === 'dark' || (ui20.theme === 'system' && systemDark);
  const html = document.documentElement;
  html.dataset.theme19 = dark ? 'dark' : 'light';
  html.dataset.theme20 = dark ? 'dark' : 'light';
  html.dataset.accent19 = ui20.accent || 'purple';
  html.dataset.accent20 = ui20.accent || 'purple';
  html.dataset.density19 = ui20.density || 'comfortable';
  html.dataset.density20 = ui20.density || 'comfortable';
  html.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#081b2d' : '#eef3f9');
}
function save20(){
  localStorage.setItem(KEY20, JSON.stringify(ui20));
  localStorage.setItem('samenThuisDeviceUiV19', JSON.stringify(ui20));
  apply20();
}
apply20();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => ui20.theme === 'system' && apply20()); } catch(_){}

function beautifySettings20(){
  if (typeof current === 'undefined' || current !== 'settings') return;
  const box = document.querySelector('[data-v19-device-settings]');
  if (!box) return;
  box.classList.add('glass20');
  const theme = box.querySelector('[data-v19-theme]');
  const accent = box.querySelector('[data-v19-accent]');
  const density = box.querySelector('[data-v19-density]');
  if(theme){ theme.value=ui20.theme; theme.onchange=()=>{ui20.theme=theme.value;save20()}; }
  if(accent){ accent.value=ui20.accent; accent.onchange=()=>{ui20.accent=accent.value;save20()}; }
  if(density){ density.value=ui20.density; density.onchange=()=>{ui20.density=density.value;save20()}; }
}

function dock20(){
  const mobile = document.querySelector('.mobile-nav,.bottom-nav');
  if(!mobile) return;
  mobile.classList.add('glass-dock20');
  const buttons = [...mobile.querySelectorAll('button')];
  buttons.forEach(b => b.classList.add('glass-dock-item20'));

  // Make the middle action a prominent glass + button without changing navigation data.
  let add = mobile.querySelector('[data-v20-add]');
  if(!add){
    add = document.createElement('button');
    add.type='button';
    add.dataset.v20Add='';
    add.className='glass-dock-item20 glass-add20';
    add.innerHTML='<span>＋</span><small>Toevoegen</small>';
    const more = mobile.querySelector('[data-v19-more]');
    mobile.insertBefore(add, more || null);
  }
}
function enhance20(){
  document.body.classList.add('st-glass20');
  apply20();
  beautifySettings20();
  dock20();
}

const previousRender20 = typeof render === 'function' ? render : null;
if(previousRender20){
  render = function(...args){
    const result = previousRender20(...args);
    requestAnimationFrame(enhance20);
    return result;
  };
}

document.addEventListener('click', e => {
  if(e.target.closest('[data-v20-add]')){
    const topAdd = [...document.querySelectorAll('button')].find(b =>
      !b.closest('.mobile-nav,.bottom-nav') && /toevoegen|\+\s*toevoegen/i.test(b.textContent || '')
    );
    if(topAdd) topAdd.click();
    else {
      const generic = document.querySelector('[data-add],[data-action="add"],.add-btn');
      generic?.click();
    }
  }
});
requestAnimationFrame(enhance20);
})();

/* ===== v21 TRUE GLASS DOCK ===== */
(()=>{'use strict';if(window.__ST21)return;window.__ST21=1;
const pages=[['today','⌂','Today'],['planning','▦','Agenda'],['meals','♨','Weekmenu'],['groceries','✓','Boodschappen'],['chores','⌁','Huishouden'],['stock','▤','Voorraad'],['trips','✈','Reizen'],['ideas','♡','Date ideeën'],['home','⌂','Woning'],['budget19','€','Budget'],['extra19','＋','Extra'],['settings','⚙','Instellingen']],direct=['today','planning','meals','groceries'];
function go(id){if(window.SamenThuisGo)SamenThuisGo(id);else{current=id;render()}}
function dock(){
 document.querySelectorAll('.mobile-nav,.bottom-nav').forEach(x=>x.classList.add('old21'));
 let n=document.querySelector('#dock21');if(!n){n=document.createElement('nav');n.id='dock21';n.className='dock21';document.body.append(n)}
 n.innerHTML=direct.map(id=>{let p=pages.find(x=>x[0]===id);return`<button data-go21="${id}" class="${current===id?'on':''}"><span>${p[1]}</span><small>${p[2]}</small></button>`}).join('')+`<button data-more21 class="${direct.includes(current)?'':'on'}"><span>•••</span><small>Meer</small></button>`;
 document.querySelectorAll('.sync-info,[class*="info-box"],[class*="sync-info"]').forEach(x=>x.classList.add('surface21'));
}
function sheet(){document.querySelector('#sheet21')?.remove();let w=document.createElement('div');w.id='sheet21';w.className='sheetwrap21';w.innerHTML=`<button class="shade21" data-close21></button><section class="sheet21"><header><div><small>SNEL NAAR</small><strong>Alle pagina's</strong></div><button data-close21>×</button></header><div>${pages.filter(p=>!direct.includes(p[0])).map(p=>`<button data-go21="${p[0]}" class="${current===p[0]?'on':''}"><span>${p[1]}</span><b>${p[2]}</b></button>`).join('')}</div></section>`;document.body.append(w)}
const rr=render;render=function(...a){let x=rr(...a);requestAnimationFrame(dock);return x};
document.addEventListener('click',e=>{let g=e.target.closest('[data-go21]');if(g){e.preventDefault();document.querySelector('#sheet21')?.remove();go(g.dataset.go21);return}if(e.target.closest('[data-more21]')){e.preventDefault();sheet();return}if(e.target.closest('[data-close21]'))document.querySelector('#sheet21')?.remove()});
requestAnimationFrame(dock);
})();

/* Samen Thuis v21.6 · build 2026-09-16 22:xx · app.js volledig opnieuw uitgegeven */

/* v21.7 fresh build: 2026-09-16 20:58:16 +0000 */

/* v21.8 build 2026-09-16 21:01:28 +0000 */


/* =========================================================
   SAMEN THUIS v23 — GEÏNTEGREERDE MOBIELE NAVIGATIE + BUDGET
   Eén implementatie; geen v21.9/v22 render-wrappers.
   ========================================================= */
(()=>{
'use strict';
if(window.__ST_V23__) return; window.__ST_V23__=true;

const NAV23=[
 ['today','⌂','Today'],['planning','▦','Agenda'],['meals','♨','Weekmenu'],
 ['groceries','✓','Boodschappen'],['chores','⌁','Huishouden'],['stock','▤','Voorraad'],
 ['trips','✈','Reizen'],['ideas','♡','Date ideeën'],['home','⌂','Woning'],
 ['budget19','€','Budget'],['extra19','＋','Extra'],['settings','⚙','Instellingen']
];

const DEFAULT_BUDGET23={
 incomes:{Kees:2731,Daphne:3427},
 contributionPct:75,
 houseBudget:1000,
 houseCategories:[
  {id:'hb-groceries',title:'Boodschappen',amount:650},
  {id:'hb-household',title:'Huishouden',amount:125},
  {id:'hb-home',title:'Woning',amount:125},
  {id:'hb-other',title:'Overig gezamenlijk',amount:100}
 ],
 investing:75,
 fixed:[
  ['Huur',1170.11,'maand'],['Eneco',101,'maand'],['Evides',20,'maand'],
  ['Odido',40.52,'maand'],['Vodafone',22.33,'maand'],['Gym',27.99,'maand'],
  ['Univé',181.19,'maand'],['Zorgverzekering',184.50,'maand'],
  ['Scooterverzekering',33.15,'maand'],['Netflix',6.30,'maand'],
  ['Rabobank',5.95,'maand'],['Parkeervergunning',35.20,'maand'],
  ['Wegenbelasting Daphne',62.67,'maand'],['Wegenbelasting Kees',33,'maand']
 ].map((x,i)=>({id:`fixed23-${i}`,title:x[0],amount:x[1],period:x[2]})),
 goals:[
  {id:'buffer23',title:'Buffer',target:3000,current:1000,monthly:150,deadline:'',recurring:false},
  {id:'vacation23',title:'Vakantie',target:5000,current:0,monthly:416.67,deadline:'Jaarlijks',recurring:true},
  {id:'home23',title:'Huis',target:15000,current:0,monthly:1000,deadline:'2027-12-31',recurring:false},
  {id:'other23',title:'Overig',target:10000,current:0,monthly:0,deadline:'',recurring:false}
 ]
};
const clone23=x=>JSON.parse(JSON.stringify(x));
function budget23(){
 if(!data.budgetV23){
   const old=data.budget219||data.budgetV22||null;
   data.budgetV23=clone23(DEFAULT_BUDGET23);
   if(old){
    if(old.incomes) data.budgetV23.incomes={...data.budgetV23.incomes,...old.incomes};
    ['contributionPct','houseBudget','investing'].forEach(k=>{if(old[k]!=null)data.budgetV23[k]=Number(old[k])});
    if(Array.isArray(old.fixed)&&old.fixed.length)data.budgetV23.fixed=old.fixed.map(x=>({...x}));
    if(Array.isArray(old.goals)&&old.goals.length)data.budgetV23.goals=old.goals.map(x=>({...x}));
   }
   save({touch:false});
 }
 const b=data.budgetV23;
 b.incomes={...DEFAULT_BUDGET23.incomes,...(b.incomes||{})};
 b.fixed=Array.isArray(b.fixed)?b.fixed:clone23(DEFAULT_BUDGET23.fixed);
 b.goals=Array.isArray(b.goals)?b.goals:clone23(DEFAULT_BUDGET23.goals);
 b.houseCategories=Array.isArray(b.houseCategories)&&b.houseCategories.length?b.houseCategories:clone23(DEFAULT_BUDGET23.houseCategories);
 return b;
}
const n23=v=>Number(String(v??0).replace(',','.'))||0;
const eur23=v=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n23(v));
const pct23=v=>Math.max(0,Math.min(100,n23(v)));
const monthlyFixed23=x=>x.period==='jaar'?n23(x.amount)/12:x.period==='kwartaal'?n23(x.amount)/3:n23(x.amount);
function calcBudget23(){
 const b=budget23(),K=n23(b.incomes.Kees),D=n23(b.incomes.Daphne),rate=n23(b.contributionPct)/100;
 const fixed=b.fixed.reduce((s,x)=>s+monthlyFixed23(x),0);
 const saving=b.goals.reduce((s,x)=>s+n23(x.monthly),0);
 const investing=n23(b.investing),house=n23(b.houseBudget),income=K+D,contribution=income*rate;
 const needed=fixed+house+saving+investing,remainder=contribution-needed;
 const saved=b.goals.reduce((s,x)=>s+n23(x.current),0),targets=b.goals.reduce((s,x)=>s+n23(x.target),0);
 return {b,K,D,rate,fixed,saving,investing,house,income,contribution,needed,remainder,saved,targets,
  kContribution:K*rate,dContribution:D*rate,kPersonal:K*(1-rate),dPersonal:D*(1-rate),
  neededPct:income?needed/income*100:0};
}
function deadlineMonths23(deadline){
 if(!deadline||deadline==='Jaarlijks')return null;
 const d=new Date(deadline+'T12:00:00'),now=new Date();
 if(Number.isNaN(d.getTime()))return null;
 return Math.max(0,Math.ceil((d-now)/(30.4375*86400000)));
}
function goalStatus23(g){
 const left=Math.max(0,n23(g.target)-n23(g.current)),m=n23(g.monthly);
 const months=m>0?Math.ceil(left/m):null,deadline=deadlineMonths23(g.deadline);
 return {left,months,deadline,enough:deadline==null||left===0||(m>0&&months<=deadline)};
}
function donut23(value,max,label){
 const p=pct23(max?n23(value)/n23(max)*100:0),r=42,c=2*Math.PI*r,d=c*p/100;
 return `<div class="donut23"><svg viewBox="0 0 110 110"><circle class="ring-bg23" cx="55" cy="55" r="${r}"/><circle class="ring-value23" cx="55" cy="55" r="${r}" stroke-dasharray="${d} ${c-d}" transform="rotate(-90 55 55)"/></svg><div><b>${Math.round(p)}%</b><small>${esc(label)}</small></div></div>`;
}
function bars23(rows,stacked=false){
 const max=Math.max(1,...rows.flatMap(x=>[Math.abs(n23(x.value)),Math.abs(n23(x.value2))]));
 return `<div class="chart-bars23">${rows.map(x=>`<div class="chart-row23"><span>${esc(x.label)}</span><div class="chart-track23"><i style="width:${Math.max(x.value?2:0,Math.abs(n23(x.value))/max*100)}%"></i>${x.value2!=null?`<em style="width:${Math.max(x.value2?2:0,Math.abs(n23(x.value2))/max*100)}%"></em>`:''}</div><b>${eur23(x.value)}</b></div>`).join('')}</div>`;
}
function projection23(g){
 const st=goalStatus23(g),points=[],months=Math.min(24,Math.max(12,st.months||12));
 for(let i=0;i<=months;i+=Math.max(1,Math.ceil(months/8)))points.push({m:i,v:Math.min(n23(g.target),n23(g.current)+n23(g.monthly)*i)});
 if(points.at(-1)?.m!==months)points.push({m:months,v:Math.min(n23(g.target),n23(g.current)+n23(g.monthly)*months)});
 const max=Math.max(1,n23(g.target)),w=300,h=100,pad=12;
 const coords=points.map((p,i)=>`${pad+(w-2*pad)*(p.m/months)},${h-pad-(h-2*pad)*(p.v/max)}`).join(' ');
 return `<svg class="projection23" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"/><line x1="${pad}" y1="${pad}" x2="${w-pad}" y2="${pad}" class="target23"/><polyline points="${coords}"/></svg>`;
}
function renderBudget23(){
 const c=calcBudget23(),b=c.b;
 const goals=b.goals.map((g,i)=>{
  const st=goalStatus23(g);
  return `<article class="light-surface23 goal-card23">
   <header><div><small>SPAARDOEL</small><h3>${esc(g.title)}</h3><p>${esc(g.deadline||'Geen deadline')}</p></div><div><button data-budget23-goal="${i}">Bewerk</button><button class="danger23" data-budget23-delgoal="${i}">×</button></div></header>
   <div class="goal-visual23">${donut23(g.current,g.target,g.title)}<div><b>${eur23(g.current)} / ${eur23(g.target)}</b><span>Nog nodig ${eur23(st.left)}</span><span>${n23(g.monthly)>0?`${eur23(g.monthly)} per maand`:'Geen maandbedrag'}</span><span class="${st.enough?'ok23':'warn23'}">${st.months===0?'Doel bereikt':st.months?`Verwacht over ${st.months} maanden`:'Geen prognose'}${st.deadline!=null?` · ${st.enough?'op schema':'inleg te laag voor deadline'}`:''}</span></div></div>
   ${projection23(g)}
  </article>`;
 }).join('');
 const fixed=b.fixed.map((x,i)=>`<div class="light-surface23 fixed-row23"><div><b>${esc(x.title)}</b><small>${x.period==='jaar'?'Jaarlijks':x.period==='kwartaal'?'Per kwartaal':'Maandelijks'} · ${eur23(monthlyFixed23(x))}/mnd</small></div><strong>${eur23(x.amount)}</strong><button data-budget23-fixed="${i}">Bewerk</button><button class="danger23" data-budget23-delfixed="${i}">×</button></div>`).join('');
 const goalBars=b.goals.map(g=>({label:g.title,value:n23(g.current),value2:Math.max(0,n23(g.target)-n23(g.current))}));
 const money=[{label:'Vaste lasten',value:c.fixed},{label:'Huisbudget',value:c.house},{label:'Sparen',value:c.saving},{label:'Beleggen',value:c.investing},{label:'Resterend',value:Math.max(0,c.remainder)}];
 const house=b.houseCategories.map((x,i)=>`<label>${esc(x.title)}<input inputmode="decimal" data-budget23-house="${i}" value="${n23(x.amount)}"></label>`).join('');
 return `<div class="budget23">
  <header class="budget-title23"><p class="eyebrow">SAMEN THUIS · FINANCIËN</p><h1>Budgetdashboard</h1><p>Één maandberekening voor inkomen, lasten, sparen, beleggen en wat er overblijft.</p></header>
  <section class="kpis23">
   <article><small>NETTO INKOMEN</small><b>${eur23(c.income)}</b><span>samen per maand</span></article>
   <article><small>GEZAMENLIJKE AFDACHT</small><b>${eur23(c.contribution)}</b><span>${n23(b.contributionPct)}%</span></article>
   <article><small>MAANDELIJKS NODIG</small><b>${eur23(c.needed)}</b><span>benodigd ${c.neededPct.toFixed(1).replace('.',',')}%</span></article>
   <article class="${c.remainder<0?'negative23':'positive23'}"><small>${c.remainder<0?'TEKORT':'OVER'}</small><b>${eur23(Math.abs(c.remainder))}</b><span>na alle ingestelde posten</span></article>
   <article><small>SPAARGELD TOTAAL</small><b>${eur23(c.saved)}</b><span>van ${eur23(c.targets)}</span></article>
   <article><small>BELEGGEN</small><b>${eur23(c.investing)}</b><span>per maand</span></article>
  </section>

  <section class="budget-grid23">
   <article class="budget-sheet23"><header><div><small>INKOMEN & VERDELING</small><h2>Kees en Daphne</h2></div></header>
    <div class="people23"><div><b>Kees</b><strong>${eur23(c.K)}</strong><span>Gezamenlijk ${eur23(c.kContribution)}</span><span>Persoonlijk ${eur23(c.kPersonal)}</span></div><div><b>Daphne</b><strong>${eur23(c.D)}</strong><span>Gezamenlijk ${eur23(c.dContribution)}</span><span>Persoonlijk ${eur23(c.dPersonal)}</span></div></div>
    <div class="fields23"><label>Kees netto<input data-budget23-field="incomes.Kees" inputmode="decimal" value="${c.K}"></label><label>Daphne netto<input data-budget23-field="incomes.Daphne" inputmode="decimal" value="${c.D}"></label><label>Afdracht %<input data-budget23-field="contributionPct" inputmode="decimal" value="${n23(b.contributionPct)}"></label><label>Huisbudget<input data-budget23-field="houseBudget" inputmode="decimal" value="${c.house}"></label><label>Beleggen<input data-budget23-field="investing" inputmode="decimal" value="${c.investing}"></label></div>
   </article>
   <article class="budget-sheet23"><header><div><small>MAANDELIJKSE GELDVERDELING</small><h2>Waar gaat het heen?</h2></div></header>${bars23(money)}
    <div class="calc23"><span>Gezamenlijke afdracht <b>${eur23(c.contribution)}</b></span><span>Maandbehoefte <b>− ${eur23(c.needed)}</b></span><span class="total23">Resterend <b>${eur23(c.remainder)}</b></span></div>
   </article>
  </section>

  <section class="budget-sheet23"><header><div><small>SPAARDOELEN & PROGNOSE</small><h2>Voortgang</h2></div><button class="primary" data-budget23-addgoal>+ Spaardoel</button></header><div class="goals23">${goals}</div></section>

  <section class="budget-grid23">
   <article class="budget-sheet23"><header><div><small>SPAARGELD PER DOEL</small><h2>Gespaard versus nog nodig</h2></div></header><div class="legend23"><span><i></i>Gespaard</span><span><em></em>Nog nodig</span></div>${bars23(goalBars,true)}</article>
   <article class="budget-sheet23"><header><div><small>HUISBUDGET</small><h2>${eur23(c.house)} per maand</h2></div></header><div class="fields23 house-fields23">${house}</div><p class="muted">Subcategorieën zijn een verdeling binnen het huisbudget; het totaalbudget blijft leidend in de maandberekening.</p></article>
  </section>

  <section class="budget-sheet23"><header><div><small>VASTE LASTEN</small><h2>${eur23(c.fixed)} per maand</h2></div><button class="primary" data-budget23-addfixed>+ Vaste last</button></header><div class="fixed-list23">${fixed}</div></section>
 </div>`;
}
function setBudgetField23(path,value){
 const b=budget23(),p=path.split('.');
 if(p.length===2)b[p[0]][p[1]]=n23(value);else b[path]=n23(value);
 save();render();
}
function editFixed23(i){
 const b=budget23(),x=i==null?{id:id(),title:'Nieuwe vaste last',amount:0,period:'maand'}:b.fixed[i];
 const title=prompt('Naam vaste last',x.title);if(title===null)return;
 const amount=prompt('Bedrag',x.amount);if(amount===null)return;
 const period=prompt('Frequentie: maand, kwartaal of jaar',x.period||'maand');if(period===null)return;
 const item={...x,title:title.trim()||'Vaste last',amount:n23(amount),period:['maand','kwartaal','jaar'].includes(period.toLowerCase())?period.toLowerCase():'maand'};
 if(i==null)b.fixed.push(item);else b.fixed[i]=item;save();render();
}
function editGoal23(i){
 const b=budget23(),g=i==null?{id:id(),title:'Nieuw spaardoel',target:0,current:0,monthly:0,deadline:'',recurring:false}:b.goals[i];
 const title=prompt('Naam spaardoel',g.title);if(title===null)return;
 const target=prompt('Doelbedrag',g.target);if(target===null)return;
 const currentAmount=prompt('Huidig gespaard',g.current);if(currentAmount===null)return;
 const monthly=prompt('Maandelijkse inleg',g.monthly);if(monthly===null)return;
 const deadline=prompt('Deadline (YYYY-MM-DD), "Jaarlijks" of leeg',g.deadline||'');if(deadline===null)return;
 const item={...g,title:title.trim()||'Spaardoel',target:n23(target),current:n23(currentAmount),monthly:n23(monthly),deadline:deadline.trim(),recurring:/jaarlijks/i.test(deadline)};
 if(i==null)b.goals.push(item);else b.goals[i]=item;save();render();
}
function mobileNav23(){
 document.querySelectorAll('#dock21,#dock219,.dock21,.dock219,[data-v19-moremenu]').forEach(x=>x.remove());
 document.querySelectorAll('.mobile-nav,.bottom-nav').forEach(x=>x.classList.add('legacy-mobile23'));
 let nav=document.querySelector('#mobileNav23');
 if(!nav){nav=document.createElement('nav');nav.id='mobileNav23';nav.className='mobile-nav23';nav.setAttribute('aria-label','Pagina navigatie');document.body.append(nav)}
 nav.innerHTML=`<div class="mobile-nav-scroll23">${NAV23.map(([key,icon,label])=>`<button data-nav23="${key}" class="${current===key?'active':''}"><span>${icon}</span><small>${label}</small></button>`).join('')}</div>`;
 const active=nav.querySelector('.active');
 requestAnimationFrame(()=>active?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}));
}
function go23(view){
 current=view;
 if(view!=='budget19'&&view!=='extra19'&&sections[view]){setupNav();document.querySelector('#pageTitle').textContent=sections[view].label;document.querySelector('#addBtn').style.display=['today','settings'].includes(view)?'none':''}
 render();
}
window.SamenThuisGo=go23;

const baseRender23=render;
render=function(...args){
 if(current==='budget19'){document.querySelector('#view').innerHTML=renderBudget23();updateSyncBadge();}
 else baseRender23(...args);
 requestAnimationFrame(mobileNav23);
};

document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-nav23]');if(nav){e.preventDefault();go23(nav.dataset.nav23);return}
 if(e.target.closest('[data-budget23-addfixed]')){editFixed23(null);return}
 const ef=e.target.closest('[data-budget23-fixed]');if(ef){editFixed23(Number(ef.dataset.budget23Fixed));return}
 const df=e.target.closest('[data-budget23-delfixed]');if(df&&confirm('Deze vaste last verwijderen?')){budget23().fixed.splice(Number(df.dataset.budget23Delfixed),1);save();render();return}
 if(e.target.closest('[data-budget23-addgoal]')){editGoal23(null);return}
 const eg=e.target.closest('[data-budget23-goal]');if(eg){editGoal23(Number(eg.dataset.budget23Goal));return}
 const dg=e.target.closest('[data-budget23-delgoal]');if(dg&&confirm('Dit spaardoel verwijderen?')){budget23().goals.splice(Number(dg.dataset.budget23Delgoal),1);save();render();return}
});
document.addEventListener('change',e=>{
 const f=e.target.closest('[data-budget23-field]');if(f){setBudgetField23(f.dataset.budget23Field,f.value);return}
 const h=e.target.closest('[data-budget23-house]');if(h){budget23().houseCategories[Number(h.dataset.budget23House)].amount=n23(h.value);save();render();}
});
requestAnimationFrame(mobileNav23);
})();

/* v23.2 visual integration 2026-09-18 06:17:59 +0000 */


/* =========================================================
   v23.3 — mobiele navigatiepositie bewaren
   ========================================================= */
(() => {
  const NAV_POS_KEY = 'samenThuisMobileNavScrollV233';
  let restoringNav = false;

  function getNavScroller(){
    return document.querySelector('.mobile-nav-scroll23');
  }

  function saveNavPosition(){
    const scroller = getNavScroller();
    if (!scroller || restoringNav) return;
    try {
      sessionStorage.setItem(NAV_POS_KEY, String(scroller.scrollLeft || 0));
    } catch {}
  }

  function restoreNavPosition(){
    const scroller = getNavScroller();
    if (!scroller) return;
    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(NAV_POS_KEY) || 0);
    } catch {}
    restoringNav = true;
    requestAnimationFrame(() => {
      scroller.scrollLeft = saved;
      requestAnimationFrame(() => {
        scroller.scrollLeft = saved;
        restoringNav = false;
      });
    });
  }

  document.addEventListener('scroll', (event) => {
    if (event.target && event.target.classList &&
        event.target.classList.contains('mobile-nav-scroll23')) {
      saveNavPosition();
    }
  }, true);

  /* Vóór een navklik positie vastleggen. */
  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest && event.target.closest('.mobile-nav23 button')) {
      saveNavPosition();
    }
  }, true);

  /* Na iedere klik/rerender dezelfde positie terugzetten. */
  document.addEventListener('click', (event) => {
    if (event.target.closest && event.target.closest('.mobile-nav23 button')) {
      setTimeout(restoreNavPosition, 0);
      setTimeout(restoreNavPosition, 60);
    }
  }, true);

  /* MutationObserver vangt render() / innerHTML-vervanging van de balk af. */
  const observer = new MutationObserver(() => {
    if (getNavScroller()) restoreNavPosition();
  });

  function start(){
    observer.observe(document.body, {childList:true, subtree:true});
    restoreNavPosition();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }

  window.addEventListener('pageshow', restoreNavPosition);
})();


/* build v23.3 2026-09-18 07:18:05 +0000 */

/* =========================================================
   SAMEN THUIS v24 — AUTO / FUELNEST + OPEN-METEO LUCHT
   ========================================================= */
(()=>{
'use strict';
if(window.__ST_V24__)return;window.__ST_V24__=true;
sections.auto24={label:'Auto',icon:'⛽'};
data.cars ||= [];
data.fuelEntries ||= [];
const id24=()=>typeof uid==='function'?uid():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const num24=v=>Number(String(v??'').replace(',','.'))||0;
const euro24=v=>`€ ${num24(v).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date24=()=>typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);
let autoTab24='fills',statsPeriod24='year';
function ensureCar24(){data.cars ||= [];data.fuelEntries ||= [];}
function car24(id){ensureCar24();return data.cars.find(x=>x.id===id)||data.cars[0]||null}
function entries24(carId=''){return (data.fuelEntries||[]).filter(x=>!carId||x.carId===carId).sort((a,b)=>`${b.date||''}${b.odometer||0}`.localeCompare(`${a.date||''}${a.odometer||0}`))}
function calc24(carId){const a=entries24(carId).slice().sort((x,y)=>num24(x.odometer)-num24(y.odometer)||String(x.date).localeCompare(String(y.date)));let liters=0,cost=0,dist=0,segments=[];a.forEach(x=>{liters+=num24(x.liters);cost+=num24(x.total)});for(let i=1;i<a.length;i++){const d=num24(a[i].odometer)-num24(a[i-1].odometer);if(d>0&&!a[i].missedPrevious){dist+=d;segments.push({d,l:num24(a[i].liters),e:a[i]})}}const used=segments.reduce((s,x)=>s+x.l,0);return{liters,cost,dist,l100:dist?used/dist*100:0,kmL:used?dist/used:0,perKm:dist?cost/dist:0}}
function tabs24(){return `<div class="auto-tabs24">${[['fills','Tankbeurten'],['add','+ Tanken'],['cars','Voertuigen'],['stats','Statistieken']].map(x=>`<button data-auto24-tab="${x[0]}" class="${autoTab24===x[0]?'active':''}">${x[1]}</button>`).join('')}</div>`}
function fillRows24(){const rows=entries24();if(!rows.length)return '<div class="empty24">Nog geen tankbeurten. Voeg je eerste tankbeurt toe.</div>';let month='';return rows.map(x=>{const m=(x.date||'').slice(0,7);let h='';if(m!==month){month=m;const dt=new Date(`${m}-01T12:00:00`);const total=rows.filter(r=>(r.date||'').startsWith(m)).reduce((s,r)=>s+num24(r.total),0);h=`<div class="month24"><strong>${new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric'}).format(dt)}</strong><span>${euro24(total)}</span></div>`}return h+`<article class="fill24"><div class="fuel-dot24">⛽</div><div><strong>${esc(x.station||'Tankstation')}</strong><small>${esc(x.date||'')} · ${esc(x.fuelGrade||'E10')} · ${num24(x.liters).toLocaleString('nl-NL',{maximumFractionDigits:2})} L</small><small>${num24(x.odometer).toLocaleString('nl-NL')} km${x.partialFill?' · deelvulling':''}</small></div><div class="fill-money24"><strong>${euro24(x.total)}</strong><small>${euro24(x.pricePerLiter)}/L</small><button data-auto24-edit="${x.id}">Bewerk</button></div></article>`}).join('')}
function fillForm24(edit=null){ensureCar24();const x=edit||{};if(!data.cars.length)return `<section class="card"><h3>Nog geen voertuig</h3><p>Voeg eerst een voertuig toe. Merk, model, kleur en APK worden daarna automatisch bij RDW opgehaald.</p><button class="primary" data-auto24-newcar>+ Voertuig toevoegen</button></section>`;return `<form class="fuel-form24" data-fuel24-form data-edit-id="${x.id||''}"><div class="form-grid24"><label>Voertuig<select name="carId">${data.cars.map(c=>`<option value="${c.id}" ${x.carId===c.id?'selected':''}>${esc(c.name||c.plate||'Auto')}</option>`).join('')}</select></label><label>Datum<input name="date" type="date" required value="${x.date||date24()}"></label><label>Kilometerstand<input name="odometer" type="number" step="1" required value="${x.odometer??''}"></label><label>Liters<input name="liters" type="number" step="0.01" required value="${x.liters??''}"></label><label>Totaalbedrag €<input name="total" type="number" step="0.01" value="${x.total??''}"></label><label>Prijs per liter €<input name="pricePerLiter" type="number" step="0.001" value="${x.pricePerLiter??''}"></label><label>Brandstof<select name="fuelGrade">${['E10','E5','Diesel','LPG','Anders'].map(v=>`<option ${x.fuelGrade===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Tankstation<input name="station" value="${esc(x.station||'')}"></label><label class="check24"><input name="partialFill" type="checkbox" ${x.partialFill?'checked':''}> Deelvulling</label><label class="check24"><input name="missedPrevious" type="checkbox" ${x.missedPrevious?'checked':''}> Vorige tankbeurt gemist</label><label class="span24">Notitie<textarea name="note">${esc(x.note||'')}</textarea></label></div><div class="form-actions24"><button class="primary" type="submit">${edit?'Wijzigingen opslaan':'Tankbeurt opslaan'}</button>${edit?`<button type="button" class="danger24" data-auto24-delete="${x.id}">Verwijderen</button>`:''}</div></form>`}
function cars24(){ensureCar24();if(!data.cars.length)return `<section class="card empty-car24"><h3>Nog geen voertuigen</h3><p>Voer alleen het kenteken in. Samen Thuis haalt merk, model, kleur en APK automatisch op bij RDW Open Data.</p><button class="primary" data-auto24-newcar>+ Voertuig toevoegen</button></section>`;return `<div class="car-grid24">${data.cars.map(c=>{const st=calc24(c.id),last=entries24(c.id)[0],odo=last?num24(last.odometer):0;return `<article class="car24"><div><small>${c.isDefault?'STANDAARDVOERTUIG':'VOERTUIG'}</small><h3>${esc(c.name||[c.make,c.model].filter(Boolean).join(' ')||'Auto')}</h3><p>${esc([c.make,c.model,c.year].filter(Boolean).join(' · '))}</p><b>${esc(c.plate||'Geen kenteken')}</b>${c.owner?`<p class="rdw-meta24"><span>Eigenaar</span><strong>${esc(c.owner)}</strong></p>`:''}${c.color?`<p class="rdw-meta24"><span>Kleur</span><strong>${esc(c.color)}</strong></p>`:''}${c.tankLiters?`<p class="rdw-meta24"><span>Tankinhoud</span><strong>${num24(c.tankLiters).toLocaleString('nl-NL')} L</strong></p>`:''}${odo?`<p class="rdw-meta24"><span>Laatste km-stand</span><strong>${Math.round(odo).toLocaleString('nl-NL')} km</strong></p>`:''}${c.apkExpiry?`<p class="rdw-meta24"><span>APK geldig t/m</span><strong>${fmtDate(c.apkExpiry,{day:'numeric',month:'long',year:'numeric'})}</strong></p>`:''}</div><div class="car-stats24"><span><b>${st.l100?st.l100.toFixed(1):'—'}</b><small>L/100 km</small></span><span><b>${euro24(st.cost)}</b><small>totaal</small></span><span><b>${Math.round(st.dist).toLocaleString('nl-NL')}</b><small>km gemeten</small></span></div><div class="car-actions24"><button data-auto24-car="${c.id}">Bewerk / RDW vernieuwen</button><button class="danger24" data-auto24-deletecar="${c.id}">Voertuig verwijderen</button></div></article>`}).join('')}</div><button class="primary" data-auto24-newcar>+ Voertuig toevoegen</button>`}
function filtered24(){const now=new Date();return entries24().filter(x=>{const d=new Date(`${x.date}T12:00:00`);if(statsPeriod24==='week')return now-d<=7*864e5;if(statsPeriod24==='month')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();return now-d<=365*864e5})}
function statRows24(){
  const rows=filtered24().slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return rows;
}
function monthCost24(rows){
  const m={};rows.forEach(x=>{const k=(x.date||'').slice(0,7);if(k)m[k]=(m[k]||0)+num24(x.total)});
  return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0]));
}
function weekdayCost24(rows){
  const names=['Zo','Ma','Di','Wo','Do','Vr','Za'],v=Array(7).fill(0);
  rows.forEach(x=>{const d=new Date(`${x.date}T12:00:00`);if(!isNaN(d))v[d.getDay()]+=num24(x.total)});
  return [1,2,3,4,5,6,0].map(i=>[names[i],v[i]]);
}
function economySegments24(){
  const out=[];(data.cars||[]).forEach(c=>{const a=entries24(c.id).slice().sort((x,y)=>num24(x.odometer)-num24(y.odometer)||String(x.date).localeCompare(String(y.date)));for(let i=1;i<a.length;i++){const d=num24(a[i].odometer)-num24(a[i-1].odometer),l=num24(a[i].liters);if(d>0&&l>0&&!a[i].missedPrevious&&!a[i].partialFill)out.push({l100:l/d*100,date:a[i].date})}});return out}
function streak24(){
  const months=[...new Set(entries24().map(x=>(x.date||'').slice(0,7)).filter(Boolean))].sort();let best=0,run=0,prev=null;
  months.forEach(k=>{const [y,m]=k.split('-').map(Number),n=y*12+m;if(prev!==null&&n===prev+1)run++;else run=1;best=Math.max(best,run);prev=n});return best
}
function bars24(rows,cls=''){
  const max=Math.max(1,...rows.map(x=>x[1]));return `<div class="chart-bars24 ${cls}">${rows.map(([label,val])=>`<div class="chart-col24"><div class="chart-value24">${val?euro24(val):''}</div><div class="chart-track24"><i style="height:${val?Math.max(5,val/max*100):0}%"></i></div><small>${esc(label)}</small></div>`).join('')}</div>`
}
function consistency24(){
  const dates=new Set(entries24().map(x=>x.date).filter(Boolean));const today=new Date(),cells=[];for(let i=83;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);cells.push(`<i class="${dates.has(k)?'hit':''}" title="${k}"></i>`)}return `<div class="heat24">${cells.join('')}</div>`
}
function stats24(){
  const e=statRows24(),cost=e.reduce((s,x)=>s+num24(x.total),0),lit=e.reduce((s,x)=>s+num24(x.liters),0),all=calc24('');
  const stations={};e.forEach(x=>stations[x.station||'Onbekend']=(stations[x.station||'Onbekend']||0)+num24(x.total));
  const top=Object.entries(stations).sort((a,b)=>b[1]-a[1]).slice(0,6),monthly=monthCost24(e),weekdays=weekdayCost24(e);
  const cheapest=entries24().filter(x=>num24(x.pricePerLiter)>0).sort((a,b)=>num24(a.pricePerLiter)-num24(b.pricePerLiter))[0];
  const biggest=entries24().slice().sort((a,b)=>num24(b.liters)-num24(a.liters))[0],seg=economySegments24(),best=seg.slice().sort((a,b)=>a.l100-b.l100)[0],worst=seg.slice().sort((a,b)=>b.l100-a.l100)[0];
  const annual=statsPeriod24==='year'?cost:statsPeriod24==='month'?cost*12:cost*52;
  return `<div class="period24">${[['week','Week'],['month','Maand'],['year','Jaar']].map(x=>`<button data-auto24-period="${x[0]}" class="${statsPeriod24===x[0]?'active':''}">${x[1]}</button>`).join('')}</div>
  <div class="stats-hero24"><div><small>Totaal uitgegeven</small><strong>${euro24(cost)}</strong></div><div><small>Totaal brandstof</small><strong>${lit.toFixed(1)} L</strong></div><div><small>Gem. verbruik</small><strong>${all.l100?all.l100.toFixed(1):'—'} L/100km</strong></div><div><small>Totale afstand</small><strong>${Math.round(all.dist).toLocaleString('nl-NL')} km</strong></div></div>
  <section class="card stats-card24"><h3>Kosten over tijd</h3>${monthly.length?bars24(monthly.map(([k,v])=>[new Intl.DateTimeFormat('nl-NL',{month:'short'}).format(new Date(`${k}-01T12:00:00`)),v]),'months24'):'<p class="muted">Nog geen gegevens.</p>'}</section>
  <section class="card stats-card24"><h3>Uitgaven per weekdag</h3>${bars24(weekdays,'weekdays24')}</section>
  <section class="card stats-card24"><h3>Uitgaven per tankstation</h3>${top.length?top.map(([n,v])=>`<div class="barrow24"><span>${esc(n)}</span><div><i style="width:${Math.max(6,v/top[0][1]*100)}%"></i></div><b>${euro24(v)}</b></div>`).join(''):'<p class="muted">Nog geen gegevens.</p>'}</section>
  <section class="card stats-card24"><h3>Tankbeurt-consistentie</h3><p class="muted">Tankmomenten van de afgelopen 12 weken.</p>${consistency24()}</section>
  <div class="projection24"><article class="card"><small>Geschatte jaarkosten</small><strong>${euro24(annual)}</strong><p>Gebaseerd op de geselecteerde periode.</p></article><article class="card"><small>Kosten per kilometer</small><strong>${all.perKm?euro24(all.perKm)+'/km':'—'}</strong><p>Op basis van geregistreerde tankbeurten.</p></article></div>
  <section class="card records24"><h3>Records</h3><div><span>🏆 Beste verbruik</span><b>${best?best.l100.toFixed(1)+' L/100km':'—'}</b></div><div><span>↗ Slechtste verbruik</span><b>${worst?worst.l100.toFixed(1)+' L/100km':'—'}</b></div><div><span>🏷 Laagste literprijs</span><b>${cheapest?euro24(cheapest.pricePerLiter)+'/L':'—'}</b></div><div><span>⛽ Grootste tankbeurt</span><b>${biggest?num24(biggest.liters).toFixed(1)+' L':'—'}</b></div><div><span>🔥 Langste reeks</span><b>${streak24()||'—'}${streak24()?` maand${streak24()===1?'':'en'}`:''}</b></div></section>`
}
function autoPage24(){ensureCar24();return `<div class="auto24"><header class="auto-head24"><div><p class="eyebrow">AUTO & BRANDSTOF</p><h1>Auto</h1><p>Tankbeurten, voertuigen en verbruik in één overzicht.</p></div></header>${tabs24()}<section class="auto-body24">${autoTab24==='fills'?fillRows24():autoTab24==='add'?fillForm24():autoTab24==='cars'?cars24():stats24()}</section></div>`}
function plate24(v=''){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function rdwDate24(v){const x=String(v||'').replace(/\D/g,'');return x.length===8?`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)}`:''}
function apkAgenda24(c){
  if(!c?.id)return;
  data.planning ||= [];
  data.planning=data.planning.filter(x=>x.autoApkCarId!==c.id);
  if(!c.apkExpiry)return;
  const title=`APK ${c.plate||c.name||'voertuig'}`;
  data.planning.push({id:id(),title,date:c.apkExpiry,time:'',endTime:'',person:'Samen',calendarId:'persoonlijk',autoApkCarId:c.id,autoApkType:'expiry'});
  const d=new Date(`${c.apkExpiry}T12:00:00`);d.setDate(d.getDate()-30);
  const reminder=d.toISOString().slice(0,10);
  if(reminder>=todayISO())data.planning.push({id:id(),title:`Herinnering: ${title} verloopt over 30 dagen`,date:reminder,time:'',endTime:'',person:'Samen',calendarId:'persoonlijk',autoApkCarId:c.id,autoApkType:'reminder'});
}
async function rdw24(plate){
  const k=plate24(plate);if(!k)throw new Error('Vul een kenteken in');
  const r=await fetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${encodeURIComponent(k)}`,{headers:{Accept:'application/json'},cache:'no-store'});
  if(!r.ok)throw new Error('RDW is tijdelijk niet bereikbaar');
  const rows=await r.json();if(!rows?.length)throw new Error('Kenteken niet gevonden bij RDW');
  const x=rows[0];
  return {plate:k,make:x.merk||'',model:x.handelsbenaming||'',color:[x.eerste_kleur,x.tweede_kleur].filter(v=>v&&v!=='Niet geregistreerd').join(' / '),apkExpiry:rdwDate24(x.vervaldatum_apk),year:String(x.datum_eerste_toelating||'').slice(0,4)};
}
async function editCar24(carId=''){
  ensureCar24();
  const existing=carId?data.cars.find(x=>x.id===carId):null;
  const input=prompt(existing?'Kenteken controleren/wijzigen':'Kenteken van het voertuig',existing?.plate||'');
  if(input===null)return;
  const plate=plate24(input);if(!plate)return toast('Vul een kenteken in');
  toast('Voertuiggegevens ophalen bij RDW…');
  try{
    const info=await rdw24(plate);
    const c=existing||{id:id24(),name:'',isDefault:data.cars.length===0};
    Object.assign(c,info);c.name=[info.make,info.model].filter(Boolean).join(' ')||plate;
    const owner=prompt('Eigenaar van het voertuig',c.owner||'');if(owner!==null)c.owner=owner.trim();
    const tank=prompt('Tankinhoud in liters (optioneel)',c.tankLiters||'');if(tank!==null&&tank.trim()!=='')c.tankLiters=Math.max(0,num24(tank.replace(',','.')));
    if(!existing)data.cars.push(c);
    apkAgenda24(c);save();render();
    toast(info.apkExpiry?'RDW-gegevens geladen · APK staat ook in Agenda':'RDW-gegevens geladen · geen APK-datum beschikbaar');
  }catch(err){toast(err?.message||'RDW-gegevens konden niet worden opgehaald')}
}
function deleteCar24(carId){
  const c=data.cars.find(x=>x.id===carId);if(!c)return;
  const fills=(data.fuelEntries||[]).filter(x=>x.carId===carId).length;
  const msg=fills?`Voertuig ${c.plate||c.name} verwijderen? De ${fills} gekoppelde tankbeurt${fills===1?'':'en'} worden ook verwijderd.`:`Voertuig ${c.plate||c.name} verwijderen?`;
  if(!confirm(msg))return;
  data.cars=data.cars.filter(x=>x.id!==carId);
  data.fuelEntries=(data.fuelEntries||[]).filter(x=>x.carId!==carId);
  data.planning=(data.planning||[]).filter(x=>x.autoApkCarId!==carId);
  if(c.isDefault&&data.cars[0])data.cars[0].isDefault=true;
  save();render();toast('Voertuig verwijderd');
}
function nav24(){const desktop=document.querySelector('.sidebar nav');if(desktop&&!desktop.querySelector('[data-v24-auto]')){const settings=desktop.querySelector('[data-v19-go="settings"], [data-view="settings"]');const b=document.createElement('button');b.className='nav-item';b.dataset.v24Auto='';b.innerHTML='<span>⛽</span>Auto';desktop.insertBefore(b,settings||null)}const scroll=document.querySelector('.mobile-nav-scroll23');if(scroll&&!scroll.querySelector('[data-v24-auto]')){const b=document.createElement('button');b.dataset.v24Auto='';b.className=current==='auto24'?'active':'';b.innerHTML='<span>⛽</span><small>Auto</small>';scroll.append(b)}}

// Open-Meteo Air Quality API: pollen + luchtkwaliteit naast het bestaande Open-Meteo weer.
const AQ24='stAirQualityV24';
function level24(v){v=num24(v);return v>=50?'Hoog':v>=10?'Verhoogd':v>0?'Laag':'Zeer laag'}
function aqiText24(v){v=num24(v);return v<=20?'Goed':v<=40?'Redelijk':v<=60?'Matig':v<=80?'Slecht':'Zeer slecht'}
async function air24(force=false){if(current!=='today')return;const dash=document.querySelector('[data-dash18]');if(!dash)return;let card=dash.querySelector('[data-air24]');if(!card){card=document.createElement('section');card.className='air24';card.dataset.air24='';const grid=dash.querySelector('.dg18');grid?.append(card)}if(!card)return;card.innerHTML='<strong>Pollen & luchtkwaliteit</strong><p class="muted">Open-Meteo ophalen…</p>';try{let q=null;if(!force)try{const c=JSON.parse(localStorage.getItem(AQ24)||'null');if(c&&Date.now()-c.t<1800000)q=c.q}catch(_){}if(!q){const u=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');u.searchParams.set('latitude','51.9225');u.searchParams.set('longitude','4.47917');u.searchParams.set('current','european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen');u.searchParams.set('timezone','Europe/Amsterdam');const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw 0;q=await r.json();localStorage.setItem(AQ24,JSON.stringify({t:Date.now(),q}))}const c=q.current||{};const pol=[['Gras',c.grass_pollen],['Berk',c.birch_pollen],['Els',c.alder_pollen],['Bijvoet',c.mugwort_pollen],['Ambrosia',c.ragweed_pollen]].sort((a,b)=>num24(b[1])-num24(a[1]));card.innerHTML=`<div class="air-head24"><div><small>OPEN-METEO · ROTTERDAM</small><h3>Pollen & luchtkwaliteit</h3></div><button data-air24-refresh>↻</button></div><div class="aqi24"><span class="aqi-badge24">AQI ${Math.round(num24(c.european_aqi))}</span><div><strong>${aqiText24(c.european_aqi)}</strong><small>PM2.5 ${num24(c.pm2_5).toFixed(1)} · PM10 ${num24(c.pm10).toFixed(1)} µg/m³</small></div></div><div class="pollen-grid24">${pol.map(([n,v])=>`<div><span>${n}</span><b>${level24(v)}</b><small>${num24(v).toFixed(1)} gr/m³</small></div>`).join('')}</div><p class="air-note24">Indicatie van omgevingswaarden; geen persoonlijk medisch advies.</p>`}catch(_){card.innerHTML='<strong>Pollen & luchtkwaliteit</strong><p>Gegevens tijdelijk niet beschikbaar. <button class="text-btn" data-air24-refresh>Opnieuw</button></p>'}}
const baseRender24=render;render=function(...args){if(current==='auto24'){document.querySelector('#view').innerHTML=autoPage24();updateSyncBadge();requestAnimationFrame(nav24);return}const r=baseRender24(...args);requestAnimationFrame(()=>{nav24();air24()});return r};
document.addEventListener('click',e=>{if(e.target.closest('[data-v24-auto]')){current='auto24';render();return}const t=e.target.closest('[data-auto24-tab]');if(t){autoTab24=t.dataset.auto24Tab;render();return}const ed=e.target.closest('[data-auto24-edit]');if(ed){autoTab24='add';document.querySelector('#view').innerHTML=`<div class="auto24"><header class="auto-head24"><div><p class="eyebrow">AUTO & BRANDSTOF</p><h1>Tankbeurt bewerken</h1></div></header>${tabs24()}<section class="auto-body24">${fillForm24(data.fuelEntries.find(x=>x.id===ed.dataset.auto24Edit))}</section></div>`;return}const del=e.target.closest('[data-auto24-delete]');if(del&&confirm('Tankbeurt verwijderen?')){data.fuelEntries=data.fuelEntries.filter(x=>x.id!==del.dataset.auto24Delete);save();autoTab24='fills';render();return}const ca=e.target.closest('[data-auto24-car]');if(ca){editCar24(ca.dataset.auto24Car);return}if(e.target.closest('[data-auto24-newcar]')){editCar24();return}const dc=e.target.closest('[data-auto24-deletecar]');if(dc){deleteCar24(dc.dataset.auto24Deletecar);return}const p=e.target.closest('[data-auto24-period]');if(p){statsPeriod24=p.dataset.auto24Period;render();return}if(e.target.closest('[data-air24-refresh]'))air24(true)});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-fuel24-form]');if(!f)return;e.preventDefault();const fd=new FormData(f),lit=num24(fd.get('liters'));let total=num24(fd.get('total')),price=num24(fd.get('pricePerLiter'));if(!total&&price&&lit)total=price*lit;if(!price&&total&&lit)price=total/lit;const old=data.fuelEntries.find(x=>x.id===f.dataset.editId)||{};const item={...old,id:old.id||id24(),carId:String(fd.get('carId')),date:String(fd.get('date')),odometer:num24(fd.get('odometer')),liters:lit,total,pricePerLiter:price,fuelGrade:String(fd.get('fuelGrade')),station:String(fd.get('station')||''),partialFill:fd.has('partialFill'),missedPrevious:fd.has('missedPrevious'),note:String(fd.get('note')||'')};if(old.id)Object.assign(old,item);else data.fuelEntries.push(item);save();autoTab24='fills';render();toast('Tankbeurt opgeslagen')});
ensureCar24();save({touch:false,sync:false});requestAnimationFrame(()=>{nav24();air24()});
})();

/* build v24.2 · FuelMate stats/charts + vehicle owner/tank capacity + RDW/APK */


/* ===== v24.3 CENTRALE IMPORTPAGINA ===== */
(()=>{'use strict';if(window.__ST243IMPORT)return;window.__ST243IMPORT=1;
let importTarget243='backup', importFile243=null;

const IMPORT243={
 backup:{label:'Volledige Samen Thuis back-up',formats:'JSON',example:'samen-thuis-backup-2026-09-24.json',help:'Herstelt de volledige app. Gebruik een JSON-back-up die door Samen Thuis zelf is gemaakt.'},
 planning:{label:'Agenda',formats:'CSV · TXT · JSON',example:'title,date,time,endTime,person,calendarId\nTandarts,2026-10-02,09:30,10:00,Kees,persoonlijk',help:'Velden: title, date (YYYY-MM-DD), time, endTime, person, calendarId.'},
 meals:{label:'Weekmenu',formats:'CSV · TXT · JSON',example:'title,date,type\nCurry,2026-09-25,Avondeten',help:'Velden: title, date (YYYY-MM-DD), type.'},
 groceries:{label:'Boodschappen',formats:'CSV · TXT · JSON',example:'title,category,done\nSpinazie,Groente,false',help:'Velden: title, category, done.'},
 chores:{label:'Huishouden',formats:'CSV · TXT · JSON',example:'title,category,repeat,person,due\nBadkamer schoonmaken,Badkamer,Wekelijks,Samen,2026-09-26',help:'Velden: title, category, repeat, person, due.'},
 stock:{label:'Voorraad',formats:'CSV · TXT · JSON',example:'title,category,amount,unit,min\nRijst,Voorraadkast,2,pakken,1',help:'Velden: title, category, amount, unit, min.'},
 trips:{label:'Reizen',formats:'CSV · TXT · JSON',example:'title,type,date,note\nHotel Hanoi,Verblijf,2027-01-11,Inchecken',help:'Velden: title, type, date, note. Bestaande reismappen kunnen daarna in Reizen verder worden ingedeeld.'},
 ideas:{label:'Date ideeën',formats:'CSV · TXT · JSON',example:'title,category,note\nMuseum,Uitje,Weekend',help:'Velden: title, category, note.'},
 home:{label:'Woning',formats:'CSV · TXT · JSON',example:'title,category,note\nKit badkamer vervangen,Badkamer,Controleren',help:'Velden: title, category, note.'},
 budget:{label:'Budget',formats:'JSON',example:'{"incomes":{"Kees":0,"Daphne":0},"fixed":[],"goals":[],"contributionPct":75,"houseBudget":1000,"investing":75}',help:'JSON-object met incomes, fixed, goals, contributionPct, houseBudget en investing.'},
 auto:{label:'Auto / FuelMate',formats:'FuelMate JSON · CSV · Samen Thuis JSON',example:'FuelMate: fuelmate_backup_YYYY-MM-DD.json\nCSV tankbeurten: date,odometer,volume,totalCost,station,partial,missedFill',help:'FuelMate JSON importeert voertuigen én tankbeurten. Een CSV importeert tankbeurten; als er één voertuig is wordt dat automatisch gebruikt.'}
};

function esc243(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderImport243(){
 const x=IMPORT243[importTarget243]||IMPORT243.backup;
 return `<div class="import243">
 <header class="import-head243"><div><p class="eyebrow">SAMEN THUIS · IMPORT</p><h1>Importeren</h1><p>Alle imports op één plek. Kies eerst waarvoor de informatie bedoeld is; hieronder staat precies welk formaat wordt verwacht.</p></div></header>
 <section class="card import-main243">
  <div class="form-grid">
   <label class="field"><span>Wat wil je importeren?</span><select data-import243-target>${Object.entries(IMPORT243).map(([k,v])=>`<option value="${k}" ${k===importTarget243?'selected':''}>${esc243(v.label)}</option>`).join('')}</select></label>
   <label class="field"><span>Bestand</span><input data-import243-file type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain"></label>
  </div>
  <div class="format243"><div><small>TOEGESTAAN FORMAAT</small><strong>${esc243(x.formats)}</strong><p>${esc243(x.help)}</p></div><pre>${esc243(x.example)}</pre></div>
  <div class="button-row"><button class="primary" data-import243-run ${importFile243?'':'disabled'}>Importeren</button><button class="secondary" data-import243-template>Voorbeeldbestand downloaden</button></div>
  ${importFile243?`<p class="muted">Gekozen: <strong>${esc243(importFile243.name)}</strong></p>`:''}
 </section>
 <section class="card">
  <div class="card-head"><div><p class="eyebrow">FORMAATOVERZICHT</p><h2>Wat kan waar worden ingelezen?</h2></div></div>
  <div class="format-list243">${Object.entries(IMPORT243).map(([k,v])=>`<button data-import243-jump="${k}"><span>${esc243(v.label)}</span><b>${esc243(v.formats)}</b></button>`).join('')}</div>
  <p class="muted">PDF, Word en Excel worden bewust niet als universeel importformaat gebruikt: CSV/JSON is controleerbaarder en voorkomt dat kolommen verkeerd worden geïnterpreteerd. Excel kun je eerst opslaan als CSV.</p>
 </section>
 </div>`;
}
function csv243(text){
 const lines=String(text).replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n').filter(x=>x.trim());
 if(!lines.length)return[];
 const delim=lines[0].includes(';')?';':lines[0].includes('\t')?'\t':',';
 const parse=line=>{let out=[],cur='',q=false;return out};
 function row(line){const a=[];let c='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++}else q=!q}else if(ch===delim&&!q){a.push(c.trim());c=''}else c+=ch}a.push(c.trim());return a}
 const h=row(lines[0]).map(x=>x.trim());
 return lines.slice(1).map(line=>{const vals=row(line),o={};h.forEach((k,i)=>o[k]=vals[i]??'');return o});
}
function bool243(v){return ['1','true','ja','yes','x','✓'].includes(String(v||'').trim().toLowerCase())}
function num243(v){return Number(String(v??0).replace(',','.'))||0}
function normalize243(target,r){
 const idv=typeof id==='function'?id():`i243-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 if(target==='planning')return {id:idv,title:r.title||r.titel||'',date:r.date||r.datum||'',time:r.time||r.tijd||'',endTime:r.endTime||r.eindtijd||'',person:r.person||r.persoon||'Samen',calendarId:r.calendarId||r.agenda||'persoonlijk'};
 if(target==='meals')return {id:idv,title:r.title||r.gerecht||'',date:r.date||r.datum||'',type:r.type||r.maaltijdmoment||'Avondeten'};
 if(target==='groceries')return {id:idv,title:r.title||r.product||'',category:r.category||r.categorie||'Overig',done:bool243(r.done||r.afgevinkt)};
 if(target==='chores')return {id:idv,title:r.title||r.taak||'',category:r.category||r.categorie||'',repeat:r.repeat||r.frequentie||'Wekelijks',person:r.person||r.persoon||r.toegewezenAan||'Samen',due:r.due||r.datum||r.startdatum||todayISO(),completedDates:[]};
 if(target==='stock')return {id:idv,title:r.title||r.product||'',category:r.category||r.categorie||'Overig',amount:num243(r.amount||r.hoeveelheid),unit:r.unit||r.eenheid||'stuks',min:num243(r.min||r.minimum||r.minimumvoorraad)};
 if(target==='trips')return {id:idv,title:r.title||r.titel||'',type:r.type||r.typeOnderdeel||'Notitie',date:r.date||r.datum||'',note:r.note||r.notitie||'',checkable:false,done:false};
 if(target==='ideas')return {id:idv,title:r.title||r.titel||'',category:r.category||r.categorie||'Uitje',note:r.note||r.notitie||''};
 if(target==='home')return {id:idv,title:r.title||r.titel||'',category:r.category||r.categorie||'Onderhoud',note:r.note||r.notitie||''};
 return r;
}
function arrayKey243(target){return {planning:'planning',meals:'meals',groceries:'groceries',chores:'chores',stock:'stock',trips:'trips',ideas:'ideas',home:'home'}[target]}
function fuelMate243(obj){
 ensureCar24();const vehicleMap=new Map();
 (obj.vehicles||[]).forEach(v=>{const c={id:`fm-${v.id}`,name:v.name||v.makeModel||'Auto',make:(v.makeModel||'').split(' ')[0]||'',model:(v.makeModel||'').split(' ').slice(1).join(' '),year:v.year||'',plate:plate24(v.plate||''),tankLiters:num243(v.tankLiters),owner:v.owner||v.name||'',isDefault:!!v.isDefault};data.cars=data.cars.filter(x=>plate24(x.plate)!==c.plate);data.cars.push(c);vehicleMap.set(String(v.id),c.id)});
 (obj.fillups||[]).forEach(f=>{const carId=vehicleMap.get(String(f.vehicleId))||data.cars[0]?.id;if(!carId)return;const liters=num243(f.volume),total=num243(f.totalCost);data.fuelEntries.push({id:`fm-fill-${f.id}-${Date.now()}`,carId,date:String(f.date||'').slice(0,10),odometer:num243(f.odometer),liters,total,pricePerLiter:liters?total/liters:0,fuelGrade:String(f.grade??'0'),station:f.station||'',partialFill:!!f.partial,missedPrevious:!!f.missedFill,note:f.note||''})});
}
async function runImport243(){
 if(!importFile243)return toast('Kies eerst een bestand');
 try{
  const text=await importFile243.text(), ext=importFile243.name.split('.').pop().toLowerCase();
  if(importTarget243==='backup'){if(ext!=='json')throw new Error('Voor een volledige back-up is JSON nodig');data=migrateData(JSON.parse(text));save();render();toast('Volledige back-up geïmporteerd');return}
  if(importTarget243==='budget'){const o=JSON.parse(text);data.budgetV23={...(data.budgetV23||{}),...o};save();render();toast('Budget geïmporteerd');return}
  if(importTarget243==='auto'){
   if(ext==='json'){const o=JSON.parse(text);if(o.app==='fuelmate'||Array.isArray(o.fillups)||Array.isArray(o.vehicles))fuelMate243(o);else{if(Array.isArray(o.cars))data.cars.push(...o.cars);if(Array.isArray(o.fuelEntries))data.fuelEntries.push(...o.fuelEntries)}}
   else{const rows=csv243(text);ensureCar24();if(!data.cars.length)throw new Error('Voeg eerst een voertuig toe of gebruik een FuelMate JSON-back-up');const car=data.cars.length===1?data.cars[0]:data.cars.find(x=>x.isDefault)||data.cars[0];rows.forEach((r,i)=>{const liters=num243(r.volume||r.liters),total=num243(r.totalCost||r.total);data.fuelEntries.push({id:`csv-fill-${Date.now()}-${i}`,carId:car.id,date:String(r.date||r.datum||'').slice(0,10),odometer:num243(r.odometer||r.kilometerstand),liters,total,pricePerLiter:num243(r.pricePerLiter)||(liters?total/liters:0),fuelGrade:r.grade||r.fuelGrade||'',station:r.station||r.tankstation||'',partialFill:bool243(r.partial||r.partialFill),missedPrevious:bool243(r.missedFill||r.missedPrevious),note:r.note||r.notitie||''})})}
   save();render();toast('Auto-informatie geïmporteerd');return
  }
  const key=arrayKey243(importTarget243);if(!key)throw new Error('Onbekend importdoel');
  let rows;if(ext==='json'){const o=JSON.parse(text);rows=Array.isArray(o)?o:(Array.isArray(o[key])?o[key]:[])}else rows=csv243(text);
  if(!rows.length)throw new Error('Geen regels gevonden');
  data[key] ||= [];data[key].push(...rows.map(r=>normalize243(importTarget243,r)).filter(r=>r.title));save();render();toast(`${rows.length} regels geïmporteerd`);
 }catch(err){console.error(err);toast(err?.message||'Importeren is mislukt')}
}
function template243(){
 const x=IMPORT243[importTarget243],isJson=['backup','budget','auto'].includes(importTarget243);
 let content=x.example,name=`samen-thuis-${importTarget243}-voorbeeld.${isJson?'json':'csv'}`;
 if(importTarget243==='backup')content=JSON.stringify({planning:[],meals:[],groceries:[],chores:[],stock:[],trips:[],ideas:[],home:[],cars:[],fuelEntries:[],budgetV23:{}},null,2);
 if(importTarget243==='auto')content=JSON.stringify({app:'fuelmate',version:1,vehicles:[{id:1,name:'Kees',makeModel:'Seat Ibiza',year:2012,plate:'JB796D',tankLiters:45,isDefault:1}],fillups:[{id:1,vehicleId:1,date:'2026-09-19T11:43:00',odometer:165275,volume:46.4,totalCost:108.44,partial:0,missedFill:0,station:'',grade:0,note:''}]},null,2);
 const blob=new Blob([content],{type:isJson?'application/json':'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
function navImport243(){
 const desktop=document.querySelector('.sidebar nav');if(desktop&&!desktop.querySelector('[data-import243-go]')){const settings=desktop.querySelector('[data-v19-go="settings"],[data-view="settings"]');const b=document.createElement('button');b.className=current==='imports243'?'active nav-item':'nav-item';b.dataset.import243Go='';b.innerHTML='<span>↥</span>Importeren';desktop.insertBefore(b,settings||null)}
 const scroll=document.querySelector('.mobile-nav-scroll23');if(scroll&&!scroll.querySelector('[data-import243-go]')){const b=document.createElement('button');b.dataset.import243Go='';b.className=current==='imports243'?'active':'';b.innerHTML='<span>↥</span><small>Import</small>';scroll.append(b)}
}
const prevRender243=render;render=function(...args){if(current==='imports243'){document.querySelector('#view').innerHTML=renderImport243();updateSyncBadge();requestAnimationFrame(navImport243);return}const r=prevRender243(...args);requestAnimationFrame(navImport243);return r};
document.addEventListener('click',e=>{
 if(e.target.closest('[data-import243-go]')){current='imports243';render();return}
 const j=e.target.closest('[data-import243-jump]');if(j){importTarget243=j.dataset.import243Jump;importFile243=null;render();return}
 if(e.target.closest('[data-import243-run]')){runImport243();return}
 if(e.target.closest('[data-import243-template]')){template243();return}
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-import243-target]')){importTarget243=e.target.value;importFile243=null;render();return}
 if(e.target.matches('[data-import243-file]')){importFile243=e.target.files?.[0]||null;render();return}
});
requestAnimationFrame(navImport243);
})();

/* build v24.3 · centrale importpagina voor alle app-onderdelen */
