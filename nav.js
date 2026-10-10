import { escapeHtml as esc } from './utils.js';

export const PAGES = {
  dashboard: 'Dashboard', today: 'Vandaag', agenda: 'Agenda', mealplan: 'Weekmenu', groceries: 'Boodschappen', stock: 'Voorraad',
  tasks: 'Taken', chores: 'Huishouden', challenges: 'Challenges', home: 'Woning',
  budget: 'Budget', car: 'Auto', deals: 'Acties & aanbiedingen',
  travel: 'Reizen', dates: 'Date ideeën', programs: "Programma's", weather: 'Weer', extras: 'Extra',
  imports: 'Importeren', settings: 'Instellingen'
};

export const ICONS = {
  dashboard: '⌂', today: '☀', agenda: '▦', mealplan: '♨', groceries: '✓', stock: '▤', tasks: '☑', chores: '⌁', challenges: '★', home: '⌂',
  budget: '€', car: '⛟', deals: '％', travel: '✈', dates: '♡', programs: '▶', weather: '☁', extras: '＋', imports: '⇩', settings: '⚙'
};

export const NAV_GROUPS = [
  { id: 'daily', label: 'Dagelijks', pages: ['dashboard', 'today', 'agenda', 'mealplan', 'groceries', 'stock'] },
  { id: 'household', label: 'Huishouden', pages: ['tasks', 'chores', 'challenges', 'home'] },
  { id: 'money', label: 'Geld & Auto', pages: ['budget', 'car', 'deals'] },
  { id: 'plan', label: 'Plannen', pages: ['travel', 'dates', 'programs', 'weather', 'extras'] },
  { id: 'manage', label: 'Beheer', pages: ['imports', 'settings'] }
];

export const MOBILE_TABS = ['dashboard', 'agenda', 'groceries', 'chores'];
const COLLAPSE_KEY = 'samenThuisV2-nav';

export const hashFor = page => `#/${page}`;
export const isPage = page => Object.hasOwn(PAGES, page);

/** '#/agenda' of '#/agenda?x=1' → 'agenda'; onbekend → null. */
export function parseHash(hash) {
  const match = String(hash || '').match(/^#\/?([a-z]+)(?:[/?].*)?$/i);
  const page = match?.[1].toLowerCase();
  return page && isPage(page) ? page : null;
}

const fold = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Zoekt pagina's voor het command palette (begint-met eerst, daarna bevat). */
export function searchPages(query) {
  const q = fold(query).trim();
  const all = Object.entries(PAGES).map(([id, label]) => ({ id, label }));
  if (!q) return all;
  const starts = all.filter(p => fold(p.label).startsWith(q) || p.id.startsWith(q));
  const contains = all.filter(p => !starts.includes(p) && (fold(p.label).includes(q) || p.id.includes(q)));
  return [...starts, ...contains];
}

function loadCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch { return new Set(); }
}

export function toggleGroup(id) {
  const set = loadCollapsed();
  if (set.has(id)) set.delete(id); else set.add(id);
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set])); } catch { /* voorkeur niet bewaard */ }
}

const link = (page, current, cls = 'nav-item') => `<a class="${cls} ${page === current ? 'is-active' : ''}" href="${hashFor(page)}" data-page="${page}"${page === current ? ' aria-current="page"' : ''}><span aria-hidden="true">${ICONS[page]}</span> ${esc(PAGES[page])}</a>`;

export function navMarkup(current, collapsed = loadCollapsed()) {
  return NAV_GROUPS.map(group => {
    const closed = collapsed.has(group.id) && !group.pages.includes(current);
    return `<div class="nav-group"><button type="button" class="nav-group-title" data-nav-group="${group.id}" aria-expanded="${!closed}" aria-controls="navgroup-${group.id}">${esc(group.label)}<span aria-hidden="true">${closed ? '▸' : '▾'}</span></button><div id="navgroup-${group.id}" class="nav-group-items" ${closed ? 'hidden' : ''}>${group.pages.map(p => link(p, current)).join('')}</div></div>`;
  }).join('');
}

