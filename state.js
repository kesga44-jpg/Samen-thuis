import Core from './core.js';
import { todayKey, uid } from './utils.js';
import { categorizeProduct } from './groceries.js';

export const STORAGE_KEY = 'samenThuisV2';
export const SNAPSHOT_KEY = 'samenThuisV2-premigration';
export const SCHEMA = 3;
const PEOPLE = ['Kees', 'Daphne', 'Samen'];
export const LEGACY_WIDGETS = ['tasks', 'quote', 'question', 'weather', 'agenda', 'groceries', 'challenges'];
export const NEW_WIDGETS = ['greeting', 'weatherAdvice', 'stats', 'agendaUpcoming', 'dinner', 'choresSoon', 'travelActions', 'budgetSummary', 'apkWarning', 'syncStatus'];
export const DASH_WIDGETS = [...LEGACY_WIDGETS, ...NEW_WIDGETS];
const DASH_DEFAULT_VISIBLE = ['tasks', 'quote', 'question', ...NEW_WIDGETS];
const COLLECTIONS = ['tasks', 'agenda', 'challenges', 'programs', 'meals', 'groceries', 'deals', 'stock', 'home', 'dates', 'travel', 'extras', 'chores', 'trips', 'vehicles', 'fuelEntries'];
const DEFAULT_CALENDAR = { id: 'persoonlijk', name: 'Persoonlijk', color: '#315f86', visible: true, person: '' };
const defaultBudget = () => ({ monthly: 0, items: [], incomeKees: 0, incomeDaphne: 0, contributionPct: 50, invest: 0, fixed: [], houseCategories: [], goals: [] });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

export function defaultState() {
  return {
    version: 2, schema: SCHEMA, currentPage: 'dashboard', theme: 'light', themeMode: 'light', density: 'comfortable', appearance: 'normal', minimalColor: '#315f86', showQuote: true, dashboard: [],
    weather: { place: 'Amsterdam', lat: 52.37, lon: 4.9 }, meta: { updatedAt: '' },
    tasks: [
      { id: uid(), text: 'Wasmachine aanzetten', person: 'Kees', category: 'Huishouden', due: todayKey(), done: false },
      { id: uid(), text: 'Boodschappenlijst controleren', person: 'Samen', category: 'Boodschappen', due: todayKey(), done: false }
    ],
    agenda: [], calendars: [{ ...DEFAULT_CALENDAR }], excludedCalendars: [], chores: [], trips: [], vehicles: [], fuelEntries: [], migrated: { travel: [], car: false }, challenges: [
      { id: uid(), title: '3× bewegen deze week', category: 'Sport', done: false },
      { id: uid(), title: '30 minuten lezen', category: 'Lezen', done: false }
    ],
    programs: [], meals: [], groceries: [], deals: [], stock: [], home: [], dates: [], travel: [], extras: [],
    budget: defaultBudget(), car: {}, dailyAnswers: {}, priceReferences: []
  };
}

export function normalizeDashboard(list, showQuote = true) {
  const seen = new Set();
  const result = [];
  (Array.isArray(list) ? list : []).forEach(widget => {
    if (isObject(widget) && DASH_WIDGETS.includes(widget.id) && !seen.has(widget.id)) {
      seen.add(widget.id);
      result.push({ id: widget.id, visible: widget.visible !== false });
    }
  });
  DASH_WIDGETS.forEach(id => {
    if (!seen.has(id)) result.push({ id, visible: id === 'quote' ? showQuote !== false : DASH_DEFAULT_VISIBLE.includes(id) });
  });
  return result;
}

function validWeather(weather, fallback) {
  if (!isObject(weather)) return fallback;
  const lat = Number(weather.lat), lon = Number(weather.lon);
  return typeof weather.place === 'string' && weather.place.length <= 120
    && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lon) && lon >= -180 && lon <= 180
    ? { place: weather.place, lat, lon }
    : fallback;
}

function validItems(items) {
  return items.filter(isObject).map(item => {
    const safe = { ...item };
    safe.id = typeof safe.id === 'string' && safe.id.length <= 200 ? safe.id : uid();
    if ('done' in safe) safe.done = safe.done === true;
    return safe;
  });
}

