import { escapeHtml as esc, fmtDate, parseInputDate, todayKey, daysBetween, uid } from './utils.js';
import { getState, save, render, toast } from './store.js';
import { openFormDialog } from './dialogs.js';

export const PRIORITIES = ['laag', 'gemiddeld', 'hoog'];
export const DEFAULT_FOLDER = 'Algemeen';

const SECTION_RULES = [
  ['Vervoer', /vervoer|vlucht|vluchten|trein|auto|huurauto|transfer|reis(?:dag|schema)/i],
  ['Verblijf', /verblijf|hotel|accommodatie|overnachting|airbnb|slapen/i],
  ['Activiteiten', /activiteit|programma|bezienswaard|excursie|tour|museum|uitstap/i],
  ['Eten & drinken', /restaurant|eten|diner|ontbijt|lunch|reserveren/i],
  ['Documenten', /document|paspoort|visum|verzekering|tickets?|boekingen/i],
  ['Inpakken', /inpak|paklijst|meenemen|koffer/i],
  ['Financiën', /budget|kosten|financi|geld|valuta/i]
];
export const recognizeSection = line => SECTION_RULES.find(([, re]) => re.test(line))?.[0] || '';

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const pad = n => String(n).padStart(2, '0');

/** Herkent 2026-10-01, 1-10-2026 en "1 oktober 2026" in vrije tekst. */
export function findDate(text) {
  const s = String(text || '');
  let m = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (m) return m[1];
  m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (m) return parseInputDate(m[0]);
  m = s.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})\\b`, 'i'));
  if (m) return `${m[3]}-${pad(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${pad(m[1])}`;
  return '';
}

export function findPriority(text) {
  if (/\b(hoog|urgent|dringend)\b|!{2,}/i.test(text)) return 'hoog';
  if (/\blaag\b/i.test(text)) return 'laag';
  return 'gemiddeld';
}

export const newTrip = (title, extra = {}) => ({ id: uid(), title, startDate: '', endDate: '', folders: [{ id: uid(), name: DEFAULT_FOLDER, items: [] }], ...extra });
export const newItem = (text, extra = {}) => ({ id: uid(), text, done: false, deadline: '', priority: 'gemiddeld', important: false, ...extra });

/**
 * Reisplan-tekst → {title, startDate, endDate, folders}. Ondersteunt gestructureerde velden
 * ("Reis:", "Startdatum:", "Einddatum:", "Map:"/"Sectie:") én vrije tekst met herkende koppen.
 */
export function parseTravelPlan(text) {
  const plan = { title: '', startDate: '', endDate: '', folders: [] };
  let folder = null;
  const folderFor = name => {
    folder = plan.folders.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (!folder) plan.folders.push(folder = { id: uid(), name, items: [] });
    return folder;
  };
  String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
    const field = line.match(/^(reis|bestemming|startdatum|vertrek|einddatum|terugreis|map|sectie)\s*[:：]\s*(.*)$/i);
    if (field) {
      const key = field[1].toLowerCase(), value = field[2].trim();
      if (key === 'reis' || key === 'bestemming') plan.title = value;
      else if (key === 'startdatum' || key === 'vertrek') plan.startDate = findDate(value);
      else if (key === 'einddatum' || key === 'terugreis') plan.endDate = findDate(value);
      else folderFor(value || DEFAULT_FOLDER);
      return;
    }
    const isBullet = /^([-•*✓✔☐□]|\d+[.)])\s+/.test(line);
    const section = !isBullet && line.length < 60 && !findDate(line) ? recognizeSection(line) : '';
    if (section || (!isBullet && /:$/.test(line) && line.length < 60)) { folderFor(section || line.replace(/:$/, '')); return; }
    const parts = line.replace(/^([-•*✓✔☐□]|\d+[.)])\s+/, '').split(/\s*\|\s*/);
    const itemText = parts[0].trim();
    if (!itemText) return;
    const rest = parts.slice(1).join(' ');
    (folder || folderFor(recognizeSection(itemText) || DEFAULT_FOLDER)).items.push(newItem(itemText, {
      deadline: findDate(rest) || findDate(itemText), priority: findPriority(rest || itemText),
      important: /belangrijk|!|\bhoog\b/i.test(line), done: /^[✓✔]/.test(line)
    }));
  });
  plan.folders = plan.folders.filter(f => f.items.length);
  if (!plan.title) plan.title = 'Nieuwe reis';
  return plan;
}

export function addPlanAsTrip(state, plan) {
  const existing = state.trips.find(t => t.title.toLowerCase() === plan.title.toLowerCase());
  const trip = existing || newTrip(plan.title, { startDate: plan.startDate, endDate: plan.endDate, folders: [] });
  if (!existing) state.trips.unshift(trip);
  let added = 0;
  plan.folders.forEach(f => {
    let folder = trip.folders.find(x => x.name.toLowerCase() === f.name.toLowerCase());
    if (!folder) trip.folders.push(folder = { id: uid(), name: f.name, items: [] });
    f.items.forEach(item => {
      if (!folder.items.some(x => x.text.toLowerCase() === item.text.toLowerCase())) { folder.items.push(item); added += 1; }
    });
  });
  return { trip, added };
}

const PRIO_RANK = { hoog: 0, gemiddeld: 1, laag: 2 };

/** Belangrijkste open reisacties over alle reizen. */
export function topTravelActions(trips, limit = 5, today = todayKey()) {
  const all = [];
  trips.forEach(trip => (trip.folders || []).forEach(folder => (folder.items || []).forEach(item => {
    if (!item.done) all.push({ trip, folder, item });
  })));
  const score = ({ item }) => [item.important ? 0 : 1, PRIO_RANK[item.priority] ?? 1, item.deadline || '9999'];
  return all.sort((a, b) => {
    const sa = score(a), sb = score(b);
    return sa[0] - sb[0] || sa[1] - sb[1] || sa[2].localeCompare(sb[2]);
  }).slice(0, limit).map(entry => ({ ...entry, overdue: Boolean(entry.item.deadline && entry.item.deadline < today) }));
}

export function nextTrip(trips, today = todayKey()) {
  const upcoming = trips.filter(t => t.startDate && t.startDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return upcoming ? { trip: upcoming, days: daysBetween(today, upcoming.startDate) } : null;
}

export function tripProgress(trip) {
  const items = (trip.folders || []).flatMap(f => f.items || []);
  return { done: items.filter(i => i.done).length, total: items.length };
}

const itemRow = (trip, folder, item) => `<li class="list-card task-row ${item.done ? 'is-done' : ''}"><input class="task-check" type="checkbox" data-act-change="travel:toggle" data-trip="${esc(trip.id)}" data-folder="${esc(folder.id)}" data-id="${esc(item.id)}" ${item.done ? 'checked' : ''} aria-label="Afronden"><div><strong>${item.important ? '★ ' : ''}${esc(item.text)}</strong><small>${esc([item.priority, item.deadline ? `deadline ${fmtDate(item.deadline)}` : ''].filter(Boolean).join(' · '))}</small></div><button type="button" class="icon-button" data-act="travel:edit-item" data-trip="${esc(trip.id)}" data-folder="${esc(folder.id)}" data-id="${esc(item.id)}" aria-label="Bewerken">✎</button><button type="button" class="icon-button task-delete" data-act="travel:delete-item" data-trip="${esc(trip.id)}" data-folder="${esc(folder.id)}" data-id="${esc(item.id)}" aria-label="Verwijderen">×</button></li>`;

export function renderTravel(state = getState()) {
  const trips = state.trips.map(trip => {
    const { done, total } = tripProgress(trip);
    return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">${esc([trip.startDate && fmtDate(trip.startDate), trip.endDate && fmtDate(trip.endDate)].filter(Boolean).join(' – ') || 'Geen datum')} · ${done}/${total}</p><h2>${esc(trip.title)}</h2></div><div><button type="button" class="icon-button" data-act="travel:edit-trip" data-trip="${esc(trip.id)}" aria-label="Reis bewerken">✎</button><button type="button" class="icon-button task-delete" data-act="travel:delete-trip" data-trip="${esc(trip.id)}" aria-label="Reis verwijderen">×</button></div></div>
      ${trip.folders.map(folder => `<h3>${esc(folder.name)}</h3><ul class="data-list">${folder.items.map(i => itemRow(trip, folder, i)).join('') || '<li class="empty-row">Nog geen onderdelen.</li>'}</ul><div class="button-row"><button type="button" class="button button-secondary button-small" data-act="travel:add-item" data-trip="${esc(trip.id)}" data-folder="${esc(folder.id)}">＋ Onderdeel</button><button type="button" class="button button-secondary button-small" data-act="travel:edit-folder" data-trip="${esc(trip.id)}" data-folder="${esc(folder.id)}">Map bewerken</button></div>`).join('')}
      <div class="button-row"><button type="button" class="button button-secondary" data-act="travel:add-folder" data-trip="${esc(trip.id)}">＋ Map toevoegen</button></div></section>`;
  }).join('');
  return `<div class="page-grid">${trips || '<section class="panel"><p class="muted">Nog geen reizen. Gebruik ＋ Toevoegen of importeer een reisplan.</p></section>'}</div>`;
}

