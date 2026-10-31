/* Navigatieschil: vaste onderbalk, bovenbalk met zoekknop, 'Meer'-tegels, subpagina's en URL-routes (#/pagina/subpagina).
   Eén navigatiesysteem: alle bestaande pagina's blijven bereikbaar via window.SamenThuisGo(pagina). */
(() => {
  'use strict';
  if (window.__ST_SHELL__ || !window.NavCore || typeof render !== 'function') return;
  window.__ST_SHELL__ = true;
  document.body.classList.add('st-shell');
  const NC = window.NavCore;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const P = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M19 9.5h-4a2 2 0 0 0 0 4h4"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
    chevron: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>',
    check: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    plane: '<path d="m21 4-9.5 9.5M21 4l-6.5 16-3-6.5L5 10.5z"/>',
    utensils: '<path d="M7 4v7a2 2 0 0 0 2 2v7M5 4v5M9 4v5M17 20V4c-2 1.5-3 4-3 7h3"/>',
    cart: '<path d="M3.5 5h2.5l2 10h9.5l2-7.5H7"/><circle cx="10" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/>',
    tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.2"/>',
    box: '<path d="M4 8h16v11.5H4zM3 4.5h18V8H3zM10 12h4"/>',
    repeat: '<path d="M4 11V9.5A2.5 2.5 0 0 1 6.5 7H18l-2.5-2.5M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H6l2.5 2.5"/>',
    house: '<path d="M4 20V9.5L12 4l8 5.5V20z"/><path d="M9.5 20v-6h5v6"/>',
    tv: '<rect x="3.5" y="6" width="17" height="11.5" rx="2"/><path d="M9 20.5h6M12 17.5v3"/>',
    car: '<path d="M5 16.5V12l1.8-5h10.4L19 12v4.5zM5 16.5v2.5M19 16.5v2.5M5 12h14"/><circle cx="8.3" cy="14.3" r=".6"/><circle cx="15.7" cy="14.3" r=".6"/>',
    upload: '<path d="M12 16V4.5M7.5 9 12 4.5 16.5 9M4.5 15v4.5h15V15"/>',
    sparkles: '<path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5L4.5 11 10 9zM19 3v3M17.5 4.5h3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-4 3.6-6 7.5-6s6.7 2 7.5 6"/>',
    users: '<circle cx="9" cy="9" r="3.3"/><path d="M3 19.5c.6-3.3 2.9-5 6-5s5.4 1.7 6 5M16 5.8a3.2 3.2 0 0 1 0 6.2M18.5 14.8c1.4.7 2.2 2.2 2.5 4.2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    sync: '<path d="M20 8A8.5 8.5 0 0 0 5.5 6.5M4 4v3.5h3.5M4 16a8.5 8.5 0 0 0 14.5 1.5M20 20v-3.5h-3.5"/>',
    database: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9M13 5v4M7 15v4"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12.5 16V8M17 16v-8"/>',
    receipt: '<path d="M6 3.5h12V21l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM9 8h6M9 12h6"/>',
    pie: '<path d="M12 4a8 8 0 1 0 8 8h-8z"/><path d="M15 3.5A8 8 0 0 1 20.5 9H15z"/>',
    piggy: '<path d="M5 12.5c0-3 3-5 6.5-5 3.7 0 7.5 2 7.5 5.2 0 1.7-1 3-2.4 3.8V19h-3v-1.2h-3.6V19h-3v-2.7C5.7 15.5 5 14.3 5 12.5zM19 12h2M15.5 11.2h.01"/>',
    list: '<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20"/><circle cx="4.5" cy="6.5" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="17.5" r=".8"/>',
    clipboard: '<rect x="5.5" y="5" width="13" height="16" rx="2.5"/><path d="M9 5V3.5h6V5M9 11h6M9 15h4"/>',
    book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5zM5 20.5A2.5 2.5 0 0 0 7.5 23H19"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>'
  };
  const icon = (name, cls = '') => `<svg class="st-ico ${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || P.more}</svg>`;
  window.SamenThuisIcon = icon;

  const baseGo = window.SamenThuisGo;
  let sub = null, subPage = null;       // actieve subpagina hoort bij subPage
  let idx = 0; const trail = {};        // positie in de geschiedenis, om de terugknop echt 'terug' te laten gaan
  const effectiveSub = () => (subPage === current ? sub : null);
  const hashFor = (page, s) => NC.formatRoute(page, s);
  const dateLabel = () => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  if (typeof sections === 'object' && !sections.meer) sections.meer = { label: 'Meer', icon: '≡' };

  /* ---------- Routing ---------- */
  function apply(route, focusId) {
    sub = route.sub; subPage = route.page;
    if (typeof baseGo === 'function') baseGo(route.page, focusId); else { current = route.page; render(); }
    window.scrollTo(0, 0);
  }
  function setRoute(page, s = null, focusId = '') {
    if (!NC.sectionOf(page)) return;
    const hash = hashFor(page, s);
    if (location.hash !== hash) { idx += 1; trail[idx] = hash; history.pushState({ st: 1, idx }, '', hash); }
    apply({ page, sub: s }, focusId);
  }
  window.SamenThuisGo = (page, focusId) => setRoute(page, null, focusId);
  window.SamenThuisGoSub = (page, s, focusId) => setRoute(page, s, focusId);
  window.addEventListener('popstate', e => {
    idx = (e.state && e.state.idx) || 0;
    const route = NC.parseRoute(location.hash) || { page: 'today', sub: null };
    apply(route);
  });
  function goBack() {
    const parent = NC.parentOf(current, effectiveSub());
    if (!parent) return;
    const target = hashFor(parent.page, parent.sub);
    if (idx > 0 && trail[idx - 1] === target) history.back(); else setRoute(parent.page, parent.sub);
  }
  // Rechtstreekse `current = x; render()` van oudere code houdt de URL ook bij.
  function syncUrl() {
    const hash = hashFor(current, effectiveSub());
    if (location.hash === hash || (!location.hash && current === 'today')) return;
    idx += 1; trail[idx] = hash; history.pushState({ st: 1, idx }, '', hash);
  }

  /* ---------- Hubs (tegels) ---------- */
  function tile(href, ico, title, desc) {
    return `<a class="st-tile" href="${esc(href)}"><span class="st-tile-ico">${icon(ico)}</span><span class="st-tile-text"><strong>${esc(title)}</strong>${desc ? `<small>${esc(desc)}</small>` : ''}</span></a>`;
  }
  function hubHtml(page) {
    if (page === 'meer') {
      return `<div class="st-hub">${NC.MORE_GROUPS.map(g => `<section class="st-group"><h2>${esc(g.title)}</h2><div class="st-tiles">${g.tiles.map(([p, i, l, d]) => tile(hashFor(p), i, l, d)).join('')}</div></section>`).join('')}</div>`;
    }
    const hub = NC.HUBS[page];
    return `<div class="st-hub"><section class="st-group"><div class="st-tiles">${hub.subs.map(s => tile(hashFor(page, s.key), s.icon, s.label, s.desc)).join('')}</div></section></div>`;
  }

  /* ---------- Subpagina's: een deel van de bestaande pagina tonen ---------- */
  const headTexts = el => {
    const eyebrow = el.querySelector('.eyebrow, header small, small'), head = el.querySelector('h1,h2,h3,h4');
    return [eyebrow && eyebrow.textContent.trim(), head && head.textContent.trim()].filter(Boolean);
  };
  function match(view, parts) {
    const found = new Set();
    for (const [selector, pattern] of parts) {
      const re = pattern ? new RegExp(pattern, 'i') : null;
      view.querySelectorAll(selector).forEach(el => { if (!re || headTexts(el).some(t => re.test(t))) found.add(el); });
    }
    return found;
  }
  const containsAny = (el, set) => { for (const k of set) if (k === el || el.contains(k)) return true; return false; };
  const insideAny = (el, set) => { for (const k of set) if (k.contains(el)) return true; return false; };
  function applySlice() {
    const view = $('#view'); if (!view) return;
    view.querySelectorAll('.st-hidden').forEach(el => el.classList.remove('st-hidden'));
    const page = current, s = effectiveSub(), hub = NC.HUBS[page], def = hub && NC.subOf(page, s);
    if (!def) return;
    const keep = match(view, def.parts);
    (hub.always || []).forEach(sel => view.querySelectorAll(sel).forEach(el => keep.add(el)));
    const hide = el => el.classList.add('st-hidden');
    if (def.catchAll) {
      const claimed = new Set();
      hub.subs.filter(o => o.key !== s).forEach(o => match(view, o.parts).forEach(el => claimed.add(el)));
      claimed.forEach(el => { if (!containsAny(el, keep) && !insideAny(el, keep)) hide(el); });
    } else {
      const walk = parent => [...parent.children].forEach(child => {
        if (keep.has(child) || insideAny(child, keep)) return;
        if (containsAny(child, keep)) walk(child); else hide(child);
      });
      walk(view);
    }
    // Containers waarvan alle kinderen verborgen zijn, verdwijnen mee.
    const prune = el => {
      const kids = [...el.children]; if (!kids.length) return false;
      kids.forEach(k => { if (k.children.length) prune(k); });
      if (kids.every(k => k.classList.contains('st-hidden'))) { hide(el); return true; }
      return false;
    };
    [...view.children].forEach(prune);
  }

  /* ---------- Chrome: onderbalk, kop, kruimelpad ---------- */
  function ensureNav() {
    let nav = $('#stNav');
    if (!nav) { nav = document.createElement('nav'); nav.id = 'stNav'; nav.className = 'st-nav'; nav.setAttribute('aria-label', 'Hoofdnavigatie'); document.body.append(nav); }
    return nav;
  }
  function paintNav() {
    const cur = NC.sectionOf(current);
    ensureNav().innerHTML = NC.SECTIONS.map(s => {
      const on = cur && cur.key === s.key;
      return `<a href="${hashFor(s.pages[0][0])}" data-st-section="${s.key}" class="${on ? 'active' : ''}" ${on ? 'aria-current="page"' : ''}>${icon(s.icon)}<span>${esc(s.label)}</span></a>`;
    }).join('');
  }
  function ensureBar() {
    let bar = $('#stCrumbs');
    if (!bar) { bar = document.createElement('div'); bar.id = 'stCrumbs'; bar.className = 'st-crumbs'; const v = $('#view'); v.parentNode.insertBefore(bar, v); }
    return bar;
  }
  function ensureHub() {
    let hub = $('#stHub');
    if (!hub) { hub = document.createElement('div'); hub.id = 'stHub'; const v = $('#view'); v.parentNode.insertBefore(hub, v); }
    return hub;
  }
  function paintChrome() {
    const page = current, s = effectiveSub(), section = NC.sectionOf(page);
    if (!section) return;
    const hubMode = NC.isHub(page) && !(NC.HUBS[page] && s) ;
    const title = $('#pageTitle'), eyebrow = $('#eyebrow');
    if (page === 'today') { if (title) title.textContent = 'Vandaag'; if (eyebrow) eyebrow.textContent = dateLabel(); }
    else {
      if (title) title.textContent = s ? NC.titleOf(page, s) : (NC.HUBS[page] ? NC.HUBS[page].title : NC.pageLabel(page));
      if (eyebrow) eyebrow.textContent = NC.categoryOf(page, s);
    }
    document.title = `${title ? title.textContent : 'Samen Thuis'} · Samen Thuis`;
    const parent = NC.parentOf(page, s), back = $('#stBack');
    if (back) back.hidden = !parent, back.setAttribute('aria-label', parent ? `Terug naar ${NC.titleOf(parent.page, parent.sub) || 'Meer'}` : 'Terug');
    const add = $('#addBtn');
    if (add) { let can = false; try { can = !hubMode && !s && typeof formConfig === 'function' && !!formConfig(page); } catch (_) {} add.style.display = can ? '' : 'none'; }

    const crumbs = NC.crumbs(page, s);
    const tabs = section.key === 'vandaag' ? `<div class="st-tabs" role="tablist">${section.pages.map(([k, l]) => `<a role="tab" href="${hashFor(k)}" aria-selected="${k === page}" class="${k === page ? 'active' : ''}">${esc(l)}</a>`).join('')}</div>` : '';
    const trailHtml = crumbs.length > 1 ? `<nav class="st-trail" aria-label="Kruimelpad">${crumbs.map((c, i) => i === crumbs.length - 1 ? `<strong aria-current="page">${esc(c.label)}</strong>` : `<a href="${hashFor(c.page, c.sub)}">${esc(c.label)}</a>`).join('<span aria-hidden="true">›</span>')}</nav>` : '';
    const searchBar = (page === 'today' || page === 'meer') ? `<button type="button" class="st-searchbar" data-st-search aria-label="Zoeken in Samen Thuis">${icon('search')}<span>Zoek in agenda, financiën, sport en meer…</span><kbd>Ctrl K</kbd></button>` : '';
    const bar = ensureBar();
    bar.innerHTML = `${searchBar}${trailHtml}${tabs}`;
    bar.hidden = !bar.innerHTML;
    paintNav();
  }

  /* ---------- Render-haak ---------- */
  const baseRender = render;
  render = function (...args) {
    const page = current, s = effectiveSub();
    const hubMode = NC.isHub(page) && !(NC.HUBS[page] && s);
    const view = $('#view'), hub = ensureHub();
    let result;
    if (hubMode) {
      hub.innerHTML = hubHtml(page); hub.hidden = false; view.hidden = true;
      if (typeof updateSyncBadge === 'function') updateSyncBadge();
    } else {
      hub.hidden = true; view.hidden = false;
      result = baseRender.apply(this, args);
      applySlice();
    }
    try { syncUrl(); paintChrome(); } catch (_) {}
    requestAnimationFrame(() => { try { paintChrome(); } catch (_) {} });
    setTimeout(() => { try { paintChrome(); } catch (_) {} }, 160);
    return result;
  };
  // Later toegevoegde blokken (bijv. persoonlijke accountkaart) krijgen dezelfde subpagina-filter.
  let pending = 0;
  new MutationObserver(() => {
    if (pending || !effectiveSub()) return;
    pending = requestAnimationFrame(() => { pending = 0; try { applySlice(); } catch (_) {} });
  }).observe($('#view'), { childList: true, subtree: true });

  /* ---------- Gebeurtenissen ---------- */
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.target.closest('#stBack')) { e.preventDefault(); goBack(); return; }
    const a = e.target.closest('a[href^="#/"]');
    if (!a) return;
    const route = NC.parseRoute(a.getAttribute('href'));
    if (!route) return;
    e.preventDefault();
    if (a.dataset.stSection && current === route.page && !route.sub && !effectiveSub()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setRoute(route.page, route.sub);
  });

  document.querySelectorAll('[data-st-icon]').forEach(el => { el.innerHTML = icon(el.dataset.stIcon); });
  paintNav();
  // Startpagina: deep link uit de URL of standaard Vandaag.
  const start = NC.parseRoute(location.hash);
  history.replaceState({ st: 1, idx: 0 }, '', start ? hashFor(start.page, start.sub) : location.pathname + location.search + location.hash);
  trail[0] = location.hash;
  if (start && !(start.page === 'today' && !start.sub)) apply(start); else render();
})();
