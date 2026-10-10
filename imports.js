import Core from './core.js';
import { escapeHtml as esc, parseInputDate, startOfWeek, todayKey, toNumber, uid } from './utils.js';
import { getState, save, render, toast } from './store.js';
import { mergeState, defaultState } from './state.js';
import { categorizeProduct, mergeGroceries, parseGroceryText } from './groceries.js';
import { parseCalendarText, importEvents, unknownCalendars, calendarKey } from './calendar.js';
import { parseMealPlan, MEAL_SLOTS } from './meals.js';
import { parseTravelPlan, findDate, findPriority, newItem, newTrip, DEFAULT_FOLDER } from './travel.js';
import { parseFuelMate, mergeFuel, newVehicle } from './auto.js';
import { REPEATS, CHORE_PEOPLE, newChore } from './chores.js';
import { download } from './prices.js';
import { readFileText } from './files.js';
import { openFormDialog } from './dialogs.js';

export const SCHEMAS = {
  agenda: ['calendar', 'date', 'time', 'title', 'person', 'endTime'],
  meals: ['date', 'slot', 'name'],
  groceries: ['name', 'category', 'done'],
  chores: ['title', 'category', 'repeat', 'person', 'due'],
  stock: ['name', 'amount', 'min', 'desired', 'unit'],
  ideas: ['title', 'notes'],
  home: ['title', 'category', 'due', 'repeat', 'notes'],
  trips: ['trip', 'folder', 'text', 'deadline', 'priority', 'important'],
  budget: ['name', 'amount', 'type', 'period'],
  car: [],
  backup: []
};

const ALIASES = {
  calendar: ['agenda', 'kalender'], date: ['datum', 'startdate', 'startdatum'], time: ['tijd', 'starttime', 'begintijd'], title: ['titel', 'taak', 'naam', 'idee'], person: ['persoon', 'wie', 'voor wie'],
  endTime: ['eindtijd', 'endtime'], slot: ['maaltijd', 'mealtype', 'moment'], name: ['naam', 'product', 'title', 'titel', 'maaltijd'], category: ['categorie'], done: ['gedaan', 'afgevinkt', 'gekocht'],
  repeat: ['herhaling', 'frequentie'], due: ['deadline', 'datum', 'nextdate', 'startdate', 'startdatum'], amount: ['aantal', 'hoeveelheid', 'bedrag', 'price', 'prijs'], min: ['minimum', 'minimaal'],
  desired: ['gewenst', 'doel'], unit: ['eenheid'], notes: ['notitie', 'details', 'description', 'omschrijving'], trip: ['reis', 'bestemming'], folder: ['map', 'sectie', 'section'],
  text: ['onderdeel', 'titel', 'title', 'item'], deadline: ['due', 'datum'], priority: ['prioriteit'], important: ['belangrijk'], type: ['soort', 'kind'], period: ['periode']
};
const norm = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();

function headerMap(cells, columns) {
  const map = columns.map(col => cells.findIndex(c => [col, ...(ALIASES[col] || [])].some(a => norm(a) === norm(c))));
  return map.filter(i => i >= 0).length >= 2 ? map : null;
}

const flag = value => ['1', 'ja', 'yes', 'true', 'x', '✓', 'waar'].includes(String(value || '').trim().toLowerCase());

/** Universeel formaat: pipe, puntkomma of tab; optionele kopregel; of JSON-array van objecten. */
export function parseTable(text, columns) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  if (/^[[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      const rows = Array.isArray(parsed) ? parsed : Object.values(parsed).find(Array.isArray) || [];
      return rows.filter(r => r && typeof r === 'object').map(r => Object.fromEntries(columns.map(col => {
        const key = Object.keys(r).find(k => [col, ...(ALIASES[col] || [])].some(a => norm(a) === norm(k)));
        return [col, key ? String(r[key] ?? '') : ''];
      })));
    } catch { /* val terug op regels */ }
  }
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const delimiter = lines.some(l => l.includes('|')) ? '|' : lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes(';')) ? ';' : ',';
  const split = line => line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
  const map = headerMap(split(lines[0]), columns);
  const rows = map ? lines.slice(1) : lines;
  return rows.map(line => {
    const cells = split(line);
    return Object.fromEntries(columns.map((col, i) => [col, String(cells[map ? map[i] : i] ?? '').trim()]));
  });
}

const validRepeat = value => REPEATS.find(r => norm(r) === norm(value)) || 'Wekelijks';