const find = (el) => {
  const trip = getState().trips.find(t => t.id === el.dataset.trip);
  const folder = trip?.folders.find(f => f.id === el.dataset.folder);
  const item = folder?.items.find(i => i.id === el.dataset.id);
  return { trip, folder, item };
};
const ITEM_FIELDS = [{ name: 'text', label: 'Onderdeel', required: true }, { name: 'deadline', label: 'Deadline', type: 'date' }, { name: 'priority', label: 'Prioriteit', type: 'select', options: PRIORITIES }, { name: 'important', label: 'Belangrijk', type: 'checkbox' }];

export const actions = {
  'travel:toggle'(el) { const { item } = find(el); if (item) { item.done = el.checked; save(); render(); } },
  'travel:delete-item'(el) { const { folder, item } = find(el); if (item) { folder.items = folder.items.filter(i => i !== item); save('Verwijderd'); render(); } },
  'travel:add-item'(el) {
    const { folder } = find(el);
    if (folder) openFormDialog({ title: 'Onderdeel toevoegen', fields: ITEM_FIELDS, values: { priority: 'gemiddeld' }, submit: 'Toevoegen', onSubmit: v => { if (!v.text) return false; folder.items.push(newItem(v.text, { deadline: v.deadline, priority: v.priority, important: v.important })); save('Toegevoegd'); render(); return true; } });
  },
  'travel:edit-item'(el) {
    const { item } = find(el);
    if (item) openFormDialog({ title: 'Onderdeel bewerken', fields: ITEM_FIELDS, values: item, onSubmit: v => { if (!v.text) return false; Object.assign(item, { text: v.text, deadline: v.deadline, priority: v.priority, important: v.important }); save('Opgeslagen'); render(); return true; } });
  },
  'travel:add-folder'(el) {
    const trip = getState().trips.find(t => t.id === el.dataset.trip);
    if (trip) openFormDialog({ title: 'Map toevoegen', fields: [{ name: 'name', label: 'Naam', required: true }], submit: 'Toevoegen', onSubmit: v => { if (!v.name) return false; trip.folders.push({ id: uid(), name: v.name, items: [] }); save('Toegevoegd'); render(); return true; } });
  },
  'travel:edit-folder'(el) {
    const { folder } = find(el);
    if (folder) openFormDialog({ title: 'Map bewerken', fields: [{ name: 'name', label: 'Naam', required: true }], values: folder, onSubmit: v => { if (!v.name) return false; folder.name = v.name; save('Opgeslagen'); render(); return true; } });
  },
  'travel:edit-trip'(el) {
    const trip = getState().trips.find(t => t.id === el.dataset.trip);
    if (trip) openFormDialog({ title: 'Reis bewerken', fields: [{ name: 'title', label: 'Bestemming', required: true }, { name: 'startDate', label: 'Start', type: 'date' }, { name: 'endDate', label: 'Einde', type: 'date' }], values: trip, onSubmit: v => { if (!v.title) return false; Object.assign(trip, { title: v.title, startDate: v.startDate, endDate: v.endDate }); save('Opgeslagen'); render(); return true; } });
  },
  'travel:delete-trip'(el) {
    const state = getState();
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm('Deze reis en alle onderdelen verwijderen?')) return;
    state.trips = state.trips.filter(t => t.id !== el.dataset.trip); save('Verwijderd'); render(); toast('Reis verwijderd');
  }
};
