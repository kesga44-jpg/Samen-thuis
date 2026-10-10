import { addDays, escapeHtml as esc, fmtDate, parseInputDate, startOfWeek, todayKey, uid, weekDates } from './utils.js';
import { getState, save, render, toast } from './store.js';
import { openFormDialog } from './dialogs.js';

export const CAL_PEOPLE = ['Kees', 'Daphne', 'Samen'];
export const CALENDAR_COLORS = ['#315f86', '#e98248', '#2e7d67', '#9b59b6', '#b84f58', '#8a6f3e'];
export const DEFAULT_CALENDAR_ID = 'persoonlijk';
export const defaultCalendars = () => [{ id: DEFAULT_CALENDAR_ID, name: 'Persoonlijk', color: '#315f86', visible: true, person: '' }];

export const validPerson = value => CAL_PEOPLE.find(p => p.toLowerCase() === String(value || '').trim().toLowerCase()) || '';
export const cleanCalendarName = name => String(name || 'Persoonlijk').normalize('NFKC').replace(/\s+/g, ' ').trim() || 'Persoonlijk';
export const calendarKey = name => cleanCalendarName(name).toLocaleLowerCase('nl-NL');

/** Tekst/JSON → afspraken. Formaat: calendar | datum | tijd | titel | persoon | eindtijd */
export function parseCalendarText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  if (/^[[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.events || parsed.planning || parsed.agenda;
      if (Array.isArray(items)) {
        return items.filter(item => item && typeof item === 'object').map(item => ({
          calendar: cleanCalendarName(item.calendar || item.calendarName), date: parseInputDate(item.date),
          time: String(item.time || '').trim(), endTime: String(item.endTime || '').trim(),
          title: String(item.title || item.name || '').trim(), person: validPerson(item.person)
        })).filter(item => item.date && item.title);
      }
    } catch { /* val terug op regels */ }
  }
  return trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s*[|;\t]\s*/);
    if (parts.length < 4) return null;
    return { calendar: cleanCalendarName(parts[0]), date: parseInputDate(parts[1]), time: parts[2] || '', title: parts[3] || '', person: validPerson(parts[4]), endTime: parts[5] || '' };
  }).filter(item => item?.date && item.title);
}

export const inferCalendarPerson = name => validPerson(String(name).split(/\s+/).find(part => validPerson(part)) || '');

export const isExcluded = (state, name) => state.excludedCalendars.some(c => calendarKey(c.name) === calendarKey(name));

export function ensureCalendar(state, name) {
  const clean = cleanCalendarName(name);
  if (isExcluded(state, clean)) return null;
  let calendar = state.calendars.find(c => calendarKey(c.name) === calendarKey(clean));
  if (!calendar) {
    calendar = { id: `cal-${uid()}`, name: clean, color: CALENDAR_COLORS[state.calendars.length % CALENDAR_COLORS.length], visible: true, person: inferCalendarPerson(clean) };
    state.calendars.push(calendar);
  }
  return calendar;
}

export const calendarOf = (state, id) => state.calendars.find(c => c.id === id)
  || (state.excludedCalendars.find(c => c.id === id) ? { ...state.excludedCalendars.find(c => c.id === id), visible: true } : { id, name: 'Zonder agenda', color: '#315f86', visible: true });

/** Voegt afspraken toe; dubbelen (zelfde datum/tijd/titel/agenda) worden overgeslagen. Niets wordt overschreven. */
export function importEvents(state, events, choices = new Map()) {
  let added = 0, duplicates = 0, skipped = 0;
  events.forEach(event => {
    const calendar = ensureCalendar(state, event.calendar);
    if (!calendar) { skipped += 1; return; }
    const chosen = validPerson(choices.get(calendarKey(event.calendar)));
    if (chosen) calendar.person = chosen;
    const person = validPerson(event.person) || calendar.person || 'Samen';
    const dup = state.agenda.some(item => item.date === event.date && (item.time || '') === (event.time || '')
      && String(item.title).toLowerCase() === event.title.toLowerCase() && (item.calendarId || DEFAULT_CALENDAR_ID) === calendar.id);
    if (dup) { duplicates += 1; return; }
    state.agenda.push({ id: uid(), title: event.title, date: event.date, time: event.time || '', endTime: event.endTime || '', person, calendarId: calendar.id });
    added += 1;
  });
  return { added, duplicates, skipped };
}

