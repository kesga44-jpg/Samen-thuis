import Core from './core.js';
import { daysBetween, escapeHtml as esc, fmtDate, startOfWeek, todayKey, uid, weekDates } from './utils.js';
import { getState, save, render, toast } from './store.js';

export const REPEATS = ['Eenmalig', 'Dagelijks', 'Om de dag', '2× per week', '3× per week', 'Wekelijks', 'Elke 2 weken', 'Elke 4 weken', 'Maandelijks', 'Elke 2 maanden', 'Elke 3 maanden', 'Elke 6 maanden', 'Jaarlijks', 'Na elke was', 'Wanneer nodig'];
export const CHORE_PEOPLE = ['Kees', 'Daphne', 'Samen'];
const normalizeRepeat = repeat => String(repeat || '').toLocaleLowerCase('nl-NL').replace(/(\d)x/g, '$1×');

export const weeklyTarget = repeat => ({ '2× per week': 2, '2 per week': 2, '3× per week': 3, '3 per week': 3 }[normalizeRepeat(repeat)] || 0);
export const isUnscheduled = repeat => ['na elke was', 'wanneer nodig'].includes(normalizeRepeat(repeat));

export function lastDone(chore) {
  const dates = [...(Array.isArray(chore.completedDates) ? chore.completedDates : []), chore.lastDoneDate].filter(Boolean).sort();
  return dates.at(-1) || '';
}

export function doneThisWeek(chore, today = todayKey()) {
  const week = weekDates(startOfWeek(today));
  return (chore.completedDates || []).filter(date => week.includes(date)).length;
}

/** Eerstvolgende uitvoerdatum, berekend vanaf de werkelijke laatste uitvoering. */
export function choreNextDue(chore) {
  return Core.nextDue(lastDone(chore), chore.due || '', chore.repeat || 'Wekelijks');
}

/** Status: red = te laat, orange = nu/binnenkort, green = op schema, none = geen planning. */
export function choreStatus(chore, today = todayKey()) {
  const target = weeklyTarget(chore.repeat);
  if (target) {
    const count = doneThisWeek(chore, today);
    if (count >= target) return { color: 'green', label: `${count}/${target} klaar deze week`, due: '', soon: false };
    const last = lastDone(chore);
    const due = choreNextDue(chore);
    const overdue = due && due < today;
    return { color: overdue ? 'red' : 'orange', label: `${count}/${target} deze week`, due: due || today, soon: true, doneToday: last === today };
  }
  const due = choreNextDue(chore);
  if (!due) {
    const finished = normalizeRepeat(chore.repeat) === 'eenmalig' && lastDone(chore);
    return { color: finished ? 'green' : 'none', label: finished ? 'Gedaan' : 'Wanneer nodig', due: '', soon: false };
  }
  const diff = daysBetween(today, due);
  if (diff < 0) return { color: 'red', label: `${-diff} d te laat`, due, soon: true };
  if (diff <= 2) return { color: 'orange', label: diff === 0 ? 'Vandaag' : diff === 1 ? 'Morgen' : 'Over 2 dagen', due, soon: true };
  return { color: 'green', label: `Over ${diff} dagen`, due, soon: false };
}

export function sortChores(chores, today = todayKey()) {
  const rank = { red: 0, orange: 1, green: 2, none: 3 };
  return chores.slice().sort((a, b) => {
    const sa = choreStatus(a, today), sb = choreStatus(b, today);
    return rank[sa.color] - rank[sb.color] || (sa.due || '9999').localeCompare(sb.due || '9999') || String(a.title).localeCompare(String(b.title));
  });
}

export const soonChores = (chores, today = todayKey()) => sortChores(chores, today).filter(c => choreStatus(c, today).soon);
export const laterChores = (chores, today = todayKey()) => sortChores(chores, today).filter(c => !choreStatus(c, today).soon);

export function completeChore(chore, date = todayKey()) {
  const dates = new Set(chore.completedDates || []);
  dates.add(date);
  chore.completedDates = [...dates].sort();
  chore.lastDoneDate = chore.completedDates.at(-1);
  return chore;
}

export function undoChore(chore, date = todayKey()) {
  chore.completedDates = (chore.completedDates || []).filter(d => d !== date);
  chore.lastDoneDate = chore.completedDates.at(-1) || '';
  return chore;
}

/** Weekbord: per dag wat gedaan is en wat gepland staat (te late taken staan op vandaag). */
export function weekBoard(chores, weekStart, today = todayKey()) {
  const days = weekDates(weekStart).map(date => ({ date, done: [], open: [] }));
  chores.forEach(chore => {
    days.forEach(day => { if ((chore.completedDates || []).includes(day.date)) day.done.push(chore); });
    const status = choreStatus(chore, today);
    const due = status.due && status.due < today ? today : status.due;
    const day = days.find(d => d.date === due);
    if (day && !day.done.includes(chore)) day.open.push(chore);
  });
  const done = days.reduce((n, d) => n + d.done.length, 0), open = days.reduce((n, d) => n + d.open.length, 0);
  return { days, done, open, percent: done + open ? Math.round((done / (done + open)) * 100) : 0 };
}