/** Tekst → records voor de preview. Elk record heeft `label` (bewerkbaar) en per doel de benodigde velden. */
export function buildRecords(target, text, { weekStart = startOfWeek(todayKey()) } = {}) {
  const T = String(text || '');
  switch (target) {
    case 'agenda': {
      const rows = parseCalendarText(T);
      return rows.length ? rows : parseTable(T, SCHEMAS.agenda).filter(r => parseInputDate(r.date) && r.title).map(r => ({ ...r, calendar: r.calendar || 'Persoonlijk', date: parseInputDate(r.date) }));
    }
    case 'meals': {
      const plan = parseMealPlan(T, weekStart);
      const meals = plan.meals.length ? plan.meals : parseTable(T, SCHEMAS.meals).filter(r => r.name).map(r => ({ date: parseInputDate(r.date), slot: MEAL_SLOTS.find(s => norm(s) === norm(r.slot)) || 'Avondeten', name: r.name }));
      return [...meals.map(m => ({ ...m, kind: 'meal' })), ...plan.groceries.map(g => ({ ...g, kind: 'grocery' }))];
    }
    case 'groceries':
      return /[|;\t]/.test(T) ? parseTable(T, SCHEMAS.groceries).filter(r => r.name).map(r => ({ name: r.name.replace(/^[✓✔]\s*/, ''), category: r.category || categorizeProduct(r.name), done: flag(r.done) || /^[✓✔]/.test(r.name) })) : parseGroceryText(T);
    case 'chores': return parseTable(T, SCHEMAS.chores).filter(r => r.title).map(r => ({ ...r, repeat: validRepeat(r.repeat), person: CHORE_PEOPLE.find(p => norm(p) === norm(r.person)) || 'Samen', due: parseInputDate(r.due) || todayKey() }));
    case 'stock': return parseTable(T, SCHEMAS.stock).filter(r => r.name).map(r => ({ ...r, amount: toNumber(r.amount), min: toNumber(r.min), desired: toNumber(r.desired) }));
    case 'ideas': return parseTable(T, SCHEMAS.ideas).filter(r => r.title);
    case 'home': return parseTable(T, SCHEMAS.home).filter(r => r.title).map(r => ({ ...r, due: parseInputDate(r.due) }));
    case 'trips': {
      if (/^\s*(reis|bestemming)\s*:/im.test(T) || !/[|;\t]/.test(T)) {
        const plan = parseTravelPlan(T);
        return plan.folders.flatMap(f => f.items.map(i => ({ trip: plan.title, folder: f.name, text: i.text, deadline: i.deadline, priority: i.priority, important: i.important, done: i.done, startDate: plan.startDate, endDate: plan.endDate })));
      }
      return parseTable(T, SCHEMAS.trips).filter(r => r.text).map(r => ({ ...r, trip: r.trip || 'Nieuwe reis', folder: r.folder || DEFAULT_FOLDER, deadline: parseInputDate(r.deadline) || findDate(r.deadline), priority: findPriority(r.priority), important: flag(r.important) }));
    }
    case 'budget': return parseTable(T, SCHEMAS.budget).filter(r => r.name).map(r => ({ ...r, amount: toNumber(r.amount), fixed: /vast|fixed/i.test(r.type), period: ['kwartaal', 'jaar'].find(p => norm(r.period).startsWith(p.slice(0, 4))) || 'maand' }));
    case 'car': return parseFuelMate(T, '');
    case 'backup': {
      const raw = JSON.parse(T);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Ongeldige back-up');
      return [{ backup: raw }];
    }
    default: return [];
  }
}

export const primaryField = { agenda: 'title', meals: 'name', groceries: 'name', chores: 'title', stock: 'name', ideas: 'title', home: 'title', trips: 'text', budget: 'name' };
export const recordLabel = (target, r) => (target === 'backup' ? 'Volledige back-up' : target === 'car' ? `${r.date} · ${r.liters} L · ${r.total}` : r[primaryField[target]] || '');

const sig = (...parts) => parts.map(p => String(p ?? '').toLowerCase().trim()).join('|');
const BACKUP_LISTS = ['tasks', 'agenda', 'challenges', 'programs', 'meals', 'groceries', 'deals', 'stock', 'home', 'dates', 'travel', 'extras', 'chores', 'trips', 'vehicles', 'fuelEntries', 'priceReferences', 'calendars'];

