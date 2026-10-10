import Core from './core.js';
import { escapeHtml as esc, fmtDate, todayKey, uid } from './utils.js';
import { renderCollection } from './rendering.js';
import { getState, save, render, toast } from './store.js';
import { openFormDialog } from './dialogs.js';
import { GROCERY_CATEGORIES, categorizeProduct, groupGroceries, mergeGroceries, parseGroceryText } from './groceries.js';
import { priceBadge } from './prices.js';
import { MEAL_SLOTS } from './meals.js';
import { REPEATS, CHORE_PEOPLE, newChore } from './chores.js';
import { newTrip } from './travel.js';
import { readFileText } from './files.js';

export const PEOPLE = ['Kees', 'Daphne', 'Samen'];
export const HOME_CATEGORIES = ['Onderhoud', 'Klus', 'Garantie', 'Woninginfo', 'Handleiding'];
const person = { name: 'person', label: 'Voor wie', type: 'select', options: PEOPLE };
const notes = { name: 'notes', label: 'Details' };

export const SECTIONS = {
  tasks: { label: 'Taak', empty: 'Nog geen taken.', fields: [{ name: 'text', label: 'Taak', required: true }, person, { name: 'category', label: 'Categorie', value: 'Huishouden' }, { name: 'due', label: 'Deadline', type: 'date' }], title: i => i.text, meta: i => [i.person, i.category, i.due].filter(Boolean).join(' · '), check: true },
  agenda: { label: 'Afspraak', empty: 'Geen afspraken.', fields: () => [{ name: 'title', label: 'Titel', required: true }, { name: 'date', label: 'Datum', type: 'date' }, { name: 'time', label: 'Begintijd', type: 'time' }, { name: 'endTime', label: 'Eindtijd', type: 'time' }, person, { name: 'calendarId', label: 'Agenda', type: 'select', options: getState().calendars.map(c => [c.id, c.name]) }], title: i => i.title, meta: i => [i.date, i.time, i.person].filter(Boolean).join(' · ') },
  challenges: { label: 'Challenge', empty: 'Geen challenges.', fields: [{ name: 'title', label: 'Titel', required: true }, { name: 'category', label: 'Categorie' }], title: i => i.title, meta: i => i.category || '', check: true },
  programs: { label: 'Programma', empty: 'Geen programma’s.', fields: [{ name: 'title', label: 'Titel', required: true }, { name: 'notes', label: 'Notities' }], title: i => i.title, meta: i => i.notes || '' },
  mealplan: { key: 'meals', label: 'Maaltijd', empty: 'Plan je week.', fields: [{ name: 'name', label: 'Maaltijd', required: true }, { name: 'date', label: 'Datum', type: 'date' }, { name: 'slot', label: 'Moment', type: 'select', options: MEAL_SLOTS }], title: i => i.name, meta: i => [i.date, i.slot].filter(Boolean).join(' · ') },
  groceries: { label: 'Product', empty: 'Boodschappenlijst is leeg.', fields: [{ name: 'name', label: 'Product', required: true }, { name: 'quantity', label: 'Aantal' }, { name: 'category', label: 'Categorie', type: 'select', options: GROCERY_CATEGORIES }, { name: 'price', label: 'Prijs (optioneel)', type: 'number', step: '0.01' }], title: i => i.name, meta: i => [i.quantity, i.category].filter(Boolean).join(' · '), check: true },
  deals: { label: 'Aanbieding', empty: 'Geen aanbiedingen.', fields: [{ name: 'title', label: 'Aanbieding', required: true }, { name: 'store', label: 'Winkel' }], title: i => i.title, meta: i => i.store || '' },
  stock: { label: 'Voorraad', empty: 'Geen voorraad.', fields: [{ name: 'name', label: 'Product', required: true }, { name: 'amount', label: 'Aantal', type: 'number', step: '0.01' }, { name: 'min', label: 'Minimum', type: 'number', step: '0.01' }, { name: 'desired', label: 'Gewenst', type: 'number', step: '0.01' }, { name: 'unit', label: 'Eenheid' }], title: i => i.name, meta: i => `${i.amount ?? ''} ${i.unit || ''}` },
  home: { label: 'Woning', empty: 'Niets genoteerd.', fields: [{ name: 'title', label: 'Klus of notitie', required: true }, { name: 'category', label: 'Categorie', type: 'select', options: HOME_CATEGORIES }, { name: 'due', label: 'Datum', type: 'date' }, { name: 'repeat', label: 'Herhaling', type: 'select', options: ['', ...REPEATS.filter(r => r !== 'Eenmalig')] }, notes], title: i => i.title, meta: i => [i.category, i.due && fmtDate(i.due), i.repeat, i.notes].filter(Boolean).join(' · '), check: true },
  dates: { label: 'Date idee', empty: 'Nog geen ideeën.', fields: [{ name: 'title', label: 'Idee', required: true }, notes], title: i => i.title, meta: i => i.notes || '' },
  travel: { key: 'trips', label: 'Reis', empty: 'Nog geen reizen.', fields: [{ name: 'title', label: 'Bestemming', required: true }, { name: 'startDate', label: 'Startdatum', type: 'date' }, { name: 'endDate', label: 'Einddatum', type: 'date' }], title: i => i.title, meta: i => i.startDate || '' },
  extras: { label: 'Extra', empty: 'Niets toegevoegd.', fields: [{ name: 'title', label: 'Titel', required: true }, notes], title: i => i.title, meta: i => i.notes || '' },
  chores: { label: 'Huishoudtaak', empty: 'Nog geen huishoudtaken.', fields: [{ name: 'title', label: 'Taak', required: true }, { name: 'person', label: 'Voor wie', type: 'select', options: CHORE_PEOPLE }, { name: 'repeat', label: 'Herhaling', type: 'select', options: REPEATS }, { name: 'due', label: 'Eerste keer', type: 'date' }, { name: 'category', label: 'Categorie' }, notes], title: i => i.title, meta: i => `${i.repeat} · ${i.person}` }
};

