
/* ===== GEÏNTEGREERD: app.js ===== */
const STORAGE_KEY = 'samenThuisDataV2';
const LEGACY_STORAGE_KEY = 'samenThuisDataV1';
const SYNC_KEY = 'samenThuisSyncV1';
const SYNC_CONFLICT_KEY = 'samenThuisSyncConflictV1';
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
  freezer: [],
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
const syncConflictStore = SamenThuisCore.createConflictStore(localStorage, SYNC_CONFLICT_KEY);
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const fmtDate = (value, options = { weekday: 'short', day: 'numeric', month: 'short' }) => value ? new Intl.DateTimeFormat('nl-NL', options).format(parseDate(value)) : 'Geen datum';
function migrateLegacyFreezerStock(target) {
  const freezerCore = window.FreezerCore;
  if (!freezerCore?.migrateLegacyStock) return;
  const result = freezerCore.migrateLegacyStock(target.stock, target.freezer, todayISO());
  target.stock = result.stock;
  target.freezer = result.freezer.map(item => item && typeof item === 'object'
    ? freezerCore.normalize(item, todayISO())
    : item);
}
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
  SamenThuisCore.preserveUnknownFields(raw, migrated, clone);
  ['planning', 'meals', 'groceries', 'chores', 'stock', 'ideas', 'home', 'trips', 'freezer'].forEach(key => {
    if (Array.isArray(raw[key])) migrated[key] = raw[key];
  });
  migrateLegacyFreezerStock(migrated);
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

const RECOVERY_KEYS = {
  storageKey: STORAGE_KEY, legacyKey: LEGACY_STORAGE_KEY,
  backupKey: 'samenThuisPreV23Backup', backupAtKey: 'samenThuisPreV23BackupAt',
  corruptKey: 'samenThuisCorruptBackup', preRestoreKey: 'samenThuisPreRestoreBackup'
};

function recoveryOptions() {
  return { ...RECOVERY_KEYS, migrate: migrateData, fresh: freshLocalData, now: () => new Date().toISOString() };
}

let storageProtected = false;
const RESTORE_HOLD_KEY = 'samenThuisRestoreHold';

function loadData() {
  try {
    const result = SamenThuisCore.loadWithRecovery(localStorage, recoveryOptions());
    // Kon de beschadigde bron niet veilig bewaard worden, dan blokkeren we opslaan zodat die bron niet wordt overschreven.
    if (result.status !== 'ok' && result.status !== 'empty' && !result.preserved) storageProtected = true;
    return result.data;
  } catch {
    return freshLocalData();
  }
}

function recoveryCard() {
  const items = SamenThuisCore.listCorruptBackups(localStorage, RECOVERY_KEYS.corruptKey, migrateData);
  if (!items.length) return '';
  return `<section class="card settings-card"><div class="card-head"><div><p class="eyebrow">Gegevens</p><h2>Beschadigde gegevens herstellen</h2></div></div><p>Onleesbare gegevens zijn veilig bewaard. Herstellen kan alleen als de gegevens geldig zijn; je huidige gegevens worden eerst apart bewaard.</p>${items.map(item => `<div class="button-row"><span>${esc(item.at ? new Date(item.at).toLocaleString('nl-NL') : 'Onbekende datum')} · ${item.size} tekens · ${item.valid ? 'geldig' : 'niet herstelbaar'}</span><button class="secondary" data-restore-corrupt="${item.index}" ${item.valid ? '' : 'disabled'}>Herstellen</button></div>`).join('')}</section>`;
}

