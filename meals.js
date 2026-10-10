import { addDays, escapeHtml as esc, fmtDate, startOfWeek, todayKey, uid, weekDates } from './utils.js';
import { getState, save, render } from './store.js';
import { openFormDialog } from './dialogs.js';
import { categorizeProduct } from './groceries.js';

export const MEAL_SLOTS = ['Ontbijt', 'Lunch', 'Avondeten', 'Snack'];
const WEEKDAYS = [['maandag', 'monday'], ['dinsdag', 'tuesday'], ['woensdag', 'wednesday'], ['donderdag', 'thursday'], ['vrijdag', 'friday'], ['zaterdag', 'saturday'], ['zondag', 'sunday']];
const weekdayIndex = word => WEEKDAYS.findIndex(names => names.some(n => n === String(word).toLowerCase().trim()));
const slotOf = word => MEAL_SLOTS.find(s => s.toLowerCase() === String(word || '').toLowerCase().trim()) || '';

/**
 * Importeert "Maandag: Pasta", "Dinsdag Lunch: Soep" of Osta-tekst. Een sectie "Grocery list"
 * (of "Boodschappen") wordt apart als boodschappenlijst teruggegeven.
 */
export function parseMealPlan(text, weekStart = startOfWeek(todayKey())) {
  const meals = [], groceries = [];
  let inGroceries = false;
  const dates = weekDates(weekStart);
  String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
    if (/^(grocery list|boodschappen(lijst)?)\s*:?$/i.test(line)) { inGroceries = true; return; }
    if (inGroceries) {
      const name = line.replace(/^[-•*✓✔]\s*/, '').trim();
      if (name) groceries.push({ name, done: /^[✓✔]/.test(line), category: categorizeProduct(name) });
      return;
    }
    const match = line.match(/^([A-Za-zë]+)(?:\s*[-–]?\s*([A-Za-z]+))?\s*[:：]\s*(.+)$/);
    if (!match) return;
    const day = weekdayIndex(match[1]);
    if (day < 0) return;
    const slot = slotOf(match[2]) || 'Avondeten';
    match[3].split(/\s*[;|]\s*/).filter(Boolean).forEach(name => meals.push({ date: dates[day], slot, name: name.trim() }));
  });
  return { meals, groceries };
}

export const mealsOn = (state, date) => state.meals.filter(m => m.date === date);
export const dinnerOn = (state, date) => state.meals.find(m => m.date === date && (m.slot || 'Avondeten') === 'Avondeten') || null;

let weekStart = '';
const currentWeek = () => weekStart || (weekStart = startOfWeek(todayKey()));

export function renderMeals(state = getState(), today = todayKey()) {
  const start = currentWeek();
  const dates = weekDates(start);
  const rows = dates.map(date => `<tr class="${date === today ? 'is-today' : ''}"><th scope="row">${esc(fmtDate(date, { weekday: 'short', day: 'numeric' }))}</th>${MEAL_SLOTS.map(slot => `<td>${state.meals.filter(m => m.date === date && (m.slot || 'Avondeten') === slot).map(m => `<span class="chip">${esc(m.name)} <button type="button" class="chip-x" data-delete="mealplan" data-id="${esc(m.id)}" aria-label="Verwijderen">×</button></span>`).join('')}<button type="button" class="icon-button" data-act="meals:add" data-date="${esc(date)}" data-slot="${esc(slot)}" aria-label="${esc(slot)} toevoegen">＋</button></td>`).join('')}</tr>`).join('');
  const undated = state.meals.filter(m => !m.date);
  return `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Week van ${esc(fmtDate(start, { day: 'numeric', month: 'long' }))}</p><h2>Weekmenu</h2></div></div>
    <div class="button-row"><button type="button" class="button button-secondary button-small" data-act="meals:week" data-dir="-1">‹ Vorige week</button><button type="button" class="button button-secondary button-small" data-act="meals:week" data-dir="0">Deze week</button><button type="button" class="button button-secondary button-small" data-act="meals:week" data-dir="1">Volgende week ›</button><button type="button" class="button button-secondary button-small" data-act="goto" data-page="imports">Importeren</button></div>
    <div class="table-scroll"><table class="meal-grid"><thead><tr><th></th>${MEAL_SLOTS.map(s => `<th scope="col">${esc(s)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    ${undated.length ? `<h3>Zonder datum</h3><ul class="data-list">${undated.map(m => `<li class="list-card"><div><strong>${esc(m.name)}</strong></div><button type="button" class="icon-button task-delete" data-delete="mealplan" data-id="${esc(m.id)}" aria-label="Verwijderen">×</button></li>`).join('')}</ul>` : ''}</section>`;
}

export const actions = {
  'meals:week'(el) { const dir = Number(el.dataset.dir); weekStart = dir === 0 ? startOfWeek(todayKey()) : addDays(currentWeek(), dir * 7); render(); },
  'meals:add'(el) {
    const { date, slot } = el.dataset;
    openFormDialog({
      title: `${slot} · ${fmtDate(date)}`, submit: 'Toevoegen', fields: [{ name: 'name', label: 'Maaltijd', required: true }],
      onSubmit: values => { if (!values.name) return false; getState().meals.unshift({ id: uid(), name: values.name, date, slot }); save('Toegevoegd'); render(); return true; }
    });
  }
};