export const keyOf = page => SECTIONS[page].key || page;
export const listOf = (page, st = getState()) => st[keyOf(page)];
const fieldsOf = page => (typeof SECTIONS[page].fields === 'function' ? SECTIONS[page].fields() : SECTIONS[page].fields);

export function itemMarkup(page, item, state = getState()) {
  const s = SECTIONS[page];
  const check = s.check ? `<input class="task-check" type="checkbox" data-toggle="${page}" data-id="${esc(item.id)}" ${item.done ? 'checked' : ''} aria-label="Afronden">` : '';
  const badge = page === 'groceries' || page === 'stock' ? priceBadge(state.priceReferences, item) : '';
  return `<li class="list-card task-row ${item.done ? 'is-done' : ''}">${check}<div><strong>${esc(s.title(item))}</strong><small>${esc(s.meta(item))}</small></div>${badge}<button type="button" class="icon-button" data-act="edit" data-page="${page}" data-id="${esc(item.id)}" aria-label="Bewerken">✎</button><button type="button" class="icon-button task-delete" data-delete="${page}" data-id="${esc(item.id)}" aria-label="Verwijderen">×</button></li>`;
}

export function listMarkup(page, items = listOf(page)) {
  return `<ul class="data-list task-list">${renderCollection(items, i => itemMarkup(page, i), esc(SECTIONS[page].empty))}</ul>`;
}

export const quickTaskForm = '<form class="inline-form" data-form="task:quick"><input name="text" placeholder="Nieuwe taak…" required maxlength="120" aria-label="Nieuwe taak"><button class="button button-primary">Toevoegen</button></form>';

export function renderSection(page, pages) {
  const items = listOf(page);
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">${items.length} items</p><h2>${esc(pages[page])}</h2></div></div>${page === 'tasks' ? quickTaskForm : ''}${listMarkup(page, items)}</section>`;
}

