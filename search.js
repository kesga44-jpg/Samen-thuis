/* Zoekvenster voor heel Samen Thuis. Opent via de zoekknop in de bovenbalk, de zoekbalk op Vandaag/Meer of Ctrl/Cmd+K. */
(() => {
  'use strict';
  const core = window.SamenThuisSearchCore, NC = window.NavCore;
  if (window.__ST_SEARCH__ || !core || !NC || typeof data === 'undefined') return;
  window.__ST_SEARCH__ = true;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls) => (window.SamenThuisIcon ? window.SamenThuisIcon(name, cls) : '');
  let dlg, input, out, timer, active = -1;

  function build() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'stSearchDialog'; dlg.className = 'st-search'; dlg.setAttribute('aria-label', 'Zoeken');
    dlg.innerHTML = `<div class="st-search-head"><label class="st-search-field">${icon('search')}<input id="stSearchInput" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Zoek in alle onderdelen…" aria-label="Zoekterm"></label><button type="button" class="st-search-close" data-st-search-close>Sluiten</button></div><div id="stSearchOut" class="st-search-out" aria-live="polite"></div>`;
    document.body.append(dlg);
    input = dlg.querySelector('#stSearchInput'); out = dlg.querySelector('#stSearchOut');
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 100); });
    input.addEventListener('keydown', onKey);
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('[data-st-search-close]')) { dlg.close(); return; }
      const a = e.target.closest('a[data-st-result]');
      if (a) { e.preventDefault(); openResult(a); }
    });
    dlg.addEventListener('close', () => { input.value = ''; out.innerHTML = ''; active = -1; });
    return dlg;
  }

  function options() {
    const access = window.SamenThuisSportAccess;
    return { canManagePerson: access && access.canManagePerson ? person => { try { return access.canManagePerson(person); } catch (_) { return false; } } : null };
  }

  function run() {
    const q = input.value.trim();
    active = -1;
    if (!q) { hint(); return; }
    let groups = [];
    try { groups = core.search(data, q, options()); } catch (_) { groups = []; }
    if (!groups.length) { out.innerHTML = `<p class="st-search-empty">Geen resultaten voor “${esc(q)}”. Probeer een kortere zoekterm.</p>`; return; }
    out.innerHTML = groups.map(g => `<section class="st-search-group"><h3>${icon(g.icon)}<span>${esc(g.label)}</span><small>${g.total}</small></h3><ul>${g.results.map(r =>
      `<li><a data-st-result data-page="${esc(r.page)}" data-sub="${esc(r.sub || '')}" data-id="${esc(r.id || '')}" href="${esc(NC.formatRoute(r.page, r.sub))}"><strong>${esc(r.title)}</strong>${r.subtitle ? `<small>${esc(r.subtitle)}</small>` : ''}</a></li>`).join('')}</ul></section>`).join('');
  }
  function hint() {
    const links = [['planning', 'Agenda'], ['groceries', 'Boodschappen'], ['budget19', 'Financiën'], ['sportcoach', 'Sport'], ['settings', 'Instellingen']];
    out.innerHTML = `<p class="st-search-empty">Zoek in agenda, boodschappen, voorraad, financiën, sport, reizen en meer. Resultaten staan per onderdeel.</p><div class="st-search-quick">${links.map(([p, l]) => `<a data-st-result data-page="${p}" data-sub="" data-id="" href="${NC.formatRoute(p)}">${esc(l)}</a>`).join('')}</div>`;
  }

  function openResult(a) {
    const page = a.dataset.page, sub = a.dataset.sub || null, id = a.dataset.id || '';
    dlg.close();
    if (sub && window.SamenThuisGoSub) window.SamenThuisGoSub(page, sub, id); else if (window.SamenThuisGo) window.SamenThuisGo(page, id);
    if (id) setTimeout(() => {
      const el = document.querySelector(`#view [data-id="${CSS.escape(id)}"],#view [data-edit="${CSS.escape(id)}"],#view [id="${CSS.escape(id)}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('st-found'); setTimeout(() => el.classList.remove('st-found'), 2200); }
    }, 250);
  }

  function onKey(e) {
    const items = [...out.querySelectorAll('a[data-st-result]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('st-active', i === active));
      items[active].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const target = items[active >= 0 ? active : 0];
      if (target) { e.preventDefault(); openResult(target); }
    }
  }

  function open() {
    build();
    if (!dlg.open) dlg.showModal();
    hint();
    input.focus();
    input.select();
  }
  window.SamenThuisSearch = { open, close: () => dlg && dlg.open && dlg.close() };

  document.addEventListener('click', e => { if (e.target.closest('[data-st-search]')) { e.preventDefault(); open(); } });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      if (dlg && dlg.open) dlg.close(); else open();
    }
  });
})();