const weeklyLoad = chore => {
  const target = weeklyTarget(chore.repeat);
  if (target) return target;
  const days = Core.DAY_INTERVALS[normalizeRepeat(chore.repeat)];
  if (days) return 7 / days;
  const months = Core.MONTH_INTERVALS[normalizeRepeat(chore.repeat)];
  return months ? 7 / (months * 30) : 0.1;
};

/** Aanbevolen verdeling: zwaarste taken eerst, steeds naar degene met de laagste weekbelasting. */
export function recommendedAssignment(chores) {
  const load = { Kees: 0, Daphne: 0 };
  const result = {};
  chores.slice().sort((a, b) => weeklyLoad(b) - weeklyLoad(a) || String(a.title).localeCompare(String(b.title))).forEach(chore => {
    const person = load.Kees <= load.Daphne ? 'Kees' : 'Daphne';
    load[person] += weeklyLoad(chore);
    result[chore.id] = person;
  });
  return result;
}

export function newChore(values = {}) {
  return {
    id: uid(), title: String(values.title || '').trim(), person: CHORE_PEOPLE.includes(values.person) ? values.person : 'Samen',
    due: values.due || todayKey(), repeat: REPEATS.includes(values.repeat) ? values.repeat : 'Wekelijks',
    category: values.category || '', notes: values.notes || '', completedDates: [], lastDoneDate: ''
  };
}

const COLORS = { red: 'Te laat', orange: 'Nu', green: 'Op schema', none: 'Geen datum' };

export function choreRow(chore, today = todayKey()) {
  const status = choreStatus(chore, today);
  const doneToday = (chore.completedDates || []).includes(today);
  const btn = doneToday
    ? `<button type="button" class="button button-secondary button-small" data-act="chores:undo" data-id="${esc(chore.id)}">↺ Ongedaan</button>`
    : `<button type="button" class="button button-primary button-small" data-act="chores:done" data-id="${esc(chore.id)}">✓ Gedaan</button>`;
  return `<li class="list-card chore-row status-${status.color}"><span class="status-dot" title="${esc(COLORS[status.color])}" aria-label="${esc(COLORS[status.color])}"></span><div><strong>${esc(chore.title)}</strong><small>${esc([chore.person, chore.repeat, status.label, status.due ? fmtDate(status.due) : ''].filter(Boolean).join(' · '))}</small></div>${btn}<button type="button" class="icon-button" data-act="edit" data-page="chores" data-id="${esc(chore.id)}" aria-label="Bewerken">✎</button><button type="button" class="icon-button task-delete" data-delete="chores" data-id="${esc(chore.id)}" aria-label="Verwijderen">×</button></li>`;
}

export function renderChores(state = getState(), today = todayKey()) {
  const chores = state.chores;
  const board = weekBoard(chores, startOfWeek(today), today);
  const soon = soonChores(chores, today), later = laterChores(chores, today);
  const list = items => `<ul class="data-list">${items.map(c => choreRow(c, today)).join('') || '<li class="empty-row">Niets.</li>'}</ul>`;
  const days = board.days.map(day => `<div class="week-col ${day.date === today ? 'is-today' : ''}"><strong>${esc(fmtDate(day.date, { weekday: 'short', day: 'numeric' }))}</strong>${day.done.map(c => `<span class="chip chip-done">✓ ${esc(c.title)}</span>`).join('')}${day.open.map(c => `<span class="chip">${esc(c.title)}</span>`).join('')}</div>`).join('');
  const persons = CHORE_PEOPLE.map(p => `<span class="tag">${p}: ${chores.filter(c => c.person === p).length}</span>`).join(' ');
  return `<div class="page-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Deze week · ${board.percent}% klaar</p><h2>Weekbord</h2></div></div>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${board.percent}"><span style="width:${board.percent}%"></span></div>
    <div class="week-board">${days}</div></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Nu en binnenkort</p><h2>Huishouden (${soon.length})</h2></div></div>${list(soon)}
    <h3>Later</h3>${list(later)}</section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Taakverdeling</p><h2>Wie doet wat</h2></div></div><p>${persons}</p>
    <div class="button-row"><button type="button" class="button button-secondary" data-act="chores:distribute">Aanbevolen verdeling toepassen</button></div></section></div>`;
}

export const actions = {
  'chores:done'(el) { const c = getState().chores.find(x => x.id === el.dataset.id); if (c) { completeChore(c); save('Afgevinkt'); render(); } },
  'chores:undo'(el) { const c = getState().chores.find(x => x.id === el.dataset.id); if (c) { undoChore(c); save('Teruggezet'); render(); } },
  'chores:distribute'() {
    const state = getState();
    if (!state.chores.length) return toast('Nog geen huishoudtaken');
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm('Taken opnieuw verdelen over Kees en Daphne?')) return;
    const plan = recommendedAssignment(state.chores);
    state.chores.forEach(c => { c.person = plan[c.id] || c.person; });
    save('Verdeling toegepast'); render();
  }
};