export function renderGroceries(state = getState()) {
  const open = state.groceries.filter(i => !i.done).length;
  const groups = groupGroceries(state.groceries).map(g => `<h3>${esc(g.category)}</h3><ul class="data-list task-list">${g.items.map(i => itemMarkup('groceries', i, state)).join('')}</ul>`).join('');
  return `<div class="page-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">${open} nog te halen</p><h2>Boodschappen</h2></div></div>${groups || `<p class="empty-row">${esc(SECTIONS.groceries.empty)}</p>`}</section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Lijst importeren</p><h2>Plakken of uploaden</h2></div></div>
    <form class="stack-form" data-form="groceries:paste"><div class="field"><label>Lijst (✓ = afgevinkt)<textarea name="text" rows="5" placeholder="Melk&#10;✓ Brood"></textarea></label></div><button class="button button-primary">Toevoegen zonder dubbelen</button></form>
    <div class="field"><label>Of upload een tekst/JSON-bestand<input type="file" accept=".txt,.json,.csv" data-act-change="groceries:file"></label></div></section></div>`;
}

export function addItem(page, values) {
  const state = getState();
  if (page === 'tasks') { state.tasks.unshift({ id: uid(), done: false, text: values.text, person: values.person || 'Samen', category: values.category || 'Huishouden', due: values.due || todayKey() }); }
  else if (page === 'chores') state.chores.unshift(newChore(values));
  else if (page === 'travel') state.trips.unshift(newTrip(values.title, { startDate: values.startDate || '', endDate: values.endDate || '' }));
  else if (page === 'groceries') state.groceries.unshift({ id: uid(), done: false, ...values, category: values.category || categorizeProduct(values.name) });
  else if (page === 'stock') state.stock.unshift({ id: uid(), quantity: '', ...values, amount: Number(values.amount) || 0, min: Number(values.min) || 0, desired: Number(values.desired) || 0 });
  else if (page === 'agenda') state.agenda.unshift({ id: uid(), ...values, calendarId: values.calendarId || 'persoonlijk' });
  else state[keyOf(page)].unshift({ id: uid(), done: false, ...values });
  save('Toegevoegd');
  render();
}

export function addTask(text, values = {}) {
  const clean = String(text || '').trim();
  if (clean) addItem('tasks', { text: clean, ...values });
}

export function openAddDialog(page) {
  const target = SECTIONS[page] ? page : 'tasks';
  openFormDialog({
    title: `${SECTIONS[target].label} toevoegen`, fields: fieldsOf(target), submit: 'Opslaan',
    onSubmit: values => {
      const required = fieldsOf(target).find(f => f.required);
      if (required && !values[required.name]) return false;
      addItem(target, values);
      return true;
    }
  });
}

export function openEditDialog(page, id) {
  const item = listOf(page).find(i => i.id === id);
  if (!item) return;
  const fields = fieldsOf(page);
  openFormDialog({
    title: `${SECTIONS[page].label} bewerken`, fields, values: item,
    onSubmit: values => {
      const required = fields.find(f => f.required);
      if (required && !values[required.name]) return false;
      Object.assign(item, values);
      ['amount', 'min', 'desired'].forEach(k => { if (page === 'stock' && k in item) item[k] = Number(item[k]) || 0; });
      save('Opgeslagen'); render();
      return true;
    }
  });
}

export function deleteItem(page, id) {
  const key = keyOf(page);
  getState()[key] = getState()[key].filter(i => i.id !== id);
  save('Verwijderd'); render();
}

export function toggleItem(page, id, checked) {
  const item = listOf(page).find(i => i.id === id);
  if (!item) return;
  item.done = checked;
  if (page === 'home' && checked && item.repeat) {
    item.due = Core.nextDue(todayKey(), item.due, item.repeat);
    item.done = false;
    toast('Volgende datum ingepland');
  }
  save(); render();
}

export const forms = {
  'task:quick'(data) { addTask(data.text); },
  'groceries:paste'(data) {
    const items = parseGroceryText(data.text);
    if (!items.length) return toast('Geen boodschappen gevonden');
    const state = getState();
    const { list, added, updated } = mergeGroceries(state.groceries, items, uid);
    state.groceries = list;
    save(`${added} toegevoegd${updated ? `, ${updated} bijgewerkt` : ''}`); render();
  }
};

export const actions = {
  edit(el) { openEditDialog(el.dataset.page, el.dataset.id); },
  async 'groceries:file'(el) {
    const file = el.files?.[0];
    if (!file) return;
    try { forms['groceries:paste']({ text: await readFileText(file) }); } catch (error) { toast(error.message || 'Bestand kon niet worden gelezen'); }
    el.value = '';
  }
};