export function mobileMarkup(current) {
  const inMore = !MOBILE_TABS.includes(current);
  return `${MOBILE_TABS.map(p => `<a class="bottom-tab ${p === current ? 'is-active' : ''}" href="${hashFor(p)}" data-page="${p}"${p === current ? ' aria-current="page"' : ''}><span aria-hidden="true">${ICONS[p]}</span><small>${esc(PAGES[p])}</small></a>`).join('')}<button type="button" class="bottom-tab ${inMore ? 'is-active' : ''}" data-nav-more aria-haspopup="dialog"><span aria-hidden="true">☰</span><small>Meer</small></button>`;
}

/** Vervangt de inhoud maar behoudt de horizontale scrollpositie. */
function setPreservingScroll(el, html) {
  const left = el.scrollLeft;
  el.innerHTML = html;
  el.scrollLeft = left;
}

export function renderNav(current) {
  const nav = document.querySelector('#nav');
  if (nav) setPreservingScroll(nav, navMarkup(current));
  const bar = document.querySelector('#mobileNav');
  if (bar) setPreservingScroll(bar, mobileMarkup(current));
}

function dialog(id, html) {
  let dlg = document.querySelector(`#${id}`);
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = id; document.body.append(dlg); }
  dlg.innerHTML = html;
  return dlg;
}

export function openMoreSheet(current) {
  const dlg = dialog('moreSheet', `<div class="dialog-head"><h2>Alle pagina's</h2><button type="button" class="icon-btn" data-dialog-close aria-label="Sluiten">×</button></div>${NAV_GROUPS.map(g => `<h3>${esc(g.label)}</h3><div class="sheet-grid">${g.pages.map(p => link(p, current, 'sheet-link')).join('')}</div>`).join('')}`);
  dlg.querySelectorAll('[data-dialog-close],[data-page]').forEach(el => el.addEventListener('click', () => dlg.close()));
  dlg.showModal();
}

export function openPalette(current, onPick) {
  const dlg = dialog('palette', `<div class="dialog-head"><h2>Ga naar…</h2><button type="button" class="icon-btn" data-dialog-close aria-label="Sluiten">×</button></div><input id="paletteInput" type="search" placeholder="Zoek een pagina" autocomplete="off" aria-label="Zoek een pagina"><ul id="paletteList" class="palette-list" role="listbox"></ul>`);
  const input = dlg.querySelector('#paletteInput'), list = dlg.querySelector('#paletteList');
  let results = [], active = 0;
  const draw = () => {
    results = searchPages(input.value);
    active = Math.min(active, Math.max(0, results.length - 1));
    list.innerHTML = results.map((p, i) => `<li role="option" aria-selected="${i === active}" class="palette-item ${i === active ? 'is-active' : ''}"><button type="button" data-pick="${p.id}">${ICONS[p.id]} ${esc(p.label)}${p.id === current ? ' (huidig)' : ''}</button></li>`).join('') || '<li class="empty-row">Geen resultaten</li>';
  };
  const pick = id => { dlg.close(); onPick(id); };
  input.addEventListener('input', () => { active = 0; draw(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { active = Math.min(results.length - 1, active + 1); draw(); event.preventDefault(); }
    else if (event.key === 'ArrowUp') { active = Math.max(0, active - 1); draw(); event.preventDefault(); }
    else if (event.key === 'Enter' && results[active]) { pick(results[active].id); event.preventDefault(); }
  });
  list.addEventListener('click', event => { const b = event.target.closest('[data-pick]'); if (b) pick(b.dataset.pick); });
  dlg.querySelector('[data-dialog-close]').addEventListener('click', () => dlg.close());
  draw();
  dlg.showModal();
  input.focus();
}

export const isPaletteShortcut = event => (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