/** Agenda's waarvan de persoon niet af te leiden is (voor de mapping-dialoog). */
export function unknownCalendars(state, events) {
  const unknown = new Map();
  events.forEach(event => {
    if (isExcluded(state, event.calendar)) return;
    const found = state.calendars.find(c => calendarKey(c.name) === calendarKey(event.calendar));
    if (!validPerson(found?.person) && !inferCalendarPerson(event.calendar) && !validPerson(event.person)) unknown.set(calendarKey(event.calendar), event.calendar);
  });
  return [...unknown.entries()];
}

export function removeCalendar(state, id, deleteEvents = false) {
  const calendar = state.calendars.find(c => c.id === id);
  if (!calendar || id === DEFAULT_CALENDAR_ID) return false;
  state.excludedCalendars.push({ ...calendar, keepEvents: !deleteEvents, removedAt: new Date().toISOString() });
  state.calendars = state.calendars.filter(c => c.id !== id);
  if (deleteEvents) state.agenda = state.agenda.filter(item => item.calendarId !== id);
  else state.agenda.forEach(item => { if (item.calendarId === id) item.calendarId = DEFAULT_CALENDAR_ID; });
  return true;
}

export function restoreCalendar(state, id) {
  const found = state.excludedCalendars.find(c => c.id === id);
  if (!found) return false;
  const { keepEvents: _keep, removedAt: _removed, ...calendar } = found;
  state.excludedCalendars = state.excludedCalendars.filter(c => c.id !== id);
  state.calendars.push({ ...calendar, visible: true });
  return true;
}

export const eventsOn = (state, date) => state.agenda
  .filter(item => item.date === date && calendarOf(state, item.calendarId || DEFAULT_CALENDAR_ID).visible !== false)
  .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')) || String(a.title).localeCompare(String(b.title)));

export function upcomingEvents(state, from = todayKey(), days = 7) {
  const end = addDays(from, days);
  return state.agenda.filter(item => item.date && item.date >= from && item.date <= end
    && calendarOf(state, item.calendarId || DEFAULT_CALENDAR_ID).visible !== false)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')));
}

export const eventTime = item => [item.time, item.endTime].filter(Boolean).join('–');

let weekStart = '';
const currentWeek = () => weekStart || (weekStart = startOfWeek(todayKey()));

export function eventRow(state, item) {
  const calendar = calendarOf(state, item.calendarId || DEFAULT_CALENDAR_ID);
  return `<li class="list-card"><span class="cal-dot" style="background:${esc(calendar.color)}" title="${esc(calendar.name)}"></span><div><strong>${esc(item.title)}</strong><small>${esc([fmtDate(item.date), eventTime(item), item.person, calendar.name].filter(Boolean).join(' · '))}</small></div><button type="button" class="icon-button" data-act="edit" data-page="agenda" data-id="${esc(item.id)}" aria-label="Bewerken">✎</button><button type="button" class="icon-button task-delete" data-delete="agenda" data-id="${esc(item.id)}" aria-label="Verwijderen">×</button></li>`;
}

export function renderCalendar(state = getState(), today = todayKey()) {
  const start = currentWeek();
  const days = weekDates(start).map(date => {
    const events = eventsOn(state, date);
    return `<div class="week-col ${date === today ? 'is-today' : ''}"><strong>${esc(fmtDate(date, { weekday: 'short', day: 'numeric' }))}</strong>${events.map(e => `<span class="chip" style="border-color:${esc(calendarOf(state, e.calendarId || DEFAULT_CALENDAR_ID).color)}">${esc(eventTime(e))} ${esc(e.title)}</span>`).join('') || '<small class="muted">–</small>'}</div>`;
  }).join('');
  const undated = state.agenda.filter(i => !i.date);
  const cals = state.calendars.map(c => `<li class="list-card"><span class="cal-dot" style="background:${esc(c.color)}"></span><div><strong>${esc(c.name)}</strong><small>${esc(c.person || 'Geen persoon')}</small></div><label class="inline-check"><input type="checkbox" data-act-change="calendar:visible" data-id="${esc(c.id)}" ${c.visible !== false ? 'checked' : ''}> zichtbaar</label>${c.id === DEFAULT_CALENDAR_ID ? '' : `<button type="button" class="icon-button" data-act="calendar:remove" data-id="${esc(c.id)}" aria-label="Agenda verwijderen">×</button>`}</li>`).join('');
  const excluded = state.excludedCalendars.map(c => `<li class="list-card"><div><strong>${esc(c.name)}</strong><small>Uitgesloten van import</small></div><button type="button" class="button button-secondary button-small" data-act="calendar:restore" data-id="${esc(c.id)}">Herstellen</button></li>`).join('');
  return `<div class="page-grid"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Week van ${esc(fmtDate(start, { day: 'numeric', month: 'long' }))}</p><h2>Agenda</h2></div></div>
    <div class="button-row"><button type="button" class="button button-secondary button-small" data-act="calendar:week" data-dir="-1">‹ Vorige week</button><button type="button" class="button button-secondary button-small" data-act="calendar:week" data-dir="0">Deze week</button><button type="button" class="button button-secondary button-small" data-act="calendar:week" data-dir="1">Volgende week ›</button></div>
    <div class="week-board">${days}</div>
    ${undated.length ? `<h3>Zonder datum</h3><ul class="data-list">${undated.map(i => eventRow(state, i)).join('')}</ul>` : ''}</section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">${state.agenda.length} afspraken</p><h2>Alle afspraken</h2></div></div><ul class="data-list">${state.agenda.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map(i => eventRow(state, i)).join('') || '<li class="empty-row">Geen afspraken.</li>'}</ul></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Kalenders</p><h2>Agenda's</h2></div></div><ul class="data-list">${cals}${excluded}</ul>
    <div class="button-row"><button type="button" class="button button-secondary" data-act="calendar:add">＋ Agenda toevoegen</button><button type="button" class="button button-secondary" data-act="goto" data-page="imports">Afspraken importeren</button></div></section></div>`;
}

