import { escapeHtml as esc, todayKey, fmtDate, fmtMoney, daysBetween } from './utils.js';
import { normalizeDashboard, LEGACY_WIDGETS } from './state.js';
import { getState } from './store.js';
import { renderQuote } from './quote.js';
import { dashboardWeatherMarkup, readWeatherCache, weatherLabel } from './weather.js';
import { upcomingEvents, eventsOn, eventTime } from './calendar.js';
import { dinnerOn } from './meals.js';
import { soonChores, choreStatus } from './chores.js';
import { topTravelActions, nextTrip } from './travel.js';
import { budgetKpis } from './budget.js';
import { apkWarnings } from './auto.js';
import { lowStock } from './stock.js';
import { syncStatusText, conflictPending } from './sync.js';
import { questionForDate, questionStatus, answerText } from './questions.js';
import { listMarkup } from './lists.js';

export const WIDGET_LABELS = {
  tasks: 'Open taken', quote: 'Quote van de dag', question: 'Vraag van de dag', weather: 'Weer', agenda: 'Agenda', groceries: 'Boodschappen', challenges: 'Challenges',
  greeting: 'Begroeting', weatherAdvice: 'Weer, outfit & luchtkwaliteit', stats: 'Statistieken', agendaUpcoming: 'Agenda komende 7 dagen', dinner: 'Diner van vandaag',
  choresSoon: 'Huishouden nu/binnenkort', travelActions: 'Belangrijkste reisacties', budgetSummary: 'Budget deze maand', apkWarning: 'APK-waarschuwing', syncStatus: 'Sync-status'
};

/** Klikbare kaart die naar een pagina navigeert. */
export function card({ eyebrow = '', title, page, icon = '', body, cls = '' }) {
  return `<section class="panel card-link ${cls}" data-act="goto" data-page="${page}"><div class="panel-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h2><a href="#/${page}" data-page="${page}">${esc(title)}</a></h2></div>${icon ? `<span class="panel-icon" aria-hidden="true">${icon}</span>` : ''}</div>${body}</section>`;
}

const empty = text => `<p class="empty-row">${esc(text)}</p>`;

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
}

export function dashboardStats(state, today = todayKey()) {
  return {
    openTasks: state.tasks.filter(t => !t.done).length,
    choresToday: soonChores(state.chores, today).length,
    groceriesOpen: state.groceries.filter(g => !g.done).length,
    lowStock: lowStock(state.stock).length
  };
}

function weatherSummary(state) {
  const cache = readWeatherCache();
  const c = cache?.data?.current;
  return c
    ? `<p class="weather-now"><strong>${Math.round(c.temperature_2m)}°C</strong> ${esc(weatherLabel(c.weather_code))}</p><p class="small-note">Zie de pagina Weer voor grafieken.</p>`
    : `<p class="quote-note muted">Open eenmaal de pagina Weer om het weer hier te tonen (${esc(state.weather.place)}).</p>`;
}

function questionWidget(state, today) {
  const answers = state.dailyAnswers[today] || {};
  const status = questionStatus(answers);
  const who = ['Kees', 'Daphne'].map(p => {
    if (status.revealed) return `<article><strong>${p}</strong><p>${esc(answerText(answers[p]))}</p></article>`;
    return status[p.toLowerCase()] ? `<span class="tag">${p} heeft geantwoord ✓</span>` : `<button type="button" class="button button-secondary button-small" data-answer="${p}">${p} beantwoordt</button>`;
  }).join(' ');
  return `<section class="panel question-panel"><div class="panel-heading"><div><p class="eyebrow">Even samen stilstaan</p><h2>Vraag van de dag</h2></div><span class="panel-icon">♡</span></div><p>${esc(questionForDate(today))}</p><div class="button-row">${who}</div>${status.revealed ? '' : '<p class="small-note">Antwoorden blijven verborgen tot jullie allebei hebben geantwoord.</p>'}</section>`;
}

const eventLine = (item, withDate) => `<li class="list-card"><div><strong>${esc(item.title)}</strong><small>${esc([withDate && fmtDate(item.date), eventTime(item), item.person].filter(Boolean).join(' · '))}</small></div></li>`;