/** Veilige back-up samenvoegen: bestaande data wordt nooit overschreven. */
export function mergeBackup(state, raw) {
  const incoming = mergeState(defaultState(), raw);
  let added = 0;
  BACKUP_LISTS.forEach(key => {
    const before = state[key].length;
    const ids = new Set(state[key].map(item => item.id));
    state[key] = Core.mergeUnique(state[key], incoming[key].filter(item => !ids.has(item.id)), item => Core.stableStringify({ ...item, id: '' }));
    added += state[key].length - before;
  });
  ['dailyAnswers'].forEach(key => { state[key] = { ...incoming[key], ...state[key] }; });
  state.budget = { ...incoming.budget, ...state.budget };
  ['fixed', 'houseCategories', 'goals', 'items'].forEach(k => { state.budget[k] = Core.mergeUnique(state.budget[k], incoming.budget[k], x => sig(x.name, x.amount)); });
  return { added };
}

/** Voegt geselecteerde records veilig toe (dubbelen worden overgeslagen). */
export function applyRecords(state, target, records, extra = {}) {
  let added = 0, duplicates = 0;
  const addUnique = (list, item, signature) => {
    if (list.some(x => signature(x) === signature(item))) { duplicates += 1; return false; }
    list.unshift(item); added += 1; return true;
  };
  switch (target) {
    case 'agenda': ({ added, duplicates } = importEvents(state, records, extra.choices)); break;
    case 'meals':
      records.filter(r => r.kind !== 'grocery').forEach(r => addUnique(state.meals, { id: uid(), name: r.name, date: r.date || '', slot: r.slot || 'Avondeten' }, x => sig(x.date, x.slot, x.name)));
      { const g = mergeGroceries(state.groceries, records.filter(r => r.kind === 'grocery'), uid); state.groceries = g.list; added += g.added; }
      break;
    case 'groceries': { const g = mergeGroceries(state.groceries, records, uid); state.groceries = g.list; added = g.added; duplicates = records.length - g.added; break; }
    case 'chores': records.forEach(r => addUnique(state.chores, newChore(r), x => sig(x.title, x.repeat))); break;
    case 'stock': records.forEach(r => addUnique(state.stock, { id: uid(), name: r.name, amount: r.amount, min: r.min, desired: r.desired, unit: r.unit || '', quantity: '' }, x => sig(x.name))); break;
    case 'ideas': records.forEach(r => addUnique(state.dates, { id: uid(), title: r.title, notes: r.notes || '' }, x => sig(x.title))); break;
    case 'home': records.forEach(r => addUnique(state.home, { id: uid(), title: r.title, notes: r.notes || '', category: r.category || 'Klus', due: r.due || '', repeat: r.repeat || '', done: false }, x => sig(x.title))); break;
    case 'trips':
      records.forEach(r => {
        let trip = state.trips.find(t => sig(t.title) === sig(r.trip));
        if (!trip) { trip = newTrip(r.trip, { startDate: r.startDate || '', endDate: r.endDate || '', folders: [] }); state.trips.unshift(trip); }
        let folder = trip.folders.find(f => sig(f.name) === sig(r.folder));
        if (!folder) trip.folders.push(folder = { id: uid(), name: r.folder || DEFAULT_FOLDER, items: [] });
        addUnique(folder.items, newItem(r.text, { deadline: r.deadline || '', priority: r.priority || 'gemiddeld', important: Boolean(r.important), done: Boolean(r.done) }), x => sig(x.text));
      });
      break;
    case 'budget':
      records.forEach(r => {
        const item = { id: uid(), name: r.name, amount: r.amount };
        if (r.fixed) addUnique(state.budget.fixed, { ...item, period: r.period }, x => sig(x.name));
        else addUnique(state.budget.items, item, x => sig(x.name, x.amount));
      });
      break;
    case 'car': {
      if (!state.vehicles.length) state.vehicles.push(newVehicle({ model: 'Geïmporteerde auto' }));
      const carId = extra.carId || state.vehicles[0].id;
      const merged = mergeFuel(state.fuelEntries, records.map(r => ({ ...r, carId })));
      added = merged.length - state.fuelEntries.length; duplicates = records.length - added; state.fuelEntries = merged; break;
    }
    case 'backup': ({ added } = mergeBackup(state, records[0].backup)); break;
    default: break;
  }
  return { added, duplicates };
}