export const actions = {
  'calendar:week'(el) { const dir = Number(el.dataset.dir); weekStart = dir === 0 ? startOfWeek(todayKey()) : addDays(currentWeek(), dir * 7); render(); },
  'calendar:visible'(el) { const c = getState().calendars.find(x => x.id === el.dataset.id); if (c) { c.visible = el.checked; save(); render(); } },
  'calendar:restore'(el) { if (restoreCalendar(getState(), el.dataset.id)) { save('Agenda hersteld'); render(); } },
  'calendar:remove'(el) {
    const state = getState(), id = el.dataset.id, cal = state.calendars.find(c => c.id === id);
    if (!cal) return;
    const count = state.agenda.filter(i => i.calendarId === id).length;
    openFormDialog({
      title: 'Agenda verwijderen', submit: 'Verwijderen en uitsluiten',
      intro: `${cal.name} wordt uitgesloten van import. ${count} afspraken blijven bewaard tenzij je ze hieronder wist.`,
      fields: [{ name: 'deleteEvents', label: `Ook de ${count} afspraken wissen`, type: 'checkbox' }],
      onSubmit: values => { removeCalendar(getState(), id, Boolean(values.deleteEvents)); save('Agenda verwijderd'); render(); }
    });
  },
  'calendar:add'() {
    openFormDialog({
      title: 'Agenda toevoegen', submit: 'Toevoegen',
      fields: [{ name: 'name', label: 'Naam', required: true }, { name: 'person', label: 'Persoon', type: 'select', options: ['', ...CAL_PEOPLE] }, { name: 'color', label: 'Kleur', type: 'color', value: '#315f86' }],
      onSubmit: values => {
        const state = getState(), name = cleanCalendarName(values.name);
        if (state.calendars.some(c => calendarKey(c.name) === calendarKey(name))) return toast('Deze agenda bestaat al');
        state.excludedCalendars = state.excludedCalendars.filter(c => calendarKey(c.name) !== calendarKey(name));
        state.calendars.push({ id: `cal-${uid()}`, name, color: /^#[\da-f]{6}$/i.test(values.color) ? values.color : '#315f86', visible: true, person: validPerson(values.person) });
        save('Agenda toegevoegd'); render();
      }
    });
  }
};

/** Import via URL-parameter ?agenda=… (tekst of JSON); onbekende agenda's gaan via de mapping-dialoog. */
export function importFromQuery(search = globalThis.location?.search || '') {
  const raw = new URLSearchParams(search).get('agenda');
  const events = parseCalendarText(raw);
  if (!events.length) return false;
  const finish = (choices = new Map()) => {
    const { added, duplicates } = importEvents(getState(), events, choices);
    save(`${added} afspraken geïmporteerd${duplicates ? `, ${duplicates} dubbel overgeslagen` : ''}`);
    render();
  };
  const unknown = unknownCalendars(getState(), events);
  if (!unknown.length) { finish(); return true; }
  openFormDialog({
    title: 'Van wie zijn deze agenda\'s?', intro: 'Kies per onbekende agenda een persoon.', submit: 'Importeren',
    fields: unknown.map(([key, name]) => ({ name: key, label: name, type: 'select', options: ['Samen', 'Kees', 'Daphne'] })),
    onSubmit: values => { finish(new Map(unknown.map(([key]) => [calendarKey(key), values[key]]))); return true; }
  });
  return true;
}