export function buildWidgets(state, today = todayKey()) {
  const stats = dashboardStats(state, today);
  const open = state.tasks.filter(t => !t.done);
  const kpis = budgetKpis(state.budget);
  const upcomingTrip = nextTrip(state.trips, today);
  const todayEvents = eventsOn(state, today);
  const upcoming = upcomingEvents(state, today, 7);
  const dinner = dinnerOn(state, today);
  const soon = soonChores(state.chores, today).slice(0, 5);
  const apk = apkWarnings(state, today);
  const actions = topTravelActions(state.trips, 5, today);
  const date = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return {
    tasks: () => `<section class="panel tasks-panel"><div class="panel-heading"><div><p class="eyebrow">${esc(date)}</p><h2>Open taken (${open.length})</h2></div></div><form class="inline-form" data-form="task:quick"><input name="text" placeholder="Nieuwe taak…" required maxlength="120" aria-label="Nieuwe taak"><button class="button button-primary">Toevoegen</button></form>${listMarkup('tasks', open.slice(0, 8))}</section>`,
    quote: renderQuote,
    question: () => questionWidget(state, today),
    weather: () => `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">${esc(state.weather.place)}</p><h2>Weer</h2></div><span class="panel-icon">☀</span></div>${weatherSummary(state)}</section>`,
    agenda: () => `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Eerstvolgende afspraken</p><h2>Agenda</h2></div></div>${listMarkup('agenda', state.agenda.filter(i => !i.date || i.date >= today).slice(0, 5))}</section>`,
    groceries: () => `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Nog te halen</p><h2>Boodschappen</h2></div></div>${listMarkup('groceries', state.groceries.filter(i => !i.done).slice(0, 8))}</section>`,
    challenges: () => `<section class="panel"><div class="panel-heading"><div><p class="eyebrow">Samen doen</p><h2>Challenges</h2></div></div>${listMarkup('challenges', state.challenges.filter(i => !i.done).slice(0, 5))}</section>`,
    greeting: () => `<section class="panel greeting-panel"><p class="eyebrow">${esc(date)}</p><h2>${greeting()}</h2></section>`,
    weatherAdvice: () => card({ eyebrow: state.weather.place, title: 'Weer', page: 'weather', icon: '☀', body: dashboardWeatherMarkup(), cls: 'wide' }),
    stats: () => `<section class="stats-row" aria-label="Statistieken">${[['tasks', stats.openTasks, 'Open taken'], ['chores', stats.choresToday, 'Huishouden vandaag'], ['groceries', stats.groceriesOpen, 'Boodschappen open'], ['stock', stats.lowStock, 'Voorraad bijna op']].map(([page, n, label]) => `<a class="stat" href="#/${page}" data-page="${page}"><strong>${n}</strong><small>${label}</small></a>`).join('')}</section>`,
    agendaUpcoming: () => card({ eyebrow: 'Vandaag & komende 7 dagen', title: 'Agenda', page: 'agenda', icon: '▦', body: `<h3>Vandaag</h3><ul class="data-list">${todayEvents.map(e => eventLine(e, false)).join('') || '<li class="empty-row">Niets gepland vandaag.</li>'}</ul><h3>Komende dagen</h3><ul class="data-list">${upcoming.filter(e => e.date !== today).slice(0, 6).map(e => eventLine(e, true)).join('') || '<li class="empty-row">Geen afspraken.</li>'}</ul>` }),
    dinner: () => card({ eyebrow: 'Weekmenu', title: 'Diner vandaag', page: 'mealplan', icon: '♨', body: dinner ? `<p class="weather-now"><strong>${esc(dinner.name)}</strong></p>` : empty('Nog niets gepland voor vandaag.') }),
    choresSoon: () => card({ eyebrow: 'Slimme planning', title: 'Huishouden nu/binnenkort', page: 'chores', icon: '⌁', body: `<ul class="data-list">${soon.map(c => `<li class="list-card task-row"><span class="status-dot status-${choreStatus(c, today).color}" aria-hidden="true"></span><div><strong>${esc(c.title)}</strong><small>${esc(c.person)} · ${esc(choreStatus(c, today).label)}</small></div><button type="button" class="button button-secondary button-small" data-act="chores:done" data-id="${esc(c.id)}">✓ Gedaan</button></li>`).join('') || '<li class="empty-row">Niets dringends 🎉</li>'}</ul>` }),
    travelActions: () => card({ eyebrow: upcomingTrip ? `${upcomingTrip.trip.title} · over ${upcomingTrip.days} dagen` : 'Reizen', title: 'Belangrijkste reisacties', page: 'travel', icon: '✈', body: `<ul class="data-list">${actions.map(a => `<li class="list-card"><div><strong>${esc(a.item.text)}</strong><small>${esc([a.trip.title, a.item.deadline && fmtDate(a.item.deadline), a.item.priority].filter(Boolean).join(' · '))}</small></div></li>`).join('') || '<li class="empty-row">Geen openstaande reisacties.</li>'}</ul>` }),
    budgetSummary: () => card({ eyebrow: 'Deze maand', title: 'Budget', page: 'budget', icon: '€', body: `<p class="weather-now"><strong class="${kpis.balance < 0 ? 'neg' : 'pos'}">${esc(fmtMoney(Math.abs(kpis.balance)))}</strong> ${kpis.balance < 0 ? 'tekort' : 'over'}</p>` }),
    apkWarning: () => card({ eyebrow: 'Auto', title: 'APK', page: 'car', icon: '⛟', body: apk.length ? `<ul class="data-list">${apk.map(w => `<li class="list-card"><div><strong>${esc(w.vehicle.plate || w.vehicle.model || 'Auto')}</strong><small>APK ${esc(fmtDate(w.vehicle.apkDate))}${w.expired ? ' · verlopen' : ` · over ${daysBetween(today, w.vehicle.apkDate)} dagen`}</small></div></li>`).join('')}</ul>` : empty('Geen APK-vervaldatum binnen 60 dagen.') }),
    syncStatus: () => card({ eyebrow: 'Apparaten', title: 'Synchronisatie', page: 'settings', icon: conflictPending() ? '!' : '⟳', body: `<p>${esc(syncStatusText())}</p>` })
  };
}

/** Vandaag toont alleen de oorspronkelijke widgets; Dashboard de nieuwe + vraag/quote. */
export function visibleWidgets(state, page) {
  const list = normalizeDashboard(state.dashboard, state.showQuote).filter(w => w.visible).map(w => w.id);
  return list.filter(id => (page === 'today' ? LEGACY_WIDGETS.includes(id) : !['tasks', 'weather', 'agenda', 'groceries', 'challenges'].includes(id)));
}

export function renderDashboard(page = 'dashboard', state = getState(), today = todayKey()) {
  const widgets = buildWidgets(state, today);
  const html = visibleWidgets(state, page).map(id => widgets[id]()).join('');
  return `<div class="page-grid">${html || '<section class="panel"><p class="muted">Je dashboard is leeg. Kies onderdelen bij Instellingen → Dashboard samenstellen.</p></section>'}</div>`;
}