// Een leeg/nieuw apparaat krijgt een tijdstempel van 1970, zodat synchronisatie
// de bestaande cloudgegevens laadt in plaats van ze te overschrijven met voorbeelddata.
function freshLocalData() {
  const fresh = clone(initialData);
  fresh.meta = { ...fresh.meta, updatedAt: new Date(0).toISOString() };
  return fresh;
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
let syncConflictResolution = syncConflictStore.get()?.resolution || '';
let calendarOperation = null;
let addMode = 'item';

const sections = {
  today: { label: 'Dashboard', icon: '⌂' },
  planning: { label: 'Agenda', icon: '▦' },
  meals: { label: 'Weekmenu', icon: '♨' },
  groceries: { label: 'Boodschappen', icon: '✓' },
  offers: { label: 'Aanbiedingen', icon: '％' },
  tasks: { label: 'Taken', icon: '☑' },
  chores: { label: 'Huishouden', icon: '⌁' },
  stock: { label: 'Voorraad', icon: '▤' },
  weather: { label: 'Weer', icon: '☀' },
  challenges: { label: 'Challenges', icon: '✦' },
  programs: { label: "Programma's", icon: '▶' },
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
  migrateLegacyFreezerStock(data);
  if (storageProtected) {
    toast('Opslaan is geblokkeerd: beschadigde gegevens konden niet veilig worden bewaard. Maak een back-up en maak ruimte vrij.');
    return false;
  }
  if (touch) data.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const saveState = document.querySelector('#saveState');
  if (saveState) {
    saveState.textContent = 'Zojuist bewaard';
    setTimeout(() => { saveState.textContent = 'Lokaal bewaard'; }, 1200);
  }
  if (sync && syncConfigured()) scheduleSync();
  return true;
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
  return `<section class="card daily-question" data-widget18="dailyQuestion">
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
  let cached;
  try { cached = JSON.parse(localStorage.getItem(QUOTE_KEY) || 'null'); } catch { cached = null; }
  if (window.SamenThuisQuotes && !window.SamenThuisQuotes.shouldRefresh(cached?.checkedAt)) return;
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
    localStorage.setItem(QUOTE_KEY, JSON.stringify({ date: todayISO(), checkedAt: new Date().toISOString(), markup }));
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
  return `<section class="card travel-actions" data-widget18="travelActions"><div class="card-head"><div><p class="eyebrow">Belangrijkste reisacties</p><h2>Nog te doen</h2></div><button class="text-btn" data-view="trips">Alle reizen</button></div><div class="list">${actions.length ? actions.map(item => {
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
    <div class="today-dailies single" data-dashboard-group>${renderDailyQuestion()}</div>
    <div class="stat-row" data-widget18="todayStats"><div class="stat"><strong>${pending.length}</strong><span>huishoudtaken vandaag</span></div><div class="stat"><strong>${unbought.length}</strong><span>boodschappen open</span></div><div class="stat"><strong>${low.length}</strong><span>producten bijna op</span></div><div class="stat"><strong>${todayPlanning.length}</strong><span>agenda-items vandaag</span></div></div>
    <div class="grid two" data-dashboard-group>
      <section class="card" data-widget18="todayChores"><div class="card-head"><h2>Vandaag in huis</h2><button class="text-btn" data-view="chores">Hele week</button></div><div class="list">${todayChores.length ? todayChores.map(({ chore }) => choreOccurrenceRow(chore, todayISO())).join('') : empty('Vandaag geen huishoudtaken')}</div></section>
      <section class="card" data-widget18="todayAgenda"><div class="card-head"><h2>Op de agenda</h2><button class="text-btn" data-view="planning">Week bekijken</button></div><div class="list">${data.planning.filter(item => item.date >= todayISO() && calendarById(item.calendarId).visible !== false).sort(sortPlanning).slice(0, 5).map(item => basicRow(item.title, `${fmtDate(item.date)} · ${item.time || 'Hele dag'}`, calendarById(item.calendarId).name)).join('') || empty('Nog niets gepland')}</div></section>
      <section class="card" data-widget18="todayGroceries"><div class="card-head"><h2>Boodschappen</h2><button class="text-btn" data-view="groceries">Open lijst</button></div><div class="list">${unbought.slice(0, 5).map(groceryRow).join('') || empty('De lijst is leeg')}</div></section>
      <section class="card" data-widget18="lowStock"><div class="card-head"><h2>Bijna op</h2><button class="text-btn" data-view="stock">Voorraad bekijken</button></div><div class="list">${low.slice(0, 5).map(item => basicRow(item.title, `${item.amount} ${esc(item.unit)} in huis`, 'Aanvullen', 'red')).join('') || empty('Voorraad is op peil')}</div></section>
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
  const categories = [...new Set([...GROCERY_CATEGORIES, ...Object.keys(groups)])];
  return `<section class="card import-card grocery-import"><div><p class="eyebrow">Lijst verdelen</p><h2>Plakken of uploaden</h2><p>Hoeveelheden blijven staan. De app deelt producten automatisch in; regels met ✓ worden als gekocht gemarkeerd.</p></div><textarea id="groceryImportText" placeholder="250 g spinazie\n1 teentje knoflook\n✓ Zout"></textarea><div class="button-row"><button class="primary" data-import-groceries>Verdelen over categorieën</button><button class="secondary" data-pick-file="groceryImportFile">TXT, CSV of JSON kiezen</button></div></section>
    <div class="grid three grocery-groups">${categories.map(category => {
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
    ${renderSyncConflictCard()}
    <section class="card settings-card"><div class="card-head"><div><p class="eyebrow">Gegevens</p><h2>Back-up</h2></div></div><p>Maak een los JSON-bestand of herstel een eerdere back-up. Herstellen vervangt alle huidige gegevens op dit apparaat; Importeren voegt gegevens samen. De synchronisatiecode en sleutel worden niet in de back-up gezet. Vrijwillige Sport & Training-gezondheidsinformatie staat wel leesbaar in de JSON-back-up; bewaar en deel die zorgvuldig.</p><div class="button-row"><button class="secondary" data-action="backup">Back-up maken</button><button class="secondary" data-action="restore">Back-up herstellen (vervangen)</button></div></section>
    ${recoveryCard()}
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
    const text = await file.text();
    try { SamenThuisCore.restoreBackupText({ getItem: () => null, setItem() {}, removeItem() {} }, recoveryOptions(), text); }
    catch { toast('Dit bestand is geen geldige back-up'); return; }
    if (storageProtected) { toast('Opslaan is geblokkeerd; back-up niet geladen. Maak ruimte vrij.'); return; }
    // Herstelvlag en kopie van de huidige gegevens worden vóór het overschrijven vastgelegd.
    try {
      data = SamenThuisCore.restoreBackupText(localStorage, { ...recoveryOptions(), holdKey: RESTORE_HOLD_KEY }, text);
    } catch {
      toast('Back-up laden mislukt; je huidige gegevens zijn ongewijzigd');
      return;
    }
    save({ touch: false, sync: false });
    render();
    toast(syncConfigured() ? 'Back-up hersteld · bij de volgende synchronisatie kies je zelf welke versie geldt' : 'Back-up hersteld');
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
    if (type === 'meals' && window.FreezerCore?.cancelMeal) {
      data.meals = window.FreezerCore.cancelMeal(data.meals, itemId).meals;
    } else {
      data[type] = data[type].filter(item => item.id !== itemId);
    }
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
  const corruptBtn = event.target.closest('[data-restore-corrupt]');
  if (corruptBtn) {
    if (confirm('Deze bewaarde gegevens herstellen? Je huidige gegevens worden eerst apart bewaard.')) {
      try {
        data = SamenThuisCore.restoreCorruptBackup(localStorage, { ...recoveryOptions(), holdKey: RESTORE_HOLD_KEY }, Number(corruptBtn.dataset.restoreCorrupt));
        save({ touch: false, sync: false });
        render();
        toast(syncConfigured() ? 'Gegevens hersteld · bij de volgende synchronisatie kies je zelf welke versie geldt' : 'Gegevens hersteld');
      } catch (error) { toast(error.message || 'Herstellen mislukt'); }
    }
    return;
  }
  if (action === 'backup') exportBackup();
  if (action === 'restore') {
    if (confirm('Back-up herstellen vervangt alle huidige gegevens op dit apparaat. Gebruik Importeren als je gegevens wilt samenvoegen. Doorgaan?')) {
      document.querySelector('#restoreInput').click();
    }
  }
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
document.querySelector('#restoreInput').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (file) await importBackup(file);
  event.target.value = '';
});
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
setInterval(() => {
  if (document.visibilityState === 'visible') refreshBrainyQuoteRSS();
}, 24 * 60 * 60 * 1000);
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
    return `<section class="card travel-actions" data-widget18="travelActions"><div class="card-head"><div><p class="eyebrow">Belangrijkste reisacties</p><h2>Prioriteiten & deadlines</h2></div><button class="text-btn" data-view="trips">Alle reizen</button></div><div class="list">${actions.length ? actions.map(item => {
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
    const badge = document.querySelector('#syncState');
    if (!message && badge && getSyncConflict()) {
      badge.textContent = 'Conflict oplossen';
      badge.title = 'Open Instellingen en kies welke apparaatversie je wilt bewaren.';
      return;
    }
    baseUpdateSyncBadge(message);
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
    if (getSyncConflict() && !syncConflictResolution) {
      syncError = 'Wijzigingen op beide apparaten; kies welke versie je wilt bewaren.';
      updateSyncBadge();
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
      const pendingConflict = syncConflictStore.get();
      if (syncConflictResolution && pendingConflict?.resolution && remoteData
        && SamenThuisCore.remoteChangedSinceChoice(pendingConflict.remoteData, remoteData)) {
        const selectedData = pendingConflict.selectedData
          || (syncConflictResolution === 'local' ? pendingConflict.localData : pendingConflict.remoteData);
        const renewedConflict = {
          ...pendingConflict,
          localData: clone(selectedData),
          remoteData: clone(remoteData),
          localUpdatedAt: selectedData.meta?.updatedAt || '',
          remoteUpdatedAt: remoteData.meta?.updatedAt || '',
          resolution: '',
          selectedData: null,
          detectedAt: new Date().toISOString()
        };
        syncConflictStore.store(renewedConflict);
        syncConflictResolution = '';
        syncError = 'De andere versie is verder gewijzigd; maak opnieuw een keuze.';
        if (current === 'settings') render();
        toast(syncError);
        return;
      }

      const localTime = new Date(data.meta?.updatedAt || 0).getTime();
      const remoteTime = new Date(remoteData?.meta?.updatedAt || 0).getTime();
      let remoteLoaded = false;

      const plan = SamenThuisCore.planSync({
        local: data, remote: remoteData, hold: !!localStorage.getItem(RESTORE_HOLD_KEY),
        resolution: syncConflictResolution, lastSyncedAt: syncConfig.lastSyncedAt
      });
      if (!remoteData) {
        await uploadSyncData(baseUrl, householdId, rows[0]);
      } else if (plan === 'conflict') {
        const conflict = {
          localData: clone(data),
          remoteData: clone(remoteData),
          localUpdatedAt: data.meta.updatedAt,
          remoteUpdatedAt: remoteData.meta.updatedAt,
          detectedAt: new Date().toISOString()
        };
        if (!syncConflictStore.store(conflict)) {
          syncError = 'Conflict gevonden, maar browseropslag is vol. Kies een versie voordat je deze pagina verlaat.';
          if (current === 'settings') render();
          toast(syncError);
          return;
        }
        syncError = 'Wijzigingen op beide apparaten; kies welke versie je wilt bewaren.';
        if (current === 'settings') render();
        toast('Wijzigingen op beide apparaten gevonden. Kies een versie bij Instellingen.');
        return;
      } else if (syncConflictResolution === 'remote') {
        data = clone(pendingConflict?.selectedData || remoteData);
        normaliseTravelData();
        if (save({ touch: false, sync: false }) === false) throw new Error('Lokaal opslaan is geblokkeerd; synchronisatie niet afgerond');
        remoteLoaded = true;
      } else if (syncConflictResolution === 'local') {
        data = clone(pendingConflict?.selectedData || data);
        await uploadSyncData(baseUrl, householdId, rows[0]);
      } else if (remoteTime > localTime) {
        data = remoteData;
        normaliseTravelData();
        if (save({ touch: false, sync: false }) === false) throw new Error('Lokaal opslaan is geblokkeerd; synchronisatie niet afgerond');
        remoteLoaded = true;
      } else if (localTime > remoteTime) {
        await uploadSyncData(baseUrl, householdId, rows[0]);
      }

      syncConfig.lastSyncedAt = nowIso();
      localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
      try { localStorage.removeItem(RESTORE_HOLD_KEY); } catch {}
      if (syncConflictResolution) {
        if (syncConflictStore.clear()) syncConflictResolution = '';
      }
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
    return SamenThuisCore.nextDue(lastDone16(chore), chore.due || today16(), chore.repeat);
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

    const html=`<section class="card" data-v16-today-chores data-widget18="upcomingChores">
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
 <section class="weather18" data-weather18 data-widget18="weather">Weer ophalen…</section>
 <section class="today18" data-widget18="household"><div class="ct18"><strong>Vandaag</strong><span>${s.chores} taken</span></div><div class="stats18"><button data-view="chores"><b>${s.chores}</b><small>Huishouden</small></button><button data-view="groceries"><b>${s.groceries}</b><small>Boodschappen</small></button><button data-view="stock"><b>${s.low}</b><small>Bijna op</small></button></div><div class="meal18"><small>🍽️ VANAVOND</small><strong>${esc(s.dinner?.title||'Nog geen avondeten gepland')}</strong></div></section>
 <section class="agenda18" data-widget18="agenda"><div class="ct18"><strong>Komende afspraken</strong><button class="text-btn" data-view="planning">Alles →</button></div>${s.agenda.length?s.agenda.map(x=>`<div class="ar18"><time>${esc(x.date===todayISO()?(x.time||'Hele dag'):new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric'}).format(parseDate(x.date)))}</time><div><strong>${esc(x.title)}</strong><small>${esc(x.person||'')}</small></div></div>`).join(''):'<p class="muted">Geen komende afspraken.</p>'}</section>
 <section class="outfit18" data-outfit18 data-widget18="outfit"><span>👕</span><div><strong>Wat trek je aan?</strong><p>Weeradvies laden…</p></div></section></div></section>`
}
async function weather18(force=false){
 const box=document.querySelector('[data-weather18]');if(!box)return;
 const settings=data.settings||{},savedLat=settings.weatherLat===''||settings.weatherLat==null?NaN:Number(settings.weatherLat),savedLon=settings.weatherLon===''||settings.weatherLon==null?NaN:Number(settings.weatherLon),loc={name:settings.weatherPlace||LOC.name,lat:Number.isFinite(savedLat)&&savedLat>=-90&&savedLat<=90?savedLat:LOC.lat,lon:Number.isFinite(savedLon)&&savedLon>=-180&&savedLon<=180?savedLon:LOC.lon},key=`${loc.lat},${loc.lon}`;
 try{let w=null;if(!force)try{let c=JSON.parse(localStorage.getItem(WC)||'null');if(c&&c.key===key&&Date.now()-c.t<1800000)w=c.w}catch(_){}
 if(!w){let q=new URLSearchParams({latitude:loc.lat,longitude:loc.lon,current:'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m',hourly:'temperature_2m,weather_code,precipitation_probability',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max',timezone:'Europe/Amsterdam',forecast_days:'5'});let r=await fetch('https://api.open-meteo.com/v1/forecast?'+q,{cache:'no-store'});if(!r.ok)throw 0;w=await r.json();localStorage.setItem(WC,JSON.stringify({t:Date.now(),key,w}))}
 let c=w.current,d=w.daily,h=w.hourly,n=new Date(),i=h.time.findIndex(t=>new Date(t)>=new Date(n.getFullYear(),n.getMonth(),n.getDate(),n.getHours()));if(i<0)i=0;let ids=Array.from({length:6},(_,k)=>i+k).filter(k=>k<h.time.length);
 box.innerHTML=`<div class="wm18"><div><small>⌖ ${esc(loc.name)}</small><div class="temp18"><span>${wi(c.weather_code)}</span><strong>${Math.round(c.temperature_2m)}°</strong></div><p>${wt(c.weather_code)} · voelt als ${Math.round(c.apparent_temperature)}°</p></div><div class="wf18"><b>${Math.round(d.temperature_2m_max[0])}° / ${Math.round(d.temperature_2m_min[0])}°</b><span>☂ ${Math.round(d.precipitation_probability_max[0]||0)}%</span><span>↗ ${Math.round(c.wind_speed_10m||0)} km/u</span></div></div><div class="hours18">${ids.map(k=>`<div><small>${h.time[k].slice(11,16)}</small><b>${wi(h.weather_code[k])}</b><strong>${Math.round(h.temperature_2m[k])}°</strong><small>${Math.round(h.precipitation_probability[k]||0)}%</small></div>`).join('')}</div><button class="wr18" data-wr18>↻</button>`;
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
 ['today','Dashboard','⌂'],['planning','Agenda','▦'],['tasks','Taken','☑'],['groceries','Boodschappen','✓'],['stock','Voorraad','▤'],['offers','Aanbiedingen','％'],['budget19','Budget','€'],
 ['meals','Weekmenu','♨'],['chores','Huishouden','⌁'],['challenges','Challenges','✦'],['weather','Weer','☀'],['programs',"Programma's",'▶'],['ideas','Date ideeën','♡'],
 ['home','Woning','⌂'],['trips','Reizen','✈'],['extra19','Extra','＋'],['settings','Instellingen','⚙']
];
try{
  sections.today={label:'Dashboard',icon:'⌂'};
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
    desktop.innerHTML=pages19.map(([id,label,icon])=>`<button class="${current===id?'active':''}" data-v19-go="${esc(id)}"><span>${esc(icon)}</span>${esc(label)}</button>`).join('');
  }
  const mobile=document.querySelector('.mobile-nav,.bottom-nav');
  if(mobile){
    const direct=(ui19.mobileNav||DEFAULTUI19.mobileNav).slice(0,4);
    mobile.innerHTML=direct.map(id=>{const p=pages19.find(x=>x[0]===id)||pages19[0];return `<button class="${current===id?'active':''}" data-v19-go="${esc(p[0])}"><span>${esc(p[2])}</span><small>${esc(p[1])}</small></button>`}).join('')+
      `<button data-v19-more><span>•••</span><small>Meer</small></button>`;
  }
}
function more19(){
  let old=document.querySelector('[data-v19-moremenu]');if(old){old.remove();return}
  const direct=new Set(ui19.mobileNav||DEFAULTUI19.mobileNav);
  document.body.insertAdjacentHTML('beforeend',`<div class="more19" data-v19-moremenu><div class="more19-sheet"><div class="more19-head"><strong>Alle pagina's</strong><button data-v19-more>×</button></div>${pages19.filter(p=>!direct.has(p[0])).map(p=>`<button data-v19-go="${esc(p[0])}"><span>${esc(p[2])}</span><b>${esc(p[1])}</b></button>`).join('')}</div></div>`);
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
 const tools=[
 ['weather','☀️','Weer','Actueel weer op Vandaag','today'],
 ['daily','💡','Vraag van de dag','Beantwoord de vraag op Vandaag','today'],
 ['floor','🏷️','Bodemprijzen','Bekijk prijsreferenties bij Boodschappen','groceries']
 ];
 return `<div class="page19"><div class="page19-head"><div><p class="eyebrow">HANDIGE TOOLS</p><h1>Extra</h1><p>Snelle toegang tot handige onderdelen.</p></div></div><div class="tools19">
 ${tools.map(([id,icon,label,description])=>`<button data-v19-tool="${id}"><span>${icon}</span><strong>${label}</strong><small>${description}</small></button>`).join('')}</div></div>`;
}
function settingsPanel19(){
 if(current!=='settings')return;
 const v=document.querySelector('#view');if(!v||v.querySelector('[data-v19-device-settings]'))return;
 v.insertAdjacentHTML('afterbegin',`<section class="card device-settings19" data-v19-device-settings><div class="card-head"><div><p class="eyebrow">WEERGAVEVOORKEUREN</p><h2>Thema & weergave</h2></div><span class="tag">Persoonlijk</span></div><p class="muted">Zonder persoonlijk account worden voorkeuren op dit apparaat bewaard. Meld je aan om ze per account tussen apparaten te synchroniseren.</p>
 <div class="settings-grid19"><label>Thema<select data-v19-theme><option value="system">Systeem</option><option value="light">Licht</option><option value="dark">Donker</option></select></label>
 <label class="accent-control20">Accentkleur <input type="color" data-accent-color aria-label="Kies je eigen accentkleur"><span class="accent-preview20" data-accent-preview aria-live="polite"></span></label>
 <label>Weergave<select data-v19-density><option value="comfortable">Ruim</option><option value="compact">Compact</option></select></label></div></section>`);
 v.querySelector('[data-v19-theme]').value=ui19.theme;v.querySelector('[data-v19-density]').value=ui19.density;
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
   const t=tool.dataset.v19Tool;   if(t==='weather'){go19('today');return}
   if(t==='floor'){go19('groceries');return}
   if(t==='daily'){go19('today');return}
 }
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-v19-theme]')){ui19.theme=e.target.value;saveUi19()}
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
const FALLBACK20 = { theme:'system', accent:'purple', accentColor:'#7057d9', density:'comfortable' };
const ACCENT_PRESETS20 = { bluePurple:'#5f63d8', blue:'#315f86', purple:'#7057d9', orange:'#d56e38' };

function get20(){
  try {
    const old = JSON.parse(localStorage.getItem('samenThuisDeviceUiV19') || '{}');
    const now = JSON.parse(localStorage.getItem(KEY20) || '{}');
    const saved = {...FALLBACK20, ...old, ...now};
    if (!/^#[0-9a-f]{6}$/i.test(saved.accentColor || '')) saved.accentColor = ACCENT_PRESETS20[saved.accent] || FALLBACK20.accentColor;
    return saved;
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
  const hex = /^#[0-9a-f]{6}$/i.test(ui20.accentColor || '') ? ui20.accentColor : FALLBACK20.accentColor;
  const channels = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  const mix = (rgb, target, amount) => '#' + rgb.map((c, index) =>
    Math.round(c + ((Array.isArray(target) ? target[index] : target) - c) * amount).toString(16).padStart(2, '0')).join('');
  const luminance = value => channels(value).map(c => {
    const normalized = c / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
  const baseRgb = channels(hex);
  const contrast = (foreground, background) => {
    const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };
  const readableOn = (background, target) => {
    for (let amount = 0; amount <= 1; amount += 0.01) {
      const candidate = mix(baseRgb, target, amount);
      if (contrast(candidate, background) >= 4.5) return candidate;
    }
    return target === 0 ? '#000000' : '#ffffff';
  };
  const darkSurface = '#0d273e';
  const accentText = contrast('#ffffff', hex) >= contrast('#17243a', hex) ? '#ffffff' : '#17243a';
  html.style.setProperty('--blue', readableOn(dark ? darkSurface : '#ffffff', dark ? 255 : 0));
  html.style.setProperty('--blue-soft', mix(baseRgb, dark ? channels(darkSurface) : 255, 0.88));
  html.style.setProperty('--dark-accent-text', readableOn(darkSurface, 255));
  html.style.setProperty('--dark-muted-text', '#c7d8e8');
  html.style.setProperty('--accent-button-bg', hex);
  html.style.setProperty('--accent-button-text', accentText);
  html.dataset.accent20 = html.dataset.accent19 = 'custom';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#081b2d' : '#eef3f9');
}
function save20(){
  localStorage.setItem(KEY20, JSON.stringify(ui20));
  localStorage.setItem('samenThuisDeviceUiV19', JSON.stringify(ui20));
  apply20();
  window.dispatchEvent(new Event('samenThuisPreferencesChange'));
}
apply20();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => ui20.theme === 'system' && apply20()); } catch(_){}
window.SamenThuisPersonalUi20 = {
  get() { return { ...ui20 }; },
  set(value) {
    const next = value && typeof value === 'object' ? value : {};
    ui20 = {
      theme: ['system', 'light', 'dark'].includes(next.theme) ? next.theme : 'system',
      accent: ['bluePurple', 'blue', 'purple', 'orange'].includes(next.accent) ? next.accent : 'purple',
      density: ['comfortable', 'compact'].includes(next.density) ? next.density : 'comfortable',
      accentColor: typeof next.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(next.accentColor)
        ? next.accentColor : ACCENT_PRESETS20[next.accent] || FALLBACK20.accentColor
    };
    save20();
  }
};

function beautifySettings20(){
  if (typeof current === 'undefined' || current !== 'settings') return;
  const box = document.querySelector('[data-v19-device-settings]');
  if (!box) return;
  box.classList.add('glass20');
  const theme = box.querySelector('[data-v19-theme]');
  const density = box.querySelector('[data-v19-density]');
  if(theme){ theme.value=ui20.theme; theme.onchange=()=>{ui20.theme=theme.value;save20()}; }
  const input = box.querySelector('[data-accent-color]');
  const preview = box.querySelector('[data-accent-preview]');
  if(input){
    input.value = /^#[0-9a-f]{6}$/i.test(ui20.accentColor || '') ? ui20.accentColor : FALLBACK20.accentColor;
    const updatePreview = () => {
      if (!preview) return;
      const channels = [1, 3, 5].map(i => parseInt(input.value.slice(i, i + 2), 16) / 255);
      const lum = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
        .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
      preview.textContent = input.value.toUpperCase();
      preview.style.backgroundColor = input.value;
      preview.style.color = lum > 0.179 ? '#17243a' : '#ffffff';
    };
    updatePreview();
    input.oninput = () => { ui20.accentColor = input.value; save20(); updatePreview(); };
  }
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
 ['today','⌂','Dashboard'],['planning','▦','Agenda'],['tasks','☑','Taken'],
 ['groceries','✓','Boodschappen'],['stock','▤','Voorraad'],['offers','％','Aanbiedingen'],['budget19','€','Budget'],
 ['meals','♨','Weekmenu'],['chores','⌁','Huishouden'],['challenges','✦','Challenges'],['weather','☀','Weer'],['programs','▶',"Programma's"],
 ['ideas','♡','Date ideeën'],['home','⌂','Woning'],['trips','✈','Reizen'],
 ['extra19','＋','Extra'],['settings','⚙','Instellingen']
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
 const saved=b.goals.reduce((s,x)=>s+goalBalance23(x),0),targets=b.goals.reduce((s,x)=>s+n23(x.target),0);
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
const SAV23=()=>globalThis.SamenThuisSavings;
function goalBalance23(g){return SAV23()?SAV23().balance(g):n23(g.current)}
function today23(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function goalStatus23(g){
 const left=Math.max(0,n23(g.target)-goalBalance23(g)),m=n23(g.monthly);
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
const KIND23={fixed:'Vast doelbedrag',recurring:'Terugkerende rekening',buffer:'Noodbuffer'};
function goalDetail23(g){
 const S=SAV23();if(!S)return '';
 const st=S.status(g,today23()),actual=S.actualInPeriod(g,today23(),st.frequency);
 const diff=S.round(actual-st.planned),label=S.FREQUENCIES[st.frequency].toLowerCase();
 const dep=(g.deposits||[]).slice(-3).reverse().map(x=>`<li>${esc(x.date)} · ${eur23(x.amount)}${x.note?' · '+esc(x.note):''}</li>`).join('');
 return `<div class="goal-extra23">
  <p><small>${esc(KIND23[g.kind]||KIND23.fixed)} · ${g.scope==='personal'?'Persoonlijk':'Gezamenlijk'} · prioriteit ${n23(g.priority)||3}${g.paused?' · gepauzeerd':''}</small></p>
  <p>Gepland per periode (${label}): <b>${eur23(st.planned)}</b> · Werkelijk deze periode: <b>${eur23(actual)}</b> · Verschil gepland/werkelijk: <b class="${diff<0?'warn23':'ok23'}">${eur23(diff)}</b></p>
  ${st.required!=null&&st.state!=='reached'?`<p>Benodigd per periode voor de deadline: <b>${eur23(st.required)}</b>${st.moments!=null?` (${st.moments} inlegmomenten)`:''}</p>`:''}
  ${st.expectedEnd?`<p>Verwachte einddatum bij huidig ritme: <b>${esc(st.expectedEnd)}</b></p>`:''}
  ${st.state==='expired'?'<p class="warn23">Deadline is verstreken — pas deadline, doelbedrag of prioriteit aan.</p>':''}
  ${st.state==='behind'?`<p class="warn23">Achterstand ten opzichte van de spaarplanning: ${eur23(st.behind)} (geen schuld en geen negatief banksaldo). ${st.required!=null?`Nodig per periode om de deadline te halen: ${eur23(st.required)}.`:''}</p>`:''}
  ${st.state==='active'&&!st.feasible&&st.required!=null?`<p class="warn23">Niet haalbaar met huidige inleg; benodigd ${eur23(st.required)} per periode.</p>`:''}
  <p><button data-sav-deposit="${esc(g.id)}">+ Storting registreren</button> <button data-sav-pause="${esc(g.id)}">${g.paused?'Hervatten':'Pauzeren'}</button></p>
  ${dep?`<ul class="muted">${dep}</ul>`:''}
 </div>`;
}
function savingsPlan23(c){
 const S=SAV23();if(!S)return '';
 const b=c.b,available=c.contribution-c.fixed-c.house-c.investing;
 const p=S.propose(b.goals,Math.max(0,available),today23());
 const rows=p.rows.map(r=>`<tr><td>${esc(r.title)}</td><td>${eur23(r.need)}</td><td><input inputmode="decimal" data-sav-prop="${esc(r.id)}" value="${r.proposed}"></td><td>${esc(r.reason)}${r.behind?` · achterstand ${eur23(r.behind)}`:''}</td></tr>`).join('');
 return `<section class="budget-sheet23"><header><div><small>SLIM SPAREN</small><h2>Verdeling beschikbaar spaarbedrag</h2></div></header>
  <div class="calc23"><span>Beschikbaar om te sparen (afdracht − vaste lasten − huisbudget − beleggen) <b>${eur23(Math.max(0,available))}</b></span><span>Totaal benodigde inleg actieve doelen (per maand) <b>${eur23(p.totalNeed)}</b></span><span>Ingestelde maandinleg (huidig budget) <b>${eur23(c.saving)}</b></span>
  <span class="total23">${p.shortfall>0?`Gewenste inleg is ${eur23(p.shortfall)} hoger dan beschikbaar`:`Voldoende beschikbaar, ${eur23(p.leftover)} over`}</span></div>
  <div style="overflow-x:auto"><table class="sav-table23"><thead><tr><th>Doel</th><th>Nodig/maand</th><th>Voorstel</th><th>Toelichting</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p><button class="primary" data-sav-apply>Voorstel opslaan als maandinleg</button></p>
  <p class="muted">Dit is een planning: er worden geen betalingen of overboekingen uitgevoerd en theoretische besparingen tellen niet als ontvangen geld.</p></section>`;
}
function renderBudget23(){
 const c=calcBudget23(),b=c.b;
 const goals=b.goals.map((g,i)=>{
  const st=goalStatus23(g);
  return `<article class="light-surface23 goal-card23">
   <header><div><small>SPAARDOEL</small><h3>${esc(g.title)}</h3><p>${esc(g.deadline||'Geen deadline')}</p></div><div><button data-budget23-goal="${i}">Bewerk</button><button class="danger23" data-budget23-delgoal="${i}">×</button></div></header>
   <div class="goal-visual23">${donut23(goalBalance23(g),g.target,g.title)}<div><b>${eur23(goalBalance23(g))} / ${eur23(g.target)}</b><span>Nog nodig ${eur23(st.left)}</span><span>${n23(g.monthly)>0?`${eur23(g.monthly)} per maand`:'Geen maandbedrag'}</span><span class="${st.enough?'ok23':'warn23'}">${st.months===0?'Doel bereikt':st.months?`Verwacht over ${st.months} maanden`:'Geen prognose'}${st.deadline!=null?` · ${st.enough?'op schema':'inleg te laag voor deadline'}`:''}</span></div></div>
   ${goalDetail23(g)}
   ${projection23(g)}
  </article>`;
 }).join('');
 const fixed=b.fixed.map((x,i)=>`<div class="light-surface23 fixed-row23"><div><b>${esc(x.title)}</b><small>${x.period==='jaar'?'Jaarlijks':x.period==='kwartaal'?'Per kwartaal':'Maandelijks'} · ${eur23(monthlyFixed23(x))}/mnd</small></div><strong>${eur23(x.amount)}</strong><button data-budget23-fixed="${i}">Bewerk</button><button class="danger23" data-budget23-delfixed="${i}">×</button></div>`).join('');
 const goalBars=b.goals.map(g=>({label:g.title,value:goalBalance23(g),value2:Math.max(0,n23(g.target)-goalBalance23(g))}));
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

  ${savingsPlan23(c)}

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
 const freq=prompt('Inlegfrequentie: weekly, monthly, quarterly of yearly',g.frequency||'monthly');if(freq===null)return;
 const prio=prompt('Prioriteit (1 = hoogst, 5 = laagst)',g.priority||3);if(prio===null)return;
 const scope=prompt('Gezamenlijk of persoonlijk? (gezamenlijk/persoonlijk)',g.scope==='personal'?'persoonlijk':'gezamenlijk');if(scope===null)return;
 const kind=prompt('Type: fixed (doelbedrag), recurring (terugkerende rekening) of buffer (noodbuffer)',g.kind||'fixed');if(kind===null)return;
 const dl=deadline.trim();
 if(dl&&dl!=='Jaarlijks'&&!/^\d{4}-\d{2}-\d{2}$/.test(dl)){alert('Ongeldige deadline; gebruik YYYY-MM-DD.');return}
 const item={...g,title:title.trim()||'Spaardoel',target:Math.max(0,n23(target)),current:n23(currentAmount),monthly:Math.max(0,n23(monthly)),deadline:dl,recurring:/jaarlijks/i.test(dl),
  frequency:['weekly','monthly','quarterly','yearly'].includes(freq.trim())?freq.trim():'monthly',priority:Math.min(5,Math.max(1,Math.round(n23(prio))||3)),
  scope:/pers/i.test(scope)?'personal':'shared',kind:['fixed','recurring','buffer'].includes(kind.trim())?kind.trim():'fixed',
  startDate:g.startDate||(dl&&dl!=='Jaarlijks'?today23():''),startAmount:g.startAmount??n23(currentAmount),deposits:Array.isArray(g.deposits)?g.deposits:[]};
 if(i==null)b.goals.push(item);else b.goals[i]=item;save();render();
}
function addSavingsDeposit23(goalId){
 const g=budget23().goals.find(x=>x.id===goalId);if(!g||!SAV23())return;
 const amount=prompt(`Bedrag storting in "${g.title}" (negatief = opname)`,'');if(amount===null)return;
 const date=prompt('Datum (YYYY-MM-DD)',today23());if(date===null)return;
 const note=prompt('Omschrijving (optioneel)','');if(note===null)return;
 try{
  const r=SAV23().addDeposit(g,{amount:n23(amount),date:date.trim(),note});
  if(!r.added)alert('Deze storting is al geregistreerd.');
  save();render();
 }catch(err){alert(err.message)}
}
function applySavingsProposal23(){
 const b=budget23();
 document.querySelectorAll('[data-sav-prop]').forEach(inp=>{const g=b.goals.find(x=>x.id===inp.dataset.savProp);if(g)g.monthly=Math.max(0,n23(inp.value))});
 save();render();
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
 const sd=e.target.closest('[data-sav-deposit]');if(sd){addSavingsDeposit23(sd.dataset.savDeposit);return}
 const sp=e.target.closest('[data-sav-pause]');if(sp){const g=budget23().goals.find(x=>x.id===sp.dataset.savPause);if(g){g.paused=!g.paused;save();render()}return}
 if(e.target.closest('[data-sav-apply]')){applySavingsProposal23();return}
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
let autoTab24='fills',statsPeriod24='year',statsCars24=[];
function ensureCar24(){data.cars ||= [];data.fuelEntries ||= [];}
function car24(id){ensureCar24();return data.cars.find(x=>x.id===id)||data.cars[0]||null}
function entries24(carId=''){return (data.fuelEntries||[]).filter(x=>!carId||x.carId===carId).sort((a,b)=>`${b.date||''}${b.odometer||0}`.localeCompare(`${a.date||''}${a.odometer||0}`))}
function calc24(carId){const a=entries24(carId).slice().sort((x,y)=>num24(x.odometer)-num24(y.odometer)||String(x.date).localeCompare(String(y.date)));let liters=0,cost=0,dist=0,segments=[];a.forEach(x=>{liters+=num24(x.liters);cost+=num24(x.total)});for(let i=1;i<a.length;i++){const d=num24(a[i].odometer)-num24(a[i-1].odometer);if(d>0&&!a[i].missedPrevious){dist+=d;segments.push({d,l:num24(a[i].liters),e:a[i]})}}const used=segments.reduce((s,x)=>s+x.l,0);return{liters,cost,dist,l100:dist?used/dist*100:0,kmL:used?dist/used:0,perKm:dist?cost/dist:0}}
function tabs24(){return `<div class="auto-tabs24">${[['fills','⛽','Tankbeurten'],['add','＋','Tanken'],['stats','↗','Statistieken'],['cars','🚗','Voertuigen']].map(x=>`<button data-auto24-tab="${x[0]}" class="${autoTab24===x[0]?'active':''}"><span>${x[1]}</span><b>${x[2]}</b></button>`).join('')}</div>`}
function fillRows24(){const rows=entries24();if(!rows.length)return '<div class="empty24">Nog geen tankbeurten. Voeg je eerste tankbeurt toe.</div>';let month='';return rows.map(x=>{const m=(x.date||'').slice(0,7);let h='';if(m!==month){month=m;const dt=new Date(`${m}-01T12:00:00`);const total=rows.filter(r=>(r.date||'').startsWith(m)).reduce((s,r)=>s+num24(r.total),0);h=`<div class="month24"><strong>${new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric'}).format(dt)}</strong><span>${euro24(total)}</span></div>`}return h+`<article class="fill24"><div class="fuel-dot24">⛽</div><div><strong>${esc(x.station||'Tankstation')}</strong><small>${esc(x.date||'')} · ${esc(x.fuelGrade||'E10')} · ${num24(x.liters).toLocaleString('nl-NL',{maximumFractionDigits:2})} L</small><small>${num24(x.odometer).toLocaleString('nl-NL')} km${x.partialFill?' · deelvulling':''}</small></div><div class="fill-money24"><strong>${euro24(x.total)}</strong><small>${euro24(x.pricePerLiter)}/L</small><button data-auto24-edit="${x.id}">Bewerk</button></div></article>`}).join('')}
function fillForm24(edit=null){ensureCar24();const x=edit||{};if(!data.cars.length)return `<section class="card"><h3>Nog geen voertuig</h3><p>Voeg eerst een voertuig toe. Merk, model, kleur en APK worden daarna automatisch bij RDW opgehaald.</p><button class="primary" data-auto24-newcar>+ Voertuig toevoegen</button></section>`;return `<form class="fuel-form24" data-fuel24-form data-edit-id="${x.id||''}"><div class="form-grid24"><label>Voertuig<select name="carId">${data.cars.map(c=>`<option value="${c.id}" ${x.carId===c.id?'selected':''}>${esc(c.name||c.plate||'Auto')}</option>`).join('')}</select></label><label>Datum<input name="date" type="date" required value="${x.date||date24()}"></label><label>Kilometerstand<input name="odometer" type="number" step="1" required value="${x.odometer??''}"></label><label>Liters<input name="liters" type="number" step="0.01" required value="${x.liters??''}"></label><label>Totaalbedrag €<input name="total" type="number" step="0.01" value="${x.total??''}"></label><label>Prijs per liter €<input name="pricePerLiter" type="number" step="0.001" value="${x.pricePerLiter??''}"></label><label>Brandstof<select name="fuelGrade">${['E10','E5','Diesel','LPG','Anders'].map(v=>`<option ${x.fuelGrade===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Tankstation<input name="station" value="${esc(x.station||'')}"></label><label class="check24"><input name="partialFill" type="checkbox" ${x.partialFill?'checked':''}> Deelvulling</label><label class="check24"><input name="missedPrevious" type="checkbox" ${x.missedPrevious?'checked':''}> Vorige tankbeurt gemist</label><label class="span24">Notitie<textarea name="note">${esc(x.note||'')}</textarea></label></div><div class="form-actions24"><button class="primary" type="submit">${edit?'Wijzigingen opslaan':'Tankbeurt opslaan'}</button>${edit?`<button type="button" class="danger24" data-auto24-delete="${x.id}">Verwijderen</button>`:''}</div></form>`}
function cars24(){ensureCar24();if(!data.cars.length)return `<section class="card empty-car24"><h3>Nog geen voertuigen</h3><p>Voer alleen het kenteken in. Samen Thuis haalt merk, model, kleur en APK automatisch op bij RDW Open Data.</p><button class="primary" data-auto24-newcar>+ Voertuig toevoegen</button></section>`;return `<div class="car-grid24">${data.cars.map(c=>{const st=calc24(c.id),last=entries24(c.id)[0],odo=last?num24(last.odometer):0;return `<article class="car24"><div><small>${c.isDefault?'STANDAARDVOERTUIG':'VOERTUIG'}</small><h3>${esc(c.name||[c.make,c.model].filter(Boolean).join(' ')||'Auto')}</h3><p>${esc([c.make,c.model,c.year].filter(Boolean).join(' · '))}</p><b>${esc(c.plate||'Geen kenteken')}</b>${c.owner?`<p class="rdw-meta24"><span>Eigenaar</span><strong>${esc(c.owner)}</strong></p>`:''}${c.color?`<p class="rdw-meta24"><span>Kleur</span><strong>${esc(c.color)}</strong></p>`:''}${c.tankLiters?`<p class="rdw-meta24"><span>Tankinhoud</span><strong>${num24(c.tankLiters).toLocaleString('nl-NL')} L</strong></p>`:''}${odo?`<p class="rdw-meta24"><span>Laatste km-stand</span><strong>${Math.round(odo).toLocaleString('nl-NL')} km</strong></p>`:''}${c.apkExpiry?`<p class="rdw-meta24"><span>APK geldig t/m</span><strong>${fmtDate(c.apkExpiry,{day:'numeric',month:'long',year:'numeric'})}</strong></p>`:''}</div><div class="car-stats24"><span><b>${st.l100?st.l100.toFixed(1):'—'}</b><small>L/100 km</small></span><span><b>${euro24(st.cost)}</b><small>totaal</small></span><span><b>${Math.round(st.dist).toLocaleString('nl-NL')}</b><small>km gemeten</small></span></div><div class="car-actions24"><button data-auto24-car="${c.id}">Bewerk / RDW vernieuwen</button><button class="danger24" data-auto24-deletecar="${c.id}">Voertuig verwijderen</button></div></article>`}).join('')}</div><button class="primary" data-auto24-newcar>+ Voertuig toevoegen</button>`}
function selectedCars24(){ensureCar24();const valid=statsCars24.filter(id=>data.cars.some(c=>c.id===id));statsCars24=valid;return valid.length?valid:data.cars.map(c=>c.id)}
function statsCarPicker24(){ensureCar24();if(!data.cars.length)return '';const ids=selectedCars24(),all=ids.length===data.cars.length;return `<section class="card stats-filter24"><div class="stats-filter-head24"><div><small>STATISTIEKEN VAN</small><strong>${all?'Alle auto’s':ids.length===1?esc(car24(ids[0])?.name||car24(ids[0])?.plate||'1 auto'):`${ids.length} auto’s geselecteerd`}</strong></div><button data-auto24-allcars class="${all?'active':''}">Alle auto’s</button></div><div class="stats-car-options24">${data.cars.map(c=>`<label class="${ids.includes(c.id)?'selected':''}"><input type="checkbox" data-auto24-statcar="${c.id}" ${ids.includes(c.id)?'checked':''}><span>${esc(c.name||c.plate||'Auto')}<small>${esc(c.plate||'')}</small></span></label>`).join('')}</div>${data.cars.length>1?'<p class="muted">Selecteer één auto, meerdere auto’s of alle auto’s samen.</p>':''}</section>`}
function statsEntriesAll24(){const ids=new Set(selectedCars24());return entries24().filter(x=>ids.has(x.carId))}
function filtered24(){const now=new Date();return statsEntriesAll24().filter(x=>{const d=new Date(`${x.date}T12:00:00`);if(statsPeriod24==='week')return now-d<=7*864e5;if(statsPeriod24==='month')return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();return now-d<=365*864e5})}
function statRows24(){return filtered24().slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function monthCost24(rows){const m={};rows.forEach(x=>{const k=(x.date||'').slice(0,7);if(k)m[k]=(m[k]||0)+num24(x.total)});return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0]))}
function weekdayCost24(rows){const names=['Zo','Ma','Di','Wo','Do','Vr','Za'],v=Array(7).fill(0);rows.forEach(x=>{const d=new Date(`${x.date}T12:00:00`);if(!isNaN(d))v[d.getDay()]+=num24(x.total)});return [1,2,3,4,5,6,0].map(i=>[names[i],v[i]])}
function calcSelected24(){const ids=selectedCars24();let liters=0,cost=0,dist=0,used=0;ids.forEach(id=>{const a=entries24(id).slice().sort((x,y)=>num24(x.odometer)-num24(y.odometer)||String(x.date).localeCompare(String(y.date)));a.forEach(x=>{liters+=num24(x.liters);cost+=num24(x.total)});for(let i=1;i<a.length;i++){const d=num24(a[i].odometer)-num24(a[i-1].odometer);if(d>0&&!a[i].missedPrevious){dist+=d;used+=num24(a[i].liters)}}});return{liters,cost,dist,l100:dist?used/dist*100:0,perKm:dist?cost/dist:0}}
function economySegments24(){const out=[];selectedCars24().forEach(id=>{const a=entries24(id).slice().sort((x,y)=>num24(x.odometer)-num24(y.odometer)||String(x.date).localeCompare(String(y.date)));for(let i=1;i<a.length;i++){const d=num24(a[i].odometer)-num24(a[i-1].odometer),l=num24(a[i].liters);if(d>0&&l>0&&!a[i].missedPrevious&&!a[i].partialFill)out.push({l100:l/d*100,date:a[i].date})}});return out}
function streak24(){const months=[...new Set(statsEntriesAll24().map(x=>(x.date||'').slice(0,7)).filter(Boolean))].sort();let best=0,run=0,prev=null;months.forEach(k=>{const [y,m]=k.split('-').map(Number),n=y*12+m;if(prev!==null&&n===prev+1)run++;else run=1;best=Math.max(best,run);prev=n});return best}
function bars24(rows,cls=''){const max=Math.max(1,...rows.map(x=>x[1]));return `<div class="chart-bars24 ${cls}">${rows.map(([label,val])=>`<div class="chart-col24"><div class="chart-value24">${val?euro24(val):''}</div><div class="chart-track24"><i style="height:${val?Math.max(5,val/max*100):0}%"></i></div><small>${esc(label)}</small></div>`).join('')}</div>`}
function consistency24(){const dates=new Set(statsEntriesAll24().map(x=>x.date).filter(Boolean));const today=new Date(),cells=[];for(let i=83;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);cells.push(`<i class="${dates.has(k)?'hit':''}" title="${k}"></i>`)}return `<div class="heat24">${cells.join('')}</div>`}
function stats24(){
  const e=statRows24(),cost=e.reduce((s,x)=>s+num24(x.total),0),lit=e.reduce((s,x)=>s+num24(x.liters),0),all=calcSelected24(),selectedEntries=statsEntriesAll24();
  const stations={};e.forEach(x=>stations[x.station||'Onbekend']=(stations[x.station||'Onbekend']||0)+num24(x.total));
  const top=Object.entries(stations).sort((a,b)=>b[1]-a[1]).slice(0,6),monthly=monthCost24(e),weekdays=weekdayCost24(e);
  const cheapest=selectedEntries.filter(x=>num24(x.pricePerLiter)>0).sort((a,b)=>num24(a.pricePerLiter)-num24(b.pricePerLiter))[0];
  const biggest=selectedEntries.slice().sort((a,b)=>num24(b.liters)-num24(a.liters))[0],seg=economySegments24(),best=seg.slice().sort((a,b)=>a.l100-b.l100)[0],worst=seg.slice().sort((a,b)=>b.l100-a.l100)[0];
  const annual=statsPeriod24==='year'?cost:statsPeriod24==='month'?cost*12:cost*52;
  return `${statsCarPicker24()}<div class="period24">${[['week','Week'],['month','Maand'],['year','Jaar']].map(x=>`<button data-auto24-period="${x[0]}" class="${statsPeriod24===x[0]?'active':''}">${x[1]}</button>`).join('')}</div>
  <div class="stats-hero24"><div><small>Totaal uitgegeven</small><strong>${euro24(cost)}</strong></div><div><small>Totaal brandstof</small><strong>${lit.toFixed(1)} L</strong></div><div><small>Gem. verbruik</small><strong>${all.l100?all.l100.toFixed(1):'—'} L/100km</strong></div><div><small>Totale afstand</small><strong>${Math.round(all.dist).toLocaleString('nl-NL')} km</strong></div></div>
  <section class="card stats-card24"><h3>Kosten over tijd</h3>${monthly.length?bars24(monthly.map(([k,v])=>[new Intl.DateTimeFormat('nl-NL',{month:'short'}).format(new Date(`${k}-01T12:00:00`)),v]),'months24'):'<p class="muted">Nog geen gegevens.</p>'}</section>
  <section class="card stats-card24"><h3>Uitgaven per weekdag</h3>${bars24(weekdays,'weekdays24')}</section>
  <section class="card stats-card24"><h3>Uitgaven per tankstation</h3>${top.length?top.map(([n,v])=>`<div class="barrow24"><span>${esc(n)}</span><div><i style="width:${Math.max(6,v/top[0][1]*100)}%"></i></div><b>${euro24(v)}</b></div>`).join(''):'<p class="muted">Nog geen gegevens.</p>'}</section>
  <section class="card stats-card24"><h3>Tankbeurt-consistentie</h3><p class="muted">Tankmomenten van de afgelopen 12 weken.</p>${consistency24()}</section>
  <div class="projection24"><article class="card"><small>Geschatte jaarkosten</small><strong>${euro24(annual)}</strong><p>Gebaseerd op de geselecteerde periode.</p></article><article class="card"><small>Kosten per kilometer</small><strong>${all.perKm?euro24(all.perKm)+'/km':'—'}</strong><p>Op basis van de geselecteerde auto’s.</p></article></div>
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
async function air24(force=false){if(current!=='today')return;const dash=document.querySelector('[data-dash18]');if(!dash)return;let card=dash.querySelector('[data-air24]');if(!card){card=document.createElement('section');card.className='air24';card.dataset.air24='';card.dataset.widget18='air';const grid=dash.querySelector('.dg18');grid?.append(card)}if(!card)return;card.innerHTML='<strong>Pollen & luchtkwaliteit</strong><p class="muted">Open-Meteo ophalen…</p>';try{const loc=window.SamenThuisWeatherLocation25?.()||{place:'Rotterdam',lat:51.9225,lon:4.47917},key=`${loc.lat},${loc.lon}`;let q=null;if(!force)try{const c=JSON.parse(localStorage.getItem(AQ24)||'null');if(c&&c.key===key&&Date.now()-c.t<1800000)q=c.q}catch(_){}if(!q){const u=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');u.searchParams.set('latitude',String(loc.lat));u.searchParams.set('longitude',String(loc.lon));u.searchParams.set('current','european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen');u.searchParams.set('timezone','Europe/Amsterdam');const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw 0;q=await r.json();localStorage.setItem(AQ24,JSON.stringify({t:Date.now(),key,q}))}const c=q.current||{};const pol=[['Gras',c.grass_pollen],['Berk',c.birch_pollen],['Els',c.alder_pollen],['Bijvoet',c.mugwort_pollen],['Ambrosia',c.ragweed_pollen]].sort((a,b)=>num24(b[1])-num24(a[1]));card.innerHTML=`<div class="air-head24"><div><small>OPEN-METEO · ${esc(loc.place.toUpperCase())}</small><h3>Pollen & luchtkwaliteit</h3></div><button data-air24-refresh>↻</button></div><div class="aqi24"><span class="aqi-badge24">AQI ${Math.round(num24(c.european_aqi))}</span><div><strong>${aqiText24(c.european_aqi)}</strong><small>PM2.5 ${num24(c.pm2_5).toFixed(1)} · PM10 ${num24(c.pm10).toFixed(1)} µg/m³</small></div></div><div class="pollen-grid24">${pol.map(([n,v])=>`<div><span>${n}</span><b>${level24(v)}</b><small>${num24(v).toFixed(1)} gr/m³</small></div>`).join('')}</div><p class="air-note24">Indicatie van omgevingswaarden; geen persoonlijk medisch advies.</p>`}catch(_){card.innerHTML='<strong>Pollen & luchtkwaliteit</strong><p>Gegevens tijdelijk niet beschikbaar. <button class="text-btn" data-air24-refresh>Opnieuw</button></p>'}}
const baseRender24=render;render=function(...args){if(current==='auto24'){document.querySelector('#view').innerHTML=autoPage24();updateSyncBadge();requestAnimationFrame(nav24);return}const r=baseRender24(...args);requestAnimationFrame(()=>{nav24();air24()});return r};
document.addEventListener('click',e=>{if(e.target.closest('[data-v24-auto]')){current='auto24';render();return}const t=e.target.closest('[data-auto24-tab]');if(t){autoTab24=t.dataset.auto24Tab;render();return}const ed=e.target.closest('[data-auto24-edit]');if(ed){autoTab24='add';document.querySelector('#view').innerHTML=`<div class="auto24"><header class="auto-head24"><div><p class="eyebrow">AUTO & BRANDSTOF</p><h1>Tankbeurt bewerken</h1></div></header>${tabs24()}<section class="auto-body24">${fillForm24(data.fuelEntries.find(x=>x.id===ed.dataset.auto24Edit))}</section></div>`;return}const del=e.target.closest('[data-auto24-delete]');if(del&&confirm('Tankbeurt verwijderen?')){data.fuelEntries=data.fuelEntries.filter(x=>x.id!==del.dataset.auto24Delete);save();autoTab24='fills';render();return}const ca=e.target.closest('[data-auto24-car]');if(ca){editCar24(ca.dataset.auto24Car);return}if(e.target.closest('[data-auto24-newcar]')){editCar24();return}const dc=e.target.closest('[data-auto24-deletecar]');if(dc){deleteCar24(dc.dataset.auto24Deletecar);return}const p=e.target.closest('[data-auto24-period]');if(p){statsPeriod24=p.dataset.auto24Period;render();return}if(e.target.closest('[data-auto24-allcars]')){statsCars24=[];render();return}const sc=e.target.closest('[data-auto24-statcar]');if(sc){const id=sc.dataset.auto24Statcar;const currentIds=selectedCars24();if(sc.checked){statsCars24=[...new Set([...currentIds,id])]}else{statsCars24=currentIds.filter(x=>x!==id);if(!statsCars24.length){sc.checked=true;toast('Selecteer minimaal één auto');return}}render();return}if(e.target.closest('[data-air24-refresh]'))air24(true)});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-fuel24-form]');if(!f)return;e.preventDefault();const fd=new FormData(f),lit=num24(fd.get('liters'));let total=num24(fd.get('total')),price=num24(fd.get('pricePerLiter'));if(!total&&price&&lit)total=price*lit;if(!price&&total&&lit)price=total/lit;const old=data.fuelEntries.find(x=>x.id===f.dataset.editId)||{};const item={...old,id:old.id||id24(),carId:String(fd.get('carId')),date:String(fd.get('date')),odometer:num24(fd.get('odometer')),liters:lit,total,pricePerLiter:price,fuelGrade:String(fd.get('fuelGrade')),station:String(fd.get('station')||''),partialFill:fd.has('partialFill'),missedPrevious:fd.has('missedPrevious'),note:String(fd.get('note')||'')};if(old.id)Object.assign(old,item);else data.fuelEntries.push(item);save();autoTab24='fills';render();toast('Tankbeurt opgeslagen')});
ensureCar24();save({touch:false,sync:false});requestAnimationFrame(()=>{nav24();air24()});
})();

/* build v24.2 · FuelMate stats/charts + vehicle owner/tank capacity + RDW/APK */


/* ===== v24.3 CENTRALE IMPORTPAGINA ===== */
(()=>{'use strict';if(window.__ST243IMPORT)return;window.__ST243IMPORT=1;
let importTarget243='backup', importFile243=null;

const IMPORT243={
 backup:{label:'Volledige Samen Thuis back-up',formats:'JSON',example:'samen-thuis-backup-2026-09-24.json',help:'Voegt een Samen Thuis JSON-back-up samen met je huidige gegevens. Bestaande gegevens worden niet verwijderd.'},
 planning:{label:'Agenda',formats:'Excel · CSV · TXT · JSON',example:'title,date,time,endTime,person,calendarId\nTandarts,2026-10-02,09:30,10:00,Kees,persoonlijk',help:'Velden: title, date (YYYY-MM-DD), time, endTime, person, calendarId.'},
 meals:{label:'Weekmenu',formats:'Excel · CSV · TXT · JSON',example:'title,date,type\nCurry,2026-09-25,Avondeten',help:'Velden: title, date (YYYY-MM-DD), type.'},
 groceries:{label:'Boodschappen',formats:'Excel · CSV · TXT · JSON',example:'title,category,done\nSpinazie,Groente,false',help:'Velden: title, category, done.'},
 chores:{label:'Huishouden',formats:'Excel · CSV · TXT · JSON',example:'title,category,repeat,person,due\nBadkamer schoonmaken,Badkamer,Wekelijks,Samen,2026-09-26',help:'Velden: title, category, repeat, person, due.'},
 stock:{label:'Voorraad',formats:'Excel · CSV · TXT · JSON',example:'title,category,amount,unit,min\nRijst,Voorraadkast,2,pakken,1',help:'Velden: title, category, amount, unit, min.'},
 trips:{label:'Reizen',formats:'Excel · CSV · TXT · JSON',example:'title,type,date,note\nHotel Hanoi,Verblijf,2027-01-11,Inchecken',help:'Velden: title, type, date, note. Bestaande reismappen kunnen daarna in Reizen verder worden ingedeeld.'},
 ideas:{label:'Date ideeën',formats:'Excel · CSV · TXT · JSON',example:'title,category,note\nMuseum,Uitje,Weekend',help:'Velden: title, category, note.'},
 home:{label:'Woning',formats:'Excel · CSV · TXT · JSON',example:'title,category,note\nKit badkamer vervangen,Badkamer,Controleren',help:'Velden: title, category, note.'},
 budget:{label:'Budget',formats:'JSON',example:'{"incomes":{"Kees":0,"Daphne":0},"fixed":[],"goals":[],"contributionPct":75,"houseBudget":1000,"investing":75}',help:'JSON-object met incomes, fixed, goals, contributionPct, houseBudget en investing.'},
 auto:{label:'Auto / FuelMate',formats:'FuelMate JSON · Excel · CSV · Samen Thuis JSON',example:'FuelMate: fuelmate_backup_YYYY-MM-DD.json\nCSV tankbeurten: date,odometer,volume,totalCost,station,partial,missedFill',help:'FuelMate JSON importeert voertuigen én tankbeurten. Een CSV importeert tankbeurten; als er één voertuig is wordt dat automatisch gebruikt.'}
};

function esc243(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderImport243(){
 const x=IMPORT243[importTarget243]||IMPORT243.backup;
 return `<div class="import243">
 <header class="import-head243"><div><p class="eyebrow">SAMEN THUIS · IMPORT</p><h1>Importeren</h1><p>Alle imports op één plek. Kies eerst waarvoor de informatie bedoeld is; hieronder staat precies welk formaat wordt verwacht.</p></div></header>
 <section class="card import-main243">
  <div class="form-grid">
   <label class="field"><span>Wat wil je importeren?</span><select data-import243-target>${Object.entries(IMPORT243).map(([k,v])=>`<option value="${k}" ${k===importTarget243?'selected':''}>${esc243(v.label)}</option>`).join('')}</select></label>
   <label class="field"><span>Bestand</span><input data-import243-file type="file" accept=".json,.csv,.txt,.xlsx,.xls,application/json,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>
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
function plateImport243(v=''){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
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
async function rowsFromExcel243(file){
 if(!window.XLSX)throw new Error('Excel-module kon niet worden geladen. Controleer je internetverbinding en probeer opnieuw.');
 const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array',cellDates:false}),ws=wb.Sheets[wb.SheetNames[0]];
 if(!ws)throw new Error('Het Excel-bestand bevat geen werkblad');
 return XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
}
function arraysDeep243(obj){const found=[],seen=new Set();function walk(v,path=''){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(Array.isArray(v)){if(v.length&&v.some(x=>x&&typeof x==='object'))found.push({path,rows:v});v.forEach((x,i)=>walk(x,`${path}[${i}]`));return}Object.entries(v).forEach(([k,x])=>walk(x,path?`${path}.${k}`:k))}walk(obj);return found}
function pickArray243(obj,names){const direct=names.map(n=>obj?.[n]).find(Array.isArray);if(direct)return direct;const all=arraysDeep243(obj),lower=names.map(x=>x.toLowerCase());return all.find(x=>lower.some(n=>x.path.toLowerCase().endsWith(n)))?.rows||[]}
function fuelMate243(obj){
 data.cars ||= []; data.fuelEntries ||= [];const vehicles=pickArray243(obj,['vehicles','vehicle','cars','autos','voertuigen']),fills=pickArray243(obj,['fillups','fillUps','fuelEntries','fills','refuels','tankbeurten']);
 if(!vehicles.length&&!fills.length)throw new Error('Geen voertuigen of tankbeurten gevonden in deze JSON');
 const map=new Map();
 vehicles.forEach((v,i)=>{const raw=v.plate??v.licensePlate??v.kenteken??v.registration??'',mm=v.makeModel??v.make_model??v.vehicleName??'',make=v.make??v.brand??v.merk??String(mm).split(' ')[0]??'',model=v.model??v.handelsbenaming??String(mm).split(' ').slice(1).join(' '),old=String(v.id??v.vehicleId??v.uuid??i),plate=plateImport243(raw),existing=data.cars.find(x=>plate&&plateImport243(x.plate)===plate),c=existing||{id:`imp-car-${Date.now()}-${i}`,isDefault:!!(v.isDefault??v.default??v.primary)};Object.assign(c,{name:(v.name??v.nickname??[make,model].filter(Boolean).join(' ')??'')||plate||`Voertuig ${i+1}`,make,model,year:v.year??v.buildYear??v.bouwjaar??'',plate,tankLiters:num243(v.tankLiters??v.tankCapacity??v.tankSize??v.tankinhoud),owner:v.owner??v.eigenaar??''});if(!existing)data.cars.push(c);map.set(old,c.id)});
 fills.forEach((f,i)=>{let carId=map.get(String(f.vehicleId??f.carId??f.vehicle_id??f.vehicle??''));if(!carId&&data.cars.length===1)carId=data.cars[0].id;if(!carId)carId=data.cars.find(x=>x.isDefault)?.id||data.cars[0]?.id;if(!carId)return;data.fuelEntries.push(SamenThuisCore.normalizeFuelMateFill(f,carId,`imp-fill-${Date.now()}-${i}`))})
}
function sigImport246(x,kind=''){if(!x||typeof x!=='object')return String(x);if(kind==='cars')return plateImport243(x.plate||'')||String(x.id||'');if(kind==='fuelEntries')return [x.carId||'',String(x.date||'').slice(0,10),num243(x.odometer),num243(x.liters||x.volume),num243(x.total||x.totalCost)].join('|');if(kind==='planning')return [x.title||'',x.date||'',x.time||'',x.person||''].join('|').toLowerCase();return String(x.id||[x.title||x.name||'',x.date||x.due||'',x.category||''].join('|')).toLowerCase()}
function mergeArray246(a,b,kind=''){return SamenThuisCore.mergeUnique(a,b,x=>sigImport246(x,kind))}
function mergeBackup246(raw){const incoming=typeof migrateData==='function'?migrateData(raw):raw;if(!incoming||typeof incoming!=='object')throw new Error('Ongeldige Samen Thuis back-up');const keys=['planning','meals','groceries','chores','stock','trips','ideas','home','freezer','cars','fuelEntries'];keys.forEach(k=>{if(Array.isArray(incoming[k]))data[k]=mergeArray246(data[k],incoming[k],k)});Object.entries(incoming).forEach(([k,v])=>{if(keys.includes(k)||v==null)return;if(k==='sportCoach'&&v&&typeof v==='object'){const old=data.sportCoach&&typeof data.sportCoach==='object'?data.sportCoach:{},merged={...v,...old};merged.profiles={...(v.profiles||{}),...(old.profiles||{})};['programs','sessions','sources','exercises','evaluations','library','plans'].forEach(key=>{merged[key]=mergeArray246(old[key],v[key],key)});merged.favorites=[...new Set([...(v.favorites||[]),...(old.favorites||[])])];merged.libraryCategories=[...new Set([...(v.libraryCategories||[]),...(old.libraryCategories||[])])];merged.activeWorkouts={...(v.activeWorkouts||{}),...(old.activeWorkouts||{})};merged.settings={...(v.settings||{}),...(old.settings||{})};data.sportCoach=merged;return}if(v&&typeof v==='object'&&!Array.isArray(v)){data[k]={...v,...((data[k]&&typeof data[k]==='object'&&!Array.isArray(data[k]))?data[k]:{})}}else if(data[k]===undefined||data[k]===null||data[k]==='')data[k]=v})}
async function runImport243(){
 if(!importFile243)return toast('Kies eerst een bestand');
 try{
  const ext=importFile243.name.split('.').pop().toLowerCase(), text=(ext==='xlsx'||ext==='xls')?'':await importFile243.text();
  if(importTarget243==='backup'){if(ext!=='json')throw new Error('Voor een volledige back-up is JSON nodig');mergeBackup246(JSON.parse(text));save();render();toast('Back-up samengevoegd · bestaande gegevens behouden');return}
  if(importTarget243==='budget'){const o=JSON.parse(text);data.budgetV23={...o,...(data.budgetV23||{})};save();render();toast('Budget samengevoegd · bestaande waarden behouden');return}
  if(importTarget243==='auto'){
   if(ext==='json'){fuelMate243(JSON.parse(text))}
   else{const rows=(ext==='xlsx'||ext==='xls')?await rowsFromExcel243(importFile243):csv243(text);data.cars ||= []; data.fuelEntries ||= [];if(!data.cars.length)throw new Error('Voeg eerst een voertuig toe of gebruik een FuelMate JSON-back-up');const car=data.cars.length===1?data.cars[0]:data.cars.find(x=>x.isDefault)||data.cars[0];rows.forEach((r,i)=>{const liters=num243(r.volume||r.liters),total=num243(r.totalCost||r.total);data.fuelEntries.push({id:`csv-fill-${Date.now()}-${i}`,carId:car.id,date:String(r.date||r.datum||'').slice(0,10),odometer:num243(r.odometer||r.kilometerstand),liters,total,pricePerLiter:num243(r.pricePerLiter)||(liters?total/liters:0),fuelGrade:r.grade||r.fuelGrade||'',station:r.station||r.tankstation||'',partialFill:bool243(r.partial||r.partialFill),missedPrevious:bool243(r.missedFill||r.missedPrevious),note:r.note||r.notitie||''})})}
   data.fuelEntries=mergeArray246([],data.fuelEntries,'fuelEntries');save();render();toast('Auto-informatie samengevoegd · bestaande gegevens behouden');return
  }
  const key=arrayKey243(importTarget243);if(!key)throw new Error('Onbekend importdoel');
  let rows;if(ext==='json'){const o=JSON.parse(text);rows=Array.isArray(o)?o:(Array.isArray(o[key])?o[key]:pickArray243(o,[key,importTarget243]))}else if(ext==='xlsx'||ext==='xls')rows=await rowsFromExcel243(importFile243);else rows=csv243(text);
  if(!rows.length)throw new Error('Geen regels gevonden');
  data[key] ||= [];const incomingRows=rows.map(r=>normalize243(importTarget243,r)).filter(r=>r.title);data[key]=mergeArray246(data[key],incomingRows,key);save();render();toast(`${incomingRows.length} regels verwerkt · bestaande gegevens behouden`);
 }catch(err){console.error(err);toast(err?.message||'Importeren is mislukt')}
}
function template243(){
 const x=IMPORT243[importTarget243],isJson=['backup','budget','auto'].includes(importTarget243);
 let content=x.example,name=`samen-thuis-${importTarget243}-voorbeeld.${isJson?'json':'csv'}`;
 if(importTarget243==='backup')content=JSON.stringify({planning:[],meals:[],groceries:[],chores:[],stock:[],trips:[],ideas:[],home:[],freezer:[],cars:[],fuelEntries:[],budgetV23:{}},null,2);
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

/* build v24.5 · fix Auto JSON/Excel importer scope (cars/fuelEntries/plate) */

/* build v24.6 · veilige merge-import */

/* build v24.7 · logische Auto-tabs + statistieken per geselecteerde auto(s) */


/* =========================================================
   SAMEN THUIS v24.8 — LOGISCHE LIQUID-GLASS ONDERNAVIGATIE
   Volgorde: dagelijks -> huishouden -> geld/auto -> plannen -> beheer.
   Auto en Import blijven hun bestaande handlers gebruiken.
   ========================================================= */
(()=>{'use strict';
 if(window.__ST248_DOCK__)return;window.__ST248_DOCK__=true;
 const ORDER248=['today','planning','tasks','groceries','stock','offers','budget19','meals','chores','challenges','weather','programs','ideas','home','trips','auto24','extra19','imports243','settings'];
 const LABEL248={today:'Dashboard',planning:'Agenda',tasks:'Taken',groceries:'Boodschappen',stock:'Voorraad',offers:'Aanbiedingen',budget19:'Budget',meals:'Weekmenu',chores:'Huishouden',challenges:'Challenges',weather:'Weer',programs:"Programma's",ideas:'Date ideeën',home:'Woning',trips:'Reizen',auto24:'Auto',extra19:'Extra',imports243:'Importeren',settings:'Instellingen'};
 function actualKey248(b){if(b.dataset.nav23)return b.dataset.nav23;if(b.hasAttribute('data-v24-auto'))return 'auto24';if(b.hasAttribute('data-import243-go'))return 'imports243';return ''}
 function arrangeDesktop248(){
   const nav=document.querySelector('.sidebar nav');if(!nav)return;
   const buttons=[...nav.querySelectorAll(':scope > button')],map=new Map(buttons.map(b=>[b.dataset.v19Go||(b.hasAttribute('data-v24-auto')?'auto24':b.hasAttribute('data-import243-go')?'imports243':''),b]));
   ORDER248.forEach(k=>{const b=map.get(k);if(!b)return;b.classList.toggle('active',current===k);nav.appendChild(b)});
 }
 function arrange248(){
   const sc=document.querySelector('.mobile-nav-scroll23');if(!sc){arrangeDesktop248();return}
   const buttons=[...sc.querySelectorAll(':scope > button')],map=new Map(buttons.map(b=>[actualKey248(b),b]));
   ORDER248.forEach(k=>{const b=map.get(k);if(!b)return;b.classList.toggle('active',current===k);const small=b.querySelector('small');if(small)small.textContent=LABEL248[k]||small.textContent;sc.appendChild(b)});
   sc.dataset.glass248='true';
   arrangeDesktop248();
 }
 const base248=render;
 render=function(...args){const r=base248(...args);requestAnimationFrame(()=>requestAnimationFrame(arrange248));return r};
 const observer248=new MutationObserver(()=>requestAnimationFrame(()=>{arrange248();arrangeDesktop248()}));
 const start248=()=>{const n=document.querySelector('#mobileNav23');if(n)observer248.observe(n,{childList:true,subtree:true});arrange248()};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start248,{once:true});else start248();
 requestAnimationFrame(()=>requestAnimationFrame(()=>{arrange248();arrangeDesktop248()}));
})();
/* build v24.8 · liquid glass dock + logical navigation order */

function getSyncConflict() {
  return syncConflictStore.get();
}

function renderSyncConflictCard() {
  const conflict = getSyncConflict();
  if (!conflict) return '';
  const date = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'onbekend' : parsed.toLocaleString('nl-NL');
  };
  return `<section class="card settings-card sync-conflict"><div class="card-head"><div><p class="eyebrow">SYNCHRONISATIECONFLICT</p><h2>Beide apparaten zijn gewijzigd</h2></div><span class="tag red">Actie nodig</span></div><p>Er zijn sinds de vorige synchronisatie wijzigingen op beide apparaten. Kies welke volledige versie leidend wordt. De andere versie blijft bewaard in de conflictback-up op dit apparaat totdat de keuze succesvol is gesynchroniseerd.</p><p><strong>Dit apparaat:</strong> ${esc(date(conflict.localUpdatedAt))}<br><strong>Andere apparaat:</strong> ${esc(date(conflict.remoteUpdatedAt))}</p><div class="button-row"><button class="primary" data-sync-conflict-choice="local">Deze apparaatversie gebruiken</button><button class="secondary" data-sync-conflict-choice="remote">Andere apparaatversie gebruiken</button></div></section>`;
}

async function uploadSyncData(baseUrl, householdId, expectedRemoteRow = null) {
  const payload = await encryptData(data, syncConfig.householdCode);
  const row = { id: householdId, payload, updated_at: data.meta.updatedAt };
  let upload;
  if (expectedRemoteRow) {
    const filters = new URLSearchParams({
      id: `eq.${householdId}`,
      updated_at: expectedRemoteRow.updated_at ? `eq.${expectedRemoteRow.updated_at}` : 'is.null'
    });
    upload = await fetch(`${baseUrl}/rest/v1/household_data?${filters}`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    if (!upload.ok) throw new Error(`Opslaan gaf ${upload.status}`);
    const updatedRows = await upload.json();
    if (!SamenThuisCore.conditionalUpdateSucceeded(updatedRows)) throw new Error('De andere versie is ondertussen bijgewerkt. Synchroniseer opnieuw om de wijzigingen te vergelijken.');
    return;
  }
  upload = await fetch(`${baseUrl}/rest/v1/household_data?on_conflict=id`, {
    method: 'POST', headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row)
  });
  if (!upload.ok) throw new Error(`Opslaan gaf ${upload.status}`);
}

document.addEventListener('click', event => {
  const choice = event.target.closest('[data-sync-conflict-choice]');
  if (!choice) return;
  if (syncing) return;
  const conflict = getSyncConflict();
  if (!conflict) return;
  if (!conflict.resolution && !['local', 'remote'].includes(choice.dataset.syncConflictChoice)) {
    toast('Kies een geldige versie om de synchronisatie te hervatten.');
    return;
  }
  let selection;
  try {
    selection = SamenThuisCore.resolveSyncConflict(
      conflict, choice.dataset.syncConflictChoice, clone, new Date().toISOString()
    );
  } catch (error) {
    toast(error.message);
    return;
  }
  const pending = { ...conflict, resolution: selection.choice, selectedData: clone(selection.data) };
  if (!syncConflictStore.store(pending)) {
    toast('De keuze kan niet veilig worden bewaard omdat browseropslag vol is. Maak ruimte en probeer opnieuw.');
    return;
  }
  syncConflictResolution = selection.choice;
  data = selection.data;
  save({ touch: false, sync: false });
  render();
  syncNow({ manual: true });
});

/* v25 · standalone forecast page and device-local dashboard editor */
(() => {
  'use strict';
  if (window.__ST_V25_INTEGRATION__) return;
  window.__ST_V25_INTEGRATION__ = true;

  const DASH_KEY = 'samenThuisDashboardWidgetsV25';
  const DASH_WIDGETS = window.SamenThuisDashboard.CATALOG.map(([id, label]) => [id, label]);
  const DASH_DEFAULTS = DASH_WIDGETS.map(([id]) => id);
  const DASH_DEFAULT_VISIBLE = window.SamenThuisDashboard.CATALOG.filter(([, , visible]) => visible).map(([id]) => id);
  const dashboardCore = window.SamenThuisDashboard;
  const WEATHER_KEY = 'samenThuisWeatherForecastV25';
  const DEFAULT_LOCATION = { place: 'Rotterdam', lat: 51.9225, lon: 4.47917 };
  const weatherCode25 = {
    0: 'Helder', 1: 'Overwegend helder', 2: 'Half bewolkt', 3: 'Bewolkt',
    45: 'Mist', 48: 'Rijpmist', 51: 'Lichte motregen', 53: 'Motregen',
    55: 'Zware motregen', 61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen',
    71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 80: 'Lichte buien',
    81: 'Buien', 82: 'Zware buien', 95: 'Onweer', 96: 'Onweer met hagel',
    99: 'Zwaar onweer met hagel'
  };
  let dashboard25 = loadDashboard25();

  function normalizeDashboard25(saved) {
    if (dashboardCore) return dashboardCore.normalize(saved, DASH_DEFAULTS, DASH_DEFAULT_VISIBLE);
    const base = saved && typeof saved === 'object' ? saved : {};
    const order = Array.isArray(base.order) ? base.order.filter(id => DASH_DEFAULTS.includes(id)) : [];
    return {
      order: [...new Set([...order, ...DASH_DEFAULTS])],
      visible: Object.fromEntries(DASH_DEFAULTS.map(id => [id,
        Object.hasOwn(base.visible || {}, id) ? base.visible[id] !== false : DASH_DEFAULT_VISIBLE.includes(id)]))
    };
  }

  function loadDashboard25() {
    try {
      const saved = JSON.parse(localStorage.getItem(DASH_KEY) || 'null');
      return normalizeDashboard25(saved);
    } catch (_) { return normalizeDashboard25(null); }
  }

  function saveDashboard25() {
    try { localStorage.setItem(DASH_KEY, JSON.stringify(dashboard25)); } catch (_) {}
    window.dispatchEvent(new Event('samenThuisPreferencesChange'));
  }

  window.SamenThuisDashboardPreferences25 = {
    get() { return JSON.parse(JSON.stringify(dashboard25)); },
    set(value) {
      dashboard25 = normalizeDashboard25(value);
      saveDashboard25();
      applyDashboard25();
    }
  };

  function dashboardEditor25() {
    const rows = dashboard25.order.map((id, index) => {
      const label = DASH_WIDGETS.find(([widget]) => widget === id)?.[1] || id;
      return `<div class="setting-row dashboard-setting-row25"><label><input type="checkbox" data-dashboard-visible="${id}" ${dashboard25.visible[id] ? 'checked' : ''}> ${esc(label)}</label><span><button type="button" class="secondary" data-dashboard-move="${id}" data-direction="-1" aria-label="${esc(label)} omhoog" ${index === 0 ? 'disabled' : ''}>↑</button> <button type="button" class="secondary" data-dashboard-move="${id}" data-direction="1" aria-label="${esc(label)} omlaag" ${index === dashboard25.order.length - 1 ? 'disabled' : ''}>↓</button></span></div>`;
    }).join('');
    const preview = dashboard25.order.filter(id => dashboard25.visible[id]).map(id =>
      `<li>${esc(DASH_WIDGETS.find(([widget]) => widget === id)?.[1] || id)}</li>`).join('');
    return `<section class="card settings-card dashboard-editor25"><div class="card-head"><div><p class="eyebrow">DASHBOARD AANPASSEN</p><h2>Dashboardonderdelen</h2></div></div><p class="muted">Zet dashboardonderdelen aan of uit en verplaats ze. Verborgen onderdelen blijven bestaan en pagina's en navigatie veranderen niet. Zonder account worden voorkeuren alleen op dit apparaat bewaard.</p><div class="dashboard-preview25"><strong>Voorbeeld van je dashboard (${dashboard25.order.filter(id => dashboard25.visible[id]).length} onderdelen)</strong><ol>${preview || '<li>Geen onderdelen geselecteerd</li>'}</ol></div>${rows}<div class="button-row"><button type="button" class="secondary" data-dashboard-reset>Standaardindeling herstellen</button></div></section>`;
  }

  function dashboardCard25(id, eyebrow, title, detail, page) {
    return `<section class="dashboard-page-widget25 card" data-widget18="${id}"><div><p class="eyebrow">${esc(eyebrow)}</p><h3>${esc(title)}</h3>${detail ? `<p>${esc(detail)}</p>` : ''}</div><a class="secondary" href="#/${page}" data-v19-go="${page}" aria-label="Open ${esc(title)}">Open →</a></section>`;
  }

  function dashboardListCard25(id, eyebrow, title, page, rows, emptyText) {
    const list = rows.length ? `<ul class="dashboard-mini-list25">${rows.map(row => `<li>${esc(row)}</li>`).join('')}</ul>` : `<p>${esc(emptyText)}</p>`;
    return `<section class="dashboard-page-widget25 card" data-widget18="${id}"><div><p class="eyebrow">${esc(eyebrow)}</p><h3>${esc(title)}</h3>${list}</div><a class="secondary" href="#/${page}" data-v19-go="${page}" aria-label="Open ${esc(title)}">Open →</a></section>`;
  }

  const dashboardBuilders25 = {
    quote: () => `<div class="dashboard-quote25" data-widget18="quote">${renderQuote()}</div>`,
    chalkboard: () => chalkboardMarkup25(),
    budget: () => dashboardCard25('budget', 'BUDGET', 'Budgetoverzicht', data.budgetV23?.financialLedger
      ? `Huishoudsaldo ${moneyLedger25(ledgerCore25.availableCashCents(ledgerCore25.normalize(data.budgetV23.financialLedger)))}`
      : 'Bekijk planning, potjes en spaardoelen', 'budget19'),
    savings: () => dashboardListCard25('savings', 'SPAREN', 'Spaardoelen en potjes', 'budget19',
      (data.budgetV23?.goals || []).slice(0, 4).map(goal => {
        const saved = window.SamenThuisSavings?.balance(goal) ?? Number(goal.current || 0);
        return `${goal.title || 'Spaardoel'} · ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(saved) || 0)}`;
      }), 'Nog geen spaardoelen'),
    car: () => dashboardCard25('car', 'AUTO', 'Auto',
      `${(data.cars || []).length} voertuigen · ${(data.fuelEntries || []).length} tankbeurten`, 'auto24'),
    tasks: () => dashboardListCard25('tasks', 'TAKEN', 'Taken', 'tasks',
      (data.tasks || []).filter(item => !item.done).slice(0, 4).map(item => item.title || 'Taak'), 'Geen openstaande taken'),
    groceries: () => dashboardListCard25('groceries', 'BOODSCHAPPEN', 'Boodschappen', 'groceries',
      (data.groceries || []).filter(item => !item.done).slice(0, 4).map(item => item.title || 'Boodschap'), 'De lijst is leeg')
  };

  function applyDashboard25() {
    const grid = document.querySelector('[data-dash18] .dg18');
    if (!grid) return;
    document.querySelectorAll('[data-widget18]').forEach(node => {
      const id = node.dataset.widget18;
      if (Object.hasOwn(dashboard25.visible, id)) node.hidden = !dashboard25.visible[id];
    });
    document.querySelectorAll('[data-dashboard-group]').forEach(group => {
      group.hidden = ![...group.querySelectorAll('[data-widget18]')].some(node => !node.hidden);
    });
    const nodes = new Map([...grid.children].map(node => {
      const id = node.dataset.widget18 || (node.matches('[data-air24]') ? 'air' : '');
      return [id, node];
    }).filter(([id]) => id));
    Object.keys(dashboardBuilders25).forEach(id => {
      if (nodes.has(id) || !dashboard25.visible[id]) return;
      grid.insertAdjacentHTML('beforeend', dashboardBuilders25[id]());
      const node = grid.querySelector(`[data-widget18="${id}"]`);
      if (node) nodes.set(id, node);
    });
    dashboard25.order.forEach(id => {
      const node = nodes.get(id);
      if (!node) return;
      node.hidden = !dashboard25.visible[id];
      grid.append(node);
    });
    grid.hidden = ![...grid.children].some(node => !node.hidden);
    if (dashboard25.visible.chalkboard) refreshChalkboard25(false);
  }

  let ledgerMonth25 = todayISO().slice(0, 7);
  let ledgerEdit25 = null;
  let ledgerConfigEdit25 = null;
  const ledgerCore25 = window.SamenThuisBudgetLedger;
  const moneyLedger25 = value => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format((Number(value) || 0) / 100);
  const decimalLedger25 = value => (Number(value || 0) / 100).toFixed(2);
  const plannedMonthlyLedger25 = item => {
    const divisor = item.period === 'jaar' || item.period === 'yearly' ? 12
      : item.period === 'kwartaal' || item.period === 'quarterly' ? 3 : 1;
    return Math.round((Number(item.amount || 0) / divisor) * 100);
  };

  function ledgerBudget25() {
    const budget = data.budgetV23 || {};
    budget.houseCategories = Array.isArray(budget.houseCategories) ? budget.houseCategories : [];
    budget.fixed = Array.isArray(budget.fixed) ? budget.fixed : [];
    budget.goals = Array.isArray(budget.goals) ? budget.goals : [];
    return budget;
  }

  function ledgerPots25(budget = ledgerBudget25()) {
    const pots = [];
    budget.houseCategories.forEach((item, index) => pots.push({
      id: `category:${item.id || String(item.title || `huisbudget-${index}`).toLocaleLowerCase('nl-NL')}`,
      label: item.title || `Huisbudget ${index + 1}`, kind: 'house',
      plannedCents: Math.round((Number(item.amount) || 0) * 100)
    }));
    budget.fixed.forEach((item, index) => pots.push({
      id: `fixed:${item.id || String(item.title || `last-${index}`).toLocaleLowerCase('nl-NL')}`,
      label: item.title || `Vaste last ${index + 1}`, kind: 'fixed',
      plannedCents: plannedMonthlyLedger25(item)
    }));
    budget.goals.forEach((item, index) => pots.push({
      id: `goal:${item.id || String(item.title || `doel-${index}`).toLocaleLowerCase('nl-NL')}`,
      label: item.title || `Spaardoel ${index + 1}`, kind: 'goal',
      plannedCents: Math.round((Number(item.monthly) || 0) * 100)
    }));
    return pots;
  }

  function ledgerState25(budget = ledgerBudget25(), pots = ledgerPots25(budget)) {
    if (!ledgerCore25) return null;
    const current = budget.financialLedger;
    const ledger = ledgerCore25.normalize(current);
    let changed = !current || !Array.isArray(current.incomes) || !Array.isArray(current.expenses)
      || !Array.isArray(current.transfers) || !current.openingBalances || !current.goalSnapshots || !current.potSnapshots;
    const activePotIds = new Set(pots.map(pot => pot.id));
    pots.forEach(pot => {
      const previous = ledger.potSnapshots[pot.id];
      const next = { label: pot.label, kind: pot.kind, plannedCents: pot.plannedCents, active: true };
      if (!previous || previous.label !== next.label || previous.kind !== next.kind
        || previous.plannedCents !== next.plannedCents || previous.active !== true) changed = true;
      ledger.potSnapshots[pot.id] = next;
    });
    Object.keys(ledger.potSnapshots).forEach(potId => {
      if (activePotIds.has(potId)) return;
      if (ledger.potSnapshots[potId].active !== false) changed = true;
      ledger.potSnapshots[potId] = { ...ledger.potSnapshots[potId], active: false };
    });
    Object.keys(ledgerCore25.allPotBalances(ledger, pots)).forEach(potId => {
      if (ledger.potSnapshots[potId]) return;
      ledger.potSnapshots[potId] = { label: 'Verwijderd potje', kind: 'archived', plannedCents: 0, active: false };
      changed = true;
    });
    budget.goals.forEach((goal, index) => {
      const pot = pots.find(item => item.id === `goal:${goal.id || String(goal.title || `doel-${index}`).toLocaleLowerCase('nl-NL')}`);
      if (!pot) return;
      const saved = window.SamenThuisSavings?.balance(goal) ?? Number(goal.current || 0);
      const balance = Math.round((Number(saved) || 0) * 100);
      const key = String(goal.id || pot.id);
      if (!Object.hasOwn(ledger.goalSnapshots, key)) {
        ledger.goalSnapshots[key] = balance;
        if (!Object.hasOwn(ledger.openingBalances, pot.id)) ledger.openingBalances[pot.id] = balance;
        changed = true;
      } else {
        const previous = Number(ledger.goalSnapshots[key]) || 0;
        if (previous !== balance) {
          ledger.openingBalances[pot.id] = (Number(ledger.openingBalances[pot.id]) || 0) + balance - previous;
          ledger.goalSnapshots[key] = balance;
          changed = true;
        }
      }
    });
    budget.financialLedger = ledger;
    if (changed) save({ touch: false });
    return ledger;
  }

  function ledgerPotHistory25(ledger, activePots) {
    const activeIds = new Set(activePots.map(pot => pot.id));
    const balances = ledgerCore25.allPotBalances(ledger, activePots);
    const ids = new Set([...Object.keys(ledger.potSnapshots || {}), ...Object.keys(balances)]);
    return [...activePots, ...[...ids].filter(id => !activeIds.has(id)).map(id => ({
      id, ...(ledger.potSnapshots[id] || { label: 'Verwijderd potje', kind: 'archived', plannedCents: 0 }),
      archived: true
    }))];
  }

  function syncGoalMirrors25(ledger, budget = ledgerBudget25()) {
    const savings = window.SamenThuisSavings;
    if (!savings) return;
    const movements = new Map();
    const addMovement = (potId, amountCents, date, key, note) => {
      if (!String(potId || '').startsWith('goal:') || !amountCents) return;
      const goal = budget.goals.find((item, index) =>
        `goal:${item.id || String(item.title || `doel-${index}`).toLocaleLowerCase('nl-NL')}` === potId);
      if (!goal) return;
      const goalId = String(goal.id || potId);
      if (!movements.has(goalId)) movements.set(goalId, []);
      movements.get(goalId).push({
        id: `budget-ledger:${key}`, externalId: `budget-ledger:${key}`,
        amount: Number(amountCents) / 100, date, note, source: 'budget-ledger'
      });
    };
    ledger.incomes.forEach(income => (income.allocations || []).forEach(allocation =>
      addMovement(allocation.potId, allocation.amountCents, income.date, `allocation:${allocation.id}`, `Toewijzing van ${income.source}`)));
    ledger.expenses.forEach(expense =>
      addMovement(expense.potId, -Number(expense.amountCents || 0), expense.date, `expense:${expense.id}`, expense.description));
    ledger.transfers.forEach(transfer => {
      addMovement(transfer.fromPotId, -Number(transfer.amountCents || 0), transfer.date, `transfer-out:${transfer.id}`, transfer.description || 'Interne verschuiving');
      addMovement(transfer.toPotId, Number(transfer.amountCents || 0), transfer.date, `transfer-in:${transfer.id}`, transfer.description || 'Interne verschuiving');
    });
    budget.goals.forEach(goal => {
      goal.deposits = Array.isArray(goal.deposits) ? goal.deposits : [];
      const retained = goal.deposits.filter(deposit => !String(deposit.externalId || '').startsWith('budget-ledger:'));
      const expected = movements.get(String(goal.id)) || [];
      goal.deposits = [...retained, ...expected.map(movement => ({
        ...movement,
        amount: Math.round(movement.amount * 100) / 100,
        sig: `${movement.date}|${movement.amount}|${movement.note.toLowerCase()}|${movement.source}`
      }))];
      const goalBalance = savings.balance(goal);
      ledger.goalSnapshots[String(goal.id)] = Math.round(goalBalance * 100);
    });
  }

  function ledgerNode25(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function ledgerInput25(name, type = 'text', values = {}) {
    const input = ledgerNode25('input');
    input.name = name;
    input.type = type;
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'required') input.required = Boolean(value);
      else if (key === 'value') input.value = String(value ?? '');
      else input.setAttribute(key, String(value));
    });
    return input;
  }

  function ledgerSelect25(name, options, required = true) {
    const select = ledgerNode25('select');
    select.name = name;
    select.required = required;
    options.forEach(({ value, label, selected }) => {
      const option = ledgerNode25('option', '', label);
      option.value = value;
      if (selected) option.selected = true;
      select.append(option);
    });
    return select;
  }

  function ledgerField25(labelText, control, wide = false) {
    const label = ledgerNode25('label', wide ? 'ledger-wide25' : '');
    label.append(document.createTextNode(labelText), control);
    return label;
  }

  function ledgerButton25(text, className = 'secondary', type = 'button', attributes = {}) {
    const button = ledgerNode25('button', className, text);
    button.type = type;
    Object.entries(attributes).forEach(([name, value]) => button.setAttribute(name, String(value)));
    return button;
  }

  function ledgerEditFormMarkup25(ledger, pots) {
    if (!ledgerEdit25) return null;
    const { kind, id: entryId } = ledgerEdit25;
    if (!['incomes', 'expenses', 'transfers'].includes(kind)) { ledgerEdit25 = null; return null; }
    const entry = ledger[kind]?.find(item => item.id === entryId);
    if (!entry) { ledgerEdit25 = null; return null; }
    const potSelect = (name, selected, label) => ledgerField25(label, ledgerSelect25(name,
      pots.map(pot => ({ value: pot.id, label: pot.label, selected: pot.id === selected }))));
    const fields = ledgerNode25('div', 'ledger-fields25');
    fields.append(
      ledgerField25('Bedrag (€)', ledgerInput25('amount', 'number', {
        step: '0.01', min: '0.01', inputmode: 'decimal', value: decimalLedger25(entry.amountCents), required: true
      })),
      ledgerField25('Datum', ledgerInput25('date', 'date', { value: entry.date, required: true }))
    );
    if (kind === 'incomes') {
      fields.append(
        ledgerField25('Boekingsmaand', ledgerInput25('month', 'month', { value: entry.month || entry.date.slice(0, 7), required: true })),
        ledgerField25('Persoon / bron', ledgerInput25('source', 'text', { value: entry.source || '', maxlength: '80', required: true })),
        ledgerField25('Omschrijving', ledgerInput25('description', 'text', { value: entry.description || '', maxlength: '160' }), true)
      );
    } else if (kind === 'expenses') {
      const categories = ['Boodschappen', 'Tanken', 'Vaste lasten', 'Abonnementen', 'Persoonlijk', 'Huishouden', 'Overig'];
      fields.append(
        ledgerField25('Categorie', ledgerSelect25('category', categories.map(category => ({
          value: category, label: category, selected: category === entry.category
        })))),
        potSelect('potId', entry.potId, 'Potje'),
        ledgerField25('Persoon (optioneel)', ledgerInput25('person', 'text', { value: entry.person || '', maxlength: '80' })),
        ledgerField25('Omschrijving', ledgerInput25('description', 'text', {
          value: entry.description || '', maxlength: '160', required: true
        }), true)
      );
    } else {
      fields.append(
        potSelect('fromPotId', entry.fromPotId, 'Van potje'),
        potSelect('toPotId', entry.toPotId, 'Naar potje'),
        ledgerField25('Omschrijving', ledgerInput25('description', 'text', { value: entry.description || '', maxlength: '160' }), true)
      );
    }
    const form = ledgerNode25('form', 'ledger-form25');
    form.dataset.ledgerEdit = kind;
    form.dataset.entryId = entryId;
    form.append(ledgerNode25('h3', '', 'Boeking corrigeren'), fields);
    const actions = ledgerNode25('div', 'button-row');
    actions.append(
      ledgerButton25('Wijziging controleren', 'primary', 'submit'),
      ledgerButton25('Annuleren', 'secondary', 'button', { 'data-ledger-cancel-edit': '' })
    );
    form.append(actions);
    return form;
  }

  function ledgerMarkup25() {
    const budget = ledgerBudget25(), pots = ledgerPots25(budget), ledger = ledgerState25(budget, pots);
    if (!ledger) {
      const section = ledgerNode25('section', 'card');
      const message = ledgerNode25('p', '', 'De financiële administratie is niet beschikbaar in deze browser.');
      message.setAttribute('role', 'alert');
      section.append(message);
      return section;
    }
    const allPots = ledgerPotHistory25(ledger, pots);
    const summary = ledgerCore25.monthSummary(ledger, ledgerMonth25, allPots);
    const cashflow = ledgerCore25.monthPlan(ledger, ledgerMonth25, allPots);
    const balances = summary.potBalances;
    const allocationsForPot = potId => ledger.incomes.reduce((sum, income) =>
      sum + (income.allocations || []).filter(item => item.potId === potId).reduce((n, item) => n + Number(item.amountCents || 0), 0), 0);
    const monthlyPlan = [...budget.fixed.map(plannedMonthlyLedger25),
      ...budget.houseCategories.map(item => Math.round((Number(item.amount) || 0) * 100)),
      ...budget.goals.map(item => Math.round((Number(item.monthly) || 0) * 100)),
      Math.round((Number(budget.investing) || 0) * 100)].reduce((sum, value) => sum + value, 0);
    const monthResult = summary.incomeCents - summary.expenseCents;
    const totalPotBalances = Object.values(balances).reduce((sum, value) => sum + Number(value || 0), 0);
    const unallocated = summary.cashBalanceCents - totalPotBalances;
    const plannedContribution = budget.incomes && Number.isFinite(Number(budget.contributionPct))
      ? Math.round((Number(budget.incomes.Kees || 0) + Number(budget.incomes.Daphne || 0))
        * Math.max(0, Math.min(100, Number(budget.contributionPct))) * 100 / 100)
      : null;
    const plannedExternal = [...budget.fixed.map(plannedMonthlyLedger25),
      ...budget.houseCategories.map(item => Math.round((Number(item.amount) || 0) * 100))]
      .reduce((sum, value) => sum + value, 0);
    const savingsProposal = budget.goals.reduce((sum, goal) => sum + Math.round((Number(goal.monthly) || 0) * 100), 0);
    const projection = ledgerMonth25 === todayISO().slice(0, 7) && plannedContribution !== null
      ? summary.cashBalanceCents + Math.max(0, plannedContribution - summary.incomeCents)
        - Math.max(0, plannedExternal - summary.expenseCents)
      : null;
    const ledgerDate = ledgerMonth25 === todayISO().slice(0, 7) ? todayISO() : `${ledgerMonth25}-01`;
    const eligibleIncomes = ledger.incomes.filter(income => Number(income.amountCents || 0)
      > (income.allocations || []).reduce((sum, allocation) => sum + Number(allocation.amountCents || 0), 0));
    const section = ledgerNode25('section', 'card ledger25');
    const heading = ledgerNode25('div', 'card-head');
    const headingText = ledgerNode25('div');
    headingText.append(ledgerNode25('p', 'eyebrow', 'WERKELIJKHEID · APARTE BOEKINGEN'),
      ledgerNode25('h2', '', 'Inkomsten, uitgaven & potjessaldi'));
    const monthInput = ledgerInput25('month', 'month', { value: ledgerMonth25 });
    monthInput.dataset.ledgerMonth = '';
    heading.append(headingText, ledgerField25('Maand', monthInput));
    heading.querySelector('label').className = 'ledger-month25';
    section.append(heading, ledgerNode25('p', 'muted',
      'Deze administratie is aanvullend op het bestaande budgetplan. De geplande maandinleg, huisbudgetten en spaardoelen blijven ongewijzigd. Verdelingen en interne verschuivingen tellen niet als inkomsten.'));

    const kpis = ledgerNode25('div', 'ledger-kpis25');
    const kpi = (label, value, negative = false) => {
      const item = ledgerNode25('article');
      item.append(ledgerNode25('small', '', label),
        ledgerNode25('b', negative ? 'ledger-negative25' : '', value === null ? '—' : moneyLedger25(value)));
      return item;
    };
    kpis.append(
      kpi('Inkomsten geboekt', summary.incomeCents),
      kpi('Toegewezen uit inkomsten', summary.allocatedCents),
      kpi('Werkelijk uitgegeven', summary.expenseCents),
      kpi('Geregistreerd maandresultaat', monthResult, monthResult < 0),
      kpi('Huishoudsaldo nu', summary.cashBalanceCents, summary.cashBalanceCents < 0),
      kpi('Nog niet toegewezen', unallocated, unallocated < 0),
      kpi('Indicatie einde maand', projection, projection !== null && projection < 0)
    );
    section.append(kpis);
    section.append(ledgerNode25('p', 'ledger-plan25',
      `Planning: ${moneyLedger25(monthlyPlan)} per maand (waaronder ${moneyLedger25(savingsProposal)} geplande spaardoelinleg) · Werkelijke uitgaven deze maand: ${moneyLedger25(summary.expenseCents)}. De indicatie voor deze maand gebruikt alleen het bestaande geplande huishoudinkomen en vaste/huislasten minus al geboekte bedragen; het is geen bankprognose. Eerdere maanden tonen alleen de geboekte werkelijkheid.`));

    const registration = ledgerNode25('section', 'ledger-section25');
    registration.append(ledgerNode25('h3', '', 'Registreren'));
    const forms = ledgerNode25('div', 'ledger-forms25');
    const addForm = (kind, title, fields, buttonText, extra) => {
      const form = ledgerNode25('form', 'ledger-form25');
      form.dataset.ledgerForm = kind;
      form.append(ledgerNode25('h3', '', title));
      const fieldGrid = ledgerNode25('div', 'ledger-fields25');
      fields.forEach(field => fieldGrid.append(field));
      form.append(fieldGrid);
      if (extra) form.append(extra);
      form.append(ledgerButton25(buttonText, 'primary', 'submit'));
      forms.append(form);
      return form;
    };
    const expenseCategories = ['Boodschappen', 'Tanken', 'Vaste lasten', 'Abonnementen', 'Persoonlijk', 'Huishouden', 'Overig'];
    const potOptions = pots.map(pot => ({ value: pot.id, label: pot.label }));
    const allPotOptions = allPots.map(pot => ({
      value: pot.id, label: `${pot.label}${pot.archived ? ' · verwijderd' : ''}`
    }));
    const incomeFields = [
      ledgerField25('Bedrag (€)', ledgerInput25('amount', 'number', { inputmode: 'decimal', min: '0.01', step: '0.01', required: true })),
      ledgerField25('Datum', ledgerInput25('date', 'date', { value: ledgerDate, required: true })),
      ledgerField25('Boekingsmaand', ledgerInput25('month', 'month', { value: ledgerMonth25, required: true })),
      ledgerField25('Type', ledgerSelect25('type', [
        { value: 'salary', label: 'Salaris' }, { value: 'benefit', label: 'Toeslag' }, { value: 'other', label: 'Overige inkomsten' }
      ], false)),
      ledgerField25('Persoon / bron', ledgerInput25('source', 'text', { placeholder: 'Kees, Daphne, toeslag…', maxlength: '80', required: true })),
      ledgerField25('Omschrijving (optioneel)', ledgerInput25('description', 'text', { maxlength: '160' }))
    ];
    addForm('income', 'Inkomen toevoegen', incomeFields, 'Inkomstenboeking controleren');

    const allocationForm = ledgerNode25('form', 'ledger-form25');
    allocationForm.dataset.ledgerForm = 'allocation';
    allocationForm.append(ledgerNode25('h3', '', 'Inkomen verdelen'));
    if (eligibleIncomes.length) {
      const allocationFields = ledgerNode25('div', 'ledger-fields25');
      allocationFields.append(
        ledgerField25('Inkomstenboeking', ledgerSelect25('incomeId', eligibleIncomes.map(income => {
          const allocated = (income.allocations || []).reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
          return {
            value: income.id,
            label: `${income.source} · ${income.date} · nog ${moneyLedger25(Number(income.amountCents || 0) - allocated)}`
          };
        }))),
        ledgerField25('Potje', ledgerSelect25('potId', potOptions)),
        ledgerField25('Bedrag (€)', ledgerInput25('amount', 'number', { inputmode: 'decimal', min: '0.01', step: '0.01', required: true }))
      );
      allocationForm.append(allocationFields, ledgerButton25('Verdeling controleren', 'primary', 'submit'));
    } else {
      allocationForm.append(ledgerNode25('p', 'muted', 'Registreer eerst inkomsten met een nog niet verdeeld bedrag.'));
    }
    forms.append(allocationForm);

    addForm('expense', 'Werkelijke uitgave', [
      ledgerField25('Bedrag (€)', ledgerInput25('amount', 'number', { inputmode: 'decimal', min: '0.01', step: '0.01', required: true })),
      ledgerField25('Datum', ledgerInput25('date', 'date', { value: ledgerDate, required: true })),
      ledgerField25('Categorie', ledgerSelect25('category', expenseCategories.map(category => ({ value: category, label: category })), false)),
      ledgerField25('Potje', ledgerSelect25('potId', potOptions)),
      ledgerField25('Persoon (optioneel)', ledgerInput25('person', 'text', { maxlength: '80' })),
      ledgerField25('Omschrijving', ledgerInput25('description', 'text', { maxlength: '160', required: true }))
    ], 'Uitgave controleren');

    addForm('transfer', 'Geld tussen potjes verschuiven', [
      ledgerField25('Van potje', ledgerSelect25('fromPotId', allPotOptions)),
      ledgerField25('Naar potje', ledgerSelect25('toPotId', allPotOptions)),
      ledgerField25('Bedrag (€)', ledgerInput25('amount', 'number', { inputmode: 'decimal', min: '0.01', step: '0.01', required: true })),
      ledgerField25('Datum', ledgerInput25('date', 'date', { value: ledgerDate, required: true })),
      ledgerField25('Omschrijving', ledgerInput25('description', 'text', { maxlength: '160' }), true)
    ], 'Verschuiving controleren', ledgerNode25('p', 'small-note',
      'Ook verwijderde potjes met resterend saldo blijven bereikbaar. Vooraf wordt de verschuiving getoond en bevestigd; het huishoudsaldo verandert niet.'));
    registration.append(forms);
    section.append(registration);

    const selectedEdit = ledgerEditFormMarkup25(ledger, allPots);
    if (selectedEdit) section.append(selectedEdit);

    const planning = ledgerNode25('section', 'ledger-section25 ledger-planning25');
    const planningHeading = ledgerNode25('div', 'card-head');
    const planningTitle = ledgerNode25('div');
    planningTitle.append(ledgerNode25('p', 'eyebrow', 'INKOMSTEN & VASTE LASTEN'),
      ledgerNode25('h3', '', 'Maandplanning'));
    const mode = ledgerSelect25('distributionMode', [
      { value: 'approval', label: 'Eerst goedkeuren', selected: ledger.distributionMode !== 'automatic' },
      { value: 'automatic', label: 'Automatisch verdelen', selected: ledger.distributionMode === 'automatic' }
    ]);
    mode.dataset.ledgerMode = '';
    planningHeading.append(planningTitle, ledgerField25('Verdeling van ontvangen inkomsten', mode));
    planning.append(planningHeading, ledgerNode25('p', 'small-note',
      'Alleen werkelijk ontvangen inkomsten worden verdeeld. Automatische modus past de regels direct toe; goedkeuringsmodus toont eerst een voorstel.'));
    const planMetrics = ledgerNode25('div', 'ledger-kpis25');
    const planKpi = (label, amount) => {
      const card = ledgerNode25('article');
      card.append(ledgerNode25('small', '', label), ledgerNode25('b', '', moneyLedger25(amount)));
      return card;
    };
    planMetrics.append(
      planKpi('Vaste lasten deze maand', cashflow.totalBillsCents),
      planKpi('Nog niet betaald', cashflow.unpaidBillsCents),
      planKpi('Verwachte inkomsten', cashflow.expectedIncome
        .filter(item => !item.received).reduce((sum, item) => sum + item.amountCents, 0))
    );
    planning.append(planMetrics);

    const schedules = ledgerNode25('div', 'ledger-schedule25');
    const timeline = [
      ...cashflow.expectedIncome.map(item => ({ ...item, timelineKind: 'income' })),
      ...cashflow.bills.map(item => ({ ...item, timelineKind: 'bill' }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    timeline.forEach(item => {
      const row = ledgerNode25('article', 'ledger-entry25');
      const details = ledgerNode25('div');
      if (item.timelineKind === 'income') {
        details.append(ledgerNode25('strong', '', `${item.name} · ${item.receiver}`),
          ledgerNode25('small', '', `${item.date} · ${item.received ? 'Ontvangen en geregistreerd' : 'Verwacht inkomen'}`));
        row.append(details, ledgerNode25('b', '', `+ ${moneyLedger25(item.amountCents)}`));
        if (!item.received) row.append(ledgerButton25('Ontvangst boeken', 'secondary', 'button', {
          'data-ledger-receive': item.sourceId, 'data-income-date': item.date
        }));
      } else {
        const pot = allPots.find(candidate => candidate.id === item.potId);
        details.append(ledgerNode25('strong', '', item.name),
          ledgerNode25('small', '', `${item.date} · ${pot?.label || 'Verwijderd potje'} · ${item.paid ? 'Betaald' : 'Verwachte afschrijving'}`));
        row.append(details, ledgerNode25('b', '', `− ${moneyLedger25(item.expectedAmountCents)}`));
        if (!item.paid) {
          if (item.variable) {
            const amount = ledgerInput25('amount', 'number', {
              inputmode: 'decimal', min: '0.01', step: '0.01',
              value: decimalLedger25(item.expectedAmountCents), 'aria-label': `Werkelijk bedrag voor ${item.name}`
            });
            amount.dataset.billAmount = item.billId;
            amount.dataset.billOccurrenceDate = item.date;
            row.append(amount);
          }
          row.append(ledgerButton25('Betaald registreren', 'secondary', 'button', {
            'data-ledger-bill-paid': item.billId, 'data-bill-occurrence-date': item.date
          }));
        }
      }
      schedules.append(row);
    });
    if (!schedules.children.length) schedules.append(ledgerNode25('p', 'muted',
      'Stel inkomstenbronnen en vaste lasten in om de maandtijdlijn te vullen.'));
    planning.append(schedules);

    const sourceForm = ledgerNode25('form', 'ledger-form25');
    const sourceEdit = ledgerConfigEdit25?.kind === 'income-source'
      ? ledger.incomeSources.find(item => item.id === ledgerConfigEdit25.id) : null;
    sourceForm.dataset.ledgerForm = sourceEdit ? 'edit-income-source' : 'income-source';
    if (sourceEdit) sourceForm.dataset.editId = sourceEdit.id;
    sourceForm.append(ledgerNode25('h3', '', sourceEdit ? 'Inkomstenbron wijzigen' : 'Inkomstenbron instellen'));
    const sourceFields = ledgerNode25('div', 'ledger-fields25');
    sourceFields.append(
      ledgerField25('Naam', ledgerInput25('name', 'text', { maxlength: '100', required: true, value: sourceEdit?.name || '' })),
      ledgerField25('Netto bedrag (€)', ledgerInput25('amount', 'number', { inputmode: 'decimal', min: '0.01', step: '0.01', required: true, value: sourceEdit ? decimalLedger25(sourceEdit.amountCents) : '' })),
      ledgerField25('Ontvanger', ledgerInput25('receiver', 'text', { maxlength: '80', required: true, value: sourceEdit?.receiver || '' })),
      ledgerField25('Frequentie', ledgerSelect25('frequency', [
        { value: 'weekly', label: 'Wekelijks', selected: sourceEdit?.frequency === 'weekly' },
        { value: 'monthly', label: 'Maandelijks', selected: !sourceEdit || sourceEdit.frequency === 'monthly' },
        { value: 'quarterly', label: 'Per kwartaal', selected: sourceEdit?.frequency === 'quarterly' },
        { value: 'semiannual', label: 'Halfjaarlijks', selected: sourceEdit?.frequency === 'semiannual' },
        { value: 'yearly', label: 'Jaarlijks', selected: sourceEdit?.frequency === 'yearly' },
        { value: 'once', label: 'Eenmalig', selected: sourceEdit?.frequency === 'once' }
      ])),
      ledgerField25('Eerstvolgende ontvangstdatum', ledgerInput25('expectedDate', 'date', { value: sourceEdit?.expectedDate || ledgerDate, required: true })),
      ledgerField25('Voorkeurspotje (optioneel)', ledgerSelect25('potId', [
        { value: '', label: 'Geen voorkeur', selected: !sourceEdit?.potId },
        ...potOptions.map(item => ({ ...item, selected: item.value === sourceEdit?.potId }))
      ], false))
    );
    sourceForm.append(sourceFields, ledgerButton25(sourceEdit ? 'Wijzigingen bewaren' : 'Inkomstenbron bewaren', 'primary', 'submit'));
    if (sourceEdit) sourceForm.append(ledgerButton25('Annuleren', 'secondary', 'button', { 'data-ledger-config-cancel': '' }));

    const ruleForm = ledgerNode25('form', 'ledger-form25');
    const ruleEdit = ledgerConfigEdit25?.kind === 'allocation-rule'
      ? ledger.allocationRules.find(item => item.id === ledgerConfigEdit25.id) : null;
    ruleForm.dataset.ledgerForm = ruleEdit ? 'edit-allocation-rule' : 'allocation-rule';
    if (ruleEdit) ruleForm.dataset.editId = ruleEdit.id;
    ruleForm.append(ledgerNode25('h3', '', ruleEdit ? 'Verdelingsregel wijzigen' : 'Verdelingsregel toevoegen'));
    const ruleFields = ledgerNode25('div', 'ledger-fields25');
    ruleFields.append(
      ledgerField25('Potje', ledgerSelect25('potId', potOptions.map(item => ({ ...item, selected: item.value === ruleEdit?.potId })))),
      ledgerField25('Soort', ledgerSelect25('kind', [
        { value: 'fixed', label: 'Vast bedrag', selected: !ruleEdit || ruleEdit.kind === 'fixed' },
        { value: 'percent', label: 'Percentage', selected: ruleEdit?.kind === 'percent' }
      ])),
      ledgerField25('Bedrag (€) of percentage', ledgerInput25('value', 'number', {
        inputmode: 'decimal', min: '0.01', step: '0.01', required: true,
        value: ruleEdit ? (ruleEdit.kind === 'percent' ? (ruleEdit.value / 100).toFixed(2) : decimalLedger25(ruleEdit.value)) : ''
      })),
      ledgerField25('Prioriteit (lager = eerst)', ledgerInput25('priority', 'number', {
        min: '0', step: '1', value: ruleEdit?.priority ?? ledger.allocationRules.length
      }))
    );
    ruleForm.append(ruleFields, ledgerButton25(ruleEdit ? 'Wijzigingen bewaren' : 'Regel bewaren', 'primary', 'submit'));
    if (ruleEdit) ruleForm.append(ledgerButton25('Annuleren', 'secondary', 'button', { 'data-ledger-config-cancel': '' }));

    const billForm = ledgerNode25('form', 'ledger-form25');
    const billEdit = ledgerConfigEdit25?.kind === 'recurring-bill'
      ? ledger.recurringBills.find(item => item.id === ledgerConfigEdit25.id) : null;
    billForm.dataset.ledgerForm = billEdit ? 'edit-recurring-bill' : 'recurring-bill';
    if (billEdit) billForm.dataset.editId = billEdit.id;
    billForm.append(ledgerNode25('h3', '', billEdit ? 'Vaste last wijzigen' : 'Vaste last instellen'));
    const billFields = ledgerNode25('div', 'ledger-fields25');
    billFields.append(
      ledgerField25('Naam', ledgerInput25('name', 'text', { maxlength: '100', required: true, value: billEdit?.name || '' })),
      ledgerField25('Bedrag (€)', ledgerInput25('amount', 'number', { inputmode: 'decimal', min: '0.01', step: '0.01', required: true, value: billEdit ? decimalLedger25(billEdit.amountCents) : '' })),
      ledgerField25('Potje', ledgerSelect25('potId', potOptions.map(item => ({ ...item, selected: item.value === billEdit?.potId })))),
      ledgerField25('Frequentie', ledgerSelect25('frequency', [
        { value: 'weekly', label: 'Wekelijks', selected: billEdit?.frequency === 'weekly' },
        { value: 'monthly', label: 'Maandelijks', selected: !billEdit || billEdit.frequency === 'monthly' },
        { value: 'quarterly', label: 'Per kwartaal', selected: billEdit?.frequency === 'quarterly' },
        { value: 'semiannual', label: 'Halfjaarlijks', selected: billEdit?.frequency === 'semiannual' },
        { value: 'yearly', label: 'Jaarlijks', selected: billEdit?.frequency === 'yearly' }
      ])),
      ledgerField25('Eerstvolgende afschrijving', ledgerInput25('expectedDate', 'date', { value: billEdit?.expectedDate || ledgerDate, required: true })),
      ledgerField25('Startdatum', ledgerInput25('startDate', 'date', { value: billEdit?.startDate || ledgerDate, required: true })),
      ledgerField25('Einddatum (optioneel)', ledgerInput25('endDate', 'date', { value: billEdit?.endDate || '' })),
      ledgerField25('Notitie', ledgerInput25('note', 'text', { maxlength: '240', value: billEdit?.note || '' }), true)
    );
    const variableInput = ledgerInput25('variable', 'checkbox');
    variableInput.checked = Boolean(billEdit?.variable);
    const variableLabel = ledgerField25('Variabel bedrag', variableInput);
    billFields.append(variableLabel);
    billForm.append(billFields, ledgerButton25(billEdit ? 'Wijzigingen bewaren' : 'Vaste last bewaren', 'primary', 'submit'));
    if (billEdit) billForm.append(ledgerButton25('Annuleren', 'secondary', 'button', { 'data-ledger-config-cancel': '' }));
    const setupForms = ledgerNode25('div', 'ledger-forms25');
    setupForms.append(sourceForm, ruleForm, billForm);
    planning.append(setupForms);

    const sourceList = ledgerNode25('div', 'ledger-history25');
    ledger.incomeSources.forEach(source => {
      const row = ledgerNode25('article', 'ledger-entry25');
      const details = ledgerNode25('div');
      details.append(ledgerNode25('strong', '', `${source.name} · ${moneyLedger25(source.amountCents)}`),
        ledgerNode25('small', '', `${source.receiver} · ${source.frequency} · eerstvolgende ${source.expectedDate} · ${source.active === false ? 'Uitgeschakeld' : 'Actief'}`));
      const actions = ledgerNode25('span', 'ledger-actions25');
      actions.append(
        ledgerButton25('Wijzigen', 'secondary', 'button', { 'data-ledger-config-edit': 'income-source', 'data-config-id': source.id }),
        ledgerButton25(source.active === false ? 'Inschakelen' : 'Uitschakelen', 'secondary', 'button', {
          'data-ledger-source-toggle': source.id
        })
      );
      row.append(details, actions); sourceList.append(row);
    });
    if (!sourceList.children.length) sourceList.append(ledgerNode25('p', 'muted', 'Nog geen vaste inkomstenbronnen ingesteld.'));
    planning.append(ledgerNode25('h3', '', 'Inkomstenbronnen'), sourceList);

    const billList = ledgerNode25('div', 'ledger-history25');
    ledger.recurringBills.forEach(bill => {
      const pot = allPots.find(item => item.id === bill.potId);
      const row = ledgerNode25('article', 'ledger-entry25');
      const details = ledgerNode25('div');
      details.append(ledgerNode25('strong', '', `${bill.name} · ${moneyLedger25(bill.amountCents)}`),
        ledgerNode25('small', '', `${pot?.label || 'Verwijderd potje'} · ${bill.frequency} · ${bill.expectedDate} · ${bill.variable ? 'Variabel' : 'Vast'} · ${bill.active === false ? 'Uitgeschakeld' : 'Actief'}`));
      const actions = ledgerNode25('span', 'ledger-actions25');
      actions.append(
        ledgerButton25('Wijzigen', 'secondary', 'button', { 'data-ledger-config-edit': 'recurring-bill', 'data-config-id': bill.id }),
        ledgerButton25(bill.active === false ? 'Inschakelen' : 'Uitschakelen', 'secondary', 'button', {
          'data-ledger-bill-toggle': bill.id
        })
      );
      row.append(details, actions); billList.append(row);
    });
    if (!billList.children.length) billList.append(ledgerNode25('p', 'muted', 'Nog geen terugkerende vaste lasten ingesteld.'));
    planning.append(ledgerNode25('h3', '', 'Terugkerende vaste lasten'), billList);

    const ruleList = ledgerNode25('div', 'ledger-history25');
    ledger.allocationRules.sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0)).forEach(rule => {
      const pot = allPots.find(item => item.id === rule.potId);
      const value = rule.kind === 'percent' ? `${(rule.value / 100).toLocaleString('nl-NL')}%` : moneyLedger25(rule.value);
      const row = ledgerNode25('article', 'ledger-entry25');
      row.append(ledgerNode25('strong', '', `${pot?.label || 'Verwijderd potje'} · ${value} · prioriteit ${rule.priority + 1}`),
        ledgerNode25('small', '', rule.active === false ? 'Uitgeschakeld' : 'Actief'));
      const actions = ledgerNode25('span', 'ledger-actions25');
      actions.append(
        ledgerButton25('Wijzigen', 'secondary', 'button', { 'data-ledger-config-edit': 'allocation-rule', 'data-config-id': rule.id }),
        ledgerButton25(rule.active === false ? 'Inschakelen' : 'Uitschakelen', 'secondary', 'button', {
        'data-ledger-rule-toggle': rule.id
        })
      );
      row.append(actions);
      ruleList.append(row);
    });
    if (!ruleList.children.length) ruleList.append(ledgerNode25('p', 'muted', 'Nog geen verdelingsregels ingesteld.'));
    planning.append(ledgerNode25('h3', '', 'Verdelingsregels · prioriteit'), ruleList);

    const proposals = ledgerNode25('div', 'ledger-history25');
    ledger.pendingDistributions.filter(item => item.status === 'proposed').forEach(proposal => {
      const income = ledger.incomes.find(item => item.id === proposal.incomeId);
      const row = ledgerNode25('article', 'ledger-entry25');
      const details = ledgerNode25('div');
      details.append(ledgerNode25('strong', '', `Voorstel voor ${income?.source || 'inkomsten'}`));
      const list = ledgerNode25('ul');
      proposal.allocations.forEach(allocation => {
        const pot = allPots.find(item => item.id === allocation.potId);
        list.append(ledgerNode25('li', '', `${pot?.label || 'Verwijderd potje'} · ${moneyLedger25(allocation.amountCents)}`));
      });
      details.append(list, ledgerNode25('small', '', `Niet verdeeld: ${moneyLedger25(proposal.unallocatedCents)}`));
      row.append(details, ledgerButton25('Verdeling goedkeuren', 'primary', 'button', {
        'data-ledger-distribution-approve': proposal.id
      }));
      proposals.append(row);
    });
    if (proposals.children.length) planning.append(ledgerNode25('h3', '', 'Wacht op goedkeuring'), proposals);
    planning.append(ledgerNode25('p', 'small-note',
      'Verwachte afschrijvingen zijn reserveringen, geen betalingen. Alleen na jouw bevestiging wordt een uitgave geboekt; variabele bedragen kunnen daarbij worden aangepast.'));
    section.append(planning);

    const historySection = (title, content) => {
      const block = ledgerNode25('section', 'ledger-section25');
      block.append(ledgerNode25('h3', '', title), content);
      return block;
    };
    const potSection = ledgerNode25('section', 'ledger-section25');
    const potHeading = ledgerNode25('div', 'card-head');
    potHeading.append(ledgerNode25('h3', '', 'Potjes · saldo nu'),
      ledgerNode25('span', 'small-note', 'Bestaande maandbudgetten blijven planning.'));
    potSection.append(potHeading);
    const potRows = ledgerNode25('div');
    allPots.forEach(pot => {
      const balance = Number(balances[pot.id] || 0);
      const assigned = Number(ledger.openingBalances[pot.id] || 0) + allocationsForPot(pot.id);
      const spent = summary.expenses.filter(item => item.potId === pot.id)
        .reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
      const reservation = cashflow.byPot[pot.id] || { reservedCents: 0, availableCents: balance, stillNeededCents: 0 };
      const needsAttention = balance < 0 || reservation.stillNeededCents > 0;
      const row = ledgerNode25('article', `ledger-pot25${needsAttention ? ' is-negative' : ''}${pot.archived ? ' is-archived' : ''}`);
      const name = ledgerNode25('div');
      name.append(ledgerNode25('h3', '', pot.label), ledgerNode25('small', '',
        pot.archived ? 'Verwijderd potje · verschuif het saldo naar een actief potje'
          : pot.kind === 'goal' ? 'Spaardoel' : pot.kind === 'fixed' ? 'Vaste last' : 'Huisbudget'));
      row.append(name);
      const metric = (label, value) => {
        const item = ledgerNode25('span');
        item.append(ledgerNode25('small', '', label), ledgerNode25('b', '', moneyLedger25(value)));
        return item;
      };
      row.append(
        metric(pot.archived ? 'Begroot toen verwijderd' : 'Begroot / mnd', pot.plannedCents),
        metric('Toegewezen totaal', assigned),
        metric('Uitgegeven deze maand', spent),
        metric('Gereserveerd', reservation.reservedCents),
        metric('Vrij beschikbaar', reservation.availableCents),
        metric('Nog nodig', reservation.stillNeededCents),
        metric('Saldo nu', balance)
      );
      potRows.append(row);
    });
    potSection.append(allPots.length ? potRows
      : ledgerNode25('p', 'muted', 'Voeg eerst potjes of spaardoelen toe in de bestaande budgetplanning.'));
    section.append(potSection);

    const incomeRows = ledgerNode25('div', 'ledger-history25');
    summary.incomes.forEach(income => {
      const allocated = (income.allocations || []).reduce((sum, allocation) => sum + Number(allocation.amountCents || 0), 0);
      const row = ledgerNode25('article', 'ledger-entry25');
      const details = ledgerNode25('div');
      const type = income.type === 'salary' ? 'Salaris' : income.type === 'benefit' ? 'Toeslag' : 'Overige inkomsten';
      details.append(ledgerNode25('strong', '', `${income.source} · ${type}`),
        ledgerNode25('small', '', `${income.date} · maand ${income.month || income.date.slice(0, 7)}${income.description ? ` · ${income.description}` : ''}`));
      if (income.allocations?.length) {
        const allocationList = ledgerNode25('ul');
        income.allocations.forEach(allocation => {
          const pot = allPots.find(item => item.id === allocation.potId);
          const item = ledgerNode25('li', '', `${pot?.label || 'Verwijderd potje'} · ${moneyLedger25(allocation.amountCents)} `);
          item.append(ledgerButton25('Verwijderen', 'text-btn', 'button', {
            'data-ledger-delete-allocation': income.id,
            'data-allocation-id': allocation.id
          }));
          allocationList.append(item);
        });
        details.append(allocationList);
      }
      details.append(ledgerNode25('small', '', `Nog te verdelen: ${moneyLedger25(Number(income.amountCents || 0) - allocated)}`));
      const actions = ledgerNode25('span', 'ledger-actions25');
      actions.append(
        ledgerButton25('Corrigeren', 'secondary', 'button', { 'data-ledger-edit-kind': 'incomes', 'data-entry-id': income.id }),
        ledgerButton25('Verwijderen', 'secondary', 'button', { 'data-ledger-delete-kind': 'incomes', 'data-entry-id': income.id })
      );
      row.append(details, ledgerNode25('b', '', moneyLedger25(income.amountCents)), actions);
      incomeRows.append(row);
    });
    if (!summary.incomes.length) incomeRows.append(ledgerNode25('p', 'muted', 'Geen inkomsten geboekt voor deze maand.'));
    section.append(historySection(`Inkomsten van ${ledgerMonth25}`, incomeRows));

    const expenseRows = ledgerNode25('div', 'ledger-history25');
    summary.expenses.forEach(expense => {
      const pot = allPots.find(item => item.id === expense.potId);
      const details = ledgerNode25('div');
      details.append(ledgerNode25('strong', '', expense.description),
        ledgerNode25('small', '', `${expense.date} · ${expense.category} · ${pot?.label || 'Verwijderd potje'}${expense.person ? ` · ${expense.person}` : ''}`));
      const actions = ledgerNode25('span', 'ledger-actions25');
      actions.append(
        ledgerButton25('Corrigeren', 'secondary', 'button', { 'data-ledger-edit-kind': 'expenses', 'data-entry-id': expense.id }),
        ledgerButton25('Verwijderen', 'secondary', 'button', { 'data-ledger-delete-kind': 'expenses', 'data-entry-id': expense.id })
      );
      const row = ledgerNode25('article', 'ledger-entry25');
      row.append(details, ledgerNode25('b', '', `− ${moneyLedger25(expense.amountCents)}`), actions);
      expenseRows.append(row);
    });
    if (!summary.expenses.length) expenseRows.append(ledgerNode25('p', 'muted', 'Geen uitgaven geboekt voor deze maand.'));
    section.append(historySection(`Uitgaven van ${ledgerMonth25}`, expenseRows));

    const transferRows = ledgerNode25('div', 'ledger-history25');
    summary.transfers.forEach(transfer => {
      const from = allPots.find(item => item.id === transfer.fromPotId);
      const to = allPots.find(item => item.id === transfer.toPotId);
      const details = ledgerNode25('div');
      details.append(ledgerNode25('strong', '', `${from?.label || 'Verwijderd potje'} → ${to?.label || 'Verwijderd potje'}`),
        ledgerNode25('small', '', `${transfer.date}${transfer.description ? ` · ${transfer.description}` : ''}`));
      const actions = ledgerNode25('span', 'ledger-actions25');
      actions.append(
        ledgerButton25('Corrigeren', 'secondary', 'button', { 'data-ledger-edit-kind': 'transfers', 'data-entry-id': transfer.id }),
        ledgerButton25('Verwijderen', 'secondary', 'button', { 'data-ledger-delete-kind': 'transfers', 'data-entry-id': transfer.id })
      );
      const row = ledgerNode25('article', 'ledger-entry25');
      row.append(details, ledgerNode25('b', '', moneyLedger25(transfer.amountCents)), actions);
      transferRows.append(row);
    });
    if (!summary.transfers.length) transferRows.append(ledgerNode25('p', 'muted', 'Geen verschuivingen geboekt voor deze maand.'));
    section.append(historySection(`Verschuivingen van ${ledgerMonth25}`, transferRows));
    section.append(ledgerNode25('p', 'small-note',
      'Boekingen worden in de bestaande huishoudopslag bewaard en via de huidige versleutelde huishoudsynchronisatie gedeeld. Dit registreert bedragen; het voert geen bankbetalingen uit.'));
    return section;
  }

  let offerQuery25 = String(data.offerCurrentQuery25 || '');
  let offerLoading25 = false;
  let offerError25 = '';
  let offerSuccess25 = '';
  let offerFavoritesOnly25 = false;
  let offerFilters25 = { category: '', sort: 'ending' };
  let offerSelectedStores25 = new Set();
  let offerRequestController25 = null;
  let offerGroup25 = '';
  let offerCategoryGroups25 = null;
  let offerCategoryNotice25 = '';
  let offerCategoryLoading25 = false;
  let offerHasMore25 = false;
  let offerPage25 = 1;
  const OFFER_CATEGORY_TTL25 = 6 * 60 * 60 * 1000;
  const offerRequestGuard25 = offerCore25().createLatestRequestGuard();

  function offerCore25() { return window.SamenThuisOffers; }
  function resetOfferFilters25() {
    offerSelectedStores25 = new Set(offerCore25().SUPPORTED_STORES);
    offerFilters25 = { category: '', sort: 'ending' };
    offerFavoritesOnly25 = false;
    offerGroup25 = '';
  }
  function offerGroups25() {
    const core = offerCore25();
    if (!offerCategoryGroups25) {
      const cached = data.offerCategoryCache25;
      offerCategoryGroups25 = core.buildCategoryGroups(cached?.categories?.length ? cached.categories : core.KNOWN_CATEGORIES);
      if (!cached?.categories?.length) offerCategoryNotice25 = 'Standaard categorie-indeling (de actuele lijst is nog niet opgehaald).';
      const age = cached?.checkedAt ? Date.now() - Date.parse(cached.checkedAt) : Infinity;
      if (!(age < OFFER_CATEGORY_TTL25)) loadOfferCategories25();
    }
    return offerCategoryGroups25;
  }
  async function loadOfferCategories25(force = false) {
    if (offerCategoryLoading25) return;
    offerCategoryLoading25 = true;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
    try {
      const base = String(syncConfig.projectUrl || DEFAULT_PROJECT_URL).replace(/\/$/, '');
      const result = await offerCore25().fetchCategories({
        url: `${base}/functions/v1/grocery-prices`,
        headers: { apikey: DEFAULT_PUBLISHABLE_KEY, Authorization: 'Bearer ' + DEFAULT_PUBLISHABLE_KEY },
        signal: controller?.signal
      });
      data.offerCategoryCache25 = { categories: result.categories, checkedAt: result.checkedAt };
      offerCategoryGroups25 = offerCore25().buildCategoryGroups(result.categories);
      offerCategoryNotice25 = '';
      save({ touch: false });
    } catch (error) {
      // Geldige (gecachte) gegevens blijven staan; de oorzaak wordt gelogd (geen secrets).
      console.warn('PrijsProfeet-categorieën vernieuwen mislukt:', error?.name === 'AbortError' ? 'time-out' : (error?.message || 'onbekende fout'));
      if (!data.offerCategoryCache25?.categories?.length) offerCategoryNotice25 = 'Categorieën konden niet worden vernieuwd; de standaardindeling wordt gebruikt.';
    } finally {
      if (timer) clearTimeout(timer);
      offerCategoryLoading25 = false;
      if (current === 'offers') render();
    }
  }
  resetOfferFilters25();
  function offerList25() {
    const core = offerCore25();
    const active = Array.isArray(data.offers25) ? data.offers25 : [];
    const archived = Array.isArray(data.offerArchive25) ? data.offerArchive25 : [];
    const scheduled = Array.isArray(data.offerScheduled25) ? data.offerScheduled25 : [];
    const groups = offerGroups25();
    const supported = core.filterSupportedOffers([...active, ...archived, ...scheduled])
      .map(item => core.applyOfficialCategory(item, groups));
    const partition = core.partition(core.dedupe(supported), new Date());
    const keepArchive = data.settings?.archiveExpiredOffers !== false;
    const nextActive = core.dedupe(partition.active);
    const nextArchive = keepArchive ? core.dedupe(partition.archive) : [];
    const nextScheduled = core.dedupe(partition.upcoming);
    if (JSON.stringify([active, archived, scheduled]) !== JSON.stringify([nextActive, nextArchive, nextScheduled])) {
      data.offers25 = nextActive;
      data.offerArchive25 = nextArchive;
      data.offerScheduled25 = nextScheduled;
      save({ touch: false });
    }
    return { active: nextActive, archived: nextArchive, scheduled: nextScheduled };
  }
  function offerDate25(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
    return new Date(`${value}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function validOfferUrl25(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function offerMoney25(value, currency = 'EUR') {
    const amount = Number(value);
    if (value == null || value === '' || !Number.isFinite(amount) || amount < 0) return '';
    try { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: String(currency || 'EUR').toUpperCase() }).format(amount); }
    catch (_) { return ''; }
  }
  function renderOfferCard25(offer, archived = false) {
    const core = offerCore25();
    const key = core.key(offer);
    const isFavorite = (data.favoriteOffers25 || []).includes(key);
    const sourceUrl = validOfferUrl25(offer.sourceUrl || '');
    const imageUrl = validOfferUrl25(offer.imageUrl || '');
    const price = offerMoney25(offer.price, offer.currency);
    const reliableOriginal = Number.isFinite(Number(offer.originalPrice)) && Number(offer.originalPrice) > Number(offer.price);
    const originalPrice = reliableOriginal ? offerMoney25(offer.originalPrice, offer.currency) : '';
    const percent = core.offerDiscountPercent(offer);
    const savingsAmount = reliableOriginal && Number.isFinite(Number(offer.savingsAmount))
      && Number(offer.savingsAmount) > 0
      && Math.abs(Number(offer.savingsAmount) - (Number(offer.originalPrice) - Number(offer.price))) <= 0.01
      ? offerMoney25(offer.savingsAmount, offer.currency) : '';
    const packageDetails = [offer.packaging || offer.size, offer.contents].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' · ');
    const promotion = [offer.promotionType, offer.promotionText].filter((value, index, all) => value && all.indexOf(value) === index).join(' · ');
    const estimated = offer.validUntilEstimated === true ? ' (geschat)' : '';
    const dates = offer.validFrom && offer.validTo
      ? `Geldig van ${offerDate25(offer.validFrom)} t/m ${offerDate25(offer.validTo)}${estimated}`
      : offer.validFrom ? `Geldig vanaf ${offerDate25(offer.validFrom)}`
        : offer.validTo ? `Geldig t/m ${offerDate25(offer.validTo)}${estimated}` : '';
    const multiBuy = offer.multiBuyQuantity > 1 && offer.multiBuyPrice != null && offerMoney25(offer.multiBuyPrice, offer.currency)
      ? `${offer.multiBuyQuantity} voor ${offerMoney25(offer.multiBuyPrice, offer.currency)}` : '';
    const extras = [multiBuy, offer.inStoreOnly ? 'Alleen in de winkel' : '', offer.onlineOnly ? 'Alleen online' : '',
      offer.loyaltyPrice != null && offerMoney25(offer.loyaltyPrice, offer.currency) ? `${offer.loyaltyProgram || 'Klantenkaart'}-prijs ${offerMoney25(offer.loyaltyPrice, offer.currency)}` : '',
      offer.maxPerCustomer ? `Max. ${offer.maxPerCustomer} per klant` : ''].filter(Boolean).join(' · ');
    const original = sourceUrl ? `<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Product bij ${esc(offer.store || 'de winkel')}</a>` : '';
    return `<article class="card offer-card25">
      <div class="offer-card-head25"><div><p class="eyebrow">${esc(offer.store || 'Supermarkt')}${offer.brand ? ` · ${esc(offer.brand)}` : ''}${offer.ean ? ` · EAN ${esc(offer.ean)}` : ''}</p><h2>${esc(offer.name)}</h2>${packageDetails ? `<p class="muted offer-package25">${esc(packageDetails)}</p>` : ''}</div>${price ? `<strong class="offer-price25">${esc(price)}</strong>` : ''}</div>
      ${imageUrl ? `<img class="offer-image25" src="${esc(imageUrl)}" alt="${esc(offer.name)}" loading="lazy">` : ''}
      ${(originalPrice || percent != null || savingsAmount) ? `<p class="offer-discount25">${originalPrice ? `<span>Was <del>${esc(originalPrice)}</del></span>` : ''}${percent != null ? `<strong>${Math.round(percent)}% korting</strong>` : ''}${savingsAmount ? `<span>${esc(savingsAmount)} korting</span>` : ''}</p>` : ''}
      ${core.formatUnitPrice(offer) ? `<p class="offer-unit-price25">${esc(core.formatUnitPrice(offer))}</p>` : ''}
      ${promotion ? `<p class="offer-promotion25">${esc(promotion)}</p>` : ''}
      ${extras ? `<p class="offer-promotion25">${esc(extras)}</p>` : ''}
      ${offer.deliveryInfo ? `<p class="muted">${esc(offer.deliveryInfo)}</p>` : ''}
      ${dates || offer.category ? `<p class="muted">${dates ? esc(dates) : ''}${dates && offer.category ? ' · ' : ''}${offer.category ? `Categorie: ${esc(offer.category)}` : ''}</p>` : ''}
      <p class="muted">Bron: ${esc(offer.source || 'PrijsProfeet')}</p>
      <div class="button-row">${original}<button type="button" class="secondary" data-offer-favorite="${esc(key)}">${isFavorite ? '★ Favoriet' : '☆ Favoriet'}</button>${archived ? '' : `<button type="button" class="primary" data-offer-grocery="${esc(key)}">＋ Voeg toe aan boodschappenlijst</button>`}</div></article>`;
  }
  function renderOffers25() {
    const { active, archived, scheduled } = offerQuery25
      ? offerList25()
      : { active: [], archived: [], scheduled: [] };
    const favorites = Array.isArray(data.favoriteOffers25) ? data.favoriteOffers25 : [];
    const queryCache = data.offerSearchCache25 && typeof data.offerSearchCache25 === 'object' ? data.offerSearchCache25 : {};
    const checkedAt = queryCache[offerQuery25]?.checkedAt || '';
    const core = offerCore25();
    const groups = offerGroups25();
    const selectedGroup = groups.find(g => g.id === offerGroup25) || null;
    const selectedCategory = offerFilters25.category ? core.categoryBySlug(groups, offerFilters25.category) : null;
    const matchingFilters = {
      stores: [...offerSelectedStores25],
      favoritesOnly: offerFavoritesOnly25,
      favorites,
      categories: GROCERY_CATEGORIES
    };
    const selection = { group: offerGroup25, categorySlug: offerFilters25.category };
    const filtered = active.filter(item => core.matchesOfferFilters(item, matchingFilters) && core.matchesCategorySelection(item, selection));
    const sorters = {
      price: (a, b) => Number(a.price) - Number(b.price),
      discount: (a, b) => Number(b.discountPercent || 0) - Number(a.discountPercent || 0),
      ending: (a, b) => String(a.validTo || '9999-12-31').localeCompare(String(b.validTo || '9999-12-31'))
    };
    filtered.sort(sorters[offerFilters25.sort] || sorters.ending);
    const emptyMessage = !active.length
      ? offerError25 ? '' : offerQuery25 ? 'Geen actuele aanbiedingen gevonden voor deze zoekopdracht.' : 'Zoek op productnaam of merk om actuele aanbiedingen op te halen.'
      : offerSelectedStores25.size === 0
        ? 'Selecteer ten minste één supermarkt om aanbiedingen te bekijken.'
        : (offerFilters25.category || offerGroup25) && !filtered.length
          ? `Geen aanbiedingen in ${selectedCategory ? 'de categorie ' + selectedCategory.name : 'de hoofdgroep ' + (selectedGroup?.name || '')} voor de geselecteerde supermarkten.`
          : offerFavoritesOnly25 && !filtered.length
            ? 'Geen favoriete aanbiedingen voldoen aan deze filters.'
            : 'Geen aanbiedingen voldoen aan deze filters.';
    return `<div class="offers-page25"><section class="card offers-toolbar25"><div><p class="eyebrow">ACTUELE SUPERMARKTAANBIEDINGEN</p><h2>Zoek in PrijsProfeet</h2></div>
      <form class="offer-search25" data-offer-search><label class="field">Product of merk<input name="query" maxlength="100" value="${esc(offerQuery25)}" placeholder="Bijvoorbeeld koffie of wasmiddel"></label><button class="primary" type="submit" ${offerLoading25 ? 'disabled' : ''}>${offerLoading25 ? 'Laden…' : 'Aanbiedingen zoeken'}</button></form>
      <p class="muted">Zoeken via de bestaande Supabase Edge Function. Bron: <a href="https://www.prijsprofeet.nl" target="_blank" rel="noopener noreferrer">PrijsProfeet</a>. Er worden geen aanbiedingen verzonnen.</p>
      ${offerError25 ? `<p class="notice error" role="alert">${esc(offerError25)}</p>` : ''}
      ${checkedAt ? `<p class="small-note">Laatst opgehaald: ${esc(new Date(checkedAt).toLocaleString('nl-NL'))}</p>` : ''}
      ${offerLoading25 ? '<p role="status">Aanbiedingen ophalen…</p>' : ''}
      ${offerSuccess25 && !offerLoading25 && !offerError25 ? `<p class="notice" role="status">${esc(offerSuccess25)}</p>` : ''}
    </section>
    <section class="card"><div class="offer-filters25">
      <fieldset class="offer-store-filter25"><legend>Supermarkten</legend><div class="offer-store-options25">${offerCore25().SUPPORTED_STORES.map(store => `<label class="offer-store-choice25 ${offerSelectedStores25.has(store) ? 'is-selected' : ''}"><input type="checkbox" data-offer-store="${esc(store)}" ${offerSelectedStores25.has(store) ? 'checked' : ''}>${esc(store)}</label>`).join('')}</div><button type="button" class="text-btn" data-offer-filters-reset>Standaardfilters herstellen</button></fieldset>
      <div class="offer-category-filter25 cat-wrap25"><span class="offer-category-title25">Categorieën</span>
        <div class="offer-chip-row25" role="group" aria-label="Hoofdgroepen"><button type="button" class="offer-chip25 ${!offerGroup25 && !offerFilters25.category ? 'is-selected' : ''}" data-offer-group="" aria-pressed="${!offerGroup25 && !offerFilters25.category}">Alle categorieën</button>${groups.map(g => `<button type="button" class="offer-chip25 ${offerGroup25 === g.id ? 'is-selected' : ''}" data-offer-group="${esc(g.id)}" aria-pressed="${offerGroup25 === g.id}">${esc(g.name)}</button>`).join('')}</div>
        ${selectedGroup ? `<div class="offer-chip-row25" role="group" aria-label="Categorieën in ${esc(selectedGroup.name)}">${selectedGroup.categories.map(c => `<button type="button" class="offer-chip25 offer-chip-sub25 ${offerFilters25.category === c.slug ? 'is-selected' : ''}" data-offer-category="${esc(c.slug)}" aria-pressed="${offerFilters25.category === c.slug}" title="${c.count != null ? `${esc(c.name)} · ${c.count} producten volgens PrijsProfeet` : esc(c.name)}">${esc(c.name)}</button>`).join('')}</div>` : ''}
        ${selectedCategory ? `<p class="small-note">Geselecteerd: <strong>${esc(selectedCategory.name)}</strong>${selectedGroup ? ` (${esc(selectedGroup.name)})` : ''}${offerQuery25 ? '' : ' — vul een zoekterm in om deze categorie te doorzoeken'} <button type="button" class="text-btn" data-offer-group="">Terug naar alle categorieën</button></p>` : ''}
        ${offerCategoryNotice25 ? `<p class="small-note">${esc(offerCategoryNotice25)}</p>` : ''}
      </div>
      <label>Sorteren op<select data-offer-filter="sort"><option value="ending" ${offerFilters25.sort === 'ending' ? 'selected' : ''}>Einddatum</option><option value="price" ${offerFilters25.sort === 'price' ? 'selected' : ''}>Prijs</option><option value="discount" ${offerFilters25.sort === 'discount' ? 'selected' : ''}>Korting</option></select></label>
      <label class="offer-favorite-filter25"><input type="checkbox" data-offer-favorites ${offerFavoritesOnly25 ? 'checked' : ''}> Favorieten</label>
      <label class="offer-favorite-filter25"><input type="checkbox" data-offer-archive ${data.settings?.archiveExpiredOffers !== false ? 'checked' : ''}> Verlopen aanbiedingen archiveren</label>
    </div></section>
    <div class="offers-list25">${filtered.map(item => renderOfferCard25(item)).join('') || (!offerError25 && !offerLoading25 ? `<section class="card"><p class="muted">${esc(emptyMessage)}</p></section>` : '')}</div>
    ${offerHasMore25 && !offerLoading25 ? '<div class="button-row"><button type="button" class="secondary" data-offer-more>Meer resultaten laden</button></div>' : ''}
    ${archived.length ? `<details class="card offer-archive25"><summary>Archief verlopen aanbiedingen (${archived.length})</summary><div class="offers-list25">${archived.map(item => renderOfferCard25(item, true)).join('')}</div></details>` : ''}
    ${scheduled.length ? `<details class="card offer-archive25"><summary>Binnenkort geldig (${scheduled.length})</summary><div class="offers-list25">${scheduled.map(item => renderOfferCard25(item, true)).join('')}</div></details>` : ''}
    <p class="small-note">Aanbiedingen kunnen wijzigen. Controleer de geldigheid en prijs bij de oorspronkelijke bron voordat je koopt.</p></div>`;
  }
  function setOfferResults25(offers) {
    const core = offerCore25();
    const groups = offerGroups25();
    const supported = core.filterSupportedOffers(offers).map(item => core.applyOfficialCategory(item, groups));
    const partition = core.partition(core.dedupe(supported), new Date());
    data.offers25 = partition.active;
    data.offerScheduled25 = partition.upcoming;
    data.offerArchive25 = data.settings?.archiveExpiredOffers === false ? [] : partition.archive;
  }
  async function searchOffers25(query, { append = false } = {}) {
    const requestToken = offerRequestGuard25.begin();
    offerRequestController25?.abort();
    offerRequestController25 = null;
    const term = String(query || '').trim();
    offerQuery25 = term;
    data.offerCurrentQuery25 = term;
    offerError25 = '';
    offerSuccess25 = '';
    const categorySlug = offerFilters25.category;
    const page = append ? offerPage25 + 1 : 1;
    const previous = append ? [...(data.offers25 || [])] : [];
    if (!append) { data.offers25 = []; offerHasMore25 = false; offerPage25 = 1; }
    data.offerArchive25 = append ? data.offerArchive25 : [];
    data.offerScheduled25 = append ? data.offerScheduled25 : [];
    offerLoading25 = false;
    save({ touch: false });
    if (!term) {
      offerError25 = 'Vul een productnaam of merk in om actuele aanbiedingen te zoeken.';
      render();
      return;
    }
    const cache = data.offerSearchCache25 && typeof data.offerSearchCache25 === 'object' ? data.offerSearchCache25 : {};
    const cacheKey = categorySlug ? `${term}\u0001${categorySlug}` : term;
    const cached = append ? null : cache[cacheKey];
    if (cached?.checkedAt && Date.now() - Date.parse(cached.checkedAt) < 20 * 60 * 1000) {
      setOfferResults25(cached.offers || []);
      offerHasMore25 = cached.hasMore === true;
      offerSuccess25 = `${data.offers25.length} actuele aanbiedingen gevonden voor “${term}”.`;
      save({ touch: false });
      render();
      return;
    }
    offerLoading25 = true;
    render();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    offerRequestController25 = controller;
    const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
    try {
      const base = String(syncConfig.projectUrl || DEFAULT_PROJECT_URL).replace(/\/$/, '');
      const result = await offerCore25().fetchOffers({
        query: term,
        category: categorySlug,
        page,
        url: `${base}/functions/v1/grocery-prices`,
        headers: { apikey: DEFAULT_PUBLISHABLE_KEY, Authorization: 'Bearer ' + DEFAULT_PUBLISHABLE_KEY },
        signal: controller?.signal
      });
      if (!offerRequestGuard25.isCurrent(requestToken)) return;
      const groups = offerGroups25();
      const fetched = result.offers.map(item => offerCore25().applyOfficialCategory(item, groups));
      const offers = append ? offerCore25().mergeOffers(previous, fetched) : fetched;
      setOfferResults25(offers);
      offerPage25 = page;
      offerHasMore25 = result.hasMore === true;
      data.offerSearchCache25 = { ...cache, [cacheKey]: { offers, hasMore: offerHasMore25, checkedAt: result.checkedAt } };
      const cacheTerms = Object.keys(data.offerSearchCache25);
      if (cacheTerms.length > 20) cacheTerms.slice(0, cacheTerms.length - 20).forEach(key => delete data.offerSearchCache25[key]);
      offerError25 = '';
      offerSuccess25 = `${data.offers25.length} actuele aanbiedingen gevonden voor “${term}”.`;
      save({ touch: false });
    } catch (error) {
      if (!offerRequestGuard25.isCurrent(requestToken)) return;
      if (append) { setOfferResults25(previous); }
      offerError25 = error.name === 'AbortError'
        ? 'De aanvraag duurde te lang. Probeer het opnieuw.'
        : `${error.message || 'Aanbiedingen zijn tijdelijk niet beschikbaar.'} De Edge Function grocery-prices moet actief zijn; er is geen actuele aanbieding geladen.`;
    } finally {
      if (timer) clearTimeout(timer);
      if (offerRequestGuard25.isCurrent(requestToken)) {
        offerLoading25 = false;
        offerRequestController25 = null;
        if (current === 'offers') render();
      }
    }
  }

  let editingCollection25 = null;
  function collectionItems25(name) {
    if (!Array.isArray(data[name])) data[name] = [];
    else if (data[name].some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
      data[name] = data[name].filter(item => item && typeof item === 'object' && !Array.isArray(item));
    }
    return data[name];
  }

  function safeLink25(value) {
    try {
      const url = new URL(value, location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function renderCollection25(name) {
    const tasks = name === 'tasks';
    const label = tasks ? 'Taak' : 'Programma';
    const items = collectionItems25(name);
    const old = editingCollection25?.collection === name
      ? items.find(item => item.id === editingCollection25.id) || null : null;
    const form = tasks
      ? `<label class="field">Taak<input name="title" maxlength="120" value="${esc(old?.title || '')}" placeholder="Bijv. vuilnis buitenzetten" required></label>
        <label class="field">Categorie<input name="category" maxlength="50" value="${esc(old?.category || '')}" placeholder="Bijv. Huishouden"></label>
        <label class="field">Voor wie?<select name="person">${['Samen', 'Kees', 'Daphne'].map(person => `<option ${old?.person === person ? 'selected' : ''}>${person}</option>`).join('')}</select></label>
        <label class="field">Uiterste datum<input name="due" type="date" value="${esc(old?.due || '')}"></label>`
      : `<label class="field">Naam<input name="title" maxlength="120" value="${esc(old?.title || '')}" placeholder="Bijv. zwemles of concert" required></label>
        <label class="field">Soort<input name="category" maxlength="50" value="${esc(old?.category || '')}" placeholder="Bijv. Sport, cultuur of tv"></label>
        <label class="field">Datum<input name="date" type="date" value="${esc(old?.date || '')}"></label>
        <label class="field">Link (optioneel)<input name="url" type="url" maxlength="500" value="${esc(old?.url || '')}" placeholder="https://…"></label>
        <label class="field">Notitie<textarea name="note" maxlength="500">${esc(old?.note || '')}</textarea></label>`;
    const ordered = [...items].sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done))
      || String(a.due || a.date || '').localeCompare(String(b.due || b.date || '')));
    const rows = ordered.map(item => {
      const detail = tasks
        ? [item.category, item.person, item.due && `Uiterlijk ${item.due}`].filter(Boolean).join(' · ')
        : [item.category, item.date, item.note].filter(Boolean).join(' · ');
      const link = !tasks && safeLink25(item.url)
        ? `<a href="${esc(safeLink25(item.url))}" target="_blank" rel="noopener noreferrer">Open link</a>` : '';
      return `<article class="card collection-item25 ${item.done ? 'is-done' : ''}"><div><h2>${esc(item.title || label)}</h2><p class="muted">${esc(detail || (item.done ? 'Afgerond' : 'Nog geen details'))}</p>${link}</div><div class="button-row"><button type="button" class="secondary" data-collection-toggle="${name}" data-item-id="${esc(item.id)}">${item.done ? 'Opnieuw openen' : 'Afronden'}</button><button type="button" class="secondary" data-collection-edit="${name}" data-item-id="${esc(item.id)}">Bewerken</button><button type="button" class="secondary" data-collection-delete="${name}" data-item-id="${esc(item.id)}">Verwijderen</button></div></article>`;
    }).join('');
    const heading = tasks ? 'Taken' : "Programma's";
    return `<div class="collection-page25"><section class="card settings-card"><div class="card-head"><div><p class="eyebrow">SAMEN THUIS</p><h2>${heading}</h2></div></div><form class="form-grid compact-form" data-collection-form="${name}">${form}<div class="button-row"><button class="primary" type="submit">${old ? 'Wijzigingen opslaan' : `${label} toevoegen`}</button>${old ? '<button class="secondary" type="button" data-collection-cancel>Annuleren</button>' : ''}</div></form></section><div class="collection-list25">${rows || `<section class="card"><p class="muted">Nog geen ${tasks ? 'open taken' : 'programma’s'}.</p></section>`}</div></div>`;
  }

  function weatherLocation25() {
    const settings = data.settings || {};
    const lat = settings.weatherLat === '' || settings.weatherLat == null ? NaN : Number(settings.weatherLat);
    const lon = settings.weatherLon === '' || settings.weatherLon == null ? NaN : Number(settings.weatherLon);
    return {
      place: typeof settings.weatherPlace === 'string' && settings.weatherPlace.trim()
        ? settings.weatherPlace.trim().slice(0, 80) : DEFAULT_LOCATION.place,
      lat: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : DEFAULT_LOCATION.lat,
      lon: Number.isFinite(lon) && lon >= -180 && lon <= 180 ? lon : DEFAULT_LOCATION.lon
    };
  }
  window.SamenThuisWeatherLocation25 = weatherLocation25;

  function validForecast25(forecast) {
    const daily = forecast?.daily;
    const hourly = forecast?.hourly;
    return Number.isFinite(forecast?.current?.temperature_2m)
      && Array.isArray(daily?.time) && daily.time.length >= 1
      && ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max', 'precipitation_sum']
        .every(key => Array.isArray(daily[key]) && daily[key].length === daily.time.length)
      && Array.isArray(hourly?.time) && hourly.time.length >= 1
      && ['temperature_2m', 'precipitation'].every(key => Array.isArray(hourly[key]) && hourly[key].length === hourly.time.length);
  }

  async function getForecast25(force = false) {
    const location = weatherLocation25();
    const locationKey = `${location.lat},${location.lon}`;
    let cache = null;
    try { cache = JSON.parse(localStorage.getItem(WEATHER_KEY) || 'null'); } catch (_) {}
    const cached = cache?.location === locationKey && validForecast25(cache.data) ? cache : null;
    if (!force && cached && Date.now() - cached.savedAt < 30 * 60 * 1000) return { ...cached, stale: false };
    if (!navigator.onLine) {
      if (cached) return { ...cached, stale: true };
      throw new Error('Geen internetverbinding en geen opgeslagen verwachting beschikbaar.');
    }
    const query = new URLSearchParams({
      latitude: String(location.lat), longitude: String(location.lon), timezone: 'auto', forecast_days: '7',
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
      hourly: 'temperature_2m,precipitation'
    });
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, {
        cache: 'no-store', ...(controller ? { signal: controller.signal } : {})
      });
      if (!response.ok) throw new Error(`Weer ophalen mislukt (${response.status}).`);
      const forecast = await response.json();
      if (!validForecast25(forecast)) throw new Error('De weerservice gaf onvolledige gegevens terug.');
      const result = { location: locationKey, savedAt: Date.now(), data: forecast, stale: false };
      try { localStorage.setItem(WEATHER_KEY, JSON.stringify(result)); } catch (_) {}
      return result;
    } catch (error) {
      if (cached) return { ...cached, stale: true };
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function chart25(title, labels, high, low, rain, suffix) {
    if (labels.length < 2 || !high.every(Number.isFinite)) return '';
    const width = 680, height = 280, left = 44, right = 40, top = 20, bottom = 46;
    const innerWidth = width - left - right, innerHeight = height - top - bottom;
    const temps = [...high, ...(low || [])].filter(Number.isFinite);
    const min = Math.floor(Math.min(...temps) - 1), max = Math.ceil(Math.max(...temps) + 1);
    const maxRain = Math.max(1, ...rain.map(value => Number.isFinite(value) ? value : 0));
    const x = index => left + innerWidth * (index / (labels.length - 1));
    const y = value => top + innerHeight - ((value - min) / (max - min || 1)) * innerHeight;
    const rainY = value => top + innerHeight - (Math.max(0, value || 0) / maxRain) * innerHeight;
    const polyline = values => values.every(Number.isFinite)
      ? `<polyline points="${values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')}"/>` : '';
    const bars = rain.map((value, index) => {
      const barY = rainY(value);
      return `<rect x="${(x(index) - Math.min(18, innerWidth / labels.length * .28)).toFixed(1)}" y="${barY.toFixed(1)}" width="${Math.min(36, innerWidth / labels.length * .56).toFixed(1)}" height="${(top + innerHeight - barY).toFixed(1)}" rx="3"/>`;
    }).join('');
    const step = Math.max(1, Math.ceil(labels.length / 8));
    const ticks = labels.map((label, index) => index % step === 0
      ? `<text x="${x(index).toFixed(1)}" y="${height - 20}" text-anchor="middle">${esc(label)}</text>` : '').join('');
    const hasLow = Array.isArray(low) && low.length === labels.length && low.every(Number.isFinite);
    const axis = [max, min].map(value => `<text x="${left - 6}" y="${(y(value) + 4).toFixed(1)}" text-anchor="end">${value}°</text>`).join('');
    const valueLabels = (values, offset) => values.map((value, index) => index % step === 0
      ? `<text class="weather-val25" x="${x(index).toFixed(1)}" y="${(y(value) + offset).toFixed(1)}" text-anchor="middle">${Math.round(value)}°</text>` : '').join('');
    const points = high.map((value, index) => `<circle cx="${x(index).toFixed(1)}" cy="${y(value).toFixed(1)}" r="8"><title>${esc(labels[index])}: ${hasLow ? `${Math.round(low[index])}–${Math.round(value)}` : Math.round(value)} °C</title></circle>`).join('');
    return `<section class="card weather-chart25"><div class="card-head"><h2>${esc(title)}</h2></div><div class="weather-svg25"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}"><line x1="${left}" y1="${top + innerHeight}" x2="${width - right}" y2="${top + innerHeight}"/><g class="weather-rain25">${bars}</g><g class="weather-low25">${polyline(low || [])}</g><g class="weather-high25">${polyline(high)}</g>${axis}${valueLabels(high, -7)}${hasLow ? valueLabels(low, 15) : ''}<g class="weather-pts25">${points}</g>${ticks}<text x="${left}" y="${height - 2}">— temperatuur °C · ▮ neerslag mm</text></svg></div><p class="small-note">${esc(suffix)}</p></section>`;
  }

  function weatherMarkup25(forecast) {
    const { current: now, daily, hourly } = forecast;
    const days = daily.time.map((date, index) => `<li class="list-item weather-day25"><strong>${esc(new Date(`${date}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }))}</strong><span>${esc(weatherCode25[daily.weather_code[index]] || 'Onbekend')}</span><span>${Math.round(daily.temperature_2m_min[index])}° – ${Math.round(daily.temperature_2m_max[index])}°</span><span>${Math.round(daily.precipitation_probability_max[index] || 0)}% · ${Number(daily.precipitation_sum[index] || 0).toFixed(1)} mm</span></li>`).join('');
    const today = todayISO();
    const start = Math.max(0, hourly.time.findIndex(time => time >= `${today}T${new Date().getHours().toString().padStart(2, '0')}:00`));
    const indices = Array.from({ length: 24 }, (_, index) => start + index).filter(index => index < hourly.time.length);
    const hourlyLabels = indices.map(index => hourly.time[index].slice(11, 16));
    const hourlyTemps = indices.map(index => hourly.temperature_2m[index]);
    const hourlyRain = indices.map(index => hourly.precipitation[index]);
    const dailyLabels = daily.time.map(date => new Date(`${date}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'short' }));
    const condition = weatherCode25[now.weather_code] || 'Onbekend';
    const location = weatherLocation25();
    return `<section class="card weather-current25"><div class="card-head"><div><p class="eyebrow">${esc(location.place)}</p><h2>Weer</h2></div><button type="button" class="secondary" data-weather-refresh>↻ Vernieuwen</button></div><p class="weather-now"><strong>${Math.round(now.temperature_2m)}°C</strong> ${esc(condition)}</p><p class="muted">Voelt als ${Math.round(now.apparent_temperature)}° · wind ${Math.round(now.wind_speed_10m)} km/u · luchtvochtigheid ${Math.round(now.relative_humidity_2m)}%</p></section>
      ${chart25('Komende 7 dagen', dailyLabels, daily.temperature_2m_max, daily.temperature_2m_min, daily.precipitation_sum, 'Maximaal en minimaal temperatuurverloop met verwachte neerslag.')}
      ${chart25('Komende 24 uur', hourlyLabels, hourlyTemps, [], hourlyRain, 'Uurlijkse temperatuur en neerslag.')}
      <section class="card weather-days25"><div class="card-head"><h2>7-daagse verwachting</h2></div><ul class="weather-list25">${days}</ul></section>
      <section class="card settings-card"><div class="card-head"><div><p class="eyebrow">LOCATIE</p><h2>Weerlocatie aanpassen</h2></div></div><form class="form-grid weather-location25" data-weather-location><label class="field">Plaats<input name="place" maxlength="80" value="${esc(location.place)}" required></label><label class="field">Breedtegraad<input name="lat" type="number" step="any" min="-90" max="90" value="${location.lat}" required></label><label class="field">Lengtegraad<input name="lon" type="number" step="any" min="-180" max="180" value="${location.lon}" required></label><div class="button-row"><button class="primary" type="submit">Locatie opslaan</button><button class="secondary" type="button" data-weather-geolocate>Mijn locatie</button></div></form><p class="small-note">Weergegevens worden lokaal 30 minuten gecachet. Locatie-instellingen worden met de bestaande appgegevens gesynchroniseerd.</p></section>
      <p class="small-note weather-cache-note25" data-weather-cache-note></p>`;
  }

  async function loadWeatherPage25(force = false) {
    const box = document.querySelector('[data-weather-page-body]');
    if (!box) return;
    box.innerHTML = '<p class="muted">Weer laden…</p>';
    try {
      const result = await getForecast25(force);
      if (!box.isConnected) return;
      box.innerHTML = weatherMarkup25(result.data);
      const note = box.querySelector('[data-weather-cache-note]');
      if (note) note.textContent = `${result.stale ? 'Offline of tijdelijk niet bereikbaar · laatst opgeslagen verwachting' : 'Bijgewerkt'} · ${new Date(result.savedAt).toLocaleString('nl-NL')}`;
    } catch (error) {
      if (box.isConnected) box.innerHTML = `<section class="card"><p>${esc(error.message || 'Het weer kan nu niet worden geladen.')}</p><button type="button" class="secondary" data-weather-refresh>Opnieuw proberen</button></section>`;
    }
  }

  function renderWeather25() {
    return `<div class="weather-page25 page-grid"><div data-weather-page-body><p class="muted">Weer laden…</p></div></div>`;
  }

  const AUTH_KEY25 = 'samenThuisPersonalAuthV1';
  const personalPreferencesCore25 = window.SamenThuisPersonalPreferences;
  let authSession25 = null;
  let authNotice25 = '';
  let authBusy25 = false;
  let personalPreferencesReady25 = false;
  let personalSaveTimer25;
  try { authSession25 = JSON.parse(localStorage.getItem(AUTH_KEY25) || 'null'); } catch (_) {}

  function authBase25() { return String(syncConfig.projectUrl || DEFAULT_PROJECT_URL).replace(/\/$/, ''); }
  function authHeaders25(token = '') {
    return { 'Content-Type': 'application/json', apikey: DEFAULT_PUBLISHABLE_KEY, ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  }
  async function authRequest25(path, body, token = '') {
    const response = await fetch(`${authBase25()}${path}`, {
      method: 'POST', headers: authHeaders25(token), body: JSON.stringify(body || {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.msg || payload.message || payload.error_description || payload.error || `Supabase Auth (${response.status})`);
    return payload;
  }
  async function readySession25() {
    if (!authSession25?.access_token || !authSession25?.refresh_token) return null;
    if (Number(authSession25.expires_at || 0) > Date.now() + 60000) return authSession25;
    const next = await authRequest25('/auth/v1/token?grant_type=refresh_token', { refresh_token: authSession25.refresh_token });
    authSession25 = { ...next, expires_at: Date.now() + Number(next.expires_in || 3600) * 1000 };
    localStorage.setItem(AUTH_KEY25, JSON.stringify(authSession25));
    return authSession25;
  }
  window.SamenThuisAuth25 = { session: () => authSession25, ready: readySession25 };
  function uiDefault25() { return { theme: 'system', accent: 'purple', accentColor: '#7057d9', density: 'comfortable' }; }
  function setPersonalPreferences25(value) {
    const normalized = personalPreferencesCore25?.normalize(value, DASH_DEFAULTS, dashboardCore, DASH_DEFAULT_VISIBLE) || value || {};
    window.SamenThuisPersonalUi20?.set(normalized.ui || uiDefault25());
    window.SamenThuisDashboardPreferences25?.set(normalized.dashboard || dashboardCore?.defaults(DASH_DEFAULTS));
  }
  function localAccountPreferences25(userId) {
    try { return JSON.parse(localStorage.getItem(personalPreferencesCore25.storageKey(userId)) || 'null'); } catch (_) { return null; }
  }
  function saveLocalAccountPreferences25(userId) {
    const preferences = {
      ui: window.SamenThuisPersonalUi20?.get() || uiDefault25(),
      dashboard: window.SamenThuisDashboardPreferences25?.get() || dashboardCore?.defaults(DASH_DEFAULTS)
    };
    localStorage.setItem(personalPreferencesCore25.storageKey(userId), JSON.stringify(preferences));
    return preferences;
  }
  async function writePersonalPreferences25(preferences) {
    const session = await readySession25();
    if (!session?.user?.id) throw new Error('Meld je opnieuw aan om voorkeuren te synchroniseren.');
    const response = await fetch(`${authBase25()}/rest/v1/personal_preferences?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...authHeaders25(session.access_token), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: session.user.id, ui_config: preferences.ui,
        dashboard_config: preferences.dashboard, updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Persoonlijke voorkeuren opslaan mislukt (${response.status}).`);
    }
    localStorage.setItem(personalPreferencesCore25.storageKey(session.user.id), JSON.stringify(preferences));
  }
  async function loadPersonalPreferences25() {
    const session = await readySession25();
    if (!session?.user?.id) return;
    const response = await fetch(`${authBase25()}/rest/v1/personal_preferences?select=ui_config,dashboard_config&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`, {
      headers: authHeaders25(session.access_token)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Voorkeuren ophalen mislukt (${response.status}); controleer de persoonlijke-voorkeurenmigratie.`);
    }
    const rows = await response.json();
    const saved = Array.isArray(rows) ? rows[0] : null;
    if (saved) setPersonalPreferences25({ ui: saved.ui_config, dashboard: saved.dashboard_config });
    else {
      const local = localAccountPreferences25(session.user.id);
      setPersonalPreferences25(local || { ui: uiDefault25(), dashboard: dashboardCore?.defaults(DASH_DEFAULTS) });
      await writePersonalPreferences25(saveLocalAccountPreferences25(session.user.id));
    }
    personalPreferencesReady25 = true;
    authNotice25 = 'Persoonlijke voorkeuren zijn geladen en worden per account gesynchroniseerd.';
    if (current === 'settings') render();
  }
  async function authenticate25(action) {
    if (authBusy25) return;
    const form = document.querySelector('[data-personal-auth25]');
    const email = String(form?.elements.email.value || '').trim();
    const password = String(form?.elements.password.value || '');
    if (!email || !password) { authNotice25 = 'Vul je e-mailadres en wachtwoord in.'; render(); return; }
    authBusy25 = true; authNotice25 = '';
    if (current === 'settings') render();
    try {
      const endpoint = action === 'sign-up' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
      const result = await authRequest25(endpoint, { email, password });
      if (!result.access_token || !result.refresh_token || !result.user?.id) {
        authNotice25 = 'Account ontvangen. Bevestig je e-mailadres via de e-mail van Supabase en meld je daarna aan.';
      } else {
        authSession25 = { ...result, expires_at: Date.now() + Number(result.expires_in || 3600) * 1000 };
        localStorage.setItem(AUTH_KEY25, JSON.stringify(authSession25));
        personalPreferencesReady25 = false;
        await loadPersonalPreferences25();
      }
    } catch (error) { authNotice25 = error.message || 'Aanmelden is mislukt.'; }
    finally { authBusy25 = false; if (current === 'settings') render(); }
  }
  async function restoreAuthCallback25() {
    const params = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const accessToken = params.get('access_token'), refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) return false;
    const response = await fetch(`${authBase25()}/auth/v1/user`, { headers: authHeaders25(accessToken) });
    const user = await response.json().catch(() => ({}));
    if (!response.ok || !user.id) throw new Error(user.message || 'E-mailbevestiging kon niet worden gevalideerd.');
    authSession25 = {
      access_token: accessToken, refresh_token: refreshToken, user,
      expires_at: Date.now() + Number(params.get('expires_in') || 3600) * 1000
    };
    localStorage.setItem(AUTH_KEY25, JSON.stringify(authSession25));
    history.replaceState({}, '', `${location.pathname}${location.search}`);
    await loadPersonalPreferences25();
    return true;
  }
  async function signOut25() {
    try {
      const session = await readySession25();
      if (session) await authRequest25('/auth/v1/logout', {}, session.access_token);
    } catch (_) {}
    authSession25 = null; personalPreferencesReady25 = false;
    localStorage.removeItem(AUTH_KEY25);
    authNotice25 = 'Je bent afgemeld. Lokale voorkeuren blijven op dit apparaat staan.';
    if (current === 'settings') render();
  }
  function personalSettings25() {
    if (current !== 'settings') return;
    const view = document.querySelector('#view');
    if (!view || view.querySelector('[data-personal-account25]')) return;
    const email = authSession25?.user?.email || '';
    const account = email
      ? `<p class="muted">Aangemeld als <strong>${esc(email)}</strong>. Je accentkleur en dashboardindeling worden afzonderlijk per account bewaard.</p><button type="button" class="secondary" data-personal-sign-out>Afmelden</button>`
      : `<form class="form-grid" data-personal-auth25><label class="field">E-mailadres<input type="email" name="email" autocomplete="username" required></label><label class="field">Wachtwoord<input type="password" name="password" autocomplete="current-password" minlength="8" required></label><div class="button-row"><button type="button" class="primary" data-personal-auth="sign-in" ${authBusy25 ? 'disabled' : ''}>Aanmelden</button><button type="button" class="secondary" data-personal-auth="sign-up" ${authBusy25 ? 'disabled' : ''}>Account maken</button></div></form>`;
    view.insertAdjacentHTML('beforeend', `<section class="card settings-card" data-personal-account25><div class="card-head"><div><p class="eyebrow">PERSOONLIJK ACCOUNT</p><h2>Voorkeuren op al je apparaten</h2></div></div><p class="muted">De huishoudcode blijft alleen voor gedeelde huishoudgegevens. Een persoonlijk Supabase-account scheidt accentkleur en dashboardindeling per gebruiker. Vereist de persoonlijke-voorkeurenmigratie in Supabase.</p>${account}${authNotice25 ? `<p class="notice" role="status">${esc(authNotice25)}</p>` : ''}</section>`);
  }
  window.addEventListener('samenThuisPreferencesChange', () => {
    if (!authSession25?.user?.id || !personalPreferencesReady25) return;
    clearTimeout(personalSaveTimer25);
    personalSaveTimer25 = setTimeout(async () => {
      try { await writePersonalPreferences25(saveLocalAccountPreferences25(authSession25.user.id)); }
      catch (error) { authNotice25 = error.message || 'Persoonlijke voorkeuren konden niet worden gesynchroniseerd.'; }
    }, 500);
  });
  document.addEventListener('click', event => {
    const auth = event.target.closest('[data-personal-auth]');
    if (auth) { authenticate25(auth.dataset.personalAuth); return; }
    if (event.target.closest('[data-personal-sign-out]')) signOut25();
  });
  if (location.hash.includes('access_token=')) {
    restoreAuthCallback25().catch(error => { authNotice25 = error.message || 'Aanmeldkoppeling kon niet worden voltooid.'; });
  } else if (authSession25?.user?.id) {
    loadPersonalPreferences25().catch(error => { authNotice25 = error.message || 'Persoonlijke voorkeuren konden niet worden geladen.'; });
  }

  /* Digitaal krijtbord · berichten per huishouden via Supabase (RLS) */
  const chalkCore25 = window.SamenThuisChalkboard;
  const chalk25 = { uid: '', status: 'idle', household: null, role: '', messages: [], error: '', notice: '', loadedAt: 0, busy: false, formError: '' };

  async function chalkRequest25(path, options = {}) {
    const session = await readySession25();
    if (!session?.user?.id) throw new Error('Meld je aan via Instellingen om het krijtbord te gebruiken.');
    const response = await fetch(`${authBase25()}${path}`, {
      ...options, headers: { ...authHeaders25(session.access_token), ...(options.headers || {}) }
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Krijtbord is niet bereikbaar (${response.status}).`);
    }
    return response.status === 204 ? null : response.json().catch(() => null);
  }

  function chalkMessageHtml25(message) {
    const mine = message.user_id === authSession25?.user?.id;
    const removable = chalkCore25.canDelete(message, authSession25?.user?.id, chalk25.role);
    return `<li class="chalk-message25"><p>${esc(message.body)}</p><footer><span>${mine ? 'Jij' : esc(message.author_name)} · <time datetime="${esc(message.created_at)}">${esc(chalkCore25.formatWhen(message.created_at))}</time></span>${removable ? `<button type="button" class="chalk-delete25" data-chalk-delete="${esc(message.id)}" aria-label="Verwijder bericht van ${esc(message.author_name)}">Wissen</button>` : ''}</footer></li>`;
  }

  function chalkInner25() {
    const head = `<header class="chalk-head25"><div><p class="eyebrow">THUIS OP DE MUUR</p><h3>Ons krijtbord ♡</h3></div>`;
    if (chalk25.status === 'signedout') {
      return `${head}</header><p class="chalk-empty25">Meld je aan met je persoonlijke account om berichtjes voor elkaar achter te laten.</p><a class="chalk-button25" href="#/settings" data-v19-go="settings">Naar Instellingen</a>`;
    }
    if (chalk25.status === 'idle' || chalk25.status === 'loading') return `${head}</header><p class="chalk-empty25" role="status">Krijtbord laden…</p>`;
    if (chalk25.status === 'error') {
      return `${head}</header><p class="chalk-error25" role="alert">${esc(chalk25.error)}</p><button type="button" class="chalk-button25" data-chalk-retry>Opnieuw proberen</button>`;
    }
    if (chalk25.status === 'nohousehold') {
      return `${head}</header><p class="chalk-empty25">Maak een huishouden aan of voeg je toe met de code van je huisgenoot.</p><form class="chalk-form25" data-chalk-create><label for="chalkHouseName">Naam van jullie huishouden</label><input id="chalkHouseName" name="name" maxlength="80" required placeholder="Bijv. Samen Thuis"><button class="chalk-button25">Huishouden aanmaken</button></form><form class="chalk-form25" data-chalk-join><label for="chalkJoinCode">Of join met een code</label><input id="chalkJoinCode" name="code" maxlength="20" required autocomplete="off"><button class="chalk-button25">Toevoegen</button></form>${chalk25.formError ? `<p class="chalk-error25" role="alert">${esc(chalk25.formError)}</p>` : ''}`;
    }
    const messages = chalkCore25.sortMessages(chalk25.messages);
    const list = messages.length
      ? `<ul class="chalk-list25" tabindex="0" aria-label="Berichten, nieuwste bovenaan">${messages.map(chalkMessageHtml25).join('')}</ul>`
      : '<p class="chalk-empty25">Het krijtbord is nog leeg. Schrijf jullie eerste lieve berichtje ♡</p>';
    return `${head}<button type="button" class="chalk-button25" data-chalk-open>Laat een berichtje achter</button></header><p class="chalk-notice25" role="status" aria-live="polite">${esc(chalk25.notice)}</p>${list}<p class="chalk-code25">${esc(chalk25.household?.name || '')} · code om huisgenoten toe te voegen: <strong>${esc(chalk25.household?.join_code || '')}</strong></p>`;
  }

  function chalkboardMarkup25() {
    return `<section class="chalkboard25 card" data-widget18="chalkboard" aria-label="Krijtbord">${chalkInner25()}</section>`;
  }

  function paintChalkboard25() {
    document.querySelectorAll('[data-widget18="chalkboard"]').forEach(node => { node.innerHTML = chalkInner25(); });
  }

  async function refreshChalkboard25(force = true) {
    const userId = authSession25?.user?.id || '';
    if (chalk25.uid !== userId) Object.assign(chalk25, { uid: userId, status: 'idle', household: null, role: '', messages: [], notice: '', loadedAt: 0 });
    if (!userId) { chalk25.status = 'signedout'; paintChalkboard25(); return; }
    if (chalk25.busy) return;
    if (!force && chalk25.status === 'ready' && Date.now() - chalk25.loadedAt < 60000) return;
    chalk25.busy = true;
    if (chalk25.status !== 'ready') { chalk25.status = 'loading'; paintChalkboard25(); }
    try {
      const uid = encodeURIComponent(authSession25.user.id);
      const rows = await chalkRequest25(`/rest/v1/household_members?select=role,households(id,name,join_code)&user_id=eq.${uid}&order=joined_at.asc&limit=1`);
      const membership = rows?.[0];
      if (!membership?.households) { chalk25.status = 'nohousehold'; chalk25.household = null; chalk25.messages = []; return; }
      chalk25.household = membership.households; chalk25.role = membership.role;
      chalk25.messages = await chalkRequest25(`/rest/v1/chalkboard_messages?select=id,user_id,author_name,body,created_at&household_id=eq.${encodeURIComponent(chalk25.household.id)}&order=created_at.desc&limit=50`) || [];
      chalk25.status = 'ready'; chalk25.loadedAt = Date.now();
    } catch (error) {
      chalk25.status = 'error'; chalk25.error = error.message || 'Het krijtbord kon niet worden geladen.';
    } finally {
      chalk25.busy = false; paintChalkboard25();
    }
  }

  function chalkDialog25() {
    let dialog = document.querySelector('#chalkDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'chalkDialog';
    dialog.className = 'chalk-dialog25';
    dialog.innerHTML = `<form id="chalkForm" novalidate><div class="dialog-head"><div><p class="eyebrow">KRIJTBORD</p><h2>Laat een berichtje achter</h2></div><button type="button" class="icon-btn" data-chalk-close aria-label="Sluiten">×</button></div><div class="field"><label for="chalkText">Je bericht</label><textarea id="chalkText" name="text" rows="4" placeholder="Ik hoop dat je een fijne dag hebt ❤️" aria-describedby="chalkCount chalkFormError"></textarea><small id="chalkCount" class="chalk-count25">0 / ${chalkCore25.MAX_LENGTH}</small><p id="chalkFormError" class="chalk-error25" role="alert"></p></div><div class="dialog-actions"><button type="button" class="secondary" data-chalk-close>Annuleren</button><button type="submit" class="primary">Plaats bericht</button></div></form>`;
    document.body.append(dialog);
    return dialog;
  }

  async function postChalkMessage25(form) {
    const field = form.elements.text, errorNode = form.querySelector('#chalkFormError');
    const result = chalkCore25.validateMessage(field.value);
    if (!result.ok) { errorNode.textContent = result.error; field.focus(); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true; errorNode.textContent = '';
    try {
      const session = await readySession25();
      const saved = await chalkRequest25('/rest/v1/chalkboard_messages', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ household_id: chalk25.household.id, user_id: session.user.id, author_name: chalkCore25.authorName(session.user), body: result.value })
      });
      if (!saved?.length) throw new Error('Het bericht is niet opgeslagen.');
      chalk25.messages = [saved[0], ...chalk25.messages].slice(0, 50);
      chalk25.notice = 'Je berichtje hangt op het krijtbord ♡';
      field.value = '';
      document.querySelector('#chalkDialog')?.close();
      paintChalkboard25(); toast('Bericht geplaatst op het krijtbord.');
    } catch (error) {
      errorNode.textContent = `Het bericht is niet geplaatst: ${error.message || 'onbekende fout'}. Je tekst is bewaard; probeer het opnieuw.`;
    } finally { submit.disabled = false; }
  }

  async function deleteChalkMessage25(id) {
    const message = chalk25.messages.find(item => item.id === id);
    if (!message || !chalkCore25.canDelete(message, authSession25?.user?.id, chalk25.role)) return;
    if (!confirm('Dit bericht van het krijtbord wissen?')) return;
    try {
      const removed = await chalkRequest25(`/rest/v1/chalkboard_messages?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      if (!removed?.length) throw new Error('Je hebt geen rechten om dit bericht te wissen.');
      chalk25.messages = chalk25.messages.filter(item => item.id !== id);
      chalk25.notice = 'Bericht gewist.';
      paintChalkboard25();
    } catch (error) {
      chalk25.notice = `Wissen mislukt: ${error.message || 'onbekende fout'}`;
      paintChalkboard25();
    }
  }

  async function joinOrCreateHousehold25(form, kind) {
    chalk25.formError = '';
    try {
      if (kind === 'create') await chalkRequest25('/rest/v1/rpc/create_household', { method: 'POST', body: JSON.stringify({ p_name: form.elements.name.value }) });
      else await chalkRequest25('/rest/v1/rpc/join_household', { method: 'POST', body: JSON.stringify({ p_code: form.elements.code.value }) });
      await refreshChalkboard25(true);
    } catch (error) {
      chalk25.formError = error.message || 'Dit is niet gelukt.'; paintChalkboard25();
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-chalk-open]')) {
      const dialog = chalkDialog25();
      dialog.querySelector('#chalkFormError').textContent = '';
      dialog.showModal(); dialog.querySelector('#chalkText').focus();
      return;
    }
    if (event.target.closest('[data-chalk-close]')) { document.querySelector('#chalkDialog')?.close(); return; }
    if (event.target.closest('[data-chalk-retry]')) { refreshChalkboard25(true); return; }
    const del = event.target.closest('[data-chalk-delete]');
    if (del) deleteChalkMessage25(del.dataset.chalkDelete);
  });
  document.addEventListener('input', event => {
    if (!event.target.matches('#chalkText')) return;
    const count = Array.from(event.target.value).length;
    const node = document.querySelector('#chalkCount');
    node.textContent = `${count} / ${chalkCore25.MAX_LENGTH}`;
    node.classList.toggle('over', count > chalkCore25.MAX_LENGTH);
  });
  document.addEventListener('submit', event => {
    if (event.target.matches('#chalkForm')) { event.preventDefault(); postChalkMessage25(event.target); }
    else if (event.target.matches('[data-chalk-create]')) { event.preventDefault(); joinOrCreateHousehold25(event.target, 'create'); }
    else if (event.target.matches('[data-chalk-join]')) { event.preventDefault(); joinOrCreateHousehold25(event.target, 'join'); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current === 'today' && document.querySelector('[data-widget18="chalkboard"]:not([hidden])')) refreshChalkboard25(true);
  });

  function render25(...args) {
    if (current === 'tasks' || current === 'programs') {
      document.querySelector('#view').innerHTML = renderCollection25(current);
      document.querySelector('#pageTitle').textContent = sections[current].label;
      document.querySelector('#addBtn').style.display = 'none';
      document.querySelectorAll('[data-nav23], [data-v19-go]').forEach(button => {
        const page = button.dataset.nav23 || button.dataset.v19Go;
        button.classList.toggle('active', page === current);
      });
      updateSyncBadge();
      return;
    }
    if (current === 'challenges' && typeof window.SamenThuisRenderChallenges25 === 'function') {
      window.SamenThuisRenderChallenges25();
      document.querySelector('#pageTitle').textContent = sections.challenges.label;
      document.querySelector('#addBtn').style.display = 'none';
      document.querySelectorAll('[data-nav23], [data-v19-go]').forEach(button => {
        const page = button.dataset.nav23 || button.dataset.v19Go;
        button.classList.toggle('active', page === 'challenges');
      });
      updateSyncBadge();
      return;
    }
    if (current === 'weather') {
      document.querySelector('#view').innerHTML = renderWeather25();
      document.querySelector('#pageTitle').textContent = sections.weather.label;
      document.querySelector('#addBtn').style.display = 'none';
      document.querySelectorAll('[data-nav23], [data-v19-go]').forEach(button => {
        const page = button.dataset.nav23 || button.dataset.v19Go;
        button.classList.toggle('active', page === 'weather');
      });
      updateSyncBadge();
      requestAnimationFrame(() => loadWeatherPage25());
      return;
    }
    if (current === 'offers') {
      document.querySelector('#view').innerHTML = renderOffers25();
      document.querySelector('#pageTitle').textContent = sections.offers.label;
      document.querySelector('#addBtn').style.display = 'none';
      document.querySelectorAll('[data-nav23], [data-v19-go]').forEach(button => {
        const page = button.dataset.nav23 || button.dataset.v19Go;
        button.classList.toggle('active', page === 'offers');
      });
      updateSyncBadge();
      return;
    }
    const result = previousRender25(...args);
    requestAnimationFrame(() => {
      applyDashboard25();
      if (current === 'budget19' && !document.querySelector('#view .ledger25')) {
        document.querySelector('#view')?.append(ledgerMarkup25());
      }
      const settings = document.querySelector('#view .settings-grid');
      if (current === 'settings' && settings && !settings.querySelector('.dashboard-editor25')) {
        settings.insertAdjacentHTML('beforeend', dashboardEditor25());
      }
      personalSettings25();
    });
    return result;
  }

  const previousRender25 = render;
  render = render25;
  window.__ST_V26_INTEGRATED__ = true;
  window.SamenThuisChallengeStore = {
    get() { return data.challengeDataV26 ? clone(data.challengeDataV26) : null; },
    save(value, { initialize = false } = {}) {
      data.challengeDataV26 = clone(value);
      save({ touch: !initialize, sync: true });
    }
  };

  document.addEventListener('click', event => {
    const receiveIncome = event.target.closest('[data-ledger-receive]');
    if (receiveIncome) {
      const ledger = ledgerState25(), source = ledger.incomeSources.find(item => item.id === receiveIncome.dataset.ledgerReceive);
      if (!source) { toast('Deze inkomstenbron is niet meer beschikbaar.'); return; }
      const date = receiveIncome.dataset.incomeDate;
      if (!confirm(`Bevestig dat ${source.name} van ${moneyLedger25(source.amountCents)} op ${date} daadwerkelijk is ontvangen. Alleen dan wordt dit als inkomen geboekt.`)) return;
      const pots = ledgerPots25();
      try {
        const hasRules = ledger.allocationRules.some(rule => rule.active !== false);
        const income = ledgerCore25.addIncome(ledger, {
          amount: source.amountCents / 100, date, type: 'other', source: source.name,
          description: `Ontvangst geregistreerd voor ${source.receiver}`, sourceId: source.id,
          externalId: `income-source:${source.id}:${date}`,
          allocations: !hasRules && source.potId ? [{ potId: source.potId, amount: source.amountCents / 100 }] : []
        }, pots);
        const proposal = hasRules
          ? ledgerCore25.proposeIncomeDistribution(ledger, income.id, pots, { automatic: ledger.distributionMode === 'automatic' })
          : null;
        syncGoalMirrors25(ledger); save(); render();
        toast(proposal?.status === 'proposed' ? 'Ontvangst geboekt; verdelingsvoorstel wacht op goedkeuring.'
          : proposal ? 'Ontvangst geboekt en automatisch verdeeld.' : 'Ontvangst geboekt.');
      } catch (error) { toast(error.message || 'De ontvangst kon niet worden geregistreerd.'); }
      return;
    }
    const payBill = event.target.closest('[data-ledger-bill-paid]');
    if (payBill) {
      const ledger = ledgerState25(), bill = ledger.recurringBills.find(item => item.id === payBill.dataset.ledgerBillPaid);
      if (!bill) { toast('Deze vaste last is niet meer beschikbaar.'); return; }
      const occurrenceDate = payBill.dataset.billOccurrenceDate;
      const amountField = payBill.closest('.ledger-entry25')?.querySelector('[data-bill-amount]');
      const amount = amountField?.value;
      if (!confirm(`Is ${bill.name} op ${occurrenceDate} daadwerkelijk betaald? Dit registreert alleen de uitgave in Samen Thuis; er wordt geen bankbetaling uitgevoerd.`)) return;
      try {
        const allPots = ledgerPotHistory25(ledger, ledgerPots25());
        try {
          ledgerCore25.recordBillPayment(ledger, { billId: bill.id, occurrenceDate, amount }, allPots);
        } catch (error) {
          if (error.code !== 'INSUFFICIENT_FUNDS') throw error;
          const balance = ledgerCore25.allPotBalances(ledger, allPots)[bill.potId] || 0;
          if (!confirm(`${error.message} Het saldo van ${moneyLedger25(balance)} is onvoldoende. De betaling toch als negatief potjessaldo registreren?`)) return;
          ledgerCore25.recordBillPayment(ledger, { billId: bill.id, occurrenceDate, amount }, allPots, { allowOverdraw: true });
        }
        syncGoalMirrors25(ledger); save(); render(); toast('Betaling als werkelijk uitgegeven geregistreerd.');
      } catch (error) { toast(error.message || 'De betaling kon niet worden geregistreerd.'); }
      return;
    }
    const approveDistribution = event.target.closest('[data-ledger-distribution-approve]');
    if (approveDistribution) {
      const ledger = ledgerState25();
      try {
        if (!ledgerCore25.approveIncomeDistribution(ledger, approveDistribution.dataset.ledgerDistributionApprove, ledgerPotHistory25(ledger, ledgerPots25()))) {
          toast('Dit verdelingsvoorstel is al afgehandeld.'); return;
        }
        syncGoalMirrors25(ledger); save(); render(); toast('Verdeling goedgekeurd en geboekt.');
      } catch (error) { toast(error.message || 'De verdeling kon niet worden goedgekeurd.'); }
      return;
    }
    const toggleRule = event.target.closest('[data-ledger-rule-toggle]');
    if (toggleRule) {
      const ledger = ledgerState25(), rule = ledger.allocationRules.find(item => item.id === toggleRule.dataset.ledgerRuleToggle);
      if (!rule) return;
      rule.active = rule.active === false;
      save(); render(); toast(rule.active ? 'Verdelingsregel ingeschakeld.' : 'Verdelingsregel uitgeschakeld.');
      return;
    }
    if (event.target.closest('[data-ledger-config-cancel]')) {
      ledgerConfigEdit25 = null; render(); return;
    }
    const editConfig = event.target.closest('[data-ledger-config-edit]');
    if (editConfig) {
      ledgerConfigEdit25 = { kind: editConfig.dataset.ledgerConfigEdit, id: editConfig.dataset.configId };
      render(); return;
    }
    const toggleSource = event.target.closest('[data-ledger-source-toggle]');
    if (toggleSource) {
      const source = ledgerState25().incomeSources.find(item => item.id === toggleSource.dataset.ledgerSourceToggle);
      if (!source) return;
      source.active = source.active === false;
      save(); render(); toast(source.active ? 'Inkomstenbron ingeschakeld.' : 'Inkomstenbron uitgeschakeld.');
      return;
    }
    const toggleBill = event.target.closest('[data-ledger-bill-toggle]');
    if (toggleBill) {
      const bill = ledgerState25().recurringBills.find(item => item.id === toggleBill.dataset.ledgerBillToggle);
      if (!bill) return;
      bill.active = bill.active === false;
      save(); render(); toast(bill.active ? 'Vaste last ingeschakeld.' : 'Vaste last uitgeschakeld.');
      return;
    }
    const groupBtn = event.target.closest('[data-offer-group]');
    if (groupBtn) {
      const id = groupBtn.dataset.offerGroup;
      const changed = offerGroup25 !== id || offerFilters25.category;
      const hadCategory = !!offerFilters25.category;
      offerGroup25 = id;
      offerFilters25.category = '';
      if (hadCategory && offerQuery25) searchOffers25(offerQuery25); else if (changed) render();
      return;
    }
    const categoryBtn = event.target.closest('[data-offer-category]');
    if (categoryBtn) {
      const slug = categoryBtn.dataset.offerCategory;
      offerFilters25.category = offerFilters25.category === slug ? '' : slug;
      if (offerQuery25) searchOffers25(offerQuery25); else render();
      return;
    }
    if (event.target.closest('[data-offer-more]')) {
      if (offerQuery25 && !offerLoading25) searchOffers25(offerQuery25, { append: true });
      return;
    }
    if (event.target.closest('[data-offer-filters-reset]')) {
      resetOfferFilters25();
      render();
      return;
    }
    if (event.target.closest('[data-ledger-cancel-edit]')) {
      ledgerEdit25 = null; render(); return;
    }
    const editLedger = event.target.closest('[data-ledger-edit-kind]');
    if (editLedger) {
      ledgerEdit25 = { kind: editLedger.dataset.ledgerEditKind, id: editLedger.dataset.entryId };
      render(); return;
    }
    const deleteAllocation = event.target.closest('[data-ledger-delete-allocation]');
    if (deleteAllocation) {
      const ledger = ledgerState25(), income = ledger.incomes.find(item => item.id === deleteAllocation.dataset.ledgerDeleteAllocation);
      if (!income || !confirm('Deze pottoewijzing verwijderen? De inkomstenboeking blijft staan en het bedrag wordt weer niet-toegewezen.')) return;
      ledgerCore25.removeAllocation(ledger, income.id, deleteAllocation.dataset.allocationId);
      syncGoalMirrors25(ledger);
      save(); render(); return;
    }
    const deleteLedger = event.target.closest('[data-ledger-delete-kind]');
    if (deleteLedger) {
      const kind = deleteLedger.dataset.ledgerDeleteKind, ledger = ledgerState25();
      const entry = ledger[kind]?.find(item => item.id === deleteLedger.dataset.entryId);
      if (!entry) return;
      const note = kind === 'incomes' ? ' De bijbehorende toewijzingen verdwijnen ook; reeds geboekte uitgaven blijven zichtbaar.'
        : kind === 'expenses' ? ' Het huishoud- en potjessaldo wordt opnieuw berekend.'
          : ' Het saldo wordt opnieuw berekend; het huishoudtotaal blijft gelijk.';
      if (!confirm(`Deze ${kind === 'incomes' ? 'inkomstenboeking' : kind === 'expenses' ? 'uitgave' : 'verschuiving'} verwijderen?${note}`)) return;
      ledgerCore25.removeEntry(ledger, kind, entry.id);
      syncGoalMirrors25(ledger);
      ledgerEdit25 = null; save(); render(); return;
    }
    const favoriteOffer = event.target.closest('[data-offer-favorite]');
    if (favoriteOffer) {
      const key = favoriteOffer.dataset.offerFavorite;
      const favorites = new Set(Array.isArray(data.favoriteOffers25) ? data.favoriteOffers25 : []);
      if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
      data.favoriteOffers25 = [...favorites];
      save({ touch: false }); render(); return;
    }
    const addOffer = event.target.closest('[data-offer-grocery]');
    if (addOffer) {
      const key = addOffer.dataset.offerGrocery;
      const offer = [...(data.offers25 || [])].find(item => offerCore25().key(item) === key);
      if (!offer) { toast('Deze aanbieding is niet meer actief.'); return; }
      data.groceries ||= [];
      if (offerCore25().offerAlreadyInGroceries(data.groceries, offer)) {
        addOffer.disabled = true;
        toast('Deze aanbieding staat al op de boodschappenlijst.');
        return;
      }
      const item = offerCore25().groceryItemFromOffer({
        ...offer,
        sourceUrl: validOfferUrl25(offer.sourceUrl) || ''
      }, id, offerGroups25());
      data.groceries.push(item);
      addOffer.disabled = true;
      save(); toast('Toegevoegd aan de boodschappenlijst'); render(); return;
    }
    if (event.target.closest('[data-offer-archive]')) return;
    const submitOffers = event.target.closest('[data-offer-search]');
    if (submitOffers) return;
    if (event.target.closest('[data-collection-cancel]')) {
      editingCollection25 = null; render(); return;
    }
    const collectionAction = event.target.closest('[data-collection-toggle], [data-collection-edit], [data-collection-delete]');
    if (collectionAction) {
      const name = collectionAction.dataset.collectionToggle || collectionAction.dataset.collectionEdit || collectionAction.dataset.collectionDelete;
      const items = collectionItems25(name);
      const item = items.find(entry => entry.id === collectionAction.dataset.itemId);
      if (!item) return;
      if (collectionAction.hasAttribute('data-collection-toggle')) item.done = !item.done;
      else if (collectionAction.hasAttribute('data-collection-edit')) editingCollection25 = { collection: name, id: item.id };
      else {
        if (!confirm(`“${item.title}” verwijderen?`)) return;
        data[name] = items.filter(entry => entry.id !== item.id);
      }
      if (collectionAction.hasAttribute('data-collection-delete') && !data[name].some(entry => entry.id === item.id)) {
        editingCollection25 = null;
      }
      save(); render(); return;
    }
    if (event.target.closest('[data-weather-refresh]')) { loadWeatherPage25(true); return; }
    if (event.target.closest('[data-weather-geolocate]')) {
      if (!navigator.geolocation) { toast('Locatiebepaling wordt niet door deze browser ondersteund.'); return; }
      navigator.geolocation.getCurrentPosition(position => {
        const form = document.querySelector('[data-weather-location]');
        if (!form) return;
        form.elements.lat.value = position.coords.latitude.toFixed(5);
        form.elements.lon.value = position.coords.longitude.toFixed(5);
      }, () => toast('Je locatie kon niet worden opgehaald.'), { timeout: 10000, maximumAge: 300000 });
      return;
    }
    const move = event.target.closest('[data-dashboard-move]');
    if (move) {
      if (dashboardCore) dashboard25 = dashboardCore.move(dashboard25, move.dataset.dashboardMove, Number(move.dataset.direction), DASH_DEFAULTS, DASH_DEFAULT_VISIBLE);
      else {
        const index = dashboard25.order.indexOf(move.dataset.dashboardMove);
        const next = index + Number(move.dataset.direction);
        if (index < 0 || next < 0 || next >= dashboard25.order.length) return;
        [dashboard25.order[index], dashboard25.order[next]] = [dashboard25.order[next], dashboard25.order[index]];
      }
      saveDashboard25(); render();
      return;
    }
    if (event.target.closest('[data-dashboard-reset]')) {
      dashboard25 = normalizeDashboard25(null);
      saveDashboard25(); render();
    }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-ledger-mode]')) {
      try {
        ledgerCore25.setDistributionMode(ledgerState25(), event.target.value);
        save(); render();
        toast(event.target.value === 'automatic' ? 'Automatische verdeling ingeschakeld.' : 'Verdelingen vragen eerst om goedkeuring.');
      } catch (error) { toast(error.message); }
      return;
    }
    if (event.target.matches('[data-ledger-month]')) {
      if (ledgerCore25.validMonth(event.target.value)) { ledgerMonth25 = event.target.value; ledgerEdit25 = null; render(); }
      else toast('Kies een geldige maand.');
      return;
    }
    if (event.target.matches('[data-offer-filter]')) {
      offerFilters25[event.target.dataset.offerFilter] = event.target.value;
      render(); return;
    }
    if (event.target.matches('[data-offer-store]')) {
      const store = event.target.dataset.offerStore;
      if (event.target.checked) offerSelectedStores25.add(store);
      else offerSelectedStores25.delete(store);
      render(); return;
    }
    if (event.target.matches('[data-offer-favorites]')) {
      offerFavoritesOnly25 = event.target.checked;
      render(); return;
    }
    if (event.target.matches('[data-offer-archive]')) {
      data.settings.archiveExpiredOffers = event.target.checked;
      if (!event.target.checked) data.offerArchive25 = [];
      else offerList25();
      save({ touch: false }); render(); return;
    }
    const toggle = event.target.closest('[data-dashboard-visible]');
    if (!toggle) return;
    if (dashboardCore) dashboard25 = dashboardCore.setVisible(dashboard25, toggle.dataset.dashboardVisible, toggle.checked, DASH_DEFAULTS, DASH_DEFAULT_VISIBLE);
    else dashboard25.visible[toggle.dataset.dashboardVisible] = toggle.checked;
    saveDashboard25();
    if (current === 'settings') render();
    else applyDashboard25();
  });

  document.addEventListener('submit', event => {
    const ledgerEditForm = event.target.closest('[data-ledger-edit]');
    const ledgerForm = event.target.closest('[data-ledger-form]');
    if (ledgerEditForm || ledgerForm) {
      event.preventDefault();
      const form = ledgerEditForm || ledgerForm;
      const fields = Object.fromEntries(new FormData(form));
      const budget = ledgerBudget25(), pots = ledgerPots25(budget), ledger = ledgerState25(budget, pots);
      const allPots = ledgerPotHistory25(ledger, pots);
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        if (ledgerEditForm) {
          const kind = ledgerEditForm.dataset.ledgerEdit, entryId = ledgerEditForm.dataset.entryId;
          const preview = clone(ledger);
          try {
            ledgerCore25.updateEntry(preview, kind, entryId, fields, allPots, { allowOverdraw: true });
            if (kind !== 'incomes') {
              const before = ledgerCore25.allPotBalances(ledger, allPots);
              const after = ledgerCore25.allPotBalances(preview, allPots);
              const newlyOverdrawn = Object.entries(after).filter(([potId, balance]) =>
                balance < 0 && balance < (before[potId] || 0));
              for (const [potId, balance] of newlyOverdrawn) {
                const pot = allPots.find(item => item.id === potId);
                if (!confirm(`Deze correctie leidt tot een negatief saldo van ${moneyLedger25(balance)} in ${pot?.label || 'een potje'}. Bewust doorgaan?`)) {
                  if (submit) submit.disabled = false;
                  return;
                }
              }
            }
          } catch (error) { throw error; }
          ledgerCore25.updateEntry(ledger, kind, entryId, fields, allPots, { allowOverdraw: true });
          syncGoalMirrors25(ledger);
          ledgerEdit25 = null; save(); render(); toast('Boeking bijgewerkt'); return;
        }
        const action = ledgerForm.dataset.ledgerForm;
        if (action === 'income') {
          if (!confirm(`Inkomsten registreren: ${moneyLedger25(ledgerCore25.cents(fields.amount))} van ${String(fields.source).trim()}, geboekt in ${fields.month}?`)) {
            if (submit) submit.disabled = false;
            return;
          }
          const income = ledgerCore25.addIncome(ledger, fields, pots);
          const proposal = ledger.allocationRules.some(rule => rule.active !== false)
            ? ledgerCore25.proposeIncomeDistribution(ledger, income.id, pots, { automatic: ledger.distributionMode === 'automatic' })
            : null;
          syncGoalMirrors25(ledger);
          toast(proposal?.status === 'proposed' ? 'Inkomstenboeking opgeslagen; verdelingsvoorstel wacht op goedkeuring.'
            : proposal ? 'Inkomstenboeking opgeslagen en automatisch verdeeld.' : 'Inkomstenboeking opgeslagen');
        } else if (action === 'income-source') {
          ledgerCore25.addIncomeSource(ledger, fields, pots);
          toast('Inkomstenbron opgeslagen');
        } else if (action === 'edit-income-source') {
          ledgerCore25.updateIncomeSource(ledger, ledgerForm.dataset.editId, fields, pots);
          ledgerConfigEdit25 = null; toast('Inkomstenbron bijgewerkt');
        } else if (action === 'allocation-rule') {
          const kind = fields.kind;
          ledgerCore25.addAllocationRule(ledger, {
            potId: fields.potId, kind, priority: fields.priority,
            ...(kind === 'fixed' ? { amount: fields.value } : { basisPoints: Number(fields.value) * 100 })
          }, pots);
          toast('Verdelingsregel opgeslagen');
        } else if (action === 'edit-allocation-rule') {
          const kind = fields.kind;
          ledgerCore25.updateAllocationRule(ledger, ledgerForm.dataset.editId, {
            potId: fields.potId, kind, priority: fields.priority,
            ...(kind === 'fixed' ? { amount: fields.value } : { basisPoints: Number(fields.value) * 100 })
          }, pots);
          ledgerConfigEdit25 = null; toast('Verdelingsregel bijgewerkt');
        } else if (action === 'recurring-bill') {
          ledgerCore25.addRecurringBill(ledger, fields, pots);
          toast('Vaste last opgeslagen');
        } else if (action === 'edit-recurring-bill') {
          ledgerCore25.updateRecurringBill(ledger, ledgerForm.dataset.editId, fields, pots);
          ledgerConfigEdit25 = null; toast('Vaste last bijgewerkt');
        } else if (action === 'allocation') {
          const income = ledger.incomes.find(item => item.id === fields.incomeId);
          if (!income) throw new Error('Deze inkomstenboeking bestaat niet meer.');
          const pot = pots.find(item => item.id === fields.potId);
          const amount = ledgerCore25.cents(fields.amount);
          const already = (income.allocations || []).reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
          if (!confirm(`Verdeling controleren: ${moneyLedger25(amount)} van ${income.source} naar ${pot?.label || 'het potje'}. Daarna blijft ${moneyLedger25(Number(income.amountCents || 0) - already - amount)} van deze inkomstenboeking nog niet toegewezen. Dit is geen nieuwe inkomstenboeking. Definitief verdelen?`)) {
            if (submit) submit.disabled = false;
            return;
          }
          ledgerCore25.allocateIncome(ledger, fields, pots);
          syncGoalMirrors25(ledger);
          toast('Verdeling opgeslagen');
        } else if (action === 'expense') {
          try { ledgerCore25.addExpense(ledger, fields, pots); }
          catch (error) {
            if (error.code !== 'INSUFFICIENT_FUNDS') throw error;
            const balance = ledgerCore25.allPotBalances(ledger, pots)[fields.potId] || 0;
            if (!confirm(`${error.message} Het huidige saldo is ${moneyLedger25(balance)}; de boeking maakt het saldo negatief. Bewust toch registreren?`)) {
              if (submit) submit.disabled = false;
              return;
            }
            ledgerCore25.addExpense(ledger, fields, pots, { allowOverdraw: true });
          }
          syncGoalMirrors25(ledger);
          toast('Uitgave opgeslagen');
        } else if (action === 'transfer') {
          const preview = clone(ledger);
          ledgerCore25.addTransfer(preview, fields, allPots, { allowOverdraw: true });
          const amount = ledgerCore25.cents(fields.amount);
          const before = ledgerCore25.allPotBalances(ledger, allPots);
          const after = ledgerCore25.allPotBalances(preview, allPots);
          const source = allPots.find(item => item.id === fields.fromPotId);
          const destination = allPots.find(item => item.id === fields.toPotId);
          if (!confirm(`Controleer verschuiving: ${moneyLedger25(amount)} van ${source?.label || 'bronpotje'} (${moneyLedger25(before[fields.fromPotId] || 0)} → ${moneyLedger25(after[fields.fromPotId] || 0)}) naar ${destination?.label || 'doelpotje'} (${moneyLedger25(before[fields.toPotId] || 0)} → ${moneyLedger25(after[fields.toPotId] || 0)}). Huishoudsaldo blijft ${moneyLedger25(ledgerCore25.availableCashCents(ledger))}. Definitief verschuiven?`)) {
            if (submit) submit.disabled = false;
            return;
          }
          if ((before[fields.fromPotId] || 0) < amount && !confirm(`Waarschuwing: het bronpotje krijgt een negatief saldo van ${moneyLedger25(after[fields.fromPotId] || 0)}. Bewust doorgaan?`)) {
            if (submit) submit.disabled = false;
            return;
          }
          ledgerCore25.addTransfer(ledger, fields, allPots, { allowOverdraw: true });
          syncGoalMirrors25(ledger);
          toast('Verschuiving opgeslagen');
        }
        save(); render();
      } catch (error) {
        if (submit) submit.disabled = false;
        toast(error.message || 'De boeking kon niet worden opgeslagen.');
      }
      return;
    }
    const offerForm = event.target.closest('[data-offer-search]');
    if (offerForm) {
      event.preventDefault();
      searchOffers25(new FormData(offerForm).get('query'));
      return;
    }
    const collectionForm = event.target.closest('[data-collection-form]');
    if (collectionForm) {
      event.preventDefault();
      const name = collectionForm.dataset.collectionForm;
      const fields = Object.fromEntries(new FormData(collectionForm));
      const items = collectionItems25(name);
      const existing = editingCollection25?.collection === name
        ? items.find(item => item.id === editingCollection25.id) : null;
      const item = name === 'tasks'
        ? { ...existing, id: existing?.id || id(), title: String(fields.title || '').trim(), category: String(fields.category || '').trim(), person: String(fields.person || 'Samen'), due: String(fields.due || ''), done: existing?.done === true }
        : { ...existing, id: existing?.id || id(), title: String(fields.title || '').trim(), category: String(fields.category || '').trim(), date: String(fields.date || ''), url: String(fields.url || '').trim(), note: String(fields.note || '').trim(), done: existing?.done === true };
      if (!item.title) return;
      const index = items.findIndex(entry => entry.id === item.id);
      if (index < 0) items.unshift(item); else items[index] = item;
      editingCollection25 = null;
      save(); render(); toast(`${name === 'tasks' ? 'Taak' : 'Programma'} opgeslagen`);
      return;
    }
    const form = event.target.closest('[data-weather-location]');
    if (!form) return;
    event.preventDefault();
    const values = new FormData(form);
    const lat = Number(values.get('lat')), lon = Number(values.get('lon'));
    const place = String(values.get('place') || '').trim();
    if (!place || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      toast('Controleer de plaats en coördinaten.');
      return;
    }
    data.settings ||= {};
    data.settings.weatherPlace = place.slice(0, 80);
    data.settings.weatherLat = lat;
    data.settings.weatherLon = lon;
    save();
    try { localStorage.removeItem(WEATHER_KEY); } catch (_) {}
    render();
    toast('Weerlocatie opgeslagen');
  });
})();

/* Vriezer & mealprep: gekoppeld aan Voorraad (data.freezer) en Weekmenu (meal.freezerId). */
(function () {
  const F = window.FreezerCore;
  if (!F) return;
  const fzUI = { query: '', location: '', sort: 'first', open: false };
  const list = () => (data.freezer = Array.isArray(data.freezer) ? data.freezer : []);
  const today = () => todayISO();
  const field = (n, label, type = 'text', extra = '') => `<label class="fz-field"><span>${label}</span><input id="fz-${n}" type="${type}" ${extra}></label>`;
  const opts = arr => arr.map(o => `<option>${esc(o)}</option>`).join('');

  function itemRow(x) {
    const d = F.daysLeft(x, today());
    const tag = d === null ? '' : d < 0 ? `<span class="tag red">${-d} d over datum</span>` : d <= 14 ? `<span class="tag orange">nog ${d} d</span>` : `<span class="tag green">nog ${d} d</span>`;
    return `<section class="card fz-item"><div class="card-head"><strong>${esc(x.title)}</strong>${tag}</div>
      <p class="muted">${esc(x.kind)} · ${esc(x.location)}${x.category ? ' · ' + esc(x.category) : ''}${x.label ? ' · 🏷 ' + esc(x.label) : ''}${x.recipe ? ' · Recept: ' + esc(x.recipe) : ''}</p>
      <p class="muted">${x.frozen ? 'Ingevroren ' + fmtDate(x.frozen) : x.prepared ? 'Bereid ' + fmtDate(x.prepared) : ''}${x.bestBefore ? ' · Tot ' + fmtDate(x.bestBefore) : ''}</p>
      ${x.note ? `<p class="muted">${esc(x.note)}</p>` : ''}
      <div class="stock-controls"><strong>${x.portions} <small>${esc(x.legacyStock?.unit || 'porties')}${x.batchPortions > x.portions ? ` · ${x.batchPortions} ingevroren` : ''}</small></strong></div>
      <div class="button-row"><button class="secondary" data-fz="eaten:${x.id}">Opgegeten −1</button><button class="secondary" data-fz="thawed:${x.id}">Ontdooid −1</button><button class="secondary" data-fz="discarded:${x.id}">Weggegooid −1</button><button class="secondary" data-fz="move:${x.id}">Verplaats</button><button class="delete" data-fz="delete:${x.id}" aria-label="Verwijderen">×</button></div></section>`;
  }

  function freezerHTML() {
    const t = today(), s = F.summary(list(), t), items = F.sortFilter(list(), fzUI, t);
    const first = F.sortFilter(list(), { sort: 'first' }, t)[0];
    return `<section class="card fz-panel" id="fzPanel"><div class="card-head"><div><p class="eyebrow">Vriezer & mealprep</p><h2>${s.total} porties · ${s.items} items</h2></div><button class="primary" data-fz="toggle:form">＋ Toevoegen</button></div>
      <p class="muted">${s.urgent ? `⚠ ${s.urgent} bijna op of over datum${s.expired ? ` (${s.expired} verlopen)` : ''}. ` : ''}${first ? `Eerst gebruiken: <strong>${esc(first.title)}</strong>${first.bestBefore ? ' (' + fmtDate(first.bestBefore) + ')' : ''}` : 'Nog niets in de vriezer.'}</p>
      <div class="fz-form" ${fzUI.open ? '' : 'hidden'}>
        <div class="fz-grid">${field('title', 'Gerecht / product', 'text', 'list="fz-recipes" maxlength="120" required')}${field('portions', 'Porties ingevroren', 'number', 'min="1" value="2" inputmode="numeric"')}
        <label class="fz-field"><span>Soort</span><select id="fz-kind">${opts(F.KINDS)}</select></label><label class="fz-field"><span>Plek</span><select id="fz-location">${opts(F.LOCATIONS)}</select></label>
        ${field('frozen', 'Invriesdatum', 'date', `value="${t}"`)}${field('bestBefore', 'Uiterste gebruiksdatum', 'date')}${field('cooked', 'Porties bereid (optioneel)', 'number', 'min="1" inputmode="numeric"')}${field('category', 'Categorie')}${field('label', 'Label')}${field('note', 'Notitie')}</div>
        <datalist id="fz-recipes">${[...new Set((data.meals || []).map(m => m.title).filter(Boolean))].slice(0, 50).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="button-row"><button class="primary" data-fz="save:close">Opslaan</button><button class="secondary" data-fz="save:more">Opslaan & volgende</button></div></div>
      <div class="fz-filters"><input id="fzQuery" type="search" placeholder="Zoek in vriezer en voorraad" value="${esc(fzUI.query)}" aria-label="Zoeken"><select id="fzLoc" aria-label="Plek"><option value="">Alle plekken</option>${F.LOCATIONS.map(l => `<option ${fzUI.location === l ? 'selected' : ''}>${l}</option>`).join('')}</select><select id="fzSort" aria-label="Sorteren"><option value="first" ${fzUI.sort === 'first' ? 'selected' : ''}>Eerst gebruiken</option><option value="name" ${fzUI.sort === 'name' ? 'selected' : ''}>Naam</option><option value="portions" ${fzUI.sort === 'portions' ? 'selected' : ''}>Meeste porties</option></select></div>
      <div class="grid three">${items.map(itemRow).join('') || empty('Geen items gevonden')}</div></section>`;
  }

  function mealLinkHTML() {
    const avail = F.sortFilter(list(), {}, today());
    const linked = (data.meals || []).filter(m => m.freezerId);
    const planner = avail.length ? `<div class="fz-grid"><label class="fz-field"><span>Vriezergerecht</span><select id="fzMealItem">${avail.map(x => `<option value="${x.id}">${esc(x.title)} (${x.portions})</option>`).join('')}</select></label>${field('mealDate', 'Datum', 'date', `value="${today()}"`)}<label class="fz-field"><span>Maaltijd</span><select id="fzMealType"><option>Avondeten</option><option>Lunch</option><option>Ontbijt</option></select></label>${field('mealPortions', 'Porties', 'number', 'min="1" value="2"')}</div><button class="primary" data-fz="plan:x">Inplannen</button>` : '<p class="muted">Geen beschikbare vriezergerechten.</p>';
    const rows = linked.map(m => { const it = list().find(x => x.id === m.freezerId); const done = F.wasProcessed(it, 'meal:' + m.id); return `<div class="list-item"><div class="item-main"><strong>${esc(m.title)}</strong><small>${fmtDate(m.date)} · ${esc(m.type)} · ${esc(String(m.persons || 1))} porties</small></div>${done ? '<span class="tag green">Verwerkt</span>' : `<button class="secondary" data-fz="book:${m.id}">Gegeten ✓</button>`}</div>`; }).join('');
    const ing = (data.meals || []).filter(m => m.ingredients && m.date >= today()).length;
    return `<section class="card" id="fzMeals"><h2>Vriezer in weekmenu</h2>${planner}<div class="list">${rows}</div>${ing ? `<div class="button-row"><button class="secondary" data-fz="shop:x">Ontbrekende ingrediënten naar boodschappen</button></div>` : ''}</section>`;
  }

  function inject() {
    const view = document.querySelector('#view');
    if (!view || document.querySelector('#fzPanel, #fzMeals')) return;
    if (current === 'stock') view.insertAdjacentHTML('afterbegin', freezerHTML());
    else if (current === 'meals') view.insertAdjacentHTML('beforeend', mealLinkHTML());
  }
  const prev = render;
  render = function (...a) { const r = prev(...a); inject(); return r; };

  const val = n => (document.querySelector('#fz-' + n) || {}).value || '';
  function done(msg) { save(); render(); if (msg) toast(msg); }

  document.addEventListener('input', e => { if (e.target.id === 'fzQuery') { fzUI.query = e.target.value; const p = document.querySelector('#fzPanel'); if (p) { const pos = e.target.selectionStart; p.outerHTML = freezerHTML(); const q = document.querySelector('#fzQuery'); q.focus(); q.setSelectionRange(pos, pos); } } });
  document.addEventListener('change', e => { if (e.target.id === 'fzLoc') fzUI.location = e.target.value; else if (e.target.id === 'fzSort') fzUI.sort = e.target.value; else return; document.querySelector('#fzPanel').outerHTML = freezerHTML(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fz]'); if (!b) return;
    const [act, ref] = b.dataset.fz.split(':'), item = list().find(x => x.id === ref);
    if (act === 'toggle') { fzUI.open = !fzUI.open; render(); return; }
    if (act === 'save') {
      const cooked = Math.floor(Number(val('cooked')) || 0), frozen = Math.floor(Number(val('portions')) || 0);
      if (cooked && frozen > cooked) { toast('Ingevroren porties kunnen niet hoger zijn dan bereide porties.'); return; }
      const bb = val('bestBefore'), fr = val('frozen');
      if (bb && fr && bb < fr) { toast('Gebruiksdatum ligt vóór invriesdatum.'); return; }
      const recipe = F.matchMealTitle(val('title'), data.meals);
      const res = F.add(list(), { title: val('title'), portions: frozen, kind: val('kind'), location: val('location'), frozen: fr, prepared: fr, bestBefore: bb, category: val('category'), label: val('label'), recipe: recipe?.title || '', note: val('note') + (cooked && cooked > frozen ? ` (${cooked - frozen} van ${cooked} porties direct gegeten)` : '') }, today());
      if (!res.ok) { toast(res.error); return; }
      fzUI.open = ref === 'more'; done(res.merged ? 'Samengevoegd met bestaand item' : 'Toegevoegd'); return;
    }
    if (act === 'plan') {
      const it = list().find(x => x.id === (document.querySelector('#fzMealItem') || {}).value), n = Math.max(1, Math.floor(Number(val('mealPortions')) || 1));
      if (!it) return;
      const planned = F.planMeal(data.meals, it, { id: id(), date: val('mealDate') || today(), type: (document.querySelector('#fzMealType') || {}).value || 'Avondeten', title: it.title, persons: n }, today());
      if (!planned.ok) { toast(planned.error); return; }
      done('Ingepland'); return;
    }
    if (act === 'book') {
      const m = data.meals.find(x => x.id === ref), it = m && list().find(x => x.id === m.freezerId);
      if (!it) { toast('Vriezergerecht niet meer beschikbaar.'); return; }
      const r = F.bookMeal(it, m); done(r.ok ? 'Voorraad bijgewerkt' : r.error); return;
    }
    if (act === 'shop') {
      let added = 0;
      data.meals.filter(m => m.ingredients && m.date >= today()).forEach(m => F.missingIngredients(m.ingredients, data.stock, data.groceries).forEach(t => { data.groceries.push({ id: id(), title: t, category: categorizeProduct(t), done: false }); added++; }));
      done(added ? `${added} ingrediënt(en) toegevoegd` : 'Niets ontbreekt'); return;
    }
    if (!item) return;
    if (act === 'delete') { if (confirm('Verwijderen?')) { data.freezer = list().filter(x => x !== item); done(); } return; }
    if (act === 'move') { const to = prompt('Verplaats naar (' + F.LOCATIONS.join(', ') + ')', item.location === 'Vriezer' ? 'Koelkast' : 'Vriezer'); if (!to) return; const n = prompt('Aantal porties (1-' + item.portions + ')', item.portions); const r = F.move(list(), item, to.trim().replace(/^./, c => c.toUpperCase()), n); if (!r.ok) toast(r.error); else done('Verplaatst'); return; }
    const r = F.consume(item, act, 1); if (!r.ok) toast(r.error); else done(act === 'thawed' ? 'Ontdooid — vergeet de maaltijd niet in te plannen' : 'Bijgewerkt');
  });
})();