export function validateState(saved) {
  if (!isObject(saved)) throw new TypeError('Back-up moet een JSON-object zijn');
  if (saved.version !== undefined && (!Number.isInteger(saved.version) || saved.version < 1 || saved.version > 2)) {
    throw new TypeError('Back-upversie wordt niet ondersteund');
  }
  for (const key of [...COLLECTIONS, 'calendars', 'excludedCalendars']) {
    if (saved[key] !== undefined && !Array.isArray(saved[key])) throw new TypeError(`Ongeldige lijst: ${key}`);
  }
  if (saved.budget !== undefined && !isObject(saved.budget)) throw new TypeError('Ongeldig budget');
  if (saved.dailyAnswers !== undefined && !isObject(saved.dailyAnswers)) throw new TypeError('Ongeldige antwoorden');
  if (saved.car !== undefined && !isObject(saved.car)) throw new TypeError('Ongeldige autogegevens');
  if (saved.priceReferences !== undefined && !Array.isArray(saved.priceReferences)) throw new TypeError('Ongeldige prijzen');
  return saved;
}

const text = (value, max = 200) => (typeof value === 'string' ? value.slice(0, max) : value == null ? '' : String(value).slice(0, max));
const validCalendars = list => {
  const out = validItems(list).map(c => ({ ...c, name: text(c.name, 80) || 'Agenda', color: /^#[\da-f]{6}$/i.test(c.color) ? c.color : '#315f86', visible: c.visible !== false, person: PEOPLE.includes(c.person) ? c.person : '' }));
  return out.some(c => c.id === DEFAULT_CALENDAR.id) ? out : [{ ...DEFAULT_CALENDAR }, ...out];
};

const migrateAgenda = items => items.map(item => ({ ...item, time: text(item.time, 10), endTime: text(item.endTime, 10), calendarId: text(item.calendarId, 200) || DEFAULT_CALENDAR.id }));
const migrateStock = items => items.map(item => {
  const out = { ...item };
  if (out.amount === undefined) {
    const parsed = parseFloat(String(out.quantity ?? '').replace(',', '.'));
    out.amount = Number.isFinite(parsed) ? parsed : 0;
  }
  if (out.min === undefined) out.min = 0;
  if (out.desired === undefined) out.desired = 0;
  if (out.unit === undefined) out.unit = '';
  return out;
});
const migrateMeals = items => items.map(item => ({ ...item, slot: text(item.slot, 20) || 'Avondeten' }));
const migrateGroceries = items => items.map(item => ({ ...item, category: text(item.category, 40) || categorizeProduct(item.name) }));
const migrateHome = items => items.map(item => ({ ...item, category: text(item.category, 40) || 'Klus', due: text(item.due, 10), repeat: text(item.repeat, 30) }));
const migrateChores = items => items.map(item => ({
  ...item, title: text(item.title, 200), person: PEOPLE.includes(item.person) ? item.person : 'Samen', repeat: text(item.repeat, 30) || 'Wekelijks',
  due: text(item.due, 10), completedDates: Array.isArray(item.completedDates) ? item.completedDates.filter(d => typeof d === 'string') : [], lastDoneDate: text(item.lastDoneDate, 10)
}));
const migrateTrips = items => items.map(trip => ({
  ...trip, title: text(trip.title, 200), startDate: text(trip.startDate, 10), endDate: text(trip.endDate, 10),
  folders: (Array.isArray(trip.folders) ? trip.folders : []).filter(isObject).map(folder => ({
    ...folder, id: typeof folder.id === 'string' ? folder.id : uid(), name: text(folder.name, 100) || 'Algemeen',
    items: (Array.isArray(folder.items) ? folder.items : []).filter(isObject).map(item => ({
      ...item, id: typeof item.id === 'string' ? item.id : uid(), text: text(item.text, 300), done: item.done === true, deadline: text(item.deadline, 10),
      priority: ['laag', 'gemiddeld', 'hoog'].includes(item.priority) ? item.priority : 'gemiddeld', important: item.important === true
    }))
  }))
}));

/** Bestaande eenvoudige reizen worden (eenmalig, op id) naar een reismap met standaardmap gemigreerd. */
function migrateLegacyTravel(out) {
  const done = new Set(out.migrated.travel);
  out.travel.forEach(item => {
    if (done.has(item.id)) return;
    done.add(item.id);
    out.trips.push({ id: `legacy-${item.id}`, title: text(item.title, 200) || 'Reis', startDate: text(item.date, 10), endDate: '', legacy: true, folders: [{ id: uid(), name: 'Algemeen', items: [] }] });
  });
  out.migrated.travel = [...done];
}

/** Het bestaande `car`-object wordt (eenmalig) het eerste voertuig; `car` zelf blijft behouden. */
function migrateLegacyCar(out) {
  if (out.migrated.car) return;
  out.migrated.car = true;
  const fields = ['model', 'plate', 'year', 'mileage', 'apkDate', 'insuranceDate'];
  if (!out.vehicles.length && fields.some(k => out.car[k])) {
    out.vehicles.push({ id: uid(), ...Object.fromEntries(fields.map(k => [k, text(out.car[k], 60)])) });
  }
}

function migrateAnswers(answers) {
  return Object.fromEntries(Object.entries(answers)
    .filter(([, day]) => isObject(day))
    .map(([date, day]) => [date, Object.fromEntries(PEOPLE.flatMap(person => {
      const value = day[person];
      const answer = typeof value === 'string' ? value : isObject(value) && typeof value.answer === 'string' ? value.answer : '';
      return answer ? [[person, { answer: answer.slice(0, 800), answeredAt: isObject(value) && typeof value.answeredAt === 'string' ? value.answeredAt : '' }]] : [];
    }))]));
}

const num = (value, fallback = 0) => (isFiniteNumber(value) && value >= 0 ? value : fallback);

export function mergeState(base, value) {
  const saved = validateState(value);
  const out = { ...base };
  for (const key of COLLECTIONS) {
    if (Array.isArray(saved[key])) out[key] = validItems(saved[key]);
  }
  out.agenda = migrateAgenda(out.agenda);
  out.stock = migrateStock(out.stock);
  out.meals = migrateMeals(out.meals);
  out.groceries = migrateGroceries(out.groceries);
  out.home = migrateHome(out.home);
  out.chores = migrateChores(out.chores);
  out.trips = migrateTrips(out.trips);
  out.calendars = validCalendars(Array.isArray(saved.calendars) ? saved.calendars : base.calendars);
  out.excludedCalendars = validItems(Array.isArray(saved.excludedCalendars) ? saved.excludedCalendars : base.excludedCalendars);
  if (Array.isArray(saved.priceReferences)) out.priceReferences = validItems(saved.priceReferences);

  const defaults = defaultBudget();
  const sb = isObject(saved.budget) ? saved.budget : {};
  out.budget = {
    ...(isObject(saved.budget) ? saved.budget : {}), ...defaults,
    monthly: num(sb.monthly, base.budget.monthly),
    items: Array.isArray(sb.items) ? validItems(sb.items) : base.budget.items,
    incomeKees: num(sb.incomeKees), incomeDaphne: num(sb.incomeDaphne), invest: num(sb.invest),
    contributionPct: isFiniteNumber(sb.contributionPct) && sb.contributionPct >= 0 && sb.contributionPct <= 100 ? sb.contributionPct : defaults.contributionPct,
    fixed: Array.isArray(sb.fixed) ? validItems(sb.fixed) : [],
    houseCategories: Array.isArray(sb.houseCategories) ? validItems(sb.houseCategories) : [],
    goals: Array.isArray(sb.goals) ? validItems(sb.goals) : []
  };
  if (isObject(saved.car)) out.car = { ...base.car, ...saved.car };

  const migrated = isObject(saved.migrated) ? saved.migrated : {};
  out.migrated = { travel: Array.isArray(migrated.travel) ? migrated.travel.filter(id => typeof id === 'string') : [], car: migrated.car === true };
  migrateLegacyTravel(out);
  migrateLegacyCar(out);

  if (isObject(saved.dailyAnswers)) out.dailyAnswers = migrateAnswers(saved.dailyAnswers);
  if (isObject(saved.meta)) out.meta = { updatedAt: typeof saved.meta.updatedAt === 'string' ? saved.meta.updatedAt : '' };
  out.weather = validWeather(saved.weather, base.weather);
  if (['light', 'dark'].includes(saved.theme)) { out.theme = saved.theme; out.themeMode = saved.theme; }
  if (['system', 'light', 'dark'].includes(saved.themeMode)) out.themeMode = saved.themeMode;
  if (['comfortable', 'compact'].includes(saved.density)) out.density = saved.density;
  if (['normal', 'minimal'].includes(saved.appearance)) out.appearance = saved.appearance;
  if (typeof saved.minimalColor === 'string' && /^#[\da-f]{6}$/i.test(saved.minimalColor)) out.minimalColor = saved.minimalColor;
  if (typeof saved.showQuote === 'boolean') out.showQuote = saved.showQuote;
  if (typeof saved.currentPage === 'string' && saved.currentPage.length <= 40) out.currentPage = saved.currentPage;
  out.version = 2;
  out.schema = SCHEMA;
  out.dashboard = normalizeDashboard(saved.dashboard, out.showQuote);
  return Core.preserveUnknownFields(saved, out, value => structuredClone(value));
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (isObject(parsed) && !(parsed.schema >= SCHEMA) && !storage.getItem(SNAPSHOT_KEY)) {
      try { storage.setItem(SNAPSHOT_KEY, raw); } catch { /* snapshot is best effort */ }
    }
    return mergeState(defaultState(), parsed);
  } catch {
    return defaultState();
  }
}

export function persistState(value, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(value));
}