export const TARGET_INFO = {
  agenda: { label: 'Agenda', formats: 'TXT · JSON · Apple Agenda-tekst', example: 'Persoonlijk | 2026-10-12 | 09:00 | Tandarts | Kees | 09:45\nCoach O23 | 2026-10-14 | 19:00 | Training | Kees | 20:30', help: 'calendar | datum | tijd | titel | persoon | eindtijd' },
  meals: { label: 'Weekmenu', formats: 'TXT · Osta · CSV', example: 'Maandag: Pasta pesto\nDinsdag Lunch: Soep\nWoensdag: Wraps\n\nGrocery list\nPasta\nPesto\nTortilla', help: '"Maandag: Pasta" of datum | moment | maaltijd; sectie "Grocery list" wordt boodschappen' },
  groceries: { label: 'Boodschappen', formats: 'TXT · JSON · CSV', example: 'Melk\n✓ Brood\nBananen\nafwasmiddel', help: 'Eén product per regel; ✓ = afgevinkt. Of: product | categorie | gedaan' },
  chores: { label: 'Huishouden', formats: 'CSV · TXT · JSON · XLSX', example: 'title | category | repeat | person | due\nBadkamer schoonmaken | Badkamer | Wekelijks | Samen | 2026-10-12', help: 'titel | categorie | herhaling | persoon | datum' },
  stock: { label: 'Voorraad', formats: 'CSV · TXT · JSON · XLSX', example: 'name | amount | min | desired | unit\nRijst | 2 | 1 | 4 | pak', help: 'naam | aantal | minimum | gewenst | eenheid' },
  ideas: { label: 'Ideeën', formats: 'CSV · TXT · JSON', example: 'title | notes\nPicknick bij het meer | Mand meenemen', help: 'titel | notitie' },
  home: { label: 'Woning', formats: 'CSV · TXT · JSON', example: 'title | category | due | repeat | notes\nRookmelder testen | Onderhoud | 2026-11-01 | Jaarlijks | Batterij controleren', help: 'titel | categorie (Onderhoud/Klus/Garantie/Woninginfo/Handleiding) | datum | herhaling | notitie' },
  trips: { label: 'Reizen', formats: 'TXT · PDF · DOCX · XLSX · CSV', example: 'Reis: Rome\nStartdatum: 2026-10-01\nEinddatum: 2026-10-05\nVervoer:\n- Vlucht boeken | 2026-08-01 | hoog\nVerblijf:\n- Hotel reserveren | belangrijk', help: 'Gestructureerd ("Reis:", "Startdatum:", koppen) of reis | map | onderdeel | deadline | prioriteit | belangrijk' },
  budget: { label: 'Budget', formats: 'CSV · TXT · JSON · XLSX', example: 'name | amount | type | period\nBoodschappen | 45.50 | uitgave |\nHuur | 950 | vast | maand', help: 'naam | bedrag | uitgave of vast | periode' },
  car: { label: 'Auto / FuelMate', formats: 'JSON · CSV', example: 'date,odometer,liters,total,station\n2026-10-01,12000,40.5,78.20,Shell', help: 'FuelMate-export (JSON of CSV) met datum, kilometerstand, liters en totaal' },
  backup: { label: 'Volledige back-up', formats: 'JSON', example: '{ "tasks": [], "groceries": [] }', help: 'JSON-back-up wordt veilig samengevoegd (niets wordt overschreven)' }
};

const ui = { target: 'agenda', text: '', fileName: '', preview: null };

export function renderImports() {
  const info = TARGET_INFO[ui.target];
  const preview = ui.preview ? `<div class="import-preview"><h3>Controle (${ui.preview.length})</h3>${ui.preview.length ? `<ul class="data-list">${ui.preview.map((row, i) => `<li class="list-card"><input class="task-check" type="checkbox" data-act-change="imports:select" data-i="${i}" ${row.selected ? 'checked' : ''} aria-label="Selecteren">${ui.target === 'car' || ui.target === 'backup' ? `<div><strong>${esc(row.label)}</strong></div>` : `<input class="preview-edit" value="${esc(row.label)}" data-act-change="imports:edit" data-i="${i}" aria-label="Bewerken">`}</li>`).join('')}</ul><div class="button-row"><button type="button" class="button button-primary" data-act="imports:apply">Geselecteerde toevoegen (${ui.preview.filter(r => r.selected).length})</button></div>` : '<p class="muted">Niets herkend. Controleer het formaat.</p>'}</div>` : '';
  return `<div class="page-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Stap 1</p><h2>Wat wil je importeren?</h2></div></div>
    <div class="chip-row">${Object.entries(TARGET_INFO).map(([k, v]) => `<button type="button" class="chip ${k === ui.target ? 'is-active' : ''}" data-act="imports:target" data-target="${k}" aria-pressed="${k === ui.target}">${esc(v.label)}</button>`).join('')}</div>
    <p class="small-note">Formaten: ${esc(info.formats)}. ${esc(info.help)}</p>
    <div class="button-row"><button type="button" class="button button-secondary button-small" data-act="imports:example">Voorbeeldbestand downloaden</button></div></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Stap 2</p><h2>Bestand of tekst</h2></div></div>
    <div class="field"><label>Bestand kiezen<input id="importFile" type="file" accept=".txt,.csv,.json,.xlsx,.xls,.pdf,.docx" data-act-change="imports:file"></label></div>
    ${ui.fileName ? `<p class="small-note">Gelezen: ${esc(ui.fileName)}</p>` : ''}
    <div class="field"><label>Of plak tekst<textarea id="importText" rows="8" placeholder="${esc(info.example)}">${esc(ui.text)}</textarea></label></div>
    <div class="inline-form"><input id="importLine" placeholder="Handmatig: één regel in dit formaat" aria-label="Handmatige regel"><button type="button" class="button button-secondary" data-act="imports:line">Regel toevoegen</button></div>
    <div class="button-row"><button type="button" class="button button-primary" data-act="imports:preview">Controleren</button></div>${preview}</section></div>`;
}

function runPreview() {
  const textarea = document.querySelector('#importText');
  if (textarea) ui.text = textarea.value;
  try {
    ui.preview = buildRecords(ui.target, ui.text).map(rec => ({ rec, label: recordLabel(ui.target, rec), selected: true }));
  } catch (error) { ui.preview = null; toast(`Importeren mislukt: ${error.message}`); }
  render();
}

function finishApply(rows, choices) {
  const records = rows.map(r => ({ ...r.rec, ...(primaryField[ui.target] ? { [primaryField[ui.target]]: r.label } : {}) }));
  const { added, duplicates } = applyRecords(getState(), ui.target, records, { choices });
  save(`${added} toegevoegd${duplicates ? `, ${duplicates} dubbel overgeslagen` : ''}`);
  ui.preview = null; ui.text = ''; ui.fileName = '';
  render();
}

export const actions = {
  'imports:target'(el) { ui.target = el.dataset.target; ui.preview = null; ui.text = ''; ui.fileName = ''; render(); },
  'imports:example'() { download(`voorbeeld-${ui.target}.${ui.target === 'backup' ? 'json' : 'txt'}`, TARGET_INFO[ui.target].example, 'text/plain'); },
  'imports:preview': runPreview,
  'imports:line'() {
    const line = document.querySelector('#importLine'), area = document.querySelector('#importText');
    if (!line?.value.trim() || !area) return;
    area.value = `${area.value.trim()}${area.value.trim() ? '\n' : ''}${line.value.trim()}`;
    ui.text = area.value; line.value = '';
  },
  async 'imports:file'(el) {
    const file = el.files?.[0];
    if (!file) return;
    try { ui.text = await readFileText(file); ui.fileName = file.name; runPreview(); }
    catch (error) { toast(error.message || 'Bestand kon niet worden gelezen'); }
  },
  'imports:select'(el) { const row = ui.preview?.[Number(el.dataset.i)]; if (row) { row.selected = el.checked; render(); } },
  'imports:edit'(el) { const row = ui.preview?.[Number(el.dataset.i)]; if (row) row.label = el.value; },
  'imports:apply'() {
    const rows = (ui.preview || []).filter(r => r.selected && (ui.target === 'car' || ui.target === 'backup' || r.label.trim()));
    if (!rows.length) return toast('Niets geselecteerd');
    if (ui.target === 'backup' && typeof globalThis.confirm === 'function' && !globalThis.confirm('Back-up samenvoegen met je huidige gegevens? Bestaande gegevens blijven behouden.')) return;
    if (ui.target === 'agenda') {
      const unknown = unknownCalendars(getState(), rows.map(r => ({ ...r.rec, title: r.label })));
      if (unknown.length) {
        openFormDialog({
          title: 'Van wie zijn deze agenda\'s?', intro: 'Kies per onbekende agenda een persoon.', submit: 'Importeren',
          fields: unknown.map(([key, name]) => ({ name: key, label: name, type: 'select', options: ['Samen', 'Kees', 'Daphne'] })),
          onSubmit: values => { finishApply(rows, new Map(unknown.map(([key]) => [calendarKey(key), values[key]]))); return true; }
        });
        return;
      }
    }
    finishApply(rows);
  }
};
